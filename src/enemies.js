// Enemies: knaves (melee), thornshots (turrets), and the Hollow Warden (boss).
// Hyperarmour is a property of the MOVE: a committed swing is not interrupted; only a full poise meter opens a punish.
import * as THREE from 'three';
import { makeBody } from './physics.js';
import { buildKnave, buildThornshot, buildWarden } from './rigs.js';
import { diff } from './settings.js';
import { turnToward } from './player.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);
const GRAV = 30;

class Enemy {
  constructor(game, spec, opts) {
    this.game = game; this.spec = spec; this.name = opts.name;
    this.body = makeBody(spec.x, spec.y, spec.z, opts.half, opts.height); this.pos = this.body.pos; this.vel = this.body.vel;
    this.radius = opts.radius; this.height = opts.height;
    this.hpMax = Math.round(opts.hp * diff().enemyHp); this.hp = this.hpMax; this.poiseMax = opts.poise; this.poise = 0; this.poiseDelay = 0;
    this.alive = true; this.state = 'idle'; this.t = 0; this.yaw = spec.yaw ?? Math.PI; this.home = new THREE.Vector3(spec.x, spec.y, spec.z);
    this.time = Math.random() * 10; this.isBoss = false; this.deadT = 0; this.hitDone = false; this.stunT = 0;
  }
  get player() { return this.game.player; }
  distToPlayer() { _w.subVectors(this.player.pos, this.pos); _w.y = 0; return _w.length(); }
  yawToPlayer() { return Math.atan2(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z); }
  forward(out = _v) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get hyper() { return false; }
  takeHit(info) {
    if (!this.alive) return false;
    this.hp -= info.dmg; this.poise += info.poise; this.poiseDelay = 1.3; this.rig.flash(0.08);
    _w.subVectors(this.pos, info.from); _w.y = 0; _w.normalize();
    const kb = info.knock * (this.isBoss ? 0.12 : 0.55);
    if (!this.hyper || this.state === 'stagger') { this.vel.x += _w.x * kb; this.vel.z += _w.z * kb; }
    this.game.sfx('enemyHit');
    if (this.hp <= 0) { this.die(); return 'kill'; }
    if (this.poise >= this.poiseMax) { this.poise = 0; this.stagger(); return 'stagger'; }
    if (!this.hyper && this.state !== 'stagger' && !this.isBoss) { this.state = 'hurt'; this.t = 0; this.stunT = 0.22; this.telegraph?.hide(); }
    return 'hit';
  }
  stagger() { this.state = 'stagger'; this.t = 0; this.stunT = this.isBoss ? 1.8 : 1.0; this.telegraph?.hide(); this.game.sfx('stagger'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, this.height * 0.7, 0)), 0xfff0a0, 24, 6); this.game.hud.toast(this.isBoss ? 'STAGGERED' : '', 0.8); }
  die() {
    this.alive = false; this.state = 'dead'; this.t = 0; this.deadT = 0; this.telegraph?.hide(); this.vel.set(0, 0, 0);
    this.game.sfx(this.isBoss ? 'roar' : 'enemyDie'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, this.height * 0.5, 0)), 0xff8a4a, this.isBoss ? 60 : 24, this.isBoss ? 9 : 6, { life: 0.8 });
    this.game.onEnemyDied(this);
  }
  common(dt) {
    this.time += dt; this.t += dt;
    if (this.poiseDelay > 0) this.poiseDelay -= dt; else this.poise = Math.max(0, this.poise - dt * 2);
    this.rig.tick(dt);
  }
  // Move toward (x,z) at speed, refusing to step off ledges deeper than 1.5 m.
  walkToward(x, z, speed, dt) {
    _w.set(x - this.pos.x, 0, z - this.pos.z); const d = _w.length(); if (d < 0.05) { this.vel.x = 0; this.vel.z = 0; return true; }
    _w.divideScalar(d);
    const nx = this.pos.x + _w.x * (this.radius + 0.4), nz = this.pos.z + _w.z * (this.radius + 0.4);
    const fl = this.game.phys.floorAt(nx, nz, this.pos.y + 0.5);
    if (!fl || this.pos.y - fl.max.y > 1.5) { this.vel.x *= 0.5; this.vel.z *= 0.5; return false; }
    const sp = Math.min(speed, d / dt);
    this.vel.x = _w.x * sp; this.vel.z = _w.z * sp;
    this.yaw = turnToward(this.yaw, Math.atan2(_w.x, _w.z), dt * 9);
    return d < 0.3;
  }
  physics(dt) { this.vel.y -= GRAV * dt; this.game.phys.step(this.body, dt); if (this.body.onGround) { this.vel.x *= Math.exp(-dt * 8); this.vel.z *= Math.exp(-dt * 8); } this.rig.group.position.copy(this.pos); this.rig.group.rotation.y = this.yaw; }
  // Does the player stand inside my melee arc?
  playerInArc(range, arc) {
    _w.subVectors(this.player.pos, this.pos); const dy = _w.y; _w.y = 0; const d = _w.length();
    if (d > range + this.player.radius || dy > 2.2 || dy < -1.2) return false;
    if (d < 0.3) return true;
    return _w.divideScalar(d).dot(this.forward(_v)) >= Math.cos(arc / 2);
  }
}

