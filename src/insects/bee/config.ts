import type { InsectConfig } from "../types";

/** Bombus: a round, buzzy flier — quick, direct moves, a jittery hover, and no gliding. */
export const beeConfig: InsectConfig = {
  id: "bee",
  displayName: "Bumblebee",
  model: {
    wingspanPx: 52,
    // Front of the head, so the pointer sits where the bee is "looking".
    hotspot: { x: 0, y: -0.5, z: 0 },
    tilt: 0.08,
  },
  follow: {
    response: 0.15,
    dragResponse: 0.11,
    rotationResponse: 0.14,
    uprightResponse: 0.6,
    uprightDelay: 0.4,
    faceSpeed: 200,
    bankResponse: 0.14,
    maxBank: 0.28,
    idleSpeed: 38,
    dartAccel: 6000,
    dartHold: 0.22,
    noiseCruise: 0.8,
    noiseIdle: 1.8,
    bobAmount: 1.1,
    tiltTowardInteractive: 0.16,
    glide: 0,
    precision: 0.85,
  },
  // Real bees beat ~200 Hz; anything near that strobes at 60 fps, so these are slow, short strokes
  // that read as a gentle buzz. Fore and hind are hooked together, so there is no phase lag.
  flap: {
    idle: { freqHz: 6.5, amplitude: 0.6, rest: -0.3, hindPhaseLag: 0 },
    cruise: { freqHz: 7.5, amplitude: 0.66, rest: -0.33, hindPhaseLag: 0 },
    dart: { freqHz: 9, amplitude: 0.72, rest: -0.36, hindPhaseLag: 0 },
    hoverInteractive: { freqHz: 5, amplitude: 0.5, rest: -0.24, hindPhaseLag: 0 },
    pressed: { freqHz: 8, amplitude: 0.6, rest: -0.3, hindPhaseLag: 0 },
    settle: { freqHz: 6, amplitude: 0.55, rest: -0.28, hindPhaseLag: 0 },
  },
  click: {
    duration: 0.2,
    dip: 0.07,
    pitch: 0.2,
    clapCycles: 2,
    clapAngle: 1.0,
    settle: 0.32,
    holdRaise: 0.35,
  },
};
