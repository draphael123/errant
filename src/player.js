// The knight. Frame data (seconds) is authoritative; the pose is stretched to fit it.
import * as THREE from 'three';
import { makeBody } from './physics.js';
import { buildKnight } from './rigs.js';
import { S, diff } from './settings.js';

export const MOVES = {
  light1: { windup: 0.11, active: 0.12, recovery: 0.22, dmg: 1, poise: 1, lunge: 3.2, arc: 1.5, range: 2.4, knock: 3, next: 'light2', chainAt: 0.55, cost: 12 },
  light2: { windup: 0.10, active: 0.12, recovery: 0.24, dmg: 1, poise: 1, lunge: 3.2, arc: 1.5, range: 2.4, knock: 3, next: 'light3', chainAt: 0.55, cost: 12 },
  light3: { windup: 0.17, active: 0.14, recovery: 0.38, dmg: 2, poise: 2, lunge: 4.2, arc: 1.7, range: 2.6, knock: 6, next: null, chainAt: 1, cost: 14 },
  heavy: { windup: 0.46, active: 0.16, recovery: 0.52, dmg: 3, poise: 4, lunge: 2.2, arc: 2.3, range: 2.9, knock: 8, hyper: true, next: null, chainAt: 1, cost: 28 },
  air: { windup: 0.07, active: 0.15, recovery: 0.2, dmg: 1, poise: 1, lunge: 0, arc: 2.6, range: 2.5, knock: 3, next: null, chainAt: 1, cost: 10, air: true },
};
for (const k in MOVES) MOVES[k].name = k;
const PH = { gravity: 30, run: 8.2, accel: 64, airAccel: 28, decel: 54, jump: 11.6, djump: 10.6, coyote: 0.12, buffer: 0.14, maxFall: 34, rollSpeed: 10.8, rollTime: 0.5, blockSpeed: 0.42 };
const STA = { max: 100, regen: 30, delay: 0.5, roll: 20, blockHit: 22 };

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);
const IDLE_ARM_R = { x: 0.12, y: 0, z: 0.14 };

export class Player {
  constructor(scene, phys, fx, sfx, hud) {
    this.scene = scene; this.phys = phys; this.fx = fx; this.sfx = sfx; this.hud = hud;
    this.body = makeBody(0, 0, 0, 0.36, 1.7);
    this.rig = buildKnight(); scene.add(this.rig.group);
    this.pos = this.body.pos; this.vel = this.body.vel;
    this.hpMax = 6; this.hp = 6; this.stamina = STA.max; this.staDelay = 0;
    this.state = 'idle'; this.t = 0; this.yaw = 0; this.runPhase = 0; this.time = 0;
    this.attack = null; this.iframes = 0; this.canDouble = true; this.airAttackUsed = false; this.coyote = 0; this.jumpBuf = 0; this.wasGround = false;
    this.blockT = 0; this.rollDir = new THREE.Vector3(0, 0, 1); this.rollT = 0; this.stunT = 0; this.hurtT = 0; this.landT = 0; this.landHard = false;
    this.jumpT = 99; this.flipT = 99; this.airT = 0; this.emoteKind = null; this.emoteT = 0; this.lookAt = null;
    this.deadT = 0; this.god = false; this.lastGround = new THREE.Vector3(); this.speedFrac = 0; this.wish = new THREE.Vector3();
    this.stats = { jumps: 0, doubles: 0, rolls: 0, hits: 0, blocks: 0, parries: 0, heavies: 0, lights: 0, moved: 0, lookMoved: 0 };
  }
  get blocking() { return this.state === 'block'; }
  get radius() { return 0.5; }
  get alive() { return this.state !== 'dead'; }
  forward(out = _v) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  emote(kind, seconds = 0.8) { this.emoteKind = kind; this.emoteT = seconds; }