// ---------------------------------------------------------------- KNAVE
export class Knave extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'Knave', half: 0.32, height: 1.2, radius: 0.5, hp: 4, poise: 3 });
    this.rig = buildKnave(); game.scene.add(this.rig.group);
    this.patrol = spec.patrol || 3; this.target = null; this.waitT = 1 + Math.random() * 2; this.walkPhase = 0; this.rig.group.position.copy(this.pos);
    this.telegraph = game.fx.makeTelegraph(2.1, 1.7);
    this.atk = { windup: 0.55, active: 0.16, recovery: 0.75, range: 2.0, arc: 1.7, dmg: 1 };
  }
  get hyper() { return this.state === 'attack'; }
  update(dt) {
    this.common(dt);
    const p = this.player, d = this.distToPlayer(), dy = p.pos.y - this.pos.y;
    const sees = p.alive && d < 9.5 && Math.abs(dy) < 3.2;
    const st = this.state;
    if (st === 'dead') { this.deadT += dt; this.vel.x = 0; this.vel.z = 0; }
    else if (st === 'hurt' || st === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) this.state = 'idle'; }
    else if (st === 'attack') {
      const a = this.atk, t = this.t;
      if (t < a.windup) { this.telegraph.show(this.pos, this.yaw, t / a.windup); this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 2.5); this.vel.x *= 0.8; this.vel.z *= 0.8; }
      else if (t < a.windup + a.active) {
        if (!this.hitDone) { this.telegraph.hide(); this.hitDone = true; this.game.sfx('swing'); const f = this.forward(_v); this.game.fx.slash(this.pos.clone().add(new THREE.Vector3(f.x * 0.3, 0.9, f.z * 0.3)), this.yaw, 0.5, a.range, a.arc, 0xff6a3a, 0.18, 0.3); this.vel.x = f.x * 4; this.vel.z = f.z * 4;
          if (this.playerInArc(a.range, a.arc)) p.takeDamage(a.dmg, this.pos, { knock: 6 }); }
      }
      else if (t > a.windup + a.active + a.recovery) { this.state = 'idle'; this.waitT = 0.4 + Math.random() * 0.5; }
    }
    else if (sees) {
      if (d < this.atk.range - 0.2 && this.waitT <= 0) { this.state = 'attack'; this.t = 0; this.hitDone = false; this.game.sfx('growl'); }
      else { this.waitT -= dt; this.state = 'chase'; if (d > 1.3) this.walkToward(p.pos.x, p.pos.z, 3.9, dt); else { this.vel.x *= 0.7; this.vel.z *= 0.7; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 8); } }
    }
    else {
      if (st === 'chase') { this.state = 'idle'; this.waitT = 0.8; }
      if (this.state === 'idle') { this.waitT -= dt; this.vel.x *= 0.8; this.vel.z *= 0.8; if (this.waitT <= 0) { const a = Math.random() * 6.28, r = Math.random() * this.patrol; this.target = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); this.state = 'patrol'; } }
      else if (this.state === 'patrol') { if (this.walkToward(this.target.x, this.target.z, 1.6, dt) || this.t > 6) { this.state = 'idle'; this.waitT = 1 + Math.random() * 2.5; } }
      else { this.state = 'idle'; this.waitT = 0.5; }
    }
    this.physics(dt);
    this.pose(dt);
    if (this.deadT > 1.6) { this.rig.group.visible = false; }
  }
  pose(dt) {
    const q = {}, t = this.time, st = this.state; let rate = 14;
    const hs = Math.hypot(this.vel.x, this.vel.z); if (hs > 0.3) this.walkPhase += dt * (5 + hs * 2.2);
    const f = clamp(hs / 3.9, 0, 1);
    if (st === 'attack') {
      const a = this.atk, tt = this.t;
      if (tt < a.windup) { const k = ease(tt / a.windup); q.armR = { x: 2.3 * k, y: 0, z: 0.5 * k }; q.lean = -0.25 * k; q.armL = { x: -0.6 * k, y: 0, z: -0.6 }; q.bodyY = 0.04 * k; q.headX = -0.2 * k; rate = 30; }
      else if (tt < a.windup + a.active) { q.armR = { x: -1.4, y: 0, z: 0.3 }; q.lean = 0.45; q.armL = { x: 0.4, y: 0, z: -0.8 }; q.bodyY = -0.12; q.headX = 0.3; rate = Infinity; }
      else { const k = ease((tt - a.windup - a.active) / a.recovery); q.armR = { x: -1.4 * (1 - k), y: 0, z: 0.3 }; q.lean = 0.45 * (1 - k); q.bodyY = -0.12 * (1 - k); q.armL = { x: 0, y: 0, z: -0.5 }; rate = 10; }
      q.hipR = -0.2; q.hipL = 0.3; q.yaw = 0;
    }
    else if (st === 'stagger') { const w = Math.sin(t * 15) * 0.15; q.lean = -0.4; q.yaw = w; q.armR = { x: -0.5, y: 0, z: 1.3 }; q.armL = { x: -0.5, y: 0, z: -1.3 }; q.headX = -0.4; q.bodyY = -0.08; q.hipR = -0.3; q.hipL = 0.3; rate = 18; }
    else if (st === 'hurt') { q.lean = -0.3; q.armR = { x: -0.8, y: 0, z: 0.9 }; q.armL = { x: -0.7, y: 0, z: -0.9 }; q.headX = -0.3; q.bodyY = 0.03; rate = 30; }
    else if (st === 'dead') { const u = clamp(this.deadT / 0.5, 0, 1), e = ease(u); q.lean = -1.5 * e; q.bodyY = -0.35 * e - Math.max(0, this.deadT - 0.8) * 0.6; q.armR = { x: -0.8 * e, y: 0, z: 1.4 * e }; q.armL = { x: -0.8 * e, y: 0, z: -1.4 * e }; q.hipR = 0.4 * e; q.hipL = -0.3 * e; q.headX = -0.6 * e; rate = Infinity; }
    else {
      const ph = this.walkPhase;
      q.hipR = Math.sin(ph) * 0.8 * f; q.hipL = -Math.sin(ph) * 0.8 * f;
      q.armR = { x: -Math.sin(ph) * 0.5 * f + 0.4, y: 0, z: 0.4 }; q.armL = { x: Math.sin(ph) * 0.6 * f - 0.1, y: 0, z: -0.45 };
      q.lean = 0.28 + 0.15 * f; q.bodyY = Math.abs(Math.sin(ph)) * 0.05 * f + Math.sin(t * 3) * 0.01; q.headX = -0.15 + Math.sin(t * 1.3) * 0.08; q.headY = Math.sin(t * 0.9) * 0.3 * (1 - f); q.yaw = Math.sin(ph) * 0.1 * f;
    }
    this.rig.blend(q, rate, dt);
  }
}

