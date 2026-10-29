import type { InsectConfig } from "../types";

/** Actias luna: big, slow, fluttery wingbeats with the tails streaming behind. */
export const lunaMothConfig: InsectConfig = {
  id: "luna-moth",
  displayName: "Luna moth",
  model: {
    wingspanPx: 64,
    hotspot: { x: 0, y: -0.14, z: 0 },
    tilt: 0.08,
  },
  follow: {
    response: 0.26,
    dragResponse: 0.17,
    rotationResponse: 0.24,
    uprightResponse: 0.7,
    faceSpeed: 240,
    bankResponse: 0.22,
    maxBank: 0.45,
    idleSpeed: 36,
    dartAccel: 6000,
    dartHold: 0.3,
    noiseCruise: 1.1,
    noiseIdle: 2.6,
    bobAmount: 1.4,
    tiltTowardInteractive: 0.2,
    glide: 0.4,
  },
  flap: {
    idle: { freqHz: 2.2, amplitude: 0.55, rest: 0.12, hindPhaseLag: 0.08 },
    cruise: { freqHz: 4.4, amplitude: 0.72, rest: 0.08, hindPhaseLag: 0.07 },
    dart: { freqHz: 6.8, amplitude: 0.66, rest: 0.06, hindPhaseLag: 0.05 },
    hoverInteractive: { freqHz: 1.8, amplitude: 0.72, rest: 0.16, hindPhaseLag: 0.1 },
    pressed: { freqHz: 5, amplitude: 0.42, rest: 0.1, hindPhaseLag: 0.04 },
    settle: { freqHz: 2.6, amplitude: 0.5, rest: 0.1, hindPhaseLag: 0.08 },
  },
  click: {
    duration: 0.24,
    dip: 0.08,
    pitch: 0.24,
    clapCycles: 2,
    clapAngle: 1.2,
    settle: 0.38,
    holdRaise: 0.3,
  },
};
