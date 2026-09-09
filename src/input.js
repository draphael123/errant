// Keyboard + mouse + gamepad, polled per frame. Actions are named so the game never sees raw key codes.
const BINDS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'Pad0'], light: ['KeyJ', 'Mouse0', 'Pad2'], heavy: ['KeyE', 'KeyK', 'Pad3', 'Pad7'], block: ['KeyL', 'Mouse2', 'Pad4', 'Pad5', 'Pad6'], dash: ['ShiftLeft', 'ShiftRight', 'Pad1'], roll: ['ControlLeft', 'ControlRight'],
  camL: ['BracketLeft'], camR: ['BracketRight'], pause: ['Escape', 'Pad9'], skip: ['KeyN', 'Pad8'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mdx = 0; this.mdy = 0;
    this.locked = false; this.wantLock = false;
    this.anyPressed = false; this.lastMouseMove = 0;
    this.pad = null; this.padPrev = []; this.stick = { x: 0, y: 0 }; this.rstick = { x: 0, y: 0 }; this.padUsed = false;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.down.add(e.code); this.pressed.add(e.code); this.anyPressed = true;
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); });
    canvas.addEventListener('mousedown', e => {
      const c = 'Mouse' + e.button; this.down.add(c); this.pressed.add(c); this.anyPressed = true;
      if (this.wantLock && !this.locked) this.lock();
    });
    window.addEventListener('mouseup', e => { const c = 'Mouse' + e.button; this.down.delete(c); this.released.add(c); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mdx += e.movementX; this.mdy += e.movementY; this.lastMouseMove = performance.now();
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });
    window.addEventListener('gamepadconnected', e => { this.pad = e.gamepad.index; });
  }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch { /* not allowed */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  // Call once per frame before reading: folds gamepad state into the same sets the keyboard uses.
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.stick.x = 0; this.stick.y = 0; this.rstick.x = 0; this.rstick.y = 0; return; }
    const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    this.stick.x = dz(gp.axes[0] || 0); this.stick.y = -dz(gp.axes[1] || 0);
    this.rstick.x = dz(gp.axes[2] || 0); this.rstick.y = dz(gp.axes[3] || 0);
    if (Math.abs(this.stick.x) + Math.abs(this.stick.y) + Math.abs(this.rstick.x) + Math.abs(this.rstick.y) > 0.1) this.padUsed = true;
    for (let i = 0; i < gp.buttons.length && i < 16; i++) {
      const on = gp.buttons[i].pressed || gp.buttons[i].value > 0.5; const code = 'Pad' + i; const was = this.padPrev[i] || false;
      if (on && !was) { this.down.add(code); this.pressed.add(code); this.anyPressed = true; this.padUsed = true; if (i === 9) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); }
      else if (!on && was) { this.down.delete(code); this.released.add(code); }
      this.padPrev[i] = on;
    }
    // dpad as movement
    const dp = [[12, 'PadUp'], [13, 'PadDown'], [14, 'PadLeft'], [15, 'PadRight']];
    for (const [i, code] of dp) { const on = gp.buttons[i] && gp.buttons[i].pressed; if (on) this.down.add(code); else this.down.delete(code); }
    if (Math.abs(this.rstick.x) + Math.abs(this.rstick.y) > 0) this.lastMouseMove = performance.now();
  }
  held(action) { const b = BINDS[action]; for (let i = 0; i < b.length; i++) if (this.down.has(b[i])) return true; return false; }
  just(action) { const b = BINDS[action]; for (let i = 0; i < b.length; i++) if (this.pressed.has(b[i])) return true; return false; }
  axis() {
    let x = (this.held('right') || this.down.has('PadRight') ? 1 : 0) - (this.held('left') || this.down.has('PadLeft') ? 1 : 0);
    let y = (this.held('fwd') || this.down.has('PadUp') ? 1 : 0) - (this.held('back') || this.down.has('PadDown') ? 1 : 0);
    if (x === 0 && y === 0) { x = this.stick.x; y = this.stick.y; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y, l: Math.min(1, l) };
  }
  consumeMouse(dt = 0.016) {
    const r = { dx: this.mdx + this.rstick.x * 900 * dt, dy: this.mdy + this.rstick.y * 700 * dt }; this.mdx = 0; this.mdy = 0; return r;
  }
  endFrame() { this.pressed.clear(); this.released.clear(); this.anyPressed = false; }
}