// ---------------------------------------------------------------- THORNSHOT
export class Thornshot extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'Thornshot', half: 0.4, height: 1.5, radius: 0.55, hp: 3, poise: 2 });
    this.rig = buildThornshot(); game.scene.add(this.rig.group); this.rig.group.position.copy(this.pos);
    this.cool = 1.2 + Math.random(); this.headYaw = 0; this.telegraph = game.fx.makeTelegraph(1.3, Math.PI * 2, 0xff5a2a);
  }
  get hyper() { return true; }
  update(dt) {
    this.common(dt);
    const p = this.player, d = this.distToPlayer(), dy = p.pos.y - this.pos.y;
    const sees = p.alive && d < 19 && dy > -6 && dy < 9;
    const st = this.state; const want = this.yawToPlayer();
    if (st === 'dead') { this.deadT += dt; }
    else if (st === 'stagger' || st === 'hurt') { this.stunT -= dt; if (this.stunT <= 0) { this.state = 'idle'; this.cool = 1.0; } }
    else if (st === 'aim') {
      this.yaw = turnToward(this.yaw, want, dt * 4); this.telegraph.show(this.pos, this.yaw, this.t / 0.9);
      if (this.t > 0.9) { this.fire(); this.state = 'recoil'; this.t = 0; this.telegraph.hide(); }
    }
    else if (st === 'recoil') { if (this.t > 0.35) { this.state = 'idle'; this.cool = 1.5 + Math.random() * 0.6; } }
    else { // idle
      if (sees) { this.yaw = turnToward(this.yaw, want, dt * 3); this.cool -= dt; if (this.cool <= 0) { this.state = 'aim'; this.t = 0; } }
      else { this.yaw += Math.sin(this.time * 0.7) * dt * 0.4; }
    }
    this.rig.group.position.copy(this.pos); this.rig.group.rotation.y = this.yaw;
    this.pose(dt);
    if (this.deadT > 1.4) this.rig.group.visible = false;
  }
  fire() {
    const from = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 0.5, 1.15, Math.cos(this.yaw) * 0.5));
    const to = this.player.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
    const dir = to.sub(from); const dist = dir.length(); dir.divideScalar(dist);
    const speed = 13;
    spawnBolt(this.game, from, dir.multiplyScalar(speed).add(new THREE.Vector3(0, dist * 0.35, 0)), this);
    this.game.sfx('bolt');
  }
  pose(dt) {
    const q = {}, st = this.state, t = this.time; let rate = 14;
    q.bob = Math.sin(t * 1.8) * 0.04; q.headX = -0.1 + Math.sin(t * 1.1) * 0.05;
    if (st === 'aim') { const u = clamp(this.t / 0.9, 0, 1); q.open = u; q.headX = -0.25 - u * 0.2; q.recoil = -u * 0.12; rate = 20; }
    else if (st === 'recoil') { q.open = 0.4; q.recoil = 0.2; q.headX = 0.15; rate = 30; }
    else if (st === 'stagger' || st === 'hurt') { q.open = 0.2; q.headX = Math.sin(t * 20) * 0.25; q.recoil = -0.1; rate = 25; }
    else if (st === 'dead') { const u = clamp(this.deadT / 0.6, 0, 1); q.headX = 1.2 * u; q.open = 0; q.bob = -0.5 * u; rate = Infinity; }
    else { q.open = 0.05 + Math.sin(t * 2.3) * 0.05; q.recoil = 0; }
    this.rig.blend(q, rate, dt);
  }
}

