import {
  BufferAttribute,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from "three";
import { lunaMothConfig } from "./config";
import {
  antennaBounds,
  antennaTexture,
  lunaWingTexture,
  TAIL_FROM_Y,
  wingBounds,
  wingOutline,
  type WingKind,
} from "./texture";
import type { InsectRig, WingAngles } from "../types";
import { ellipseShadow, outlineShadow, ShadowRig } from "../../render/soft-shadow";

/** Wing plane on a grid (so the tail can bend), cut out by the texture's alpha. */
function wingGeometry(kind: WingKind): PlaneGeometry {
  const b = wingBounds(kind);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const geo = new PlaneGeometry(w, h, 24, kind === "hind" ? 60 : 24);
  geo.translate((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, pos.getX(i) / 0.95));
    pos.setZ(i, 0.018 * Math.sin(u * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

function wingMaterial(kind: WingKind): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map: lunaWingTexture(kind),
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function furMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
}

const SHADOW_BLUR = 0.2;
const SHADOW_OFFSET = { x: 0.04, y: -0.14 };
const SHADOW_OPACITY = 0.05;

/** Forewings sweep up and out from the shoulder, tips held above the body. */
const FORE_RAISE = 0.3;

/**
 * Tail dynamics, per frame: an underdamped spring chasing the hindwing angle, so the tails whip
 * past the stroke and swing back. Lag bends them out of the wing plane and sideways.
 */
const TAIL_STIFFNESS = 0.16;
const TAIL_DAMPING = 0.78;
const TAIL_BEND = 0.5;
const TAIL_SWING = 0.26;
/** Slow idle sway so the tails never hang dead still. */
const TAIL_SWAY = 0.04;

export function createLunaMothRig(): InsectRig {
  const root = new Group();
  const headingNode = new Group();
  const pose = new Group();
  const inner = new Group();
  root.add(headingNode);
  headingNode.add(pose);
  pose.add(inner);
  const body = new Group();
  inner.add(body);

  const shadow = new ShadowRig(SHADOW_OFFSET);
  const sBody = shadow.body;
  const bodyShadow = ellipseShadow(0.13, 0.62, SHADOW_BLUR, SHADOW_OPACITY);
  bodyShadow.position.y = -0.1;
  sBody.add(bodyShadow);
  root.add(shadow.root);

  // Woolly white body with a maroon collar that continues the forewing costa across the thorax.
  const thorax = new Mesh(new SphereGeometry(0.09, 20, 16), furMaterial("#f0eacb"));
  thorax.scale.set(0.95, 1.25, 0.9);
  thorax.position.y = 0.01;
  body.add(thorax);
  const collar = new Mesh(new SphereGeometry(0.08, 18, 12), furMaterial("#7c2f3e"));
  collar.scale.set(1.08, 0.36, 0.95);
  collar.position.set(0, 0.075, 0.006);
  body.add(collar);
  const head = new Mesh(new SphereGeometry(0.05, 16, 12), furMaterial("#e9e1c4"));
  head.position.set(0, 0.15, 0.01);
  body.add(head);
  const eyeMat = new MeshStandardMaterial({ color: "#3b2a20", roughness: 0.35 });
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.021, 10, 8), eyeMat);
    eye.position.set(side * 0.037, 0.165, 0.02);
    body.add(eye);
  }
  // Overlapping tufts read as a plush, segmented abdomen rather than a smooth capsule.
  const abdomenMat = furMaterial("#f6f4ec");
  for (let i = 0; i < 9; i++) {
    const r = 0.066 - i * 0.0045;
    const tuft = new Mesh(new SphereGeometry(r, 16, 12), abdomenMat);
    tuft.scale.set(1, 1.2, 0.85);
    tuft.position.set(0, -0.1 - i * 0.04, -0.003 * i);
    body.add(tuft);
  }

  const ab = antennaBounds();
  const antennaGeo = new PlaneGeometry(ab.maxX - ab.minX, ab.maxY - ab.minY);
  antennaGeo.translate((ab.minX + ab.maxX) / 2, (ab.minY + ab.maxY) / 2, 0);
  const antennaMat = new MeshBasicMaterial({
    map: antennaTexture(),
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  for (const side of [-1, 1]) {
    const antenna = new Mesh(antennaGeo, antennaMat);
    antenna.position.set(side * 0.02, 0.17, 0.04);
    antenna.rotation.set(-0.3, 0, -side * 0.45);
    antenna.scale.setScalar(0.68);
    antenna.renderOrder = 3;
    body.add(antenna);
  }

  const foreGeo = wingGeometry("fore");
  const hb = wingBounds("hind");
  const tailLen = TAIL_FROM_Y - hb.minY;

  const makeSide = (mirror: boolean) => {
    const side = new Group();
    if (mirror) side.scale.x = -1;
    const foreMat = wingMaterial("fore");
    const hindMat = wingMaterial("hind");
    const fore = new Group();
    const hind = new Group();
    fore.position.set(0.02, 0.05, 0);
    hind.position.set(0.02, 0.05, -0.002);
    const hindGeo = wingGeometry("hind");
    const rest = (hindGeo.attributes.position.array as Float32Array).slice();
    const foreMesh = new Mesh(foreGeo, foreMat);
    foreMesh.rotation.z = FORE_RAISE;
    const hindMesh = new Mesh(hindGeo, hindMat);
    foreMesh.renderOrder = 2;
    hindMesh.renderOrder = 1;
    fore.add(foreMesh);
    hind.add(hindMesh);
    side.add(hind, fore);
    body.add(side);

    const sSide = new Group();
    if (mirror) sSide.scale.x = -1;
    const sFore = new Group();
    const sHind = new Group();
    sFore.position.copy(fore.position);
    sHind.position.copy(hind.position);
    const foreShadow = outlineShadow(wingOutline("fore"), SHADOW_BLUR, SHADOW_OPACITY);
    foreShadow.rotation.z = FORE_RAISE;
    sFore.add(foreShadow);
    sHind.add(outlineShadow(wingOutline("hind"), SHADOW_BLUR, SHADOW_OPACITY));
    sSide.add(sHind, sFore);
    sBody.add(sSide);

    let lagged = 0;
    let lagVel = 0;
    let swayPhase = mirror ? 0 : 1.7;
    const pos = hindGeo.attributes.position as BufferAttribute;
    /** Bend the tail toward where the wing was, so it streams and whips behind each stroke. */
    let primed = false;
    const bendTail = (angle: number) => {
      if (!primed) {
        lagged = angle;
        primed = true;
      }
      lagVel = (lagVel + (angle - lagged) * TAIL_STIFFNESS) * TAIL_DAMPING;
      lagged += lagVel;
      swayPhase += 0.045;
      const lag = lagged - angle;
      const bend = lag * TAIL_BEND;
      const swing = lag * TAIL_SWING + Math.sin(swayPhase) * TAIL_SWAY;
      for (let i = 0; i < pos.count; i++) {
        const y = rest[i * 3 + 1];
        if (y >= TAIL_FROM_Y) continue;
        const t = (TAIL_FROM_Y - y) / tailLen;
        const k = t * t * tailLen;
        pos.setX(i, rest[i * 3] + swing * k);
        pos.setZ(i, rest[i * 3 + 2] + bend * k);
      }
      pos.needsUpdate = true;
    };
    return { fore, hind, foreMat, hindMat, sFore, sHind, bendTail };
  };
  const left = makeSide(true);
  const right = makeSide(false);
  shadow.collect();

  const hotspot = lunaMothConfig.model.hotspot;
  inner.position.set(hotspot.x, hotspot.y, hotspot.z);
  shadow.inner.position.copy(inner.position);
  pose.rotation.x = lunaMothConfig.model.tilt;
  shadow.pose.rotation.x = pose.rotation.x;

  const shade = (angle: number) => 1 - 0.3 * Math.sin(Math.min(Math.max(angle, 0), 1.5));

  return {
    id: "luna-moth",
    group: root,
    setFlap(a: WingAngles) {
      for (const [side, fore, hind] of [
        [left, a.leftFore, a.leftHind],
        [right, a.rightFore, a.rightHind],
      ] as const) {
        side.fore.rotation.y = -fore;
        side.hind.rotation.y = -hind;
        side.foreMat.color.setScalar(shade(fore));
        side.hindMat.color.setScalar(shade(hind) * 0.97);
        side.sFore.rotation.y = side.fore.rotation.y;
        side.sHind.rotation.y = side.hind.rotation.y;
        side.bendTail(hind);
      }
    },
    setBody(pitch: number) {
      body.rotation.x = pitch;
      sBody.rotation.x = pitch;
    },
    setHeading(heading: number, bank: number) {
      headingNode.rotation.z = -heading;
      shadow.heading.rotation.z = -heading;
      pose.rotation.y = bank;
      shadow.pose.rotation.y = bank;
    },
    setLift(lift: number) {
      shadow.setLift(lift);
    },
  };
}
