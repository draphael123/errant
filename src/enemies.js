// Enemies: four goblin kinds (knave, skirmisher, brute, slinger), the Hollow Warden (boss) and the training dummy.
// Hyperarmour is a property of the MOVE: a committed swing is not interrupted; only a full poise meter opens a punish.
// Damage is in health points out of 100.
import * as THREE from 'three';
import { makeBody } from './physics.js';
import { buildGoblin, buildWarden, buildDummy, buildWarlord, buildWarlordGear } from './rigs.js';
import { diff } from './settings.js';
import { turnToward } from './player.js';
import { HealthBar } from './fx.js';
import { CharacterModel, has as hasModel } from './models.js';
const GOB_TINT = { knave: null, skirmisher: 0xd8ecb0, brute: 0x8a6a58, slinger: 0xe8dc98 };

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
    this.time = Math.random() * 10; this.isBoss = false; this.deadT = 0; this.hitDone = false; this.stunT = 0; this.bar = null;
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
    const kb = info.knock * (this.isBoss ? 0.12 : 0.95);
    if (!this.hyper || this.state === 'stagger') { this.vel.x += _w.x * kb; this.vel.z += _w.z * kb; }
    this.game.sfx('enemyHit'); if (this.voiceHurt) this.game.sfx(this.voiceHurt);
    if (this.hp <= 0) { this.die(); return 'kill'; }
    if (this.poise >= this.poiseMax) { this.poise = 0; this.stagger(); return 'stagger'; }
    if (!this.hyper && this.state !== 'stagger' && !this.isBoss) { this.state = 'hurt'; this.t = 0; this.stunT = 0.22; this.telegraph?.hide(); }
    return 'hit';
  }
  stagger() { this.state = 'stagger'; this.t = 0; this.stunT = this.isBoss ? 1.8 : 1.0; this.telegraph?.hide(); this.game.sfx('stagger'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, this.height * 0.7, 0)), 0xfff0a0, 24, 6); if (this.isBoss) this.game.hud.toast('STAGGERED', 0.8); }
  die() {
    this.alive = false; this.state = 'dead'; this.t = 0; this.deadT = 0; this.telegraph?.hide(); this.vel.set(0, 0, 0);
    this.game.sfx(this.isBoss ? 'roar' : 'enemyDie'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, this.height * 0.5, 0)), 0xff8a4a, this.isBoss ? 60 : 24, this.isBoss ? 9 : 6, { life: 0.8 });
    this.game.onEnemyDied(this);
  }
  common(dt) {
    this.time += dt; this.t += dt;
    if (this.squashT > 0) { this.squashT -= dt; const b = this.rig.group.userData.baseScale || 1; const k = Math.max(0, this.squashT / 0.14); this.rig.group.scale.set(b * (1 - 0.14 * k), b * (1 + 0.1 * k), b * (1 - 0.14 * k)); if (this.squashT <= 0) this.rig.group.scale.setScalar(b); }
    if (this.poiseDelay > 0) this.poiseDelay -= dt; else this.poise = Math.max(0, this.poise - dt * 2);
    this.rig.tick(dt);
  }
  // Move along a direction at speed, refusing to step off ledges deeper than 1.5 m.
  walkDir(dx, dz, speed, dt, face = true) {
    const l = Math.hypot(dx, dz); if (l < 0.001) return false; dx /= l; dz /= l;
    // blocked by a solid last frame: slide along it rather than push into it
    if (this.body.hitWall) { this.slideT = (this.slideT || 0) + dt; if (this.slideT > 0.7) { this.slideSign = -(this.slideSign || 1); this.slideT = 0; } const a = (this.slideSign || 1) * 1.15, c = Math.cos(a), s = Math.sin(a); const nx = dx * c - dz * s, nz = dx * s + dz * c; dx = nx; dz = nz; } else this.slideT = 0;
    const nx = this.pos.x + dx * (this.radius + 0.4), nz = this.pos.z + dz * (this.radius + 0.4);
    const fl = this.game.phys.floorAt(nx, nz, this.pos.y + 0.5);
    if (!fl || this.pos.y - fl.max.y > 1.5) { this.vel.x *= 0.5; this.vel.z *= 0.5; return false; }
    this.vel.x = dx * speed; this.vel.z = dz * speed;
    if (face) this.yaw = turnToward(this.yaw, Math.atan2(dx, dz), dt * 9);
    return true;
  }
  walkToward(x, z, speed, dt) {
    const dx = x - this.pos.x, dz = z - this.pos.z; const d = Math.hypot(dx, dz); if (d < 0.05) { this.vel.x = 0; this.vel.z = 0; return true; }
    this.walkDir(dx, dz, Math.min(speed, d / dt), dt); return d < 0.3;
  }
  physics(dt) { this.vel.y -= GRAV * dt; this.game.phys.step(this.body, dt); if (this.body.onGround) { this.vel.x *= Math.exp(-dt * 8); this.vel.z *= Math.exp(-dt * 8); } this.rig.group.position.copy(this.pos); this.rig.group.rotation.y = this.yaw; }
  playerInArc(range, arc) {
    _w.subVectors(this.player.pos, this.pos); const dy = _w.y; _w.y = 0; const d = _w.length();
    if (d > range + this.player.radius || dy > 2.2 || dy < -1.2) return false;
    if (d < 0.3) return true;
    return _w.divideScalar(d).dot(this.forward(_v)) >= Math.cos(arc / 2);
  }
  dispose() { const s = this.game.scene; s.remove(this.rig.group); if (this.telegraph && this.telegraph.mesh) s.remove(this.telegraph.mesh); if (this.tele) for (const k in this.tele) s.remove(this.tele[k].mesh); if (this.bar) this.bar.dispose(s); if (this.gear) for (const k in this.gear) s.remove(this.gear[k]); }
}