// ---------------------------------------------------------------- BOLTS
const boltGeo = new THREE.ConeGeometry(0.09, 0.55, 5);
const boltMat = new THREE.MeshBasicMaterial({ color: 0xff7a3a });
export function spawnBolt(game, from, vel, owner) {
  const mesh = new THREE.Mesh(boltGeo, boltMat); mesh.position.copy(from); game.scene.add(mesh);
  const light = new THREE.PointLight(0xff6a2a, 12, 5, 2); mesh.add(light);
  game.projectiles.push({ pos: from.clone(), vel: vel.clone(), mesh, life: 3.2, owner });
}
export function updateProjectiles(game, dt) {
  const p = game.player;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const b = game.projectiles[i]; b.life -= dt; b.vel.y -= 9 * dt; b.pos.addScaledVector(b.vel, dt); b.mesh.position.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.copy(b.vel).normalize());
    let gone = b.life <= 0;
    if (!gone) {
      _w.subVectors(p.pos, b.pos); _w.y += 1.0;
      if (p.alive && _w.length() < 0.75) {
        const res = p.takeDamage(1, b.owner.pos, { knock: 4 });
        if (res === 'blocked' || res === 'parried') game.fx.burst(b.pos, 0xffd27a, 10, 5); else game.fx.burst(b.pos, 0xff6a3a, 10, 4);
        gone = true;
      } else { const fl = game.phys.floorAt(b.pos.x, b.pos.z, b.pos.y); if (fl && b.pos.y <= fl.max.y) { game.fx.burst(b.pos, 0xff6a3a, 8, 3, { flat: true }); gone = true; } }
    }
    if (gone) { game.scene.remove(b.mesh); game.projectiles.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- THE HOLLOW WARDEN
const WATK = {
  sweep: { windup: 0.78, active: 0.22, recovery: 0.95, range: 4.4, arc: 2.7, dmg: 2, knock: 10 },
  slam: { windup: 0.95, active: 0.75, recovery: 1.05, ringR: 9.5, dmg: 2, knock: 11 },
  charge: { windup: 0.62, active: 0.62, recovery: 0.85, speed: 16, dmg: 2, knock: 12 },
};
export class Warden extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'The Hollow Warden', half: 0.85, height: 3.6, radius: 1.25, hp: 34, poise: 9 });
    this.isBoss = true; this.rig = buildWarden(); game.scene.add(this.rig.group); this.rig.group.position.copy(this.pos);
    this.state = 'dormant'; this.yaw = Math.PI; this.phase = 1; this.atk = null; this.attackT = 0; this.combo = 0; this.thinkT = 0;
    this.tele = { sweep: game.fx.makeTelegraph(4.6, 2.7), slam: game.fx.makeTelegraph(9.5, Math.PI * 2), charge: game.fx.makeTelegraph(13, 0.55) };
    this.telegraph = { hide: () => { for (const k in this.tele) this.tele[k].hide(); } };
    this.ring = null; this.chargeDir = new THREE.Vector3();
  }
  get hyper() { return this.state === 'attack' || this.state === 'rise'; }
  get poiseFrac() { return this.poise / this.poiseMax; }
  wake() { if (this.state === 'dormant') { this.state = 'rise'; this.t = 0; this.game.sfx('roar'); this.game.fx.shake(0.6); } }
  update(dt) { this.common(dt); this.think(dt); this.finish(dt); }
  think(dt) {
    const p = this.player, d = this.distToPlayer();
    const st = this.state; const spd = this.phase === 2 ? 0.74 : 1;
    if (st === 'dormant') { /* kneel */ }
    else if (st === 'rise') { if (this.t > 1.7) { this.state = 'idle'; this.thinkT = 0.6; } }
    else if (st === 'dead') { this.deadT += dt; }
    else if (st === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) { this.state = 'idle'; this.thinkT = 0.3; } }
    else if (st === 'attack') { this.updateAttack(dt, spd); }
    else { // idle / approach
      if (this.hp <= this.hpMax * 0.5 && this.phase === 1) { this.phase = 2; this.game.sfx('roar'); this.game.fx.shake(0.5); this.game.hud.toast('THE WARDEN RAGES', 1.6); this.thinkT = 0.8; this.state = 'rise'; this.t = 0.6; return; }
      this.thinkT -= dt;
      if (!p.alive) { this.vel.x *= 0.8; this.vel.z *= 0.8; return; }
      if (this.thinkT <= 0) {
        const r = Math.random();
        if (d < 4.6) this.begin(r < 0.62 ? 'sweep' : 'slam');
        else if (d < 9.5) { if (r < 0.45) this.begin('charge'); else if (r < 0.7) this.begin('slam'); else { this.walkToward(p.pos.x, p.pos.z, 3.2, dt); this.thinkT = 0.25; } }
        else this.begin(r < 0.7 ? 'charge' : 'slam');
      } else { if (d > 3.4) this.walkToward(p.pos.x, p.pos.z, 3.2, dt); else { this.vel.x *= 0.8; this.vel.z *= 0.8; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 5); } }
    }
    this.finish(dt);
  }
  finish(dt) { this.physics(dt); this.pose(dt); if (this.deadT > 3.5) this.rig.group.visible = false; }
  begin(kind) { this.state = 'attack'; this.atk = kind; this.t = 0; this.hitDone = false; this.ring = null; if (kind === 'charge') this.game.sfx('growl'); }
  updateAttack(dt, spd) {
    const k = this.atk, A = WATK[k], p = this.player, t = this.t;
    const wind = A.windup * spd, rec = A.recovery * (this.phase === 2 ? 0.78 : 1);
    if (t < wind) {
      const u = t / wind;
      if (k === 'charge') { if (u < 0.6) this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 5); this.tele.charge.show(this.pos, this.yaw, u); }
      else if (k === 'sweep') { this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 3.5); this.tele.sweep.show(this.pos, this.yaw, u); }
      else { this.tele.slam.show(this.pos, this.yaw, u); this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 2); }
      this.vel.x *= 0.85; this.vel.z *= 0.85;
    }
    else if (t < wind + A.active) {
      const u = (t - wind) / A.active;
      if (!this.hitDone) { this.hitDone = true; this.telegraph.hide(); this.game.sfx('swing', { heavy: true });
        if (k === 'sweep') { const f = this.forward(_v); this.game.fx.slash(this.pos.clone().add(new THREE.Vector3(f.x * 0.5, 1.6, f.z * 0.5)), this.yaw, 1.0, A.range, A.arc, 0xff6a3a, 0.22, 0.25); this.vel.x = f.x * 3; this.vel.z = f.z * 3; if (this.playerInArc(A.range, A.arc)) p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true }); }
        else if (k === 'slam') { this.game.sfx('slam'); this.game.fx.shake(0.9); this.game.fx.burst(this.pos.clone(), 0xffa060, 40, 9, { flat: true, up: 3 }); this.ring = this.game.fx.ring(this.pos.clone(), 0xff7a3a, 1.2, A.ringR, A.active, 0.35); this.ring.hitDone = false; }
        else { this.forward(this.chargeDir); }
      }
      if (k === 'slam' && this.ring && !this.ring.hitDone) {
        const d = this.distToPlayer(); const grounded = p.pos.y - this.pos.y < 0.9;
        if (grounded && Math.abs(d - this.ring.radius) < 1.0 && d > 1.0) { this.ring.hitDone = true; p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true, parryable: false }); }
      }
      if (k === 'charge') {
        const s = A.speed * (u < 0.85 ? 1 : 0.3); this.vel.x = this.chargeDir.x * s; this.vel.z = this.chargeDir.z * s;
        if (u > 0.05 && this.time % 0.08 < dt) this.game.fx.burst(this.pos.clone(), 0xd8c8a8, 4, 2, { flat: true, up: 1, gravity: 10, life: 0.3 });
        const d = this.distToPlayer(); if (d < this.radius + p.radius + 0.4 && Math.abs(p.pos.y - this.pos.y) < 2.5) { this.t = wind + A.active; p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true }); this.game.fx.shake(0.5); this.vel.x *= 0.2; this.vel.z *= 0.2; }
        if (this.body.hitWall) { this.t = wind + A.active; this.game.fx.shake(0.6); this.game.sfx('slam'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xd0c0a0, 20, 6); this.poise += 3; this.poiseDelay = 1.5; if (this.poise >= this.poiseMax) { this.poise = 0; this.stagger(); return; } }
      }
    }
    else if (t < wind + A.active + rec) { this.vel.x *= 0.85; this.vel.z *= 0.85; }
    else {
      // phase 2 chains a second sweep
      if (this.phase === 2 && k === 'sweep' && this.combo === 0 && this.distToPlayer() < 5.5) { this.combo = 1; this.begin('sweep'); return; }
      this.combo = 0; this.state = 'idle'; this.thinkT = 0.35 + Math.random() * 0.5;
    }
  }
  pose(dt) {
    const q = {}, st = this.state, t = this.time; let rate = 12;
    const base = () => { q.foreR = -0.2; q.foreL = -0.3; q.armL = { x: 0.15, y: 0, z: -0.35 }; q.hipR = 0; q.hipL = 0; q.kneeR = 0.1; q.kneeL = 0.1; q.headX = 0; q.cape = 0.1; q.tumble = 0; q.roll = 0; q.bodyY = 0; q.lean = 0.05; q.yaw = 0; };
    base();
    if (st === 'dormant') { q.hipR = -1.4; q.kneeR = 1.5; q.hipL = -0.3; q.kneeL = 2.2; q.bodyY = -0.52; q.lean = 0.35; q.headX = 0.5; q.armR = { x: -0.4, y: 0, z: 0.25 }; q.foreR = -0.9; q.armL = { x: -0.2, y: 0, z: -0.3 }; q.foreL = -0.6; rate = Infinity; }
    else if (st === 'rise') { const u = clamp(this.t / 1.2, 0, 1), e = ease(u); q.hipR = -1.4 * (1 - e); q.kneeR = 1.5 * (1 - e) + 0.1; q.hipL = -0.3 * (1 - e); q.kneeL = 2.2 * (1 - e) + 0.1; q.bodyY = -0.52 * (1 - e); q.lean = 0.35 * (1 - e) - 0.25 * Math.sin(u * Math.PI); q.headX = 0.5 * (1 - e) - 0.5 * Math.sin(u * Math.PI); q.armR = { x: 1.6 * Math.sin(u * Math.PI) + 0.2, y: 0, z: 0.9 * Math.sin(u * Math.PI) + 0.2 }; q.armL = { x: 1.4 * Math.sin(u * Math.PI), y: 0, z: -0.9 * Math.sin(u * Math.PI) - 0.3 }; rate = 10; }
    else if (st === 'attack') {
      const k = this.atk, A = WATK[k], tt = this.t, spd = this.phase === 2 ? 0.74 : 1, wind = A.windup * spd;
      const wr = tt < wind ? ease(tt / wind) : 1; const act = tt >= wind ? clamp((tt - wind) / A.active, 0, 1) : 0; const rec = tt >= wind + A.active ? ease(clamp((tt - wind - A.active) / (A.recovery * (this.phase === 2 ? 0.78 : 1)), 0, 1)) : 0;
      if (k === 'sweep') { const w = { x: -1.4, y: 0.2, z: 1.5 }, s = { x: -1.6, y: -0.2, z: -0.9 }; const a = act ? { x: w.x + (s.x - w.x) * Math.min(1, act * 1.4), y: 0, z: w.z + (s.z - w.z) * Math.min(1, act * 1.4) } : { x: 0.2 + (w.x - 0.2) * wr, y: 0, z: 0.2 + (w.z - 0.2) * wr }; q.armR = rec ? { x: s.x + (0.2 - s.x) * rec, y: 0, z: s.z + (0.2 - s.z) * rec } : a; q.yaw = rec ? -0.7 * (1 - rec) : (act ? 0.7 - 1.4 * Math.min(1, act * 1.4) : 0.7 * wr); q.lean = 0.1 + 0.2 * act; q.kneeR = 0.3; q.kneeL = 0.3; q.hipR = -0.2; q.hipL = -0.2; rate = act && !rec ? Infinity : 14; }
      else if (k === 'slam') { if (!act && !rec) { q.armR = { x: 2.6 * wr, y: 0, z: 0.4 }; q.armL = { x: 2.2 * wr, y: 0, z: -0.5 }; q.lean = -0.3 * wr; q.bodyY = 0.25 * wr; q.hipR = -0.5 * wr; q.hipL = -0.5 * wr; q.kneeR = 0.5 * wr; q.kneeL = 0.5 * wr; q.headX = -0.4 * wr; rate = 12; } else { const e = rec ? 1 - rec : 1; q.armR = { x: -1.3 * e, y: 0, z: 0.3 }; q.armL = { x: -1.1 * e, y: 0, z: -0.4 }; q.lean = 0.55 * e; q.bodyY = -0.35 * e; q.hipR = -0.9 * e; q.hipL = 0.3 * e; q.kneeR = 1.2 * e; q.kneeL = 0.9 * e; q.headX = 0.4 * e; rate = act && !rec ? Infinity : 8; } }
      else { if (!act && !rec) { q.lean = 0.35 * wr; q.armR = { x: 0.9 * wr, y: 0, z: 0.5 }; q.armL = { x: 0.8 * wr, y: 0, z: -0.5 }; q.hipR = -0.6 * wr; q.kneeR = 0.9 * wr; q.hipL = 0.3 * wr; q.headX = -0.2 * wr; rate = 14; } else if (act && !rec) { const ph = t * 16; q.lean = 0.5; q.hipR = Math.sin(ph) * 1.0; q.hipL = -Math.sin(ph) * 1.0; q.kneeR = Math.max(0, Math.sin(ph - 1)) * 1.4 + 0.2; q.kneeL = Math.max(0, -Math.sin(ph - 1)) * 1.4 + 0.2; q.armR = { x: -1.2, y: 0, z: 0.9 }; q.armL = { x: -0.6, y: 0, z: -0.9 }; q.cape = 1.1; rate = 30; } else { q.lean = 0.5 * (1 - rec); q.armR = { x: -1.2 * (1 - rec), y: 0, z: 0.9 * (1 - rec) + 0.2 }; rate = 8; } }
    }
    else if (st === 'stagger') { const w = Math.sin(t * 12) * 0.14; q.lean = -0.35; q.yaw = w; q.armR = { x: -0.6, y: 0, z: 1.4 }; q.armL = { x: -0.5, y: 0, z: -1.4 }; q.headX = -0.5; q.bodyY = -0.15; q.hipR = -0.4; q.hipL = -0.3; q.kneeR = 0.8; q.kneeL = 0.7; rate = 16; }
    else if (st === 'dead') { const u = clamp(this.deadT / 1.4, 0, 1), e = ease(u); q.hipR = -1.4 * e; q.kneeR = 1.5 * e; q.hipL = -0.3 * e; q.kneeL = 2.2 * e; q.bodyY = -0.52 * e - Math.max(0, this.deadT - 2.2) * 0.8; q.lean = 0.6 * e; q.headX = 0.9 * e; q.armR = { x: -0.3 * e, y: 0, z: 0.25 }; q.armL = { x: -0.2 * e, y: 0, z: -0.3 }; rate = Infinity; }
    else {
      const hs = Math.hypot(this.vel.x, this.vel.z); const f = clamp(hs / 3.2, 0, 1); this.walkPhase = (this.walkPhase || 0) + dt * (3 + hs * 1.2); const ph = this.walkPhase;
      q.hipR = Math.sin(ph) * 0.7 * f; q.hipL = -Math.sin(ph) * 0.7 * f; q.kneeR = Math.max(0, Math.sin(ph - 1)) * 1.0 * f + 0.15; q.kneeL = Math.max(0, -Math.sin(ph - 1)) * 1.0 * f + 0.15;
      q.armR = { x: 0.3 - Math.sin(ph) * 0.3 * f, y: 0, z: 0.3 }; q.armL = { x: Math.sin(ph) * 0.4 * f, y: 0, z: -0.4 }; q.foreR = -0.5;
      q.lean = 0.12 + 0.1 * f; q.bodyY = Math.abs(Math.sin(ph)) * 0.05 * f + Math.sin(t * 1.5) * 0.015; q.headX = Math.sin(t * 0.8) * 0.06; q.cape = 0.2 + 0.4 * f; rate = 12;
    }
    this.rig.blend(q, rate, dt);
  }
}

export function spawnEnemies(game, specs) {
  const out = [];
  for (const s of specs) { if (s.type === 'knave') out.push(new Knave(game, s)); else if (s.type === 'thornshot') out.push(new Thornshot(game, s)); else if (s.type === 'warden') out.push(new Warden(game, s)); }
  return out;
}
