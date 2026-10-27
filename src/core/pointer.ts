const INTERACTIVE = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "SUMMARY",
  "LABEL",
]);

function isInteractive(el: Element | null): boolean {
  if (!el || el === document.documentElement || el === document.body) return false;
  const html = el as HTMLElement;
  if (html.dataset?.entomonRoot !== undefined) return false;
  if (INTERACTIVE.has(el.tagName)) return true;
  const role = el.getAttribute("role");
  if (role === "button" || role === "link" || role === "tab" || role === "menuitem") {
    return true;
  }
  if (html.isContentEditable) return true;
  if (html.tabIndex >= 0 && (el.tagName === "DIV" || el.tagName === "SPAN")) return true;
  return false;
}

function findInteractive(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const html = el as HTMLElement;
    if (html.dataset?.entomonRoot !== undefined || html.classList?.contains("entomon-layer")) continue;
    if (el.tagName === "CANVAS" && html.closest?.("[data-entomon-root]") !== null) continue;
    let node: Element | null = el;
    while (node) {
      if (isInteractive(node)) return node;
      node = node.parentElement;
    }
  }
  return null;
}

export class PointerTracker {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  down = false;
  dragging = false;
  overInteractive = false;
  interactiveCX = 0;
  interactiveCY = 0;

  private lastX: number;
  private lastY: number;
  private lastT = performance.now();
  private downX = 0;
  private downY = 0;
  private readonly dragSlop = 6;
  private usingPointer = false;
  private readonly onMove = (e: PointerEvent | MouseEvent) => this.handleMove(e);
  private readonly onDown = (e: PointerEvent | MouseEvent) => this.handleDown(e);
  private readonly onUp = (e: PointerEvent | MouseEvent) => this.handleUp(e);

  constructor() {
    this.x = window.innerWidth * 0.5;
    this.y = window.innerHeight * 0.5;
    this.lastX = this.x;
    this.lastY = this.y;
  }

  attach(): void {
    const opts = { passive: true, capture: true } as const;
    window.addEventListener("pointermove", this.onMove, opts);
    window.addEventListener("pointerdown", this.onDown, opts);
    window.addEventListener("pointerup", this.onUp, opts);
    window.addEventListener("pointercancel", this.onUp, opts);
    window.addEventListener("mousemove", this.onMove, opts);
    window.addEventListener("mousedown", this.onDown, opts);
    window.addEventListener("mouseup", this.onUp, opts);
  }

  detach(): void {
    const opts = { capture: true } as const;
    window.removeEventListener("pointermove", this.onMove, opts);
    window.removeEventListener("pointerdown", this.onDown, opts);
    window.removeEventListener("pointerup", this.onUp, opts);
    window.removeEventListener("pointercancel", this.onUp, opts);
    window.removeEventListener("mousemove", this.onMove, opts);
    window.removeEventListener("mousedown", this.onDown, opts);
    window.removeEventListener("mouseup", this.onUp, opts);
  }

  private handleMove(e: PointerEvent | MouseEvent): void {
    if ("pointerType" in e) this.usingPointer = true;
    else if (this.usingPointer) return;
    const now = performance.now();
    const dt = Math.max((now - this.lastT) / 1000, 1 / 240);
    const nx = e.clientX;
    const ny = e.clientY;
    const ivx = (nx - this.lastX) / dt;
    const ivy = (ny - this.lastY) / dt;
    const blend = 1 - Math.exp(-dt * 18);
    this.vx += (ivx - this.vx) * blend;
    this.vy += (ivy - this.vy) * blend;
    this.x = nx;
    this.y = ny;
    this.lastX = nx;
    this.lastY = ny;
    this.lastT = now;

    if (this.down) {
      const dx = nx - this.downX;
      const dy = ny - this.downY;
      if (dx * dx + dy * dy > this.dragSlop * this.dragSlop) this.dragging = true;
    }

    this.sampleInteractive(nx, ny);
  }

  private handleDown(e: PointerEvent | MouseEvent): void {
    if ("pointerType" in e) this.usingPointer = true;
    else if (this.usingPointer) return;
    if (e.button !== 0) return;
    this.down = true;
    this.dragging = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.x = e.clientX;
    this.y = e.clientY;
  }

  private handleUp(e: PointerEvent | MouseEvent): void {
    if ("pointerType" in e) this.usingPointer = true;
    else if (this.usingPointer) return;
    this.down = false;
    this.dragging = false;
    this.x = e.clientX;
    this.y = e.clientY;
  }

  pollInteractive(): void {
    this.sampleInteractive(this.x, this.y);
  }

  private sampleInteractive(x: number, y: number): void {
    const el = findInteractive(x, y);
    this.overInteractive = Boolean(el);
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.interactiveCX = r.left + r.width * 0.5;
    this.interactiveCY = r.top + r.height * 0.5;
  }

  decayVelocity(dt: number): void {
    const idle = performance.now() - this.lastT > 48;
    if (!idle) return;
    const damp = Math.exp(-dt * 10);
    this.vx *= damp;
    this.vy *= damp;
  }
}
