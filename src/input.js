// Keyboard + mouse, polled per frame. Actions are named so the player never sees raw key codes.
const BINDS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], light: ['KeyJ', 'Mouse0'], heavy: ['KeyE', 'KeyK'], block: ['KeyL', 'Mouse2'], roll: ['ShiftLeft', 'ShiftRight'],
  camL: ['BracketLeft'], camR: ['BracketRight'], pause: ['Escape'], any: [],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();     // went down this frame
    this.released = new Set();
    this.mdx = 0; this.mdy = 0;
    this.locked = false;
    this.wantLock = false;
    this.anyPressed = false;
    this.lastMouseMove = 0;

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
  }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch { /* not allowed */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  held(action) { const b = BINDS[action]; for (let i = 0; i < b.length; i++) if (this.down.has(b[i])) return true; return false; }
  just(action) { const b = BINDS[action]; for (let i = 0; i < b.length; i++) if (this.pressed.has(b[i])) return true; return false; }
  axis() { // x right, y forward (in camera space, normalised)
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('fwd') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y, l: Math.min(1, l) };
  }
  consumeMouse() { const r = { dx: this.mdx, dy: this.mdy }; this.mdx = 0; this.mdy = 0; return r; }
  endFrame() { this.pressed.clear(); this.released.clear(); this.anyPressed = false; }
}