// ---------------------------------------------------------------- GOBLINS
export const GOB = {
  knave: { name: 'Goblin Knave', hp: 4, poise: 3, speed: 3.9, half: 0.32, height: 1.2, radius: 0.5, see: 9.5, atk: { windup: 0.55, active: 0.16, recovery: 0.75, range: 2.0, arc: 1.7, dmg: 12, knock: 6, lunge: 4 } },
  skirmisher: { name: 'Goblin Skirmisher', hp: 3, poise: 2, speed: 5.6, half: 0.28, height: 1.05, radius: 0.45, see: 11, atk: { windup: 0.28, active: 0.1, recovery: 0.22, range: 1.8, arc: 1.2, dmg: 7, knock: 3, lunge: 5, combo: 2, hop: true } },
  brute: { name: 'Goblin Brute', hp: 10, poise: 7, speed: 2.5, half: 0.5, height: 1.8, radius: 0.72, see: 10, hyperAlways: true, atk: { windup: 0.9, active: 0.22, recovery: 1.15, range: 2.7, arc: 2.0, dmg: 22, knock: 10, lunge: 2, slam: 3.4 } },
  slinger: { name: 'Goblin Slinger', hp: 3, poise: 2, speed: 3.6, half: 0.3, height: 1.15, radius: 0.45, see: 19, ranged: { near: 5, far: 11.5, cooldown: 2.4, windup: 0.75, speed: 15, dmg: 10 } },
};
export class Goblin extends Enemy {
  constructor(game, spec) {
    const kind = spec.kind || 'knave'; const K = GOB[kind];
    super(game, spec, { name: K.name, half: K.half, height: K.height, radius: K.radius, hp: K.hp, poise: K.poise });
    this.kind = kind; this.K = K;
    this.usesModel = hasModel('goblin'); this.rig = this.usesModel ? new CharacterModel('goblin', { height: K.height * 1.02, tint: GOB_TINT[kind] }) : buildGoblin(kind);
    game.scene.add(this.rig.group); this.rig.group.position.copy(this.pos);
    this.patrol = spec.patrol ?? 3; this.target = null; this.waitT = 1 + Math.random() * 2; this.walkPhase = 0; this.combo = 0; this.cool = 1 + Math.random();
    this.telegraph = K.atk ? game.fx.makeTelegraph(K.atk.range + 0.2, K.atk.arc) : game.fx.makeTelegraph(1.2, Math.PI * 2, 0xff5a2a);
    this.bar = new HealthBar(game.scene, 0.9 + K.radius * 0.6);
    this.voiceHurt = kind === 'brute' ? 'growl' : 'gobHurt'; this.chatT = 3 + Math.random() * 6; this.isAdd = !!spec.add;
  }
  get hyper() { return this.K.hyperAlways || this.state === 'attack'; }
  update(dt) {
    this.common(dt);
    const p = this.player, d = this.distToPlayer(), dy = p.pos.y - this.pos.y, K = this.K;
    const sees = p.alive && d < K.see && Math.abs(dy) < (K.ranged ? 8 : 3.2);
    const st = this.state;
    if (this.alive && d < 14) { this.chatT -= dt; if (this.chatT <= 0) { this.game.sfx(st === 'chase' || st === 'attack' ? 'gobGrunt' : 'gobChatter'); this.chatT = 5 + Math.random() * 7; } }
    if (st === 'dead') { this.deadT += dt; this.vel.x = 0; this.vel.z = 0; }
    else if (st === 'hurt' || st === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) { this.state = 'idle'; this.combo = 0; } }
    else if (st === 'attack') this.updateMelee(dt);
    else if (st === 'aim') {
      const R = K.ranged; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 4); this.telegraph.show(this.pos, this.yaw, this.t / R.windup); this.vel.x *= 0.8; this.vel.z *= 0.8;
      if (this.t > R.windup) { this.telegraph.hide(); this.throwStone(); this.state = 'idle'; this.cool = R.cooldown * (0.8 + Math.random() * 0.4); }
    }
    else if (sees && K.ranged) {
      const R = K.ranged; this.cool -= dt;
      if (d < R.near) { this.state = 'retreat'; const ok = this.walkDir(this.pos.x - p.pos.x, this.pos.z - p.pos.z, K.speed, dt, false); this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 6); if (!ok && this.cool <= 0) { this.state = 'aim'; this.t = 0; } }
      else if (d > R.far) { this.state = 'chase'; this.walkToward(p.pos.x, p.pos.z, K.speed, dt); }
      else { this.state = 'chase'; this.vel.x *= 0.8; this.vel.z *= 0.8; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 6); if (this.cool <= 0) { this.state = 'aim'; this.t = 0; this.game.sfx('gobGrunt'); } }
    }
    else if (sees) {
      const A = K.atk;
      if (d < A.range - 0.2 && this.waitT <= 0) { this.state = 'attack'; this.t = 0; this.hitDone = false; this.game.sfx(this.kind === 'brute' ? 'growl' : 'gobGrunt'); }
      else { this.waitT -= dt; this.state = 'chase'; if (d > 1.3) this.walkToward(p.pos.x, p.pos.z, K.speed, dt); else { this.vel.x *= 0.7; this.vel.z *= 0.7; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 8); } }
    }
    else {
      if (st === 'chase' || st === 'retreat') { this.state = 'idle'; this.waitT = 0.8; }
      if (this.state === 'idle') { this.waitT -= dt; this.vel.x *= 0.8; this.vel.z *= 0.8; if (this.waitT <= 0 && this.patrol > 0) { const a = Math.random() * 6.28, r = Math.random() * this.patrol; this.target = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); this.state = 'patrol'; this.t = 0; } }
      else if (this.state === 'patrol') { if (this.walkToward(this.target.x, this.target.z, K.speed * 0.4, dt) || this.t > 6) { this.state = 'idle'; this.waitT = 1 + Math.random() * 2.5; } }
      else { this.state = 'idle'; this.waitT = 0.5; }
    }
    this.physics(dt);
    this.pose(dt);
    if (this.deadT > 1.6) this.rig.group.visible = false;
  }
  updateMelee(dt) {
    const A = this.K.atk, t = this.t, p = this.player;
    if (t < A.windup) { this.telegraph.show(this.pos, this.yaw, t / A.windup); this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * (this.kind === 'skirmisher' ? 6 : 2.5)); this.vel.x *= 0.8; this.vel.z *= 0.8; }
    else if (t < A.windup + A.active) {
      if (!this.hitDone) {
        this.telegraph.hide(); this.hitDone = true; this.game.sfx('swing', { heavy: this.kind === 'brute' }); const f = this.forward(_v);
        this.game.fx.slash(this.pos.clone().add(new THREE.Vector3(f.x * 0.3, this.height * 0.7, f.z * 0.3)), this.yaw, 0.5, A.range, A.arc, 0xff6a3a, 0.18, this.kind === 'brute' ? 0.6 : 0.3);
        this.vel.x = f.x * A.lunge; this.vel.z = f.z * A.lunge;
        let hit = this.playerInArc(A.range, A.arc);
        if (A.slam) { this.game.sfx('slam'); this.game.fx.shake(0.45); this.game.fx.ring(this.pos.clone(), 0xff7a3a, 0.6, A.slam, 0.35, 0.18); this.game.fx.burst(this.pos.clone(), 0xd8c8a8, 18, 5, { flat: true, up: 2 }); const d = this.distToPlayer(); if (d < A.slam + 0.4 && p.pos.y - this.pos.y < 0.8) hit = true; }
        if (hit) p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: this.kind === 'brute' });
      }
    }
    else if (t > A.windup + A.active + A.recovery) {
      this.combo++;
      if (A.combo && this.combo < A.combo && this.distToPlayer() < A.range + 1.2 && p.alive) { this.t = 0; this.hitDone = false; return; }
      this.combo = 0; this.state = 'idle'; this.waitT = A.hop ? 0.9 : 0.4 + Math.random() * 0.5;
      if (A.hop) { const f = this.forward(_v); this.vel.x = -f.x * 6; this.vel.z = -f.z * 6; this.vel.y = 4; }
    }
  }
  throwStone() {
    const R = this.K.ranged;
    const from = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 0.4, 1.1, Math.cos(this.yaw) * 0.4));
    const to = this.player.pos.clone().add(new THREE.Vector3(this.player.vel.x * 0.25, 1.0, this.player.vel.z * 0.25));
    const dir = to.sub(from); const dist = dir.length(); dir.divideScalar(dist);
    spawnBolt(this.game, from, dir.multiplyScalar(R.speed).add(new THREE.Vector3(0, dist * 0.32, 0)), this, 'stone', R.dmg);
    this.game.sfx('bolt');
  }
  animateModel(dt) {
    const M = this.rig, st = this.state, K = this.K; const hs = Math.hypot(this.vel.x, this.vel.z);
    if (st === 'dead') { M.play('Death', { loop: false, clamp: true }); return; }
    if (st === 'attack') { const A = K.atk, t = this.t; const u = t < A.windup ? 0.5 * (t / A.windup) : t < A.windup + A.active ? 0.5 + 0.2 * ((t - A.windup) / A.active) : 0.7 + 0.3 * Math.min(1, (t - A.windup - A.active) / A.recovery); M.drive('Attack', u); return; }
    if (st === 'aim') { M.drive('Attack', 0.45 * Math.min(1, this.t / K.ranged.windup)); return; }
    if (st === 'hurt') { M.drive('HitRecieve', 1 - Math.max(0, this.stunT) / 0.22); return; }
    if (st === 'stagger') { M.play('HitRecieve', { loop: true, speed: 0.5 }); return; }
    if (hs > K.speed * 0.55) { M.play('Run', { speed: 0.7 + hs / K.speed * 0.6 }); return; }
    if (hs > 0.4) { M.play('Walk', { speed: 0.8 + hs * 0.3 }); return; }
    M.play('Idle');
  }
  pose(dt) {
    if (this.usesModel) return this.animateModel(dt);
    const q = {}, t = this.time, st = this.state, K = this.K; let rate = 14;
    const hs = Math.hypot(this.vel.x, this.vel.z); if (hs > 0.3) this.walkPhase += dt * (4 + hs * 2.0) * (this.kind === 'brute' ? 0.7 : 1);
    const f = clamp(hs / K.speed, 0, 1);
    q.browL = 0; q.browR = 0; q.browY = 0; q.mouthOpen = 0; q.mouthW = 1; q.eyeOpen = 1; q.footR = 0; q.footL = 0; q.headZ = 0; q.roll = 0;
    if (st === 'attack') {
      const A = K.atk, tt = this.t; q.browL = 0.5; q.browR = 0.5; q.mouthOpen = 0.9; q.mouthW = 0.8; q.eyeOpen = 0.7; q.hipR = -0.2; q.hipL = 0.3; q.yaw = 0;
      const wind = this.kind === 'skirmisher' ? { x: 0.9, z: 0.6 } : this.kind === 'brute' ? { x: 2.6, z: 0.4 } : { x: 2.3, z: 0.5 };
      const strike = this.kind === 'skirmisher' ? { x: -1.7, z: 0.1 } : { x: -1.4, z: 0.3 };
      if (tt < A.windup) { const k = ease(tt / A.windup); q.armR = { x: wind.x * k, y: 0, z: wind.z * k }; q.lean = (this.kind === 'brute' ? -0.35 : -0.25) * k; q.armL = { x: (this.kind === 'brute' ? 2.2 : -0.6) * k, y: 0, z: -0.6 }; q.bodyY = 0.04 * k; q.headX = -0.2 * k; rate = 30; }
      else if (tt < A.windup + A.active) { q.armR = { x: strike.x, y: 0, z: strike.z }; q.lean = 0.45; q.armL = { x: this.kind === 'brute' ? -1.2 : 0.4, y: 0, z: -0.8 }; q.bodyY = -0.12; q.headX = 0.3; rate = Infinity; }
      else { const k = ease((tt - A.windup - A.active) / A.recovery); q.armR = { x: strike.x * (1 - k), y: 0, z: 0.3 }; q.lean = 0.45 * (1 - k); q.bodyY = -0.12 * (1 - k); q.armL = { x: 0, y: 0, z: -0.5 }; rate = 10; }
    }
    else if (st === 'aim') { const u = clamp(this.t / K.ranged.windup, 0, 1); q.armR = { x: -(u * u) * 14, y: 0, z: 0.9 }; q.armL = { x: -0.8, y: 0, z: -0.5 }; q.lean = 0.1; q.browL = 0.4; q.browR = 0.4; q.eyeOpen = 0.6; q.mouthW = 0.7; rate = Infinity; }
    else if (st === 'stagger') { const w = Math.sin(t * 15) * 0.15; q.lean = -0.4; q.yaw = w; q.headZ = w * 1.5; q.armR = { x: -0.5, y: 0, z: 1.3 }; q.armL = { x: -0.5, y: 0, z: -1.3 }; q.headX = -0.4; q.bodyY = -0.08; q.hipR = -0.3; q.hipL = 0.3; q.eyeOpen = 0.4; q.mouthOpen = 0.5; q.browY = 0.015; q.browL = -0.3; q.browR = 0.3; rate = 18; }
    else if (st === 'hurt') { q.lean = -0.3; q.armR = { x: -0.8, y: 0, z: 0.9 }; q.armL = { x: -0.7, y: 0, z: -0.9 }; q.headX = -0.3; q.bodyY = 0.03; q.browY = 0.02; q.browL = -0.4; q.browR = -0.4; q.mouthOpen = 0.7; q.mouthW = 0.6; rate = 30; }
    else if (st === 'dead') { const u = clamp(this.deadT / 0.5, 0, 1), e = ease(u); q.lean = -1.5 * e; q.bodyY = -0.35 * e - Math.max(0, this.deadT - 0.8) * 0.6; q.armR = { x: -0.8 * e, y: 0, z: 1.4 * e }; q.armL = { x: -0.8 * e, y: 0, z: -1.4 * e }; q.hipR = 0.4 * e; q.hipL = -0.3 * e; q.headX = -0.6 * e; q.eyeOpen = 0.05; q.mouthOpen = 0.4; rate = Infinity; }
    else {
      const ph = this.walkPhase, s = Math.sin(ph);
      q.hipR = s * 0.8 * f; q.hipL = -s * 0.8 * f; q.footR = Math.max(0, s) * 0.5 * f; q.footL = Math.max(0, -s) * 0.5 * f;
      q.armR = { x: -s * 0.5 * f + (this.kind === 'brute' ? 0.6 : 0.4), y: 0, z: 0.4 }; q.armL = { x: s * 0.6 * f - 0.1, y: 0, z: -0.45 };
      q.lean = (this.kind === 'brute' ? 0.18 : 0.28) + 0.15 * f; q.bodyY = Math.abs(s) * 0.05 * f + Math.sin(t * 3) * 0.01; q.headX = -0.15 + Math.sin(t * 1.3) * 0.08; q.headY = Math.sin(t * 0.9) * 0.3 * (1 - f); q.yaw = s * 0.1 * f;
      if (st === 'chase' || st === 'retreat') { q.browL = 0.45; q.browR = 0.45; q.mouthOpen = 0.35; q.mouthW = 0.85; q.eyeOpen = 0.8; if (st === 'retreat') { q.headY = 0; q.browY = 0.012; } }
      else { const peek = Math.sin(t * 0.9) > 0.85 ? 1 : 0; q.browY = 0.012 * peek; q.mouthW = 0.9; }
    }
    this.rig.blend(q, rate, dt);
  }
}