  respawn(pos, yaw = 0, fullHeal = true) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.state = 'idle'; this.t = 0; this.attack = null; this.iframes = 1.0; if (fullHeal) this.hp = this.hpMax; this.stamina = STA.max;
    this.body.groundBox = null; this.body.onGround = false; this.canDouble = true; this.lastGround.copy(pos); this.jumpT = 99; this.flipT = 99; this.emoteKind = null;
  }

  // ---- damage in
  takeDamage(dmg, from, opts = {}) {
    if (!this.alive) return 'dead';
    if (this.iframes > 0 || this.god) return 'immune';
    _w.subVectors(this.pos, from); _w.y = 0; const dist = _w.length() || 1; _w.divideScalar(dist);
    const fwd = this.forward(_v); const facingIt = fwd.dot(_w) < -0.25;
    if (this.state === 'block' && facingIt && !opts.unblockable) {
      if (this.blockT < 0.17 && opts.parryable !== false) { this.stats.parries++; this.emote('grin', 1.0); this.sfx('parry'); this.fx.burst(this.pos.clone().add(new THREE.Vector3(fwd.x * 0.8, 1.2, fwd.z * 0.8)), 0xfff2b0, 22, 7); this.fx.hitstop(0.09); this.fx.shake(0.35); this.hud.toast('PARRY', 0.9); return 'parried'; }
      this.stats.blocks++;
      this.stamina -= STA.blockHit * (opts.heavy ? 1.6 : 1); this.staDelay = 0.7;
      this.sfx('clang'); this.fx.burst(this.pos.clone().add(new THREE.Vector3(fwd.x * 0.7, 1.2, fwd.z * 0.7)), 0xffd070, 12, 5); this.fx.shake(0.2);
      this.vel.x += _w.x * 3.5; this.vel.z += _w.z * 3.5; this.landT = 0.12;
      if (this.stamina < 0) { this.stamina = 0; this.state = 'stagger'; this.t = 0; this.stunT = 0.8; this.sfx('stagger'); this.hud.toast('GUARD BROKEN', 1.2); }
      return 'blocked';
    }
    const mult = diff().enemyDmg;
    const real = Math.max(1, Math.round(dmg * mult));
    this.hp -= real; this.hud.damage(); this.hud.setHearts(Math.max(0, this.hp), this.hpMax);
    this.fx.shake(0.45 + real * 0.1); this.fx.hitstop(0.05); this.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff6a4a, 16, 6);
    this.attack = null;
    if (this.hp <= 0) { this.hp = 0; this.die(); return 'dead'; }
    this.sfx('hurt');
    this.state = 'hurt'; this.t = 0; this.hurtT = 0.38; this.iframes = 0.95;
    const k = opts.knock ?? 5; this.vel.x = _w.x * k; this.vel.z = _w.z * k; this.vel.y = Math.max(this.vel.y, 3.5);
    return 'hit';
  }
  die() { if (this.state === 'dead') return; this.state = 'dead'; this.t = 0; this.deadT = 0; this.attack = null; this.sfx('death'); this.fx.shake(0.6); }
  heal(n) { this.hp = Math.min(this.hpMax, this.hp + n); this.hud.setHearts(this.hp, this.hpMax); this.emote('happy', 1.0); }

  // ---- per-frame
  update(dt, input, camFwd, game) {
    this.time += dt; this.t += dt; this.jumpT += dt; this.flipT += dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emoteKind = null; }
    const b = this.body, v = this.vel;
    const ground = b.onGround;
    if (ground) { this.coyote = PH.coyote; this.canDouble = true; this.airAttackUsed = false; this.lastGround.copy(this.pos); this.airT = 0; } else { this.coyote -= dt; this.airT += dt; }
    if (input.just('jump')) this.jumpBuf = PH.buffer; else this.jumpBuf -= dt;

    // wish direction (camera relative)
    const ax = input.axis();
    const rx = -camFwd.z, rz = camFwd.x;
    this.wish.set(camFwd.x * ax.y + rx * ax.x, 0, camFwd.z * ax.y + rz * ax.x);
    const wishLen = this.wish.length(); if (wishLen > 0.001) this.wish.divideScalar(wishLen);

    // stamina
    if (this.staDelay > 0) this.staDelay -= dt; else if (this.stamina < STA.max) this.stamina = Math.min(STA.max, this.stamina + STA.regen * (this.state === 'block' ? 0.5 : 1) * dt);

    const st = this.state;
    const canAct = st === 'idle' || st === 'run' || st === 'air' || st === 'block';
    if (this.alive) {
      if (canAct && input.just('roll') && (ground || this.coyote > 0) && this.stamina >= STA.roll * 0.5) this.startRoll();
      else if (canAct && !this.attack && input.just('light') && ((ground || this.coyote > 0) || !this.airAttackUsed) && this.stamina > 0) this.startAttack(ground || this.coyote > 0 ? 'light1' : 'air', game);
      else if (canAct && !this.attack && input.just('heavy') && (ground || this.coyote > 0) && this.stamina > 0) this.startAttack('heavy', game);
      else if (this.attack && this.attack.move.next && input.just('light')) this.attack.queued = true;
      else if (this.attack && this.attack.phase === 'recovery' && this.attack.u > 0.55 && input.just('roll') && this.stamina >= STA.roll * 0.5) this.startRoll();
    }
    const st2 = this.state; // re-read: an action may have just changed it
    let moveScale = 1, canTurn = true, applyMove = true;
    if (st2 === 'dead') { this.deadT += dt; applyMove = false; moveScale = 0; }
    else if (st2 === 'hurt') { this.hurtT -= dt; moveScale = 0; canTurn = false; if (this.hurtT <= 0) this.state = ground ? 'idle' : 'air'; }
    else if (st2 === 'stagger') { this.stunT -= dt; moveScale = 0; canTurn = false; if (this.stunT <= 0) this.state = 'idle'; }
    else if (st2 === 'roll') {
      this.rollT += dt; const u = this.rollT / PH.rollTime; canTurn = false; moveScale = 0;
      const sp = PH.rollSpeed * (1 - u * 0.55); v.x = this.rollDir.x * sp; v.z = this.rollDir.z * sp;
      this.iframes = Math.max(this.iframes, u > 0.1 && u < 0.72 ? 0.02 : 0);
      if (u >= 1) { this.state = ground ? 'idle' : 'air'; this.rollT = 0; }
    }
    else if (this.attack) { this.updateAttack(dt, ground, game); moveScale = this.attack && this.attack.move.air ? 0.7 : 0; canTurn = false; }
    else if (st2 === 'block') {
      this.blockT += dt; moveScale = PH.blockSpeed;
      if (!input.held('block') || !ground) this.state = ground ? 'idle' : 'air';
      const e = this.nearestEnemy(game, 9, -1); if (e) { this.yaw = turnToward(this.yaw, Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z), dt * 10); canTurn = false; }
    }
    else {
      if (ground && input.held('block') && this.alive) { this.state = 'block'; this.blockT = 0; this.t = 0; }
      else this.state = ground ? (wishLen > 0.1 ? 'run' : 'idle') : 'air';
    }

    if (applyMove) {
      const target = PH.run * moveScale * (wishLen > 0.1 ? 1 : 0);
      const acc = (ground ? PH.accel : PH.airAccel);
      if (wishLen > 0.1 && moveScale > 0) {
        v.x = approach(v.x, this.wish.x * target, acc * dt); v.z = approach(v.z, this.wish.z * target, acc * dt);
        if (canTurn) this.yaw = turnToward(this.yaw, Math.atan2(this.wish.x, this.wish.z), dt * 13);
      } else if (this.state !== 'roll' && this.state !== 'hurt') {
        const dec = (ground ? PH.decel : PH.airAccel * 0.35) * dt; v.x = approach(v.x, 0, dec); v.z = approach(v.z, 0, dec);
      }
      if (this.alive && this.jumpBuf > 0 && this.state !== 'roll' && this.state !== 'hurt' && this.state !== 'stagger' && !(this.attack && !this.attack.move.air)) {
        if (this.coyote > 0) { v.y = PH.jump; this.coyote = 0; this.jumpBuf = 0; this.jumpT = 0; this.stats.jumps++; this.sfx('jump'); this.state = 'air'; this.fx.burst(this.pos.clone(), 0xcfe6c0, 6, 2, { flat: true, up: 1, gravity: 8, life: 0.3 }); }
        else if (this.canDouble && !ground) { v.y = PH.djump; this.canDouble = false; this.jumpBuf = 0; this.flipT = 0; this.stats.doubles++; this.sfx('djump'); this.fx.ring(this.pos.clone(), 0x9fd3ff, 0.3, 1.6, 0.35, 0.08); this.fx.burst(this.pos.clone(), 0x9fd3ff, 10, 3, { flat: true, up: 0.5, gravity: 4, life: 0.35 }); }
      }
      if (!ground && v.y > 2 && input.released.has('Space') && this.state === 'air') v.y *= 0.55;
    }
    v.y -= PH.gravity * dt * (this.attack && this.attack.move.air && this.attack.phase !== 'recovery' ? 0.35 : 1);
    v.y = Math.max(v.y, -PH.maxFall);
    const fallSpeed = -v.y;
    const prevX = this.pos.x, prevZ = this.pos.z;
    this.phys.step(b, dt);
    this.stats.moved += Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    if (b.onGround && !this.wasGround) {
      const hard = fallSpeed > 16; this.sfx('land', { hard }); this.landT = hard ? 0.26 : 0.12; this.landHard = hard;
      this.fx.burst(this.pos.clone(), 0xd8c8a8, hard ? 14 : 6, hard ? 4 : 2, { flat: true, up: 1, gravity: 10, life: 0.35 });
      if (hard) this.fx.shake(0.25);
      if (this.state === 'air') this.state = 'idle';
      if (this.attack && this.attack.move.air) this.attack = null;
    }
    this.wasGround = b.onGround;
    const hs = Math.hypot(v.x, v.z); this.speedFrac = clamp(hs / PH.run, 0, 1);
    if (ground && hs > 1 && this.state !== 'roll') { const prev = this.runPhase; this.runPhase += dt * (6 + hs * 1.3); if (Math.floor(prev / Math.PI) !== Math.floor(this.runPhase / Math.PI)) { this.sfx('step'); if (hs > 5) this.fx.burst(this.pos.clone(), 0xd8c8a8, 2, 1.2, { flat: true, up: 0.6, gravity: 8, life: 0.25 }); } }
    else if (ground) this.runPhase = 0;

    this.lookAt = this.nearestEnemy(game, 10, -0.2);
    this.rig.group.position.copy(this.pos); this.rig.group.rotation.y = this.yaw;
    this.pose(dt, ground, input);
    this.rig.tick(dt);
  }

  nearestEnemy(game, range, minDot) {
    let best = null, bd = range; const fwd = this.forward(_v);
    for (const e of game.enemies) { if (!e.alive) continue; _w.subVectors(e.pos, this.pos); _w.y = 0; const d = _w.length(); if (d > bd || Math.abs(e.pos.y - this.pos.y) > 3) continue; if (d > 0.01 && _w.divideScalar(d).dot(fwd) < minDot) continue; best = e; bd = d; }
    return best;
  }
  startRoll() {
    this.stamina -= STA.roll; this.staDelay = STA.delay; this.state = 'roll'; this.rollT = 0; this.attack = null; this.t = 0; this.stats.rolls++;
    if (this.wish.lengthSq() > 0.01) this.rollDir.copy(this.wish); else this.forward(this.rollDir);
    this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z); this.sfx('roll');
    this.fx.burst(this.pos.clone(), 0xd8c8a8, 8, 3, { flat: true, up: 1, gravity: 10, life: 0.35 });
  }
  startAttack(name, game) {
    const mv = MOVES[name];
    this.stamina -= mv.cost; this.staDelay = STA.delay;
    if (mv.air) this.airAttackUsed = true;
    if (name === 'heavy') this.stats.heavies++; else this.stats.lights++;
    const e = this.nearestEnemy(game, 5.5, 0.2);
    if (e) this.yaw = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    else if (this.wish.lengthSq() > 0.01) this.yaw = Math.atan2(this.wish.x, this.wish.z);
    this.attack = { name, move: mv, t: 0, phase: 'windup', u: 0, hit: new Set(), queued: false, slashed: false };
    this.state = mv.air ? 'air' : 'attack'; this.t = 0;
    if (!mv.air) { this.vel.x *= 0.3; this.vel.z *= 0.3; }
    this.sfx('swing', { heavy: name === 'heavy' });
  }
  updateAttack(dt, ground, game) {
    const a = this.attack, mv = a.move; a.t += dt;
    const total = mv.windup + mv.active + mv.recovery;
    let phase = 'windup', u;
    if (a.t < mv.windup) { u = a.t / mv.windup; }
    else if (a.t < mv.windup + mv.active) { phase = 'active'; u = (a.t - mv.windup) / mv.active; }
    else { phase = 'recovery'; u = (a.t - mv.windup - mv.active) / mv.recovery; }
    a.phase = phase; a.u = u;
    if (phase === 'active') {
      if (!a.slashed) { a.slashed = true; const fwd = this.forward(_v); this.fx.slash(this.pos.clone().add(new THREE.Vector3(fwd.x * 0.3, 1.05, fwd.z * 0.3)), this.yaw, 0.6, mv.range, mv.arc, 0x9fd3ff, 0.16, mv.name === 'light3' || mv.name === 'heavy' ? 0.5 : 0.1); }
      if (!mv.air && ground) { const fwd = this.forward(_v); this.vel.x = fwd.x * mv.lunge; this.vel.z = fwd.z * mv.lunge; }
      this.hitTest(mv, game);
    }
    if (a.t >= total || (a.queued && phase === 'recovery' && u >= (1 - mv.chainAt))) {
      if (a.queued && mv.next && this.stamina > 0) { this.startAttack(mv.next, game); return; }
      this.attack = null; this.state = ground ? 'idle' : 'air';
    }
  }
  hitTest(mv, game) {
    const fwd = this.forward(_v); const cosA = Math.cos(mv.arc / 2);
    for (const e of game.enemies) {
      if (!e.alive || this.attack.hit.has(e)) continue;
      _w.subVectors(e.pos, this.pos); const dy = _w.y; _w.y = 0; const d = _w.length();
      if (d > mv.range + e.radius || Math.abs(dy) > 2.4) continue;
      if (d > 0.3 && _w.divideScalar(d).dot(fwd) < cosA - (e.radius / Math.max(d, 0.5)) * 0.4) continue;
      this.attack.hit.add(e);
      const res = e.takeHit({ dmg: mv.dmg * diff().playerDmg, poise: mv.poise, from: this.pos, knock: mv.knock, heavy: mv.name === 'heavy', move: mv.name });
      if (res) {
        this.stats.hits++;
        const cp = new THREE.Vector3(e.pos.x - _w.x * e.radius * 0.6, e.pos.y + Math.min(1.4, e.height * 0.6), e.pos.z - _w.z * e.radius * 0.6);
        this.fx.burst(cp, res === 'stagger' ? 0xfff0a0 : 0xffd27a, mv.name === 'heavy' ? 26 : 14, mv.name === 'heavy' ? 8 : 6);
        this.fx.hitstop(mv.name === 'heavy' ? 0.09 : 0.045); this.fx.shake(mv.name === 'heavy' ? 0.4 : 0.15);
        this.sfx('hit', { heavy: mv.name === 'heavy' });
      }
    }
  }

  // ---- posing
  pose(dt, ground, input) {
    const st = this.state, q = {}, t = this.time;
    let rate = 14;
    // default face: calm
    q.browL = 0; q.browR = 0; q.browY = 0; q.mouthOpen = 0; q.mouthW = 1; q.eyeOpen = 1;
    const idle = () => {
      q.bodyY = Math.sin(t * 2) * 0.012; q.armR = { ...IDLE_ARM_R }; q.armL = { x: 0.08, y: 0, z: -0.16 }; q.foreR = -0.25; q.foreL = -0.35; q.foreLy = 0.3;
      q.headX = Math.sin(t * 0.7) * 0.04; q.headY = Math.sin(t * 0.5) * 0.08; q.cape = 0.05; q.hipR = 0; q.hipL = 0; q.kneeR = 0; q.kneeL = 0; q.footR = 0; q.footL = 0; q.lean = 0; q.yaw = 0; q.tumble = 0; q.roll = 0;
      // a weight shift every few seconds
      const w = Math.sin(t * 0.35); q.hipRz = w * 0.04; q.hipLz = w * 0.04; q.bodyX = w * 0.02;
    };
    if (st === 'idle' || st === 'attack' && !this.attack) idle();
    else if (st === 'run') {
      const ph = this.runPhase, f = this.speedFrac, s = Math.sin(ph), c = Math.cos(ph);
      q.hipR = s * 0.95 * f; q.hipL = -s * 0.95 * f;
      // knee bends as the leg swings forward-and-through; foot rolls heel→toe
      q.kneeR = (0.25 + 0.55 * Math.max(0, -Math.sin(ph - 0.9))) * f + 0.12 * (1 - f) + Math.max(0, s) * 1.15 * f;
      q.kneeL = (0.25 + 0.55 * Math.max(0, Math.sin(ph - 0.9))) * f + 0.12 * (1 - f) + Math.max(0, -s) * 1.15 * f;
      q.footR = (Math.max(0, s) * 0.6 - Math.max(0, -s) * 0.3 * Math.max(0, c)) * f;
      q.footL = (Math.max(0, -s) * 0.6 - Math.max(0, s) * 0.3 * Math.max(0, -c)) * f;
      q.armR = { x: -s * 0.55 * f + 0.15, y: 0, z: 0.25 }; q.armL = { x: s * 0.65 * f, y: 0, z: -0.3 };
      q.foreR = -0.5; q.foreL = -0.8; q.foreLy = 0.3;
      q.lean = 0.2 * f; q.bodyY = Math.abs(s) * 0.05 * f - 0.03 * f; q.yaw = s * 0.08 * f; q.roll = c * 0.03 * f;
      q.cape = 0.35 + 0.35 * f + Math.sin(ph * 2) * 0.08; q.headX = -0.1 * f; q.tumble = 0; q.hipRz = 0; q.hipLz = 0; q.bodyX = 0;
      q.browL = 0.15 * f; q.browR = 0.15 * f; q.mouthW = 0.8; rate = 18;
    }
    else if (st === 'air' && !this.attack) {
      const vy = this.vel.y;
      if (this.flipT < 0.45) { // double-jump somersault
        const u = this.flipT / 0.45; q.tumble = ease(u) * Math.PI * 2; q.hipR = -1.4; q.hipL = -1.4; q.kneeR = 2.0; q.kneeL = 2.0; q.footR = 0.4; q.footL = 0.4;
        q.armR = { x: -1.2, y: 0, z: 0.5 }; q.armL = { x: -1.2, y: 0, z: -0.5 }; q.foreR = -1.5; q.foreL = -1.5; q.headX = 0.5; q.bodyY = -0.1; q.cape = -0.6; q.lean = 0; q.eyeOpen = 0.2; q.mouthW = 0.7; rate = Infinity;
      } else if (this.jumpT < 0.14) { // takeoff stretch
        q.hipR = 0.25; q.hipL = 0.1; q.kneeR = 0.1; q.kneeL = 0.2; q.footR = 0.7; q.footL = 0.7; q.armR = { x: -1.6, y: 0, z: 0.5 }; q.armL = { x: -1.5, y: 0, z: -0.5 }; q.lean = -0.08; q.cape = 0.0; q.bodyY = 0.04; q.headX = -0.25; q.browY = 0.01; rate = 40;
      } else if (vy > 1.5) { // rising tuck
        q.hipR = -0.8; q.hipL = 0.3; q.kneeR = 1.1; q.kneeL = 0.4; q.footR = 0.3; q.footL = 0.6; q.armR = { x: -0.7, y: 0, z: 0.6 }; q.armL = { x: -0.5, y: 0, z: -0.6 }; q.lean = 0.12; q.cape = 0.05; q.headX = -0.15; rate = 12;
      } else if (vy > -2.5) { // apex: open up
        q.hipR = -0.2; q.hipL = 0.2; q.kneeR = 0.6; q.kneeL = 0.5; q.footR = 0.5; q.footL = 0.5; q.armR = { x: -0.5, y: 0, z: 1.2 }; q.armL = { x: -0.4, y: 0, z: -1.2 }; q.lean = 0.0; q.cape = 0.5; q.headX = 0.05; rate = 10;
      } else { // falling: legs dangle, arms out, a little flail the longer it lasts
        const fl = Math.min(1, this.airT * 0.6); const w = Math.sin(t * 11) * 0.12 * fl;
        q.hipR = 0.15 + w; q.hipL = -0.15 - w; q.kneeR = 0.5; q.kneeL = 0.7; q.footR = 0.6; q.footL = 0.6; q.armR = { x: -0.4 + w, y: 0, z: 1.1 + w }; q.armL = { x: -0.3 - w, y: 0, z: -1.1 - w }; q.lean = clamp(-vy * 0.012, -0.1, 0.35); q.cape = clamp(0.8 - vy * 0.05, 0.4, 1.6); q.headX = 0.25;
        q.browY = 0.012 * fl; q.mouthOpen = 0.3 * fl; q.eyeOpen = 1; rate = 10;
      }
      q.foreR = q.foreR ?? -0.4; q.foreL = q.foreL ?? -0.5; q.foreLy = 0.3; q.bodyY = q.bodyY ?? 0; q.roll = 0; q.yaw = 0; q.hipRz = 0; q.hipLz = 0; q.bodyX = 0;
    }
    else if (this.attack) { this.attackPose(q); rate = this.attack.phase === 'active' ? Infinity : this.attack.phase === 'windup' ? 26 : 11; }
    else if (st === 'block') {
      q.armL = { x: -1.35, y: 0.1, z: -0.2 }; q.foreL = -0.4; q.foreLy = 1.45; q.armR = { x: 0.7, y: 0, z: 0.5 }; q.foreR = -0.9;
      q.lean = 0.1; q.bodyY = -0.09; q.hipR = -0.35; q.hipL = -0.35; q.kneeR = 0.6; q.kneeL = 0.6; q.footR = 0; q.footL = 0; q.headX = 0.1; q.cape = 0.1; q.tumble = 0; q.roll = 0; q.yaw = -0.25; q.hipRz = 0; q.hipLz = 0; q.bodyX = 0;
      q.browL = 0.35; q.browR = 0.35; q.mouthW = 0.7; q.eyeOpen = 0.75; rate = 22;
    }
    else if (st === 'roll') {
      const u = clamp(this.rollT / PH.rollTime, 0, 1);
      q.tumble = u * Math.PI * 2; q.bodyY = -0.42 + Math.sin(u * Math.PI) * 0.1; q.hipR = -1.3; q.hipL = -1.3; q.kneeR = 1.9; q.kneeL = 1.9; q.footR = 0.5; q.footL = 0.5;
      q.armR = { x: -1.1, y: 0, z: 0.4 }; q.armL = { x: -1.1, y: 0, z: -0.4 }; q.foreR = -1.6; q.foreL = -1.6; q.foreLy = 0.3; q.headX = 0.6; q.lean = 0; q.cape = -0.4; q.roll = 0; q.hipRz = 0; q.hipLz = 0; q.bodyX = 0; q.eyeOpen = 0.1; rate = Infinity;
    }
    else if (st === 'hurt') { q.lean = -0.35; q.armR = { x: -0.7, y: 0, z: 0.9 }; q.armL = { x: -0.6, y: 0, z: -0.9 }; q.foreR = -0.5; q.foreL = -0.5; q.foreLy = 0.3; q.headX = -0.45; q.bodyY = 0.02; q.hipR = -0.3; q.hipL = 0.2; q.kneeR = 0.5; q.kneeL = 0.3; q.footR = 0.3; q.footL = 0; q.cape = -0.3; q.tumble = 0; q.roll = 0; q.hipRz = 0; q.hipLz = 0; q.bodyX = 0; q.browY = 0.02; q.browL = -0.3; q.browR = -0.3; q.mouthOpen = 0.6; q.mouthW = 0.7; rate = 30; }
    else if (st === 'stagger') { const w = Math.sin(t * 14) * 0.12; q.lean = -0.22; q.yaw = w; q.armL = { x: -0.4, y: 0, z: -1.4 }; q.armR = { x: -0.3, y: 0, z: 1.1 }; q.foreL = -0.3; q.foreLy = 0.6; q.foreR = -0.3; q.headX = -0.3; q.headZ = w * 0.5; q.bodyY = -0.06; q.hipR = -0.2; q.hipL = -0.2; q.kneeR = 0.4; q.kneeL = 0.4; q.cape = 0; q.tumble = 0; q.roll = 0; q.eyeOpen = 0.5; q.mouthOpen = 0.3; q.browY = 0.015; rate = 18; }
    else if (st === 'dead') {
      const u = clamp(this.deadT / 0.6, 0, 1); const e = ease(u);
      q.tumble = -Math.PI / 2 * e; q.bodyY = -0.72 * e; q.armR = { x: -0.4 * e, y: 0, z: 1.3 * e }; q.armL = { x: -0.3 * e, y: 0, z: -1.3 * e }; q.foreR = -0.2; q.foreL = -0.2; q.foreLy = 0.3; q.headX = -0.3 * e; q.hipR = 0.1; q.hipL = -0.1; q.kneeR = 0.4 * e; q.kneeL = 0.2; q.lean = 0; q.cape = 0.2; q.roll = 0; q.eyeOpen = 0.05; q.mouthOpen = 0.25; q.browL = -0.2; q.browR = -0.2; rate = Infinity;
    }
    else idle();
    // landing squash (also used for guard impacts)
    if (this.landT > 0 && (st === 'idle' || st === 'run' || st === 'block')) { const k = this.landT * (this.landHard ? 4 : 6); q.bodyY = (q.bodyY || 0) - 0.14 * k; q.kneeR = (q.kneeR || 0) + 0.8 * k; q.kneeL = (q.kneeL || 0) + 0.8 * k; q.hipR = (q.hipR || 0) - 0.45 * k; q.hipL = (q.hipL || 0) - 0.45 * k; q.lean = (q.lean || 0) + 0.18 * k; if (st !== 'block') { q.armR = { x: (q.armR?.x || 0) - 0.5 * k, y: 0, z: (q.armR?.z || 0) + 0.3 * k }; q.armL = { x: (q.armL?.x || 0) - 0.5 * k, y: 0, z: (q.armL?.z || 0) - 0.3 * k }; } if (this.landHard) { q.mouthOpen = 0.3 * k; q.eyeOpen = 0.6; } }
    // look at the nearest threat with the head when not busy
    if ((st === 'idle' || st === 'run') && this.lookAt) { const a = Math.atan2(this.lookAt.pos.x - this.pos.x, this.lookAt.pos.z - this.pos.z) - this.yaw; const d = Math.atan2(Math.sin(a), Math.cos(a)); q.headY = clamp(d, -0.7, 0.7); q.browL = Math.max(q.browL, 0.1); q.browR = Math.max(q.browR, 0.1); }
    // emotes override the face
    if (this.emoteKind === 'happy') { q.browY = 0.012; q.browL = -0.1; q.browR = -0.1; q.mouthW = 1.5; q.mouthOpen = 0.12; q.eyeOpen = 0.8; }
    else if (this.emoteKind === 'grin') { q.browL = 0.25; q.browR = 0.25; q.mouthW = 1.6; q.mouthOpen = 0.08; q.eyeOpen = 0.7; }
    this.rig.blend(q, rate, dt);
  }
  attackPose(q) {
    const a = this.attack, n = a.name, u = a.u, ph = a.phase;
    const base = { foreR: -0.1, foreL: -0.5, foreLy: 0.3, hipR: 0, hipL: 0, kneeR: 0.1, kneeL: 0.1, footR: 0, footL: 0, headX: 0, cape: 0.3, tumble: 0, roll: 0, bodyY: 0, hipRz: 0, hipLz: 0, bodyX: 0, armL: { x: 0.2, y: 0, z: -0.5 } };
    Object.assign(q, base);
    const lerpP = (A, B, k) => ({ x: A.x + (B.x - A.x) * k, y: (A.y || 0) + ((B.y || 0) - (A.y || 0)) * k, z: A.z + (B.z - A.z) * k });
    let wind, strike, windYaw = 0, strikeYaw = 0, windLean = 0, strikeLean = 0.15;
    if (n === 'light1' || n === 'air') { wind = { x: -1.3, y: 0.2, z: 1.3 }; strike = { x: -1.5, y: -0.2, z: -0.7 }; windYaw = 0.65; strikeYaw = -0.6; }
    else if (n === 'light2') { wind = { x: -1.5, y: -0.2, z: -1.0 }; strike = { x: -1.3, y: 0.2, z: 1.2 }; windYaw = -0.65; strikeYaw = 0.6; }
    else if (n === 'light3') { wind = { x: 2.5, y: 0, z: 0.35 }; strike = { x: -1.1, y: 0, z: 0.2 }; windLean = -0.18; strikeLean = 0.42; }
    else { wind = { x: 2.7, y: 0, z: 0.45 }; strike = { x: -1.25, y: 0, z: 0.25 }; windLean = -0.28; strikeLean = 0.5; }
    const hipDip = n === 'heavy' ? 1 : n === 'light3' ? 0.5 : 0;
    const big = n === 'heavy' || n === 'light3';
    if (ph === 'windup') { const k = ease(u); q.armR = lerpP(IDLE_ARM_R, wind, k); q.yaw = windYaw * k; q.lean = windLean * k; q.foreR = -0.3 * (1 - k); if (n === 'heavy') { q.armL = { x: 1.0, y: 0, z: -0.7 }; q.bodyY = -0.05 * k; } q.browL = 0.3 * k; q.browR = 0.3 * k; q.eyeOpen = 1 - 0.3 * k; q.mouthW = 0.7; if (big) { q.mouthOpen = 0.3 * k; } }
    else if (ph === 'active') { const k = Math.min(1, u * 1.35); q.armR = lerpP(wind, strike, k); q.yaw = windYaw + (strikeYaw - windYaw) * k; q.lean = windLean + (strikeLean - windLean) * k; q.bodyY = -0.12 * hipDip * k; q.kneeR = 0.1 + 0.6 * hipDip * k; q.kneeL = 0.1 + 0.9 * hipDip * k; q.hipR = -0.3 * hipDip * k; q.hipL = 0.35 * hipDip * k; q.footL = 0.3 * hipDip * k; if (n === 'heavy') q.armL = { x: 0.6, y: 0, z: -0.8 }; q.browL = 0.45; q.browR = 0.45; q.eyeOpen = 0.6; q.mouthOpen = big ? 0.8 : 0.2; q.mouthW = 0.8; }
    else { const k = ease(u); q.armR = lerpP(strike, IDLE_ARM_R, k); q.yaw = strikeYaw * (1 - k); q.lean = strikeLean * (1 - k); q.bodyY = -0.12 * hipDip * (1 - k); q.kneeR = 0.1 + 0.6 * hipDip * (1 - k); q.kneeL = 0.1 + 0.9 * hipDip * (1 - k); q.hipR = -0.3 * hipDip * (1 - k); q.hipL = 0.35 * hipDip * (1 - k); q.browL = 0.3 * (1 - k); q.browR = 0.3 * (1 - k); q.mouthOpen = (big ? 0.4 : 0.1) * (1 - k); }
    if (n === 'air') { q.hipR = -0.8; q.hipL = 0.3; q.kneeR = 1.2; q.kneeL = 0.5; q.footR = 0.4; q.footL = 0.5; q.cape = 0.9; }
  }
}

function approach(v, target, step) { if (v < target) return Math.min(target, v + step); return Math.max(target, v - step); }
export function turnToward(yaw, target, k) { let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return yaw + d * Math.min(1, k); }
