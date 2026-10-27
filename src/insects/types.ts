import type { Group } from "three";

export type InsectId =
  | "monarch"
  | "dragonfly"
  | "firefly"
  | "luna-moth"
  | "damselfly"
  | "bee"
  | "ladybird";

export type MotionState =
  | "idle"
  | "cruise"
  | "dart"
  | "hoverInteractive"
  | "pressed"
  | "settle";

export type FlapProfile = {
  freqHz: number;
  /** Stroke amplitude in radians. */
  amplitude: number;
  /** Wing angle at the bottom of the downstroke, radians. */
  rest: number;
  /** How far the hindwing trails the forewing, in cycles. */
  hindPhaseLag: number;
};

export type InsectConfig = {
  id: InsectId;
  displayName: string;
  model: {
    wingspanPx: number;
    /** Offset in model units so the pointer sits on the head. */
    hotspot: { x: number; y: number; z: number };
    /** Base pitch toward the viewer, radians. */
    tilt: number;
  };
  follow: {
    response: number;
    dragResponse: number;
    /** Settle time for turning toward the travel direction, seconds. */
    rotationResponse: number;
    /** Settle time for returning head-up once the insect is at rest, seconds. */
    uprightResponse: number;
    /** Seconds the insect keeps facing its last travel direction after stopping. Defaults to 0. */
    uprightDelay?: number;
    /** Speed in px/s at which the insect fully faces its travel direction. */
    faceSpeed: number;
    bankResponse: number;
    /** Max roll into turns, radians. */
    maxBank: number;
    idleSpeed: number;
    dartAccel: number;
    /** Seconds a dart lasts once triggered. */
    dartHold: number;
    noiseCruise: number;
    noiseIdle: number;
    /** Idle vertical bob in px. */
    bobAmount: number;
    tiltTowardInteractive: number;
    /** Chance-weighted gliding while cruising, 0 disables. */
    glide: number;
    /** Wing angle offset held while gliding, radians. Defaults to 0.14 (slightly raised). */
    glideAngle?: number;
    /**
     * 0..1: how much organic drift and bob are suppressed over interactive targets and while the
     * pointer is still, so the hotspot lands exactly where the user points. Defaults to 0.
     */
    precision?: number;
  };
  flap: Record<MotionState, FlapProfile>;
  click: {
    duration: number;
    /** Scale dip fraction on press. */
    dip: number;
    pitch: number;
    clapCycles: number;
    /** Peak wing angle during the clap, radians. */
    clapAngle: number;
    /** Seconds of soft settle after release. */
    settle: number;
    /** Extra wing raise while the button is held without dragging. */
    holdRaise: number;
  };
};

export type WingAngles = {
  leftFore: number;
  rightFore: number;
  leftHind: number;
  rightHind: number;
};

export type InsectRig = {
  id: InsectId;
  group: Group;
  setFlap(angles: WingAngles): void;
  setBody(pitch: number): void;
  setHeading(heading: number, bank: number): void;
  /** Height above the page, 1 = cruising height; lower pulls the cast shadow in and darkens it. */
  setLift(lift: number): void;
};

export type InsectFactory = () => InsectRig;