// ---------------------------------------------------------------- PROJECTILES
const boltGeo = new THREE.ConeGeometry(0.09, 0.55, 5);
const stoneGeo = new THREE.DodecahedronGeometry(0.14, 0);
const boltMat = new THREE.MeshBasicMaterial({ color: 0xff7a3a });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
export function spawnBolt(game, from, vel, owner, kind = 'bolt', dmg = 10) {
  const mesh = new THREE.Mesh(kind === 'stone' ? stoneGeo : boltGeo, kind === 'stone' ? stoneMat : boltMat); mesh.position.copy(from); mesh.castShadow = true; game.scene.add(mesh);
  if (kind !== 'stone') { const light = new THREE.PointLight(0xff6a2a, 12, 5, 2); mesh.add(light); }
  game.projectiles.push({ pos: from.clone(), vel: vel.clone(), mesh, life: 3.2, owner, kind, dmg });
}
export function updateProjectiles(game, dt) {
  const p = game.player;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const b = game.projectiles[i]; b.life -= dt; b.vel.y -= (b.kind === 'stone' ? 14 : 9) * dt; b.pos.addScaledVector(b.vel, dt); b.mesh.position.copy(b.pos);
    if (b.kind === 'stone') { b.mesh.rotation.x += dt * 9; b.mesh.rotation.z += dt * 7; } else b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.copy(b.vel).normalize());
    let gone = b.life <= 0;
    if (!gone) {
      _w.subVectors(p.pos, b.pos); _w.y += 1.0;
      if (p.alive && _w.length() < 0.8) {
        const res = p.takeDamage(b.dmg, b.owner.pos, { knock: 4 });
        if (res === 'blocked' || res === 'parried') game.fx.burst(b.pos, 0xffd27a, 10, 5); else { game.fx.burst(b.pos, b.kind === 'stone' ? 0xb0a898 : 0xff6a3a, 10, 4); if (b.kind === 'stone') game.sfx('stoneHit'); }
        gone = true;
      } else { const fl = game.phys.floorAt(b.pos.x, b.pos.z, b.pos.y); if (fl && b.pos.y <= fl.max.y) { game.fx.burst(b.pos, b.kind === 'stone' ? 0xb0a898 : 0xff6a3a, 8, 3, { flat: true }); gone = true; } }
    }
    if (gone) { game.scene.remove(b.mesh); game.projectiles.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- THE HOLLOW WARDEN
const WATK = {
  sweep: { windup: 0.78, active: 0.22, recovery: 0.95, range: 4.4, arc: 2.7, dmg: 20, knock: 10 },
  slam: { windup: 0.95, active: 0.75, recovery: 1.05, ringR: 9.5, dmg: 22, knock: 11 },
  charge: { windup: 0.62, active: 0.62, recovery: 0.85, speed: 16, dmg: 25, knock: 12 },
};
export class Warden extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'The Hollow Warden', half: 0.85, height: 3.6, radius: 1.25, hp: 34, poise: 9 });
    this.isBoss = true; this.rig = buildWarden(); game.scene.add(this.rig.group); this.rig.group.position.copy(this.pos);
    this.state = 'dormant'; this.yaw = Math.PI; this.phase = 1; this.atk = null; this.combo = 0; this.thinkT = 0;
    this.tele = { sweep: game.fx.makeTelegraph(4.6, 2.7), slam: game.fx.makeTelegraph(9.5, Math.PI * 2), charge: game.fx.makeTelegraph(13, 0.55) };
    this.telegraph = { hide: () => { for (const k in this.tele) this.tele[k].hide(); } };
    this.ring = null; this.chargeDir = new THREE.Vector3();
  }
  get hyper() { return this.state === 'attack' || this.state === 'rise'; }
  get poiseFrac() { return this.poise / this.poiseMax; }
  wake() { if (this.state === 'dormant') { this.state = 'rise'; this.t = 0; this.game.sfx('roar'); this.game.fx.shake(0.6); } }
  update(dt) { this.common(dt); this.think(dt); this.physics(dt); this.pose(dt); if (this.deadT > 3.5) this.rig.group.visible = false; }
  think(dt) {
    const p = this.player, d = this.distToPlayer();
    const st = this.state; const spd = this.phase === 2 ? 0.74 : 1;
    if (st === 'dormant') { /* kneel */ }
    else if (st === 'rise') { if (this.t > 1.7) { this.state = 'idle'; this.thinkT = 0.6; } }
    else if (st === 'dead') { this.deadT += dt; }
    else if (st === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) { this.state = 'idle'; this.thinkT = 0.3; } }
    else if (st === 'attack') { this.updateAttack(dt, spd); }
    else {
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
  }
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
      if (this.phase === 2 && k === 'sweep' && this.combo === 0 && this.distToPlayer() < 5.5) { this.combo = 1; this.begin('sweep'); return; }
      this.combo = 0; this.state = 'idle'; this.thinkT = 0.35 + Math.random() * 0.5;
    }
  }
  pose(dt) {
    const q = {}, st = this.state, t = this.time; let rate = 12;
    q.eyeOpen = st === 'attack' && this.atk && this.t < WATK[this.atk].windup * (this.phase === 2 ? 0.74 : 1) ? 1.6 : 1; q.browL = 0.5; q.browR = 0.5; q.mouthOpen = st === 'attack' ? 0.6 : 0.1; q.mouthW = 0.8;
    const base = () => { q.foreR = -0.2; q.foreL = -0.3; q.armL = { x: 0.15, y: 0, z: -0.35 }; q.hipR = 0; q.hipL = 0; q.kneeR = 0.1; q.kneeL = 0.1; q.headX = 0; q.cape = 0.1; q.tumble = 0; q.roll = 0; q.bodyY = 0; q.lean = 0.05; q.yaw = 0; q.footR = 0; q.footL = 0; };
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
    else if (st === 'stagger') { const w = Math.sin(t * 12) * 0.14; q.lean = -0.35; q.yaw = w; q.armR = { x: -0.6, y: 0, z: 1.4 }; q.armL = { x: -0.5, y: 0, z: -1.4 }; q.headX = -0.5; q.bodyY = -0.15; q.hipR = -0.4; q.hipL = -0.3; q.kneeR = 0.8; q.kneeL = 0.7; q.eyeOpen = 0.5; q.mouthOpen = 0.6; rate = 16; }
    else if (st === 'dead') { const u = clamp(this.deadT / 1.4, 0, 1), e = ease(u); q.hipR = -1.4 * e; q.kneeR = 1.5 * e; q.hipL = -0.3 * e; q.kneeL = 2.2 * e; q.bodyY = -0.52 * e - Math.max(0, this.deadT - 2.2) * 0.8; q.lean = 0.6 * e; q.headX = 0.9 * e; q.armR = { x: -0.3 * e, y: 0, z: 0.25 }; q.armL = { x: -0.2 * e, y: 0, z: -0.3 }; q.eyeOpen = 0.05; rate = Infinity; }
    else {
      const hs = Math.hypot(this.vel.x, this.vel.z); const f = clamp(hs / 3.2, 0, 1); this.walkPhase = (this.walkPhase || 0) + dt * (3 + hs * 1.2); const ph = this.walkPhase, s = Math.sin(ph);
      q.hipR = s * 0.7 * f; q.hipL = -s * 0.7 * f; q.kneeR = Math.max(0, Math.sin(ph - 1)) * 1.0 * f + 0.15; q.kneeL = Math.max(0, -Math.sin(ph - 1)) * 1.0 * f + 0.15; q.footR = Math.max(0, s) * 0.5 * f; q.footL = Math.max(0, -s) * 0.5 * f;
      q.armR = { x: 0.3 - s * 0.3 * f, y: 0, z: 0.3 }; q.armL = { x: s * 0.4 * f, y: 0, z: -0.4 }; q.foreR = -0.5;
      q.lean = 0.12 + 0.1 * f; q.bodyY = Math.abs(s) * 0.05 * f + Math.sin(t * 1.5) * 0.015; q.headX = Math.sin(t * 0.8) * 0.06; q.cape = 0.2 + 0.4 * f; rate = 12;
    }
    this.rig.blend(q, rate, dt);
  }
}

