import type { PointerTracker } from "../core/pointer";
import { signedNoise2, valueNoise2 } from "../core/noise";
import { Spring1 } from "../core/spring";
import type { InsectConfig, InsectRig, MotionState } from "../insects/types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
const wrapAngle = (a: number) => a - TAU * Math.round(a / TAU);

/** 1 = wings fully up, -1 = bottom of the downstroke. Downstroke takes 55% of the cycle. */
function stroke(phase: number): number {
  const t = phase - Math.floor(phase);
  const down = 0.55;
  return t < down ? Math.cos((t / down) * Math.PI) : -Math.cos(((t - down) / (1 - down)) * Math.PI);
}

export class InsectController {
  state: MotionState = "idle";
  readonly x = new Spring1(0);
  readonly y = new Spring1(0);
  readonly heading = new Spring1(0);
  readonly facing = new Spring1(0);
  readonly bank = new Spring1(0);
  readonly pitch = new Spring1(0);
  readonly freq: Spring1;
  readonly amp: Spring1;
  readonly rest: Spring1;
  readonly dip = new Spring1(0);
  readonly glide = new Spring1(0);
  readonly press = new Spring1(0);

  private phase = 0;
  private clickAge = 99;
  private releaseAge = 99;
  private dartAge = 99;
  private wasDown = false;
  private lastVx = 0;
  private lastVy = 0;
  private time = 0;
  private travelDir = 0;

  constructor(
    private readonly config: InsectConfig,
    private readonly rig: InsectRig,
  ) {
    const idle = config.flap.idle;
    this.freq = new Spring1(idle.freqHz);
    this.amp = new Spring1(idle.amplitude);
    this.rest = new Spring1(idle.rest);
  }

  seed(px: number, py: number, width: number, height: number): void {
    this.x.pos = px - width * 0.5;
    this.y.pos = -(py - height * 0.5);
  }

