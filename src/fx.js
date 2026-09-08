// Sparks, slash arcs, telegraphs, shockwaves, hit-stop and shake. Impact FX never depth-test:
// behind a third-person camera the contact point is usually behind the player's own torso.
import * as THREE from 'three';
import { S } from './settings.js';

const MAXP = 400;

export function sectorGeometry(inner, outer, arc, segments = 24) {
  // Flat sector lying in XY, centred on local -y so that rotation (-π/2 about x, then yaw about y) points it at world forward.
  return new THREE.RingGeometry(inner, outer, segments, 1, -Math.PI / 2 - arc / 2, arc);
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.freeze = 0; this.shakeAmt = 0; this.shakeVec = new THREE.Vector3();
    // particles
    this.pPos = new Float32Array(MAXP * 3); this.pCol = new Float32Array(MAXP * 3);
    this.p = []; for (let i = 0; i < MAXP; i++) { this.p.push({ life: 0, vx: 0, vy: 0, vz: 0, g: 0 }); this.pPos[i * 3 + 1] = -9999; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const mat = new THREE.PointsMaterial({ size: 0.24, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; this.points.renderOrder = 998; scene.add(this.points);
    this.pHead = 0;
    this.transients = []; // {mesh, life, max, update}
  }
  burst(pos, color, n = 14, speed = 6, opts = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pHead; this.pHead = (this.pHead + 1) % MAXP; const q = this.p[i];
      const th = Math.random() * Math.PI * 2, ph = (Math.random() - 0.5) * Math.PI * (opts.flat ? 0.3 : 1);
      const sp = speed * (0.4 + Math.random() * 0.8);
      q.vx = Math.cos(th) * Math.cos(ph) * sp; q.vy = Math.sin(ph) * sp + (opts.up || 2); q.vz = Math.sin(th) * Math.cos(ph) * sp;
      q.life = q.max = (opts.life || 0.45) * (0.6 + Math.random() * 0.6); q.g = opts.gravity ?? 14;
      this.pPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.2; this.pPos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.2; this.pPos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.2;
      const v = 0.7 + Math.random() * 0.5; this.pCol[i * 3] = c.r * v; this.pCol[i * 3 + 1] = c.g * v; this.pCol[i * 3 + 2] = c.b * v;
    }
  }
  // A translucent arc that flashes where a blade passed. Player = steel blue, enemies = ember.
  slash(pos, yaw, inner, outer, arc, color, life = 0.16, tilt = 0) {
    const geo = sectorGeometry(inner, outer, arc, 20);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2 + tilt, yaw, 0); m.position.copy(pos); m.renderOrder = 997;
    this.scene.add(m);
    this.transients.push({ mesh: m, life, max: life, update: (o, u) => { o.mesh.material.opacity = 0.6 * (1 - u); o.mesh.scale.setScalar(1 + u * 0.25); } });
  }
  ring(pos, color, r0 = 0.5, r1 = 7, life = 0.8, thick = 0.3) {
    const geo = new THREE.TorusGeometry(1, thick, 6, 40);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.copy(pos); m.position.y += 0.25; m.scale.setScalar(r0);
    this.scene.add(m);
    const o = { mesh: m, life, max: life, radius: r0, update: (o, u) => { o.radius = r0 + (r1 - r0) * u; o.mesh.scale.set(o.radius, o.radius, 1); o.mesh.material.opacity = 0.85 * (1 - u * u); } };
    this.transients.push(o); return o;
  }
  makeTelegraph(radius, arc, color = 0xff5a2a) {
    const geo = arc >= Math.PI * 2 - 0.01 ? new THREE.RingGeometry(0.2, radius, 32) : sectorGeometry(0.3, radius, arc, 24);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, 0, 0); m.visible = false; m.renderOrder = 996;
    this.scene.add(m);
    return { mesh: m, show(pos, yaw, u) { m.visible = true; m.position.set(pos.x, pos.y + 0.06, pos.z); m.rotation.y = yaw; m.material.opacity = 0.15 + u * 0.5; const s = 0.35 + u * 0.65; m.scale.set(s, s, 1); }, hide() { m.visible = false; } };
  }
  hitstop(sec) { if (S.hitstop) this.freeze = Math.max(this.freeze, sec); }
  shake(a) { if (S.shake) this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  update(dt) {
    const a = this.pPos;
    for (let i = 0; i < MAXP; i++) {
      const q = this.p[i]; if (q.life <= 0) continue;
      q.life -= dt; if (q.life <= 0) { a[i * 3 + 1] = -9999; continue; }
      q.vy -= q.g * dt; a[i * 3] += q.vx * dt; a[i * 3 + 1] += q.vy * dt; a[i * 3 + 2] += q.vz * dt;
      const f = q.life / q.max; this.pCol[i * 3] *= 0.985; this.pCol[i * 3 + 1] *= 0.98; this.pCol[i * 3 + 2] *= 0.975; if (f < 0.25) { this.pCol[i * 3] *= 0.9; this.pCol[i * 3 + 1] *= 0.9; this.pCol[i * 3 + 2] *= 0.9; }
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const o = this.transients[i]; o.life -= dt; const u = 1 - Math.max(0, o.life / o.max); o.update(o, u);
      if (o.life <= 0) { this.scene.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); this.transients.splice(i, 1); }
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3.2);
    const s = this.shakeAmt * this.shakeAmt * 0.35;
    this.shakeVec.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.4);
  }
}