// ---------------------------------------------------------------- THE GOBLIN WARLORD (boss)
const WL = {
  slam: { windup: 0.95, active: 0.6, recovery: 1.0, ringR: 7.5, dmg: 22, knock: 11 },
  sweep: { windup: 0.7, active: 0.2, recovery: 0.9, range: 4.2, arc: 2.6, dmg: 18, knock: 10 },
  charge: { windup: 0.6, active: 0.6, recovery: 0.9, speed: 15, dmg: 24, knock: 12 },
  horn: { windup: 1.3, active: 0.1, recovery: 0.8 },
  barrage: { windup: 0.6, active: 1.0, recovery: 0.9, dmg: 10, shots: 3 },
};
export class Warlord extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'The Goblin Warlord', half: 0.8, height: 3.2, radius: 1.15, hp: 40, poise: 9 });
    this.isBoss = true;
    this.usesModel = hasModel('goblin');
    if (this.usesModel) {
      this.rig = new CharacterModel('goblin', { height: 3.2, tint: 0xd89070 }); game.scene.add(this.rig.group);
      this.gear = buildWarlordGear(); this.gear.antlers.scale.setScalar(1.35); this.rig.attach('Head', this.gear.antlers, { pos: [0, 0.75, 0.1], rot: [0, 0, 0] }); this.rig.attach('ArmR_end', this.gear.maul, { pos: [0, 0.25, 0], rot: [Math.PI, 0, 0] }); this.rig.attach('ArmL_end', this.gear.shield, { pos: [0, 0.35, 0], rot: [0, Math.PI, 0] });
    } else { this.rig = buildWarlord(); game.scene.add(this.rig.group); }
    this.rig.group.position.copy(this.pos);
    this.state = 'dormant'; this.yaw = Math.PI; this.phase = 1; this.atk = null; this.combo = 0; this.thinkT = 0; this.hornCool = 6; this.shots = 0; this.voiceHurt = 'bossHurt'; this.walkPhase = 0;
    this.tele = { sweep: game.fx.makeTelegraph(4.4, 2.6), slam: game.fx.makeTelegraph(7.5, Math.PI * 2), charge: game.fx.makeTelegraph(13, 0.55), barrage: game.fx.makeTelegraph(1.6, Math.PI * 2, 0xff8a2a) };
    this.telegraph = { hide: () => { for (const k in this.tele) this.tele[k].hide(); } };
    this.ring = null; this.chargeDir = new THREE.Vector3();
  }
  get hyper() { return this.state === 'attack' || this.state === 'rise'; }
  get poiseFrac() { return this.poise / this.poiseMax; }
  wake() { if (this.state === 'dormant') { this.state = 'rise'; this.t = 0; this.game.sfx('roar'); this.game.fx.shake(0.6); } }
  reset(spec) { this.pos.set(spec.x, spec.y, spec.z); this.vel.set(0, 0, 0); this.hp = this.hpMax; this.poise = 0; this.state = 'dormant'; this.phase = 1; this.telegraph.hide(); this.yaw = Math.PI; this.hornCool = 6; this.alive = true; this.deadT = 0; this.rig.group.visible = true; }
  update(dt) { this.common(dt); this.think(dt); this.physics(dt); this.pose(dt); if (this.deadT > 3.5) this.rig.group.visible = false; }
  adds() { return this.game.enemies.filter(e => e.isAdd && e.alive).length; }
  think(dt) {
    const p = this.player, d = this.distToPlayer(); const st = this.state; const spd = this.phase === 2 ? 0.75 : 1;
    if (st === 'dormant') return;
    if (st === 'rise') { if (this.t > 1.7) { this.state = 'idle'; this.thinkT = 0.6; } return; }
    if (st === 'dead') { this.deadT += dt; return; }
    if (st === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) { this.state = 'idle'; this.thinkT = 0.3; } return; }
    if (st === 'attack') { this.updateAttack(dt, spd); return; }
    if (this.hp <= this.hpMax * 0.5 && this.phase === 1) { this.phase = 2; this.game.sfx('roar'); this.game.fx.shake(0.5); this.game.hud.toast('THE WARLORD RAGES', 1.6); this.game.onBossRage && this.game.onBossRage(this); this.thinkT = 0.8; this.state = 'rise'; this.t = 0.6; return; }
    this.thinkT -= dt; this.hornCool -= dt;
    if (!p.alive) { this.vel.x *= 0.8; this.vel.z *= 0.8; return; }
    if (this.thinkT <= 0) {
      const r = Math.random();
      if (this.hornCool <= 0 && this.adds() < 2 && d > 3) this.begin('horn');
      else if (d < 4.5) this.begin(r < 0.55 ? 'sweep' : 'slam');
      else if (d < 10) { if (r < 0.35) this.begin('charge'); else if (r < 0.65) this.begin('barrage'); else if (r < 0.8) this.begin('slam'); else { this.walkToward(p.pos.x, p.pos.z, 3.4, dt); this.thinkT = 0.25; } }
      else this.begin(r < 0.5 ? 'charge' : 'barrage');
    } else { if (d > 3.4) this.walkToward(p.pos.x, p.pos.z, 3.4, dt); else { this.vel.x *= 0.8; this.vel.z *= 0.8; this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 5); } }
  }
  begin(kind) { this.state = 'attack'; this.atk = kind; this.t = 0; this.hitDone = false; this.ring = null; this.shots = 0; if (kind === 'charge' || kind === 'sweep') this.game.sfx('growl'); if (kind === 'horn') this.hornCool = 16; }
  updateAttack(dt, spd) {
    const k = this.atk, A = WL[k], p = this.player, t = this.t; const wind = A.windup * spd, rec = A.recovery * (this.phase === 2 ? 0.78 : 1);
    if (t < wind) {
      const u = t / wind;
      if (k === 'charge') { if (u < 0.6) this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 5); this.tele.charge.show(this.pos, this.yaw, u); }
      else if (k === 'sweep') { this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 3.5); this.tele.sweep.show(this.pos, this.yaw, u); }
      else if (k === 'slam') { this.tele.slam.show(this.pos, this.yaw, u); this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 2); }
      else if (k === 'barrage') { this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 4); this.tele.barrage.show(this.pos, this.yaw, u); }
      this.vel.x *= 0.85; this.vel.z *= 0.85;
    }
    else if (t < wind + A.active) {
      const u = (t - wind) / A.active;
      if (!this.hitDone) { this.hitDone = true; this.telegraph.hide();
        if (k === 'sweep') { this.game.sfx('swing', { heavy: true }); const f = this.forward(_v); this.game.fx.slash(this.pos.clone().add(new THREE.Vector3(f.x * 0.5, 1.5, f.z * 0.5)), this.yaw, 1.0, A.range, A.arc, 0xff6a3a, 0.22, 0.25); this.vel.x = f.x * 3; this.vel.z = f.z * 3; if (this.playerInArc(A.range, A.arc)) p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true }); }
        else if (k === 'slam') { this.game.sfx('slam'); this.game.fx.shake(0.9); this.game.fx.burst(this.pos.clone(), 0xffa060, 40, 9, { flat: true, up: 3 }); this.ring = this.game.fx.ring(this.pos.clone(), 0xff7a3a, 1.2, A.ringR, A.active, 0.35); this.ring.hitDone = false; }
        else if (k === 'charge') { this.forward(this.chargeDir); this.game.sfx('roar'); }
        else if (k === 'horn') { this.game.sfx('horn'); this.game.hud.toast('THE WARLORD CALLS', 1.4); this.game.summon && this.game.summon(2); }
      }
      if (k === 'barrage') { const due = Math.floor(u * A.shots + 0.001); if (this.shots < due && this.shots < A.shots) { this.shots++; this.throwStone(A.dmg); } }
      if (k === 'slam' && this.ring && !this.ring.hitDone) { const d = this.distToPlayer(); const grounded = p.pos.y - this.pos.y < 0.9; if (grounded && Math.abs(d - this.ring.radius) < 1.0 && d > 1.0) { this.ring.hitDone = true; p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true, parryable: false }); } }
      if (k === 'charge') {
        const s = A.speed * (u < 0.85 ? 1 : 0.3); this.vel.x = this.chargeDir.x * s; this.vel.z = this.chargeDir.z * s;
        if (u > 0.05 && this.time % 0.08 < dt) this.game.fx.burst(this.pos.clone(), 0xd8c8a8, 4, 2, { flat: true, up: 1, gravity: 10, life: 0.3 });
        const d = this.distToPlayer(); if (d < this.radius + p.radius + 0.4 && Math.abs(p.pos.y - this.pos.y) < 2.5) { this.t = wind + A.active; p.takeDamage(A.dmg, this.pos, { knock: A.knock, heavy: true }); this.game.fx.shake(0.5); this.vel.x *= 0.2; this.vel.z *= 0.2; }
        if (this.body.hitWall) { this.t = wind + A.active; this.game.fx.shake(0.6); this.game.sfx('slam'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xd0c0a0, 20, 6); this.poise += 4; this.poiseDelay = 1.5; if (this.poise >= this.poiseMax) { this.poise = 0; this.stagger(); return; } }
      }
    }
    else if (t < wind + A.active + rec) { this.vel.x *= 0.85; this.vel.z *= 0.85; }
    else { if (this.phase === 2 && k === 'sweep' && this.combo === 0 && this.distToPlayer() < 5.5) { this.combo = 1; this.begin('sweep'); return; } this.combo = 0; this.state = 'idle'; this.thinkT = 0.35 + Math.random() * 0.5; }
  }
  throwStone(dmg) {
    const from = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 0.8, 2.4, Math.cos(this.yaw) * 0.8));
    const to = this.player.pos.clone().add(new THREE.Vector3(this.player.vel.x * 0.3 + (Math.random() - 0.5) * 2, 1.0, this.player.vel.z * 0.3 + (Math.random() - 0.5) * 2));
    const dir = to.sub(from); const dist = dir.length(); dir.divideScalar(dist);
    spawnBolt(this.game, from, dir.multiplyScalar(16).add(new THREE.Vector3(0, dist * 0.3, 0)), this, 'stone', dmg); this.game.sfx('bolt');
  }
  animateModel(dt) {
    const M = this.rig, st = this.state; const hs = Math.hypot(this.vel.x, this.vel.z);
    if (st === 'dead') { M.play('Death', { loop: false, clamp: true }); return; }
    if (st === 'dormant') { M.drive('Idle', 0.2); return; }
    if (st === 'rise') { M.play('Jump', { loop: false, clamp: true }); return; }
    if (st === 'stagger') { M.play('HitRecieve', { loop: true, speed: 0.45 }); return; }
    if (st === 'attack') {
      const k = this.atk, A = WL[k], t = this.t, spd = this.phase === 2 ? 0.75 : 1, wind = A.windup * spd;
      if (k === 'barrage') { const u = t < wind ? 0.45 * (t / wind) : 0.45 + ((t - wind) % (A.active / A.shots)) / (A.active / A.shots) * 0.4; M.drive('Attack', Math.min(0.95, u)); return; }
      if (k === 'horn') { M.drive('Jump', t < wind ? 0.35 * (t / wind) : 0.35); return; }
      if (k === 'charge' && t >= wind && t < wind + A.active) { M.play('Run', { speed: 1.6 }); return; }
      const u = t < wind ? 0.5 * (t / wind) : t < wind + A.active ? 0.5 + 0.2 * ((t - wind) / A.active) : 0.7 + 0.3 * Math.min(1, (t - wind - A.active) / (A.recovery * (this.phase === 2 ? 0.78 : 1)));
      M.drive('Attack', u); return;
    }
    if (hs > 1.8) { M.play('Run', { speed: 0.9 }); return; }
    if (hs > 0.4) { M.play('Walk', { speed: 1 }); return; }
    M.play('Idle');
  }
  pose(dt) {
    if (this.usesModel) return this.animateModel(dt);
    const q = {}, st = this.state, t = this.time; let rate = 12;
    q.browL = 0.5; q.browR = 0.5; q.browY = 0; q.mouthOpen = st === 'attack' ? 0.7 : 0.15; q.mouthW = 0.85; q.eyeOpen = st === 'attack' && this.t < WL[this.atk].windup ? 1.4 : 1; q.footR = 0; q.footL = 0; q.headZ = 0; q.roll = 0; q.headY = 0; q.yaw = 0; q.bodyY = 0; q.lean = 0.15; q.headX = 0;
    q.armR = { x: 0.4, y: 0, z: 0.5 }; q.armL = { x: 0.1, y: 0, z: -0.5 }; q.hipR = 0; q.hipL = 0;
    if (st === 'dormant') { q.lean = 0.5; q.bodyY = -0.22; q.hipR = -1.3; q.hipL = -1.3; q.headX = 0.55; q.armR = { x: -0.6, y: 0, z: 0.4 }; q.armL = { x: -0.5, y: 0, z: -0.4 }; q.eyeOpen = 0.3; q.mouthOpen = 0; rate = Infinity; }
    else if (st === 'rise') { const u = clamp(this.t / 1.2, 0, 1), e = ease(u), s = Math.sin(u * Math.PI); q.lean = 0.5 * (1 - e) - 0.3 * s; q.bodyY = -0.22 * (1 - e); q.hipR = -1.3 * (1 - e); q.hipL = -1.3 * (1 - e); q.headX = 0.55 * (1 - e) - 0.5 * s; q.armR = { x: 1.8 * s + 0.3, y: 0, z: 1.0 * s + 0.4 }; q.armL = { x: 1.6 * s, y: 0, z: -1.0 * s - 0.4 }; q.mouthOpen = 0.9 * s; rate = 10; }
    else if (st === 'attack') {
      const k = this.atk, A = WL[k], tt = this.t, spd = this.phase === 2 ? 0.75 : 1, wind = A.windup * spd;
      const wr = tt < wind ? ease(tt / wind) : 1, act = tt >= wind ? clamp((tt - wind) / A.active, 0, 1) : 0, rec = tt >= wind + A.active ? ease(clamp((tt - wind - A.active) / (A.recovery * (this.phase === 2 ? 0.78 : 1)), 0, 1)) : 0;
      if (k === 'sweep') { const wx = -1.4, wz = 1.6, sx = -1.6, sz = -1.0; const kk = Math.min(1, act * 1.4); q.armR = rec ? { x: sx * (1 - rec), y: 0, z: sz * (1 - rec) + 0.5 * rec } : act ? { x: wx + (sx - wx) * kk, y: 0, z: wz + (sz - wz) * kk } : { x: 0.4 + (wx - 0.4) * wr, y: 0, z: 0.5 + (wz - 0.5) * wr }; q.yaw = rec ? -0.7 * (1 - rec) : act ? 0.7 - 1.4 * kk : 0.7 * wr; q.lean = 0.2 + 0.25 * act; rate = act && !rec ? Infinity : 14; }
      else if (k === 'slam') { if (!act && !rec) { q.armR = { x: 2.7 * wr, y: 0, z: 0.4 }; q.armL = { x: 2.3 * wr, y: 0, z: -0.5 }; q.lean = -0.3 * wr; q.bodyY = 0.25 * wr; q.hipR = -0.4 * wr; q.hipL = -0.4 * wr; q.headX = -0.4 * wr; } else { const ee = rec ? 1 - rec : 1; q.armR = { x: -1.4 * ee, y: 0, z: 0.3 }; q.armL = { x: -1.1 * ee, y: 0, z: -0.4 }; q.lean = 0.6 * ee; q.bodyY = -0.3 * ee; q.hipR = -0.9 * ee; q.hipL = 0.3 * ee; q.headX = 0.4 * ee; rate = act && !rec ? Infinity : 8; } }
      else if (k === 'charge') { if (act && !rec) { const ph = t * 16, s = Math.sin(ph); q.lean = 0.55; q.hipR = s * 1.0; q.hipL = -s * 1.0; q.footR = Math.max(0, s) * 0.5; q.footL = Math.max(0, -s) * 0.5; q.armR = { x: -1.2, y: 0, z: 0.9 }; q.armL = { x: -0.8, y: 0, z: -0.9 }; rate = 30; } else { q.lean = 0.35 * (rec ? 1 - rec : wr); q.armR = { x: 0.9 * wr, y: 0, z: 0.5 }; q.armL = { x: 0.8 * wr, y: 0, z: -0.6 }; q.headX = -0.2 * wr; } }
      else if (k === 'horn') { q.armL = { x: -2.6 * wr, y: 0, z: -0.3 }; q.headX = -0.5 * wr; q.lean = -0.15 * wr; q.mouthOpen = 0.9 * wr; q.armR = { x: 0.3, y: 0, z: 0.9 }; rate = 14; }
      else if (k === 'barrage') { const ph = act ? act * A.shots * Math.PI * 2 : 0; q.armR = { x: act ? -1.4 + Math.sin(ph) * 1.0 : -0.3 - wr * 0.8, y: 0, z: 0.7 }; q.armL = { x: -0.4, y: 0, z: -0.5 }; q.lean = 0.2; q.yaw = act ? Math.sin(ph) * 0.3 : 0; rate = 20; }
    }
    else if (st === 'stagger') { const w = Math.sin(t * 12) * 0.14; q.lean = -0.35; q.yaw = w; q.headZ = w * 1.2; q.armR = { x: -0.6, y: 0, z: 1.4 }; q.armL = { x: -0.5, y: 0, z: -1.4 }; q.headX = -0.5; q.bodyY = -0.12; q.hipR = -0.4; q.hipL = 0.3; q.eyeOpen = 0.5; q.mouthOpen = 0.6; q.browL = -0.3; q.browR = 0.3; rate = 16; }
    else if (st === 'dead') { const u = clamp(this.deadT / 1.4, 0, 1), e = ease(u); q.lean = -1.4 * e; q.bodyY = -0.3 * e - Math.max(0, this.deadT - 2.2) * 0.8; q.headX = -0.6 * e; q.armR = { x: -0.8 * e, y: 0, z: 1.4 * e }; q.armL = { x: -0.8 * e, y: 0, z: -1.4 * e }; q.hipR = 0.5 * e; q.hipL = -0.3 * e; q.eyeOpen = 0.05; q.mouthOpen = 0.5; rate = Infinity; }
    else {
      const hs = Math.hypot(this.vel.x, this.vel.z); const f = clamp(hs / 3.4, 0, 1); this.walkPhase += dt * (2.5 + hs * 1.1); const ph = this.walkPhase, s = Math.sin(ph);
      q.hipR = s * 0.75 * f; q.hipL = -s * 0.75 * f; q.footR = Math.max(0, s) * 0.5 * f; q.footL = Math.max(0, -s) * 0.5 * f;
      q.armR = { x: 0.5 - s * 0.3 * f, y: 0, z: 0.5 }; q.armL = { x: s * 0.4 * f, y: 0, z: -0.5 }; q.lean = 0.18 + 0.12 * f; q.bodyY = Math.abs(s) * 0.05 * f + Math.sin(t * 1.5) * 0.012; q.headX = Math.sin(t * 0.8) * 0.06; q.headY = Math.sin(t * 0.6) * 0.15; rate = 12;
      if (this.phase === 2 && this.hp < this.hpMax * 0.2) { q.browY = 0.02; q.browL = -0.3; q.browR = -0.3; q.eyeOpen = 1.2; q.mouthOpen = 0.5; } // panic at low health
    }
    this.rig.blend(q, rate, dt);
  }
}

