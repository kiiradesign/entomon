import type { InsectConfig } from "../types";

export const dragonflyConfig: InsectConfig = {
  id: "dragonfly",
  displayName: "Common Green Darner",
  model: {
    wingspanPx: 66,
    // Front of the face, so the tip of the insect is exactly where the pointer is.
    hotspot: { x: 0, y: -0.32, z: 0 },
    tilt: 0.06,
  },
  follow: {
    response: 0.12,
    dragResponse: 0.1,
    rotationResponse: 0.11,
    uprightResponse: 0.7,
    uprightDelay: 0.6,
    faceSpeed: 160,
    bankResponse: 0.12,
    maxBank: 0.18,
    idleSpeed: 40,
    dartAccel: 5200,
    dartHold: 0.24,
    noiseCruise: 0.4,
    noiseIdle: 1,
    bobAmount: 0.5,
    tiltTowardInteractive: 0.18,
    glide: 0.55,
    glideAngle: 0.4,
    precision: 1,
  },
  // Wings sweep above and below level, so `rest` is negative. A negative lag means the
  // hindwings lead; in a dart all four beat almost together, as darners do when accelerating.
  // Real darners beat ~30 Hz; these rates stay readable at 60 fps instead of strobing.
  //   idle            steady hover beat
  //   cruise          quicker beat broken up by flat-winged glides
  //   dart            deep, fast, all four wings together
  //   hoverInteractive slow and shallow with the wings held wide and near level
  //   pressed         double wing-flick up (clap) with a dip
  //   settle          soft, slower beat easing back to hover
  flap: {
    idle: { freqHz: 7.5, amplitude: 0.68, rest: -0.36, hindPhaseLag: -0.2 },
    cruise: { freqHz: 9.5, amplitude: 0.74, rest: -0.38, hindPhaseLag: -0.22 },
    dart: { freqHz: 12, amplitude: 0.95, rest: -0.5, hindPhaseLag: -0.04 },
    hoverInteractive: { freqHz: 5, amplitude: 0.4, rest: -0.16, hindPhaseLag: -0.24 },
    pressed: { freqHz: 10, amplitude: 0.7, rest: -0.38, hindPhaseLag: -0.04 },
    settle: { freqHz: 6.5, amplitude: 0.55, rest: -0.3, hindPhaseLag: -0.2 },
  },
  click: {
    duration: 0.22,
    dip: 0.08,
    pitch: 0.22,
    clapCycles: 2,
    clapAngle: 1.15,
    settle: 0.35,
    holdRaise: 0.42,
  },
};
