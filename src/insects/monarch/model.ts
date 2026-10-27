import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { monarchConfig } from "./config";
import {
  applyWingUVs,
  monarchWingTexture,
  wingBounds,
  wingOutline,
  type WingKind,
} from "./texture";
import type { InsectRig, WingAngles } from "../types";
import { ellipseShadow, outlineShadow, ShadowRig } from "../../render/soft-shadow";

const HIND_SPAN = 0.88;

function wingGeometry(kind: WingKind, span: number): ShapeGeometry {
  const pts = wingOutline(kind);
  const geo = new ShapeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x * span, y * span))));
  applyWingUVs(geo, wingBounds(pts, span));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, pos.getX(i) / span);
    pos.setZ(i, 0.015 * Math.sin(u * Math.PI) * span);
  }
  geo.computeVertexNormals();
  return geo;
}

function wingMaterial(kind: WingKind): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map: monarchWingTexture(kind),
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function bodyMaterial(color: string, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

/** Gaussian sigma of the shadow in wing units (the wingspan is ~2 units). */
const SHADOW_BLUR = 0.2;
const SHADOW_OFFSET = { x: 0.04, y: -0.14 };
const SHADOW_OPACITY = 0.05;

function wingShadow(kind: WingKind, span: number): Mesh {
  const pts = wingOutline(kind).map(([x, y]): [number, number] => [x * span, y * span]);
  return outlineShadow(pts, SHADOW_BLUR, SHADOW_OPACITY);
}

export function createMonarchRig(): InsectRig {
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
  const bodyShadow = ellipseShadow(0.08, 0.62, SHADOW_BLUR, SHADOW_OPACITY);
  bodyShadow.position.y = -0.1;
  sBody.add(bodyShadow);
  root.add(shadow.root);

  const black = bodyMaterial("#15100c", 0.55);
  const thorax = new Mesh(new SphereGeometry(0.085, 18, 14), black);
  thorax.scale.set(0.88, 1.32, 0.92);
  thorax.position.y = 0.02;
  body.add(thorax);

  const head = new Mesh(new SphereGeometry(0.055, 16, 12), black);
  head.position.set(0, 0.15, 0.01);
  body.add(head);

  const eyeMat = bodyMaterial("#2a1a10", 0.3);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.024, 10, 8), eyeMat);
    eye.position.set(side * 0.04, 0.165, 0.025);
    body.add(eye);
  }

  const abdomen = new Mesh(new SphereGeometry(0.05, 14, 12), black);
  abdomen.scale.set(0.74, 3.5, 0.76);
  abdomen.position.y = -0.215;
  body.add(abdomen);

  const dotMat = bodyMaterial("#f2eadb", 0.45);
  const dot = (x: number, y: number, z: number, r: number) => {
    const m = new Mesh(new SphereGeometry(r, 8, 6), dotMat);
    m.position.set(x, y, z);
    body.add(m);
  };
  dot(-0.03, 0.07, 0.07, 0.009);
  dot(0.03, 0.07, 0.07, 0.009);
  dot(-0.04, -0.01, 0.065, 0.009);
  dot(0.04, -0.01, 0.065, 0.009);
  dot(0, 0.09, 0.075, 0.008);
  dot(-0.022, 0.18, 0.04, 0.007);
  dot(0.022, 0.18, 0.04, 0.007);
  for (let i = 0; i < 4; i++) {
    const y = -0.1 - i * 0.06;
    const r = 0.03 - i * 0.0035;
    dot(-r, y, 0.02, 0.006);
    dot(r, y, 0.02, 0.006);
  }

  const antennaMat = bodyMaterial("#120c08", 0.4);
  for (const side of [-1, 1]) {
    const curve = new QuadraticBezierCurve3(
      new Vector3(side * 0.02, 0.19, 0.03),
      new Vector3(side * 0.055, 0.31, 0.05),
      new Vector3(side * 0.095, 0.42, 0.03),
    );
    body.add(new Mesh(new TubeGeometry(curve, 16, 0.0045, 5, false), antennaMat));
    const club = new Mesh(new SphereGeometry(0.011, 8, 6), antennaMat);
    club.scale.set(1, 1.6, 1);
    club.position.copy(curve.getPoint(1));
    body.add(club);
  }

  const foreGeo = wingGeometry("fore", 1);
  const hindGeo = wingGeometry("hind", HIND_SPAN);

  const makeSide = (mirror: boolean) => {
    const side = new Group();
    if (mirror) side.scale.x = -1;
    const foreMat = wingMaterial("fore");
    const hindMat = wingMaterial("hind");
    const fore = new Group();
    const hind = new Group();
    fore.position.set(0.02, 0.04, 0);
    hind.position.set(0.02, -0.03, -0.002);
    const foreMesh = new Mesh(foreGeo, foreMat);
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
    sFore.add(wingShadow("fore", 1));
    sHind.add(wingShadow("hind", HIND_SPAN));
    sSide.add(sHind, sFore);
    sBody.add(sSide);
    return { fore, hind, foreMat, hindMat, sFore, sHind };
  };
  const left = makeSide(true);
  const right = makeSide(false);
  shadow.collect();

  const hotspot = monarchConfig.model.hotspot;
  inner.position.set(hotspot.x, hotspot.y, hotspot.z);
  shadow.inner.position.copy(inner.position);
  pose.rotation.x = monarchConfig.model.tilt;
  shadow.pose.rotation.x = pose.rotation.x;

  const shade = (angle: number) => 1 - 0.32 * Math.sin(Math.min(Math.max(angle, 0), 1.5));

  return {
    id: "monarch",
    group: root,
    setFlap(a: WingAngles) {
      left.fore.rotation.y = -a.leftFore;
      right.fore.rotation.y = -a.rightFore;
      left.hind.rotation.y = -a.leftHind;
      right.hind.rotation.y = -a.rightHind;
      left.foreMat.color.setScalar(shade(a.leftFore));
      right.foreMat.color.setScalar(shade(a.rightFore));
      left.hindMat.color.setScalar(shade(a.leftHind) * 0.97);
      right.hindMat.color.setScalar(shade(a.rightHind) * 0.97);
      left.sFore.rotation.y = left.fore.rotation.y;
      right.sFore.rotation.y = right.fore.rotation.y;
      left.sHind.rotation.y = left.hind.rotation.y;
      right.sHind.rotation.y = right.hind.rotation.y;
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
