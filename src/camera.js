// Third-person orbit camera with mouse look, optional auto-follow, and a cheap occlusion pull-in.
import * as THREE from 'three';
import { S } from './settings.js';

export class FollowCamera {
  constructor(camera, phys) {
    this.cam = camera; this.phys = phys;
    this.yaw = Math.PI; this.pitch = 0.42;
    this.target = new THREE.Vector3(); this.smoothTarget = new THREE.Vector3(); this.first = true;
    this.dist = S.camDist; this.tmp = new THREE.Vector3();
  }
  reset(pos, yaw) { this.yaw = yaw + Math.PI; this.pitch = 0.42; this.first = true; this.smoothTarget.set(pos.x, pos.y + 1.4, pos.z); }
  update(dt, input, playerPos, playerYaw, moving, shake) {
    const { dx, dy } = input.consumeMouse(dt);
    const k = 0.0022 * S.sens;
    this.yaw -= dx * k; this.pitch += dy * k * (S.invertY ? -1 : 1);
    this.pitch = Math.max(-0.3, Math.min(1.25, this.pitch));
    if (input.held('camL')) this.yaw += dt * 2.2; if (input.held('camR')) this.yaw -= dt * 2.2;
    if (S.autoFollow && moving && performance.now() - input.lastMouseMove > 1400) {
      const want = playerYaw + Math.PI; let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 1.4));
    }
    this.target.set(playerPos.x, playerPos.y + 1.4, playerPos.z);
    if (this.first) { this.smoothTarget.copy(this.target); this.first = false; }
    else { const kk = 1 - Math.exp(-dt * 14); this.smoothTarget.x += (this.target.x - this.smoothTarget.x) * kk; this.smoothTarget.z += (this.target.z - this.smoothTarget.z) * kk; this.smoothTarget.y += (this.target.y - this.smoothTarget.y) * (1 - Math.exp(-dt * 9)); }
    this.dist += ((this.overrideDist || S.camDist) - this.dist) * (1 - Math.exp(-dt * 6));
    const cp = Math.cos(this.pitch);
    const dir = this.tmp.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    // pull in if the line of sight crosses a solid box
    let d = this.dist;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10; const px = this.smoothTarget.x + dir.x * d * f, py = this.smoothTarget.y + dir.y * d * f, pz = this.smoothTarget.z + dir.z * d * f;
      if (this.inside(px, py, pz, 0.35)) { d = Math.max(1.2, d * (i - 1) / 10 - 0.2); break; }
    }
    this.cam.position.set(this.smoothTarget.x + dir.x * d, this.smoothTarget.y + dir.y * d, this.smoothTarget.z + dir.z * d);
    if (shake) this.cam.position.add(shake);
    this.cam.lookAt(this.smoothTarget.x + (shake ? shake.x * 0.5 : 0), this.smoothTarget.y, this.smoothTarget.z);
    const wantFov = S.fov + (this.speedFrac || 0) * 4 + (this.rolling ? 3 : 0);
    if (Math.abs(this.cam.fov - wantFov) > 0.05) { this.cam.fov += (wantFov - this.cam.fov) * (1 - Math.exp(-dt * 8)); this.cam.updateProjectionMatrix(); }
  }
  inside(x, y, z, pad) {
    for (const b of this.phys.boxes) { if (!b.solid || b.kind === 'wall') continue; if (x > b.min.x - pad && x < b.max.x + pad && y > b.min.y - pad && y < b.max.y + pad && z > b.min.z - pad && z < b.max.z + pad) return true; }
    return false;
  }
  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; } // direction the camera looks, flattened
}