  update(dt: number, pointer: PointerTracker, width: number, height: number, reduced: boolean): void {
    const cfg = this.config;
    const f = cfg.follow;
    const c = cfg.click;
    this.time += dt;
    pointer.decayVelocity(dt);
    pointer.pollInteractive();

    const accel =
      Math.hypot(pointer.vx - this.lastVx, pointer.vy - this.lastVy) / Math.max(dt, 1 / 120);
    this.lastVx = pointer.vx;
    this.lastVy = pointer.vy;
    const speed = Math.hypot(pointer.vx, pointer.vy);

    if (pointer.down && !this.wasDown) this.clickAge = 0;
    if (!pointer.down && this.wasDown) this.releaseAge = 0;
    this.wasDown = pointer.down;
    this.clickAge += dt;
    this.releaseAge += dt;
    this.dartAge += dt;
    if (!reduced && accel > f.dartAccel && speed > f.idleSpeed * 2) this.dartAge = 0;

    this.state = this.resolveState(pointer, speed);
    const calm = this.state === "idle" || this.state === "hoverInteractive";

    const noise = reduced ? 0 : calm ? f.noiseIdle : f.noiseCruise;
    const nx = signedNoise2(this.time * 0.35, 0.2) * noise;
    const ny = signedNoise2(1.7, this.time * 0.32) * noise;
    const tx = pointer.x + nx - width * 0.5;
    const ty = -(pointer.y + ny - height * 0.5);
    const response = pointer.dragging ? f.dragResponse : f.response;
    this.x.step(tx, dt, response);
    this.y.step(ty, dt, response);
    const vx = this.x.vel;
    const vy = this.y.vel;

    const travel = Math.hypot(vx, vy);
    if (travel > 14) this.travelDir = Math.atan2(vx, vy);
    const faceTarget = reduced || (pointer.down && !pointer.dragging) ? 0 : smoothstep(f.idleSpeed * 1.5, f.faceSpeed, travel);
    this.facing.step(
      faceTarget,
      dt,
      faceTarget > this.facing.pos ? f.rotationResponse * 0.6 : f.uprightResponse,
    );

    const h = this.heading.pos;
    const upright = Math.round(h / TAU) * TAU;
    const along = h + wrapAngle(this.travelDir - h);
    let headingTarget = upright + (along - upright) * this.facing.pos;
    let pitchTarget = reduced ? 0 : clamp(travel / 1600, 0, 1) * 0.14;
    if (this.state === "hoverInteractive") {
      headingTarget +=
        clamp((pointer.interactiveCX - pointer.x) / 220, -1, 1) * f.tiltTowardInteractive * (1 - this.facing.pos);
      pitchTarget += clamp((pointer.y - pointer.interactiveCY) / 160, -1, 1) * 0.12;
    }
    if (this.dartAge < f.dartHold) pitchTarget += 0.22 * (1 - this.dartAge / f.dartHold);
    const pressEnv = this.clickAge < c.duration ? Math.sin((this.clickAge / c.duration) * Math.PI) : 0;
    pitchTarget += c.pitch * pressEnv;
    this.heading.step(headingTarget, dt, f.rotationResponse);
    this.pitch.step(pitchTarget, dt, 0.16);
    const turnRate = this.heading.vel;
    this.bank.step(reduced ? 0 : clamp(turnRate / 5, -1, 1) * f.maxBank, dt, f.bankResponse);

    const profile = cfg.flap[this.state];
    const held = pointer.down && !pointer.dragging && this.clickAge >= c.duration;
    this.freq.step(reduced ? 1.6 : profile.freqHz, dt, 0.2);
    this.amp.step(reduced ? 0.16 : profile.amplitude, dt, 0.2);
    this.rest.step(profile.rest + (held ? c.holdRaise : 0), dt, 0.18);

    const gliding =
      !reduced && this.state === "cruise" ? smoothstep(0.68, 0.8, valueNoise2(this.time * 0.4, 3.3)) : 0;
    this.glide.step(gliding * f.glide, dt, 0.25);

    const effort = reduced ? 0 : smoothstep(f.idleSpeed, 900, travel);
    this.phase += dt * this.freq.pos * (1 + 0.25 * effort) * (1 - this.glide.pos * 0.35);
    const lag = profile.hindPhaseLag;
    const strokeAmp = this.amp.pos * (1 + 0.2 * effort) * (1 - this.glide.pos);
    const glideHold = this.glide.pos * 0.14;
    let fore = this.rest.pos + glideHold + strokeAmp * (0.5 + 0.5 * stroke(this.phase));
    let hind = this.rest.pos + glideHold + strokeAmp * 0.92 * (0.5 + 0.5 * stroke(this.phase - lag));

    if (this.clickAge < c.duration) {
      const u = this.clickAge / c.duration;
      const clap = 0.5 - 0.5 * Math.cos(u * Math.PI * 2 * c.clapCycles);
      const w = Math.min(1, Math.sin(u * Math.PI) * 2.5);
      const clapAngle = 0.12 + (c.clapAngle - 0.12) * clap;
      fore += (clapAngle - fore) * w;
      hind += (clapAngle * 0.95 - hind) * w;
    } else if (this.releaseAge < c.settle) {
      const u = this.releaseAge / c.settle;
      const open = Math.sin(u * Math.PI) * 0.12;
      fore = Math.max(0.04, fore - open);
      hind = Math.max(0.04, hind - open);
    }

    const jitter = reduced ? 0 : 0.025;
    const jl = signedNoise2(this.time * 1.9, 8) * jitter;
    const jr = signedNoise2(9, this.time * 1.7) * jitter;
    this.rig.setFlap({
      leftFore: fore + jl,
      rightFore: fore + jr,
      leftHind: hind + jl * 0.6,
      rightHind: hind + jr * 0.6,
    });

    this.dip.step(this.clickAge < c.duration ? 1 : 0, dt, 0.07);
    const bob = reduced ? 0 : Math.sin(this.time * 1.7) * f.bobAmount * (calm ? 1 : 0.35);

    this.press.step(pointer.down && !pointer.dragging ? 1 : 0, dt, 0.14);
    this.rig.setLift(1 - 0.3 * this.press.pos - 0.25 * this.dip.pos);
    this.rig.setBody(this.pitch.pos);
    this.rig.setHeading(this.heading.pos, this.bank.pos);
    this.rig.group.position.set(this.x.pos, this.y.pos + bob, 0);
    this.rig.group.scale.setScalar((cfg.model.wingspanPx / 2.05) * (1 - c.dip * this.dip.pos));
  }

  private resolveState(pointer: PointerTracker, speed: number): MotionState {
    const cfg = this.config;
    if (this.clickAge < cfg.click.duration) return "pressed";
    if (!pointer.down && this.releaseAge < cfg.click.settle) return "settle";
    if (this.dartAge < cfg.follow.dartHold) return "dart";
    if (pointer.dragging) return "cruise";
    if (pointer.overInteractive) return "hoverInteractive";
    return speed < cfg.follow.idleSpeed ? "idle" : "cruise";
  }
}
