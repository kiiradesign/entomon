import {
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { applyPlanarUVs } from "../../core/outline";
import { ellipseShadow, outlineShadow, ShadowRig } from "../../render/soft-shadow";
import type { InsectRig, WingAngles } from "../types";
import { dragonflyConfig } from "./config";
import { dragonflyWingTexture, WING_ROOT, wingBounds, wingOutline, type WingKind } from "./wings";

const SHADOW_OFFSET = { x: 0.04, y: -0.14 };
const BODY_SHADOW = 0.05;
/** Membranes pass most light, so wing shadows are a faint tint next to the body's. */
const WING_SHADOW = 0.02;

const ABDOMEN_TOP = -0.15;
const ABDOMEN_TIP = -1.22;
/** Normalised position from the abdomen base (0) to the tip (1) of each segment boundary, S1..S10. */
const SEGMENTS = [0, 0.03, 0.11, 0.21, 0.315, 0.42, 0.525, 0.63, 0.73, 0.83, 0.92, 1];

function wingGeometry(kind: WingKind): ShapeGeometry {
  const pts = wingOutline(kind);
  const geo = new ShapeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))));
  applyPlanarUVs(geo, wingBounds(kind));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, pos.getX(i)));
    pos.setZ(i, 0.01 * Math.sin(u * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

function abdomenTexture(): CanvasTexture {
  const W = 128;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const segY = (s: number) => s * H;

  // u = 0 / 1 is the dorsal midline (facing the viewer), u = 0.5 the belly.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#3d8fe6");
  grad.addColorStop(0.12, "#3584e0");
  grad.addColorStop(0.5, "#2c70cc");
  grad.addColorStop(0.82, "#285fb0");
  grad.addColorStop(1, "#1f4680");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(14, 24, 44, 0.6)";
  ctx.fillRect(W * 0.32, 0, W * 0.36, H);

  ctx.fillStyle = "#5f8a3c";
  ctx.fillRect(0, 0, W, segY(SEGMENTS[1]));

  for (let i = 2; i < SEGMENTS.length - 1; i++) {
    const s0 = segY(SEGMENTS[i]);
    const s1 = segY(SEGMENTS[i + 1]);
    const h = s1 - s0;
    const narrow = W * 0.05;
    const wide = W * (i >= 8 ? 0.2 : 0.11);
    ctx.fillStyle = "#1b1711";
    ctx.beginPath();
    ctx.moveTo(0, s0);
    ctx.lineTo(narrow, s0);
    ctx.lineTo(narrow * 1.1, s0 + h * 0.45);
    ctx.lineTo(wide, s1 - h * 0.08);
    ctx.lineTo(wide, s1);
    ctx.lineTo(0, s1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, s0);
    ctx.lineTo(W - narrow, s0);
    ctx.lineTo(W - narrow * 1.1, s0 + h * 0.45);
    ctx.lineTo(W - wide, s1 - h * 0.08);
    ctx.lineTo(W - wide, s1);
    ctx.lineTo(W, s1);
    ctx.closePath();
    ctx.fill();

    if (i >= 3 && i <= 8) {
      ctx.fillStyle = "#4b9cf0";
      for (const x of [W * 0.12, W * 0.88]) {
        ctx.beginPath();
        ctx.ellipse(x, s0 + h * 0.22, W * 0.035, h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (i === 2) {
      ctx.fillStyle = "#1b1711";
      ctx.fillRect(0, s0, W * 0.05, h * 0.7);
      ctx.fillRect(W * 0.95, s0, W * 0.05, h * 0.7);
    }
  }

  ctx.fillStyle = "rgba(8, 10, 20, 0.35)";
  ctx.fillRect(0, segY(SEGMENTS[9]), W, H - segY(SEGMENTS[9]));

  ctx.fillStyle = "#101010";
  for (let i = 1; i < SEGMENTS.length - 1; i++) {
    ctx.fillRect(0, segY(SEGMENTS[i]) - 2, W, 4);
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function abdomenGeometry(): LatheGeometry {
  const profile: P2[] = [
    [0, 0.05],
    [0.03, 0.054],
    [0.07, 0.064],
    [0.11, 0.053],
    [0.2, 0.041],
    [0.5, 0.037],
    [0.8, 0.036],
    [0.9, 0.039],
    [0.97, 0.032],
    [1, 0.013],
  ];
  const radius = (s: number) => {
    for (let i = 1; i < profile.length; i++) {
      if (s <= profile[i][0]) {
        const [s0, r0] = profile[i - 1];
        const [s1, r1] = profile[i];
        const t = (s - s0) / (s1 - s0);
        return r0 + (r1 - r0) * (0.5 - 0.5 * Math.cos(t * Math.PI));
      }
    }
    return profile[profile.length - 1][1];
  };
  const pts: Vector2[] = [];
  const n = 72;
  for (let i = n; i >= 0; i--) {
    const s = i / n;
    pts.push(new Vector2(radius(s), ABDOMEN_TOP + (ABDOMEN_TIP - ABDOMEN_TOP) * s));
  }
  return new LatheGeometry(pts, 20);
}

type P2 = [number, number];

function standard(color: string, roughness: number, metalness = 0.05): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

export function createDragonflyRig(): InsectRig {
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
  const thoraxShadow = ellipseShadow(0.2, 0.56, 0.08, BODY_SHADOW);
  thoraxShadow.position.y = 0.07;
  const abdomenShadow = ellipseShadow(0.075, ABDOMEN_TOP - ABDOMEN_TIP, 0.06, BODY_SHADOW);
  abdomenShadow.position.y = (ABDOMEN_TOP + ABDOMEN_TIP) / 2;
  shadow.body.add(thoraxShadow, abdomenShadow);
  root.add(shadow.root);

  const frons = new Mesh(new SphereGeometry(0.04, 14, 10), standard("#b9bf6c", 0.45));
  frons.scale.set(1.35, 0.75, 0.75);
  frons.position.set(0, 0.302, -0.005);
  body.add(frons);
  const eyeMat = standard("#6c8a44", 0.24, 0.1);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.066, 22, 16), eyeMat);
    eye.scale.set(0.95, 0.88, 0.8);
    eye.position.set(side * 0.034, 0.25, 0.028);
    body.add(eye);
  }
  const seam = new Mesh(new SphereGeometry(0.02, 8, 6), standard("#4f6a30", 0.35));
  seam.scale.set(0.6, 2.4, 0.6);
  seam.position.set(0, 0.252, 0.072);
  body.add(seam);

  const thoraxMat = standard("#5d8436", 0.55);
  const thorax = new Mesh(new SphereGeometry(0.09, 20, 16), thoraxMat);
  thorax.scale.set(1.02, 1.75, 0.95);
  body.add(thorax);
  const dorsum = new Mesh(new SphereGeometry(0.05, 12, 10), standard("#557b32", 0.6));
  dorsum.scale.set(0.7, 2.6, 0.5);
  dorsum.position.set(0, 0.0, 0.07);
  body.add(dorsum);
  const collar = new Mesh(new SphereGeometry(0.04, 12, 10), standard("#4e7530", 0.5));
  collar.scale.set(1.2, 0.55, 0.9);
  collar.position.set(0, 0.168, 0.0);
  body.add(collar);

  const abdomen = new Mesh(abdomenGeometry(), new MeshStandardMaterial({ map: abdomenTexture(), roughness: 0.38, metalness: 0.08 }));
  body.add(abdomen);

  const darkMat = standard("#15110d", 0.5);
  for (const side of [-1, 1]) {
    const cercus = new Mesh(new ConeGeometry(0.012, 0.07, 6), darkMat);
    cercus.position.set(side * 0.014, ABDOMEN_TIP - 0.03, 0);
    cercus.rotation.z = Math.PI + side * 0.25;
    body.add(cercus);
  }

  for (const side of [-1, 1]) {
    for (const [y0, out, reach] of [
      [0.12, 0.1, 0.13],
      [0.06, 0.12, 0.06],
    ] as const) {
      const curve = new QuadraticBezierCurve3(
        new Vector3(side * 0.03, y0, -0.04),
        new Vector3(side * out, y0 + reach * 0.35, -0.05),
        new Vector3(side * (out + 0.01), y0 + reach, -0.055),
      );
      body.add(new Mesh(new TubeGeometry(curve, 10, 0.0048, 5, false), darkMat));
    }
  }

  const geos: Record<WingKind, ShapeGeometry> = { fore: wingGeometry("fore"), hind: wingGeometry("hind") };
  const makeSide = (mirror: boolean) => {
    const side = new Group();
    const sSide = new Group();
    if (mirror) {
      side.scale.x = -1;
      sSide.scale.x = -1;
    }
    const make = (kind: WingKind, order: number) => {
      const mat = new MeshBasicMaterial({
        map: dragonflyWingTexture(kind),
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const [rx, ry] = WING_ROOT[kind];
      const joint = (leaf: Mesh) => {
        const sweep = new Group();
        const flap = new Group();
        const twist = new Group();
        sweep.position.set(rx, ry, kind === "fore" ? 0.004 : 0);
        sweep.add(flap);
        flap.add(twist);
        twist.add(leaf);
        return { sweep, flap, twist };
      };
      const mesh = new Mesh(geos[kind], mat);
      mesh.renderOrder = order;
      const wing = joint(mesh);
      side.add(wing.sweep);
      const shade = joint(outlineShadow(wingOutline(kind), 0.12, WING_SHADOW));
      sSide.add(shade.sweep);
      return { wing, shade, mat, last: 0, twist: 0 };
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

  const hotspot = dragonflyConfig.model.hotspot;
  inner.position.set(hotspot.x, hotspot.y, hotspot.z);
  shadow.inner.position.copy(inner.position);
  pose.rotation.x = dragonflyConfig.model.tilt;
  shadow.pose.rotation.x = pose.rotation.x;

  /** Membranes catch a soft glint as they pass a shallow up-angle, then dim when steeply tilted. */
  const shade = (angle: number) => {
    const glint = Math.exp(-(((angle - 0.2) / 0.14) ** 2));
    return 1 - 0.14 * Math.abs(Math.sin(angle)) + 0.2 * glint;
  };
  type Joint = { sweep: Group; flap: Group; twist: Group };
  type Wing = { wing: Joint; shade: Joint; mat: MeshBasicMaterial; last: number; twist: number };
  const pose3 = (j: Joint, angle: number, twist: number) => {
    j.sweep.rotation.z = -0.1 * angle;
    j.flap.rotation.y = -angle;
    j.twist.rotation.x = twist;
  };
  let lastTime = performance.now();
  let frameDt = 1 / 60;
  // Pronate on the downstroke and supinate on the upstroke: the leading edge leads the stroke,
  // which from above reads as the chord narrowing and the sheen rolling across the membrane.
  const setWing = (w: Wing, angle: number) => {
    const vel = (angle - w.last) / frameDt;
    w.last = angle;
    const target = Math.max(-1, Math.min(1, vel / 22)) * 0.5;
    w.twist += (target - w.twist) * Math.min(1, frameDt * 30);
    pose3(w.wing, angle, w.twist);
    pose3(w.shade, angle, w.twist);
    w.mat.color.setScalar(shade(angle + w.twist * 0.4));
  };

  return {
    id: "dragonfly",
    group: root,
    setFlap(a: WingAngles) {
      const now = performance.now();
      frameDt = Math.min(0.05, Math.max(1 / 240, (now - lastTime) / 1000));
      lastTime = now;
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
