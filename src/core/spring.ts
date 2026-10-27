/** Exact integration of a critically damped spring. `response` is settle time in seconds. */
export function stepCritical(
  pos: number,
  vel: number,
  target: number,
  dt: number,
  response: number,
): { pos: number; vel: number } {
  const w = 2 / Math.max(response, 0.008);
  const x = pos - target;
  const a = x;
  const b = vel + w * x;
  const e = Math.exp(-w * dt);
  const newX = (a + b * dt) * e;
  const newV = (b - w * (a + b * dt)) * e;
  return { pos: target + newX, vel: newV };
}

export class Spring1 {
  pos: number;
  vel = 0;

  constructor(pos = 0) {
    this.pos = pos;
  }

  step(target: number, dt: number, response: number): number {
    const next = stepCritical(this.pos, this.vel, target, dt, response);
    this.pos = next.pos;
    this.vel = next.vel;
    return this.pos;
  }
}
