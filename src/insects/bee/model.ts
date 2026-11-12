import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { applyPlanarUVs } from "../../core/outline";
import { ellipseShadow, outlineShadow, ShadowRig } from "../../render/soft-shadow";
import type { InsectRig, WingAngles } from "../types";
import { beeConfig } from "./config";
import { bandTexture, FUR, hairTexture, wingBounds, wingOutline, wingTexture, type WingKind } from "./textures";

const SHADOW_OFFSET = { x: 0.04, y: -0.14 };
const BODY_SHADOW = 0.06;
const WING_SHADOW = 0.02;

const FUR_SHELLS = 12;
const FUR_LENGTH = 0.065;

/** Hinges on top of the thorax; the hindwing sits just behind and below the forewing. */
const WING_ROOT: Record<WingKind, [number, number, number]> = {
  fore: [0.12, 0.2, 0.16],
  hind: [0.12, 0.1, 0.15],
};
/** Mean sweep back from straight out, and how far each beat swings the wing fore and aft. */
const SWEEP_BASE: Record<WingKind, number> = { fore: -0.22, hind: -0.42 };
const SWEEP_PER_RAD = 0.55;
/** Faint copies at the ends of the stroke read as the blur of a buzzing wing. */
const BLUR_OPACITY = 0.07;

/**
 * Shell fur: a solid undercoat plus stacked, slightly larger copies whose hair-height mask keeps
 * fewer texels further out, so the silhouette breaks up into soft tufts with lighter tips.
 */
function furBall(radius: number, scale: [number, number, number], bands: CanvasTexture): Group {
  const g = new Group();
  g.scale.set(...scale);
  const geo = new SphereGeometry(radius, 32, 22);
  const base = new MeshStandardMaterial({ map: bands, roughness: 1, metalness: 0 });
  base.color.setScalar(0.45);
  g.add(new Mesh(geo, base));
  const hair = hairTexture();
  hair.wrapS = hair.wrapT = RepeatWrapping;
  hair.repeat.set(18, 10);
  for (let i = 1; i <= FUR_SHELLS; i++) {
    const f = i / FUR_SHELLS;
    const mat = new MeshStandardMaterial({
      map: bands,
      alphaMap: hair,
      alphaTest: 0.06 + 0.86 * f,
      roughness: 1,
      metalness: 0,
    });
    // Darker near the skin, lighter at the tips: depth in the pile and a soft fringe on dark pages.
    mat.color.setScalar(0.5 + 0.9 * f);
    mat.emissive.set("#5a4e42").multiplyScalar(f * f * 0.35);
    const shell = new Mesh(geo, mat);
    shell.scale.setScalar(1 + (f * FUR_LENGTH) / radius);
    g.add(shell);
  }
  return g;
}

