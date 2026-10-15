/* =========================================================
   tank-faults.js
   Fault bus: stuck-at forcing of named signals, optional
   intermittent behavior, and a log of events.
   Shared by the game, the CRT renderer and (later) the scope.
   ========================================================= */
const TB_TARGETS = {
  HSYNC:  { group: "video", label: "HSYNC" },
  VSYNC:  { group: "video", label: "VSYNC" },
  HBLANK: { group: "video", label: "HBLANK" },
  VBLANK: { group: "video", label: "VBLANK" },
  UP:     { group: "input", label: "UP" },
  DOWN:   { group: "input", label: "DOWN" },
  LEFT:   { group: "input", label: "LEFT" },
  RIGHT:  { group: "input", label: "RIGHT" },
  FIRE:   { group: "input", label: "FIRE" },
};

class FaultBus {
  constructor() {
    this.faults = [];
    this.nextId = 1;
    this.onChange = () => {};
    this._rng = Math.random;
  }
  /** Force `target` to `level` (0|1). Replaces any fault already on that target. */
  inject(target, level, intermittent = false) {
    this.faults = this.faults.filter((f) => f.target !== target);
    const f = { id: this.nextId++, target, level: level ? 1 : 0, intermittent: !!intermittent, on: true, timer: 0 };
    this.faults.push(f);
    this.onChange();
    return f;
  }
  clear(id) {
    this.faults = this.faults.filter((f) => f.id !== id);
    this.onChange();
  }
  clearAll() {
    if (!this.faults.length) return;
    this.faults = [];
    this.onChange();
  }
  /** Advance intermittent faults one video frame (random bursts). */
  step() {
    for (const f of this.faults) {
      if (!f.intermittent) { f.on = true; continue; }
      if (--f.timer > 0) continue;
      f.on = !f.on;
      f.timer = f.on ? 1 + Math.floor(this._rng() * 5) : 8 + Math.floor(this._rng() * 34);
    }
  }
  /** Forced level (0|1) for a target right now, or null if healthy. */
  forced(target) {
    for (const f of this.faults) if (f.target === target && f.on) return f.level;
    return null;
  }
  has(target) {
    return this.faults.some((f) => f.target === target);
  }
}
