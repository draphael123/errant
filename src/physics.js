// Axis-aligned box world. Bodies are AABBs whose `pos` is the FEET centre.
// Motion is resolved per axis (x, z, then y) so sliding along walls and landing on ledges fall out naturally.
import * as THREE from 'three';

export class Box {
  constructor(minx, miny, minz, maxx, maxy, maxz, kind = 'static', ref = null) {
    this.min = new THREE.Vector3(minx, miny, minz); this.max = new THREE.Vector3(maxx, maxy, maxz);
    this.kind = kind; this.ref = ref; this.solid = true; this.delta = null; // movers set delta each frame
  }
  static fromTop(cx, cz, w, d, top, thick = 2, kind = 'static', ref = null) {
    return new Box(cx - w / 2, top - thick, cz - d / 2, cx + w / 2, top, cz + d / 2, kind, ref);
  }
  containsXZ(x, z) { return x >= this.min.x && x <= this.max.x && z >= this.min.z && z <= this.max.z; }
  center() { return new THREE.Vector3((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, (this.min.z + this.max.z) / 2); }
}

export function makeBody(x, y, z, halfXZ, height) {
  return { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), half: halfXZ, height, onGround: false, groundBox: null, hitWall: false, hitHead: false };
}

export class Physics {
  constructor() { this.boxes = []; }
  add(box) { this.boxes.push(box); return box; }
  remove(box) { const i = this.boxes.indexOf(box); if (i >= 0) this.boxes.splice(i, 1); }

  // Highest solid top at or below y+0.6 under (x,z). Returns the box or null.
  floorAt(x, z, y, maxDrop = 100) {
    let best = null, bestTop = -Infinity;
    for (const b of this.boxes) {
      if (!b.solid || !b.containsXZ(x, z)) continue;
      if (b.max.y <= y + 0.6 && b.max.y > bestTop && y - b.max.y <= maxDrop) { bestTop = b.max.y; best = b; }
    }
    return best;
  }

  step(body, dt) {
    const p = body.pos, v = body.vel, h = body.half;
    // Ride whatever we were standing on.
    if (body.groundBox && body.groundBox.delta) p.add(body.groundBox.delta);
    const prevY = p.y;
    body.onGround = false; body.hitWall = false; body.hitHead = false;
    const prevGround = body.groundBox; body.groundBox = null;

    const canStep = !!prevGround;
    p.x += v.x * dt; this.resolveXZ(body, 'x', canStep);
    p.z += v.z * dt; this.resolveXZ(body, 'z', canStep);
    p.y += v.y * dt; this.resolveY(body, prevY, prevGround);
  }

  resolveXZ(body, axis, canStep = false) {
    const p = body.pos, h = body.half;
    const ymin = p.y + 0.05, ymax = p.y + body.height - 0.02;   // ignore the surface we stand on
    for (const b of this.boxes) {
      if (!b.solid) continue;
      if (ymin >= b.max.y || ymax <= b.min.y) continue;
      if (p.x - h >= b.max.x || p.x + h <= b.min.x) continue;
      if (p.z - h >= b.max.z || p.z + h <= b.min.z) continue;
      // a ledge no higher than a stair riser: step onto it (only when there is headroom)
      if (canStep && b.max.y - p.y <= 0.45 && b.max.y > p.y && !this.blockedAbove(body, b.max.y)) { p.y = b.max.y; body.stepped = true; continue; }
      // overlapping: push out along the axis we just moved on
      const c = (b.min[axis] + b.max[axis]) / 2;
      if (p[axis] < c) p[axis] = b.min[axis] - h; else p[axis] = b.max[axis] + h;
      body.vel[axis] = 0; body.hitWall = true;
    }
  }

  blockedAbove(body, footY) {
    const p = body.pos, h = body.half, top = footY + body.height - 0.02;
    for (const b of this.boxes) { if (!b.solid) continue; if (p.x - h >= b.max.x || p.x + h <= b.min.x || p.z - h >= b.max.z || p.z + h <= b.min.z) continue; if (b.min.y < top && b.min.y >= footY + 0.5) return true; }
    return false;
  }
  resolveY(body, prevY, prevGround) {
    const p = body.pos, h = body.half, v = body.vel;
    for (const b of this.boxes) {
      if (!b.solid) continue;
      if (p.x - h >= b.max.x || p.x + h <= b.min.x) continue;
      if (p.z - h >= b.max.z || p.z + h <= b.min.z) continue;
      if (p.y >= b.max.y || p.y + body.height <= b.min.y) continue;
      const fromAbove = prevY >= b.max.y - 0.08 || b === prevGround;
      if (v.y <= 0 && fromAbove) { p.y = b.max.y; v.y = 0; body.onGround = true; body.groundBox = b; }
      else if (v.y > 0 && prevY + body.height <= b.min.y + 0.08) { p.y = b.min.y - body.height; v.y = 0; body.hitHead = true; }
      else { // came in sideways after the xz pass (thin geometry): pick the smaller vertical push
        const up = b.max.y - p.y, down = (p.y + body.height) - b.min.y;
        if (up <= down) { p.y = b.max.y; if (v.y < 0) v.y = 0; body.onGround = true; body.groundBox = b; }
        else { p.y = b.min.y - body.height; if (v.y > 0) v.y = 0; }
      }
    }
  }
}