// ---------------------------------------------------------------- TRAINING DUMMY (tutorial only; never dies)
export class Dummy extends Enemy {
  constructor(game, spec) {
    super(game, spec, { name: 'Training Dummy', half: 0.4, height: 1.7, radius: 0.55, hp: 999, poise: 4 });
    this.usesModel = hasModel('goblin'); this.rig = this.usesModel ? new CharacterModel('goblin', { height: 1.75, tint: 0xd8c898 }) : buildDummy(); game.scene.add(this.rig.group); this.rig.group.position.copy(this.pos);
    this.hits = { light: 0, heavy: 0 }; this.results = { blocked: 0, parried: 0, hit: 0, dodged: 0 }; this.mode = 'idle'; this.swingT = 1.5; this.wobble = 0; this.telegraph = game.fx.makeTelegraph(2.3, 1.9);
    this.atk = { windup: 1.0, active: 0.16, recovery: 0.9, range: 2.2, arc: 1.9 };
  }
  get hyper() { return this.state === 'attack'; }
  takeHit(info) {
    this.rig.flash(0.08); this.wobble = 1; this.game.sfx('enemyHit');
    if (info.move === 'heavy') this.hits.heavy++; else this.hits.light++;
    this.poise += info.poise; this.poiseDelay = 1.3;
    if (this.poise >= this.poiseMax) { this.poise = 0; this.state = 'stagger'; this.t = 0; this.stunT = 1.2; this.telegraph.hide(); this.game.sfx('stagger'); this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xfff0a0, 20, 5); return 'stagger'; }
    return 'hit';
  }
  update(dt) {
    this.common(dt); const p = this.player, d = this.distToPlayer();
    this.yaw = turnToward(this.yaw, this.yawToPlayer(), dt * 2);
    if (this.state === 'stagger') { this.stunT -= dt; if (this.stunT <= 0) this.state = 'idle'; }
    else if (this.state === 'attack') {
      const a = this.atk, t = this.t;
      if (t < a.windup) this.telegraph.show(this.pos, this.yaw, t / a.windup);
      else if (t < a.windup + a.active) {
        if (!this.hitDone) { this.hitDone = true; this.telegraph.hide(); this.game.sfx('swing'); const f = this.forward(_v); this.game.fx.slash(this.pos.clone().add(new THREE.Vector3(f.x * 0.3, 1.2, f.z * 0.3)), this.yaw, 0.5, a.range, a.arc, 0xff6a3a, 0.18, 0.3);
          if (this.playerInArc(a.range, a.arc)) { const rolling = p.state === 'roll' || p.state === 'dash'; const res = p.takeDamage(8, this.pos, { knock: 4 }); if (res === 'blocked') this.results.blocked++; else if (res === 'parried') { this.results.parried++; this.state = 'stagger'; this.t = 0; this.stunT = 1.4; } else if (res === 'immune' && rolling) this.results.dodged++; else if (res === 'hit') this.results.hit++; }
          else if ((p.state === 'roll' || p.state === 'dash') && d < a.range + 1.2) this.results.dodged++; }
      }
      else if (t > a.windup + a.active + a.recovery) { this.state = 'idle'; this.swingT = 1.6; }
    }
    else if (this.mode === 'swing' && p.alive) { this.swingT -= dt; if (this.swingT <= 0 && d < 3.6) { this.state = 'attack'; this.t = 0; this.hitDone = false; } }
    this.wobble = Math.max(0, this.wobble - dt * 2.2);
    this.rig.group.position.copy(this.pos); this.rig.group.rotation.y = this.yaw;
    this.pose(dt);
  }
  pose(dt) {
    if (this.usesModel) { const M = this.rig, st = this.state, a = this.atk, t = this.t; if (st === 'stagger') M.play('HitRecieve', { loop: true, speed: 0.45 }); else if (st === 'attack') M.drive('Attack', t < a.windup ? 0.5 * (t / a.windup) : t < a.windup + a.active ? 0.5 + 0.2 * ((t - a.windup) / a.active) : 0.7 + 0.3 * Math.min(1, (t - a.windup - a.active) / a.recovery)); else if (this.wobble > 0.35) M.drive('HitRecieve', 1 - this.wobble); else M.play('Idle'); return; }
    const q = {}, t = this.time, st = this.state; let rate = 16;
    const w = Math.sin(t * 22) * this.wobble * 0.25;
    q.lean = w; q.roll = Math.cos(t * 19) * this.wobble * 0.2; q.browL = 0; q.browR = 0; q.mouthOpen = 0; q.mouthW = 1; q.eyeOpen = 1; q.headY = 0; q.browY = 0;
    if (st === 'attack') { const a = this.atk, tt = this.t; if (tt < a.windup) { const k = ease(tt / a.windup); q.armR = { x: 2.0 * k, y: 0, z: 0.4 }; q.yaw = 0.5 * k; q.browL = 0.4 * k; q.browR = 0.4 * k; rate = 24; } else if (tt < a.windup + a.active) { q.armR = { x: -1.3, y: 0, z: 0.3 }; q.yaw = -0.5; q.mouthOpen = 0.6; rate = Infinity; } else { const k = ease((tt - a.windup - a.active) / a.recovery); q.armR = { x: -1.3 * (1 - k), y: 0, z: 0.3 }; q.yaw = -0.5 * (1 - k); rate = 10; } }
    else if (st === 'stagger') { q.lean = -0.25 + w; q.headY = Math.sin(t * 9) * 0.4; q.eyeOpen = 0.4; q.mouthOpen = 0.5; q.browL = -0.3; q.browR = 0.3; q.armR = { x: -0.3, y: 0, z: 0.9 }; rate = 16; }
    else { q.armR = { x: 0.2, y: 0, z: 0.35 }; q.armL = { x: 0, y: 0, z: -0.2 }; q.yaw = 0; if (this.wobble > 0.3) { q.eyeOpen = 0.5; q.mouthOpen = 0.4; q.browY = 0.02; } else { q.browY = Math.sin(t * 0.7) > 0.9 ? 0.015 : 0; q.mouthW = 1.3; } }
    this.rig.blend(q, rate, dt);
  }
}

export function spawnEnemies(game, specs) {
  const out = [];
  for (const s of specs) {
    if (s.type === 'goblin' || s.type === 'knave') out.push(new Goblin(game, { kind: 'knave', ...s }));
    else if (s.type === 'warden') out.push(new Warden(game, s));
    else if (s.type === 'warlord') out.push(new Warlord(game, s));
    else if (s.type === 'dummy') out.push(new Dummy(game, s));
  }
  return out;
}