function wingGeometry(kind: WingKind): ShapeGeometry {
  const pts = wingOutline(kind);
  const geo = new ShapeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))));
  applyPlanarUVs(geo, wingBounds(kind));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, pos.getX(i) / 0.86));
    pos.setZ(i, 0.012 * Math.sin(u * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

function tube(points: [number, number, number][], radius: number, mat: MeshStandardMaterial): Mesh {
  const [a, b, c] = points.map(([x, y, z]) => new Vector3(x, y, z));
  return new Mesh(new TubeGeometry(new QuadraticBezierCurve3(a, b, c), 10, radius, 6, false), mat);
}

export function createBeeRig(): InsectRig {
  const root = new Group();
  const headingNode = new Group();
  const pose = new Group();
  const inner = new Group();
  const body = new Group();
  root.add(headingNode);
  headingNode.add(pose);
  pose.add(inner);
  inner.add(body);

  const shadow = new ShadowRig(SHADOW_OFFSET);
  const bodyShadow = ellipseShadow(0.5, 1.05, 0.12, BODY_SHADOW);
  bodyShadow.position.y = -0.05;
  shadow.body.add(bodyShadow);
  root.add(shadow.root);

  // Bombus terrestris colours: yellow collar, black thorax, one yellow band, white tail.
  const thorax = furBall(0.22, [1.08, 1.0, 0.92], bandTexture([[0, FUR.yellow], [0.4, FUR.black]]));
  thorax.position.set(0, 0.13, 0);
  body.add(thorax);
  const abdomen = furBall(
    0.25,
    [1.0, 1.3, 0.88],
    bandTexture([[0, FUR.black], [0.3, FUR.yellow], [0.47, FUR.black], [0.68, FUR.white]]),
  );
  abdomen.position.set(0, -0.36, -0.02);
  body.add(abdomen);
  const head = furBall(0.12, [1.15, 0.85, 0.95], bandTexture([[0, FUR.black]]));
  head.position.set(0, 0.43, 0.0);
  body.add(head);

  const eyeMat = new MeshStandardMaterial({ color: "#1c1815", roughness: 0.18, metalness: 0.25 });
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.06, 16, 12), eyeMat);
    eye.scale.set(0.55, 1.15, 0.8);
    eye.position.set(side * 0.1, 0.44, 0.03);
    body.add(eye);
  }

  const chitin = new MeshStandardMaterial({ color: "#3a332e", roughness: 0.5, metalness: 0.05 });
  // Elbowed antennae: a short scape up from the face, then the flagellum angled out.
  for (const side of [-1, 1]) {
    body.add(tube([[side * 0.04, 0.5, 0.06], [side * 0.05, 0.56, 0.08], [side * 0.07, 0.6, 0.08]], 0.011, chitin));
    body.add(tube([[side * 0.07, 0.6, 0.08], [side * 0.12, 0.66, 0.07], [side * 0.18, 0.68, 0.04]], 0.01, chitin));
  }

  // Legs hang beneath; the hind pair trails beside the abdomen with orange pollen baskets.
  const pollen = new MeshStandardMaterial({ color: "#f0962a", roughness: 0.8 });
  for (const side of [-1, 1]) {
    body.add(tube([[side * 0.1, 0.22, -0.12], [side * 0.22, 0.3, -0.16], [side * 0.26, 0.38, -0.18]], 0.013, chitin));
    body.add(tube([[side * 0.12, 0.1, -0.13], [side * 0.28, 0.08, -0.17], [side * 0.32, 0.0, -0.2]], 0.013, chitin));
    body.add(tube([[side * 0.12, 0.0, -0.13], [side * 0.27, -0.15, -0.18], [side * 0.3, -0.36, -0.2]], 0.016, chitin));
    const basket = new Mesh(new SphereGeometry(0.045, 14, 10), pollen);
    basket.scale.set(0.8, 1.3, 0.8);
    basket.position.set(side * 0.29, -0.27, -0.19);
    body.add(basket);
  }

  const makeSide = (mirror: boolean) => {
    const side = new Group();
    const sSide = new Group();
    if (mirror) {
      side.scale.x = -1;
      sSide.scale.x = -1;
    }
    const make = (kind: WingKind, order: number) => {
      const geo = wingGeometry(kind);
      const mat = new MeshBasicMaterial({
        map: wingTexture(kind),
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const [rx, ry, rz] = WING_ROOT[kind];
      const sweep = new Group();
      sweep.position.set(rx, ry, rz);
      const flap = new Group();
      sweep.add(flap);
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = order;
      flap.add(mesh);
      side.add(sweep);

      const blurMat = mat.clone();
      blurMat.opacity = BLUR_OPACITY;
      for (const k of [-1, 1]) {
        const ghost = new Mesh(geo, blurMat);
        ghost.renderOrder = order - 0.5;
        const holder = new Group();
        holder.position.copy(sweep.position);
        holder.rotation.z = SWEEP_BASE[kind] + k * 0.3 * SWEEP_PER_RAD;
        holder.add(ghost);
        side.add(holder);
      }

      const sSweep = new Group();
      sSweep.position.copy(sweep.position);
      const sFlap = new Group();
      sSweep.add(sFlap);
      sFlap.add(outlineShadow(wingOutline(kind), 0.1, WING_SHADOW));
      sSide.add(sSweep);
      return { kind, sweep, flap, mat, sSweep, sFlap };
    };
    const hind = make("hind", 1);
    const fore = make("fore", 2);
    body.add(side);
    shadow.body.add(sSide);
    return { fore, hind };
  };
  const left = makeSide(true);
  const right = makeSide(false);
  shadow.collect();

  const hotspot = beeConfig.model.hotspot;
  inner.position.set(hotspot.x, hotspot.y, hotspot.z);
  shadow.inner.position.copy(inner.position);
  pose.rotation.x = beeConfig.model.tilt;
  shadow.pose.rotation.x = pose.rotation.x;

  const setWing = (w: typeof left.fore, angle: number) => {
    const sweep = SWEEP_BASE[w.kind] + angle * SWEEP_PER_RAD;
    const lift = -0.25 * angle;
    w.sweep.rotation.z = sweep;
    w.flap.rotation.y = lift;
    w.sSweep.rotation.z = sweep;
    w.sFlap.rotation.y = lift;
    // Barely-varying shade so the membrane doesn't flicker on every beat.
    w.mat.color.setScalar(1 - 0.05 * Math.abs(Math.sin(angle)));
  };

  return {
    id: "bee",
    group: root,
    setFlap(a: WingAngles) {
      setWing(left.fore, a.leftFore);
      setWing(right.fore, a.rightFore);
      setWing(left.hind, a.leftHind);
      setWing(right.hind, a.rightHind);
    },
    setBody(pitch: number) {
      body.rotation.x = pitch;
      shadow.body.rotation.x = pitch;
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
