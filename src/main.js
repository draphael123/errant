// Boot, screens, and the frame loop. Everything the debug API needs hangs off `game`.
import * as THREE from 'three';
import { S, setSetting, resetSettings, onSetting, renderSettings } from './settings.js';
import { Input } from './input.js';
import { initAudio, sfx, applyVolumes, startMusic, stopMusic, audioReady } from './audio.js';
import { Physics } from './physics.js';
import { createWorld } from './world.js';
import { buildLevel, updateLevel } from './level.js';
import { FX } from './fx.js';
import { FollowCamera } from './camera.js';
import { HUD } from './hud.js';
import { Player } from './player.js';
import { spawnEnemies, updateProjectiles } from './enemies.js';

const $ = id => document.getElementById(id);
const KILL_Y_BELOW = 22; // fall this far below the last ground and you are returned to the shrine

// ---------------- renderer
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 1500);
function resize() {
  const w = window.innerWidth || renderer.domElement.clientWidth || 1280, h = window.innerHeight || renderer.domElement.clientHeight || 720;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * S.renderScale); renderer.setSize(w, h, true);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); document.addEventListener('visibilitychange', resize); resize();

// ---------------- world + game
const world = createWorld(renderer);
const scene = world.scene;
const phys = new Physics();
const fx = new FX(scene);
const hud = new HUD();
const input = new Input(renderer.domElement);
const level = buildLevel(scene, phys);
const followCam = new FollowCamera(camera, phys);

const game = {
  scene, phys, fx, hud, sfx, camera, level, input, renderer,
  player: null, enemies: [], projectiles: [], time: 0, state: 'title',
  checkpoint: level.shrines[0], stats: { deaths: 0, gems: 0, start: 0, elapsed: 0, kills: 0 },
  bossActive: false, boss: null, won: false, tutorialShown: new Set(),
  onEnemyDied(e) { this.stats.kills++; if (e.isBoss) this.winSoon = 2.6; },
};
game.player = new Player(scene, phys, fx, sfx, hud);

function resetRun() {
  for (const e of game.enemies) scene.remove(e.rig.group);
  for (const e of game.enemies) { if (e.telegraph && e.telegraph.mesh) scene.remove(e.telegraph.mesh); if (e.tele) for (const k in e.tele) scene.remove(e.tele[k].mesh); }
  for (const b of game.projectiles) scene.remove(b.mesh); game.projectiles.length = 0;
  game.enemies = spawnEnemies(game, level.enemySpecs);
  game.boss = game.enemies.find(e => e.isBoss); game.bossActive = false; game.won = false; game.winSoon = 0;
  for (const w of level.bossWalls) w.solid = false; level.bossGate.set(0); level.portal.group.visible = false;
  for (const g of level.gems) { g.taken = false; g.mesh.visible = true; }
  for (const h of level.hearts) { h.taken = false; h.mesh.visible = true; }
  for (const s of level.shrines) if (s !== level.shrines[0]) s.deactivate();
  level.shrines[0].activate();
  game.checkpoint = level.shrines[0];
  game.stats = { deaths: 0, gems: 0, start: performance.now(), elapsed: 0, kills: 0 };
  game.tutorialShown = new Set();
  game.player.respawn(level.spawn, 0);
  followCam.reset(level.spawn, 0);
  hud.setHearts(6, 6); hud.setGems(0, level.gemTotal); hud.boss(false);
}

// ---------------- screens
const screens = ['title', 'settings', 'controls', 'pause', 'dead', 'victory'];
let settingsReturn = 'title';
function show(name) { for (const s of screens) $(s).hidden = s !== name; }
function setState(st) {
  game.state = st;
  hud.show(st === 'playing' || st === 'paused' || st === 'dead');
  if (st === 'playing') { input.wantLock = true; input.lock(); show(null); }
  else { input.wantLock = false; input.unlock(); }
}
function startGame() {
  initAudio(); resetRun(); setState('playing'); startMusic('explore');
  $('fade').style.opacity = 0;
  hud.toast('THE LANDING', 2.2); hud.hint('Reach the courtyard beyond the stepping stones.', 5);
}
$('btn-play').onclick = () => { sfx('ui'); startGame(); };
$('btn-settings').onclick = () => { initAudio(); sfx('ui'); settingsReturn = 'title'; renderSettings($('settings-rows')); show('settings'); };
$('btn-controls').onclick = () => { initAudio(); sfx('ui'); settingsReturn = 'title'; show('controls'); };
$('btn-settings-back').onclick = () => { sfx('ui'); if (settingsReturn === 'pause') show('pause'); else show('title'); };
$('btn-controls-back').onclick = () => { sfx('ui'); if (settingsReturn === 'pause') show('pause'); else show('title'); };
$('btn-settings-reset').onclick = () => { resetSettings(); renderSettings($('settings-rows')); sfx('ui'); };
$('btn-resume').onclick = () => resume();
$('btn-pause-settings').onclick = () => { sfx('ui'); settingsReturn = 'pause'; renderSettings($('settings-rows')); show('settings'); };
$('btn-pause-controls').onclick = () => { sfx('ui'); settingsReturn = 'pause'; show('controls'); };
$('btn-respawn').onclick = () => { sfx('ui'); returnToShrine(false); resume(); };
$('btn-quit').onclick = () => { sfx('ui'); stopMusic(); setState('title'); show('title'); };
$('btn-dead-continue').onclick = () => { sfx('ui'); returnToShrine(true); setState('playing'); };
$('btn-victory-again').onclick = () => { sfx('ui'); startGame(); };
$('btn-victory-title').onclick = () => { sfx('ui'); stopMusic(); setState('title'); show('title'); };

function pause() { if (game.state !== 'playing') return; setState('paused'); show('pause'); sfx('ui'); }
function resume() { if (game.state !== 'paused') return; setState('playing'); }
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (game.state === 'playing') { pause(); }
    else if (game.state === 'paused') { if (!$('pause').hidden) resume(); else show('pause'); }
    else if (game.state === 'title' && $('title').hidden) show('title');
  }
});
// Pointer lock release (browser Esc) while playing means pause.
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && game.state === 'playing' && !input.wantLockSuppressed) { setTimeout(() => { if (game.state === 'playing' && !input.locked) pause(); }, 50); } });
window.addEventListener('blur', () => { if (game.state === 'playing') pause(); });

onSetting((k) => {
  if (['master', 'music', 'sfx'].includes(k)) applyVolumes();
  if (k === 'shadows') world.applyShadowSetting();
  if (k === 'renderScale') resize();
});

function returnToShrine(afterDeath) {
  const s = game.checkpoint;
  game.player.respawn(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z + 2.2), 0, afterDeath); game.falling = false;
  followCam.reset(game.player.pos, 0);
  for (const b of game.projectiles) scene.remove(b.mesh); game.projectiles.length = 0;
  // the boss resets if you die to it
  if (game.boss && game.boss.alive && game.bossActive) {
    game.bossActive = false; for (const w of level.bossWalls) w.solid = false; level.bossGate.set(0);
    const spec = game.boss.spec; game.boss.pos.set(spec.x, spec.y, spec.z); game.boss.vel.set(0, 0, 0); game.boss.hp = game.boss.hpMax; game.boss.poise = 0; game.boss.state = 'dormant'; game.boss.phase = 1; game.boss.telegraph.hide(); game.boss.yaw = Math.PI;
    hud.boss(false); startMusic('explore');
  }
  hud.setHearts(game.player.hp, game.player.hpMax);
  if (afterDeath) hud.toast(s.name.toUpperCase(), 2);
}
function fall() {
  const p = game.player; if (!p.alive || game.falling) return;
  game.falling = true;
  p.hp -= 1; hud.damage(); fx.shake(0.4); sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; game.falling = false; die(); return; }
  hud.setHearts(p.hp, p.hpMax);
  $('fade').style.opacity = 1;
  setTimeout(() => { returnToShrine(false); $('fade').style.opacity = 0; game.falling = false; hud.hint('Fell. Returned to the shrine.', 2.5); }, 260);
}
function die() {
  const p = game.player; if (!p.alive) return; p.die(); game.stats.deaths++;
  setTimeout(() => { if (game.state === 'playing' || game.state === 'dead') { setState('dead'); show('dead'); $('dead-stats').textContent = `${game.checkpoint.name} calls you back.  ·  deaths ${game.stats.deaths}`; } }, 1500);
}
function win() {
  game.won = true; stopMusic(); sfx('victory'); level.portal.group.visible = true;
  game.stats.elapsed = (performance.now() - game.stats.start) / 1000;
  const m = Math.floor(game.stats.elapsed / 60), s = Math.floor(game.stats.elapsed % 60);
  setTimeout(() => { setState('victory'); show('victory'); $('victory-stats').innerHTML = `time ${m}:${String(s).padStart(2, '0')}<br>gems ${game.stats.gems} / ${level.gemTotal}<br>deaths ${game.stats.deaths}`; }, 2200);
}

// ---------------- per-frame game logic
const tmp = new THREE.Vector3();
function tutorial(key, text, seconds = 5) { if (!S.hints || game.tutorialShown.has(key)) return; game.tutorialShown.add(key); hud.hint(text, seconds); }
function updateGame(dt) {
  const p = game.player; game.time += dt;
  const camF = followCam.forward();
  p.update(dt, input, camF, game);
  updateLevel(level, dt, game.time, p, sfx);
  for (const e of game.enemies) e.update(dt);
  updateProjectiles(game, dt);
  fx.update(dt);

  // pickups
  for (const g of level.gems) { if (g.taken) continue; if (tmp.subVectors(g.pos, p.pos).setY(tmp.y - 0.9).length() < 1.3) { g.taken = true; g.mesh.visible = false; game.stats.gems++; hud.setGems(game.stats.gems, level.gemTotal); sfx('gem'); fx.burst(g.pos, 0x8ef6ff, 16, 4, { gravity: 3, life: 0.6 }); } }
  for (const h of level.hearts) { if (h.taken) continue; if (tmp.subVectors(h.pos, p.pos).setY(tmp.y - 0.9).length() < 1.3) { h.taken = true; h.mesh.visible = false; p.heal(2); sfx('heart'); fx.burst(h.pos, 0xff6a7a, 20, 4, { gravity: 2, life: 0.7 }); hud.toast('RESTORED', 1); } }
  for (const s of level.shrines) { if (s.active) continue; if (tmp.subVectors(s.pos, p.pos).length() < 2.6) { s.activate(); game.checkpoint = s; sfx('shrine'); fx.burst(s.pos.clone().add(new THREE.Vector3(0, 2.7, 0)), 0x9fd3ff, 30, 4, { gravity: 1, life: 1 }); hud.toast(s.name.toUpperCase(), 2.2); hud.hint('Shrine lit. You will return here if you fall.', 3.5); if (p.hp < p.hpMax) p.heal(p.hpMax); } }

  // falling off the world
  if (p.pos.y < p.lastGround.y - KILL_Y_BELOW || p.pos.y < -60) fall();

  // tutorial beats keyed to where the player is
  if (p.pos.z > 8 && p.pos.z < 20) tutorial('jump', 'SPACE to jump. Hold it for a higher leap.');
  if (p.pos.z > 21 && p.pos.z < 40) tutorial('double', 'Press SPACE again in the air for a double jump.');
  if (p.pos.z > 44 && p.pos.z < 66 && p.pos.y > 5) tutorial('combat', 'Strike with LMB (three in a row). Hold RMB to guard. SHIFT rolls through attacks.', 7);
  if (p.pos.z > 67 && p.pos.z < 95) tutorial('bolts', 'Thornshots spit bolts. Guard to turn them aside, or roll.', 6);
  if (p.pos.z > 100 && p.pos.y > 8 && p.pos.y < 30) tutorial('crumble', 'Cracked stones give way. Keep moving.', 5);
  if (p.pos.z > 118 && p.pos.y > 32) tutorial('tower', 'The Warden waits beyond. Guard breaks poise; heavy strikes (E) break it faster.', 6);

  // boss gate
  const A = level.bossArena;
  if (!game.bossActive && game.boss && game.boss.alive && p.pos.z > A.triggerZ && p.pos.y > A.y - 1 && Math.hypot(p.pos.x - A.cx, p.pos.z - A.cz) < A.r) {
    game.bossActive = true; for (const w of level.bossWalls) w.solid = true; game.boss.wake(); startMusic('boss'); hud.toast('THE HOLLOW WARDEN', 3); hud.hint('Jump over the shockwave. Roll through the charge. Punish the stagger.', 7);
  }
  if (game.bossActive) { level.bossGate.set(Math.min(1, level.bossGate.wall.material.opacity / 0.18 + dt * 1.5)); hud.boss(game.boss.alive, game.boss.hp / game.boss.hpMax, game.boss.poiseFrac, 'THE HOLLOW WARDEN'); }
  if (game.winSoon > 0) { game.winSoon -= dt; if (game.winSoon <= 0 && !game.won) { for (const w of level.bossWalls) w.solid = false; level.bossGate.set(0); hud.boss(false); win(); } }

  // HUD
  hud.setHearts(Math.max(0, p.hp), p.hpMax); hud.setStamina(p.stamina / 100, p.stamina < 20);
  world.update(dt, game.time, p.pos, camera);
  followCam.update(dt, input, p.pos, p.yaw, p.state === 'run', fx.shakeVec);
  hud.update(dt, input.locked, p.hp / p.hpMax);
}

// ---------------- frame loop with a watchdog (embedded panes can starve rAF)
let last = performance.now(), lastTickAt = 0, rafQueued = false;
function tick(now) {
  lastTickAt = now;
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.state === 'playing' || game.state === 'dead') {
    if (fx.freeze > 0) { fx.freeze -= dt; dt *= 0.05; }
    updateGame(dt);
  } else {
    // idle world for the title: slow orbit around the landing
    if (game.state === 'title') { const t = now * 0.0002; camera.position.set(Math.sin(t) * 22, 8 + Math.sin(t * 0.7) * 2, -6 + Math.cos(t) * 22); camera.lookAt(0, 3, 4); world.update(dt, now / 1000, new THREE.Vector3(0, 0, 0), camera); updateLevel(level, dt, now / 1000, game.player, () => { }); fx.update(dt); }
    else { world.update(dt, game.time, game.player.pos, camera); }
  }
  renderer.render(scene, camera);
  input.endFrame();
}
function frame(now) { rafQueued = false; try { tick(now); } catch (e) { console.error(e); } if (!rafQueued) { rafQueued = true; requestAnimationFrame(frame); } }
rafQueued = true; requestAnimationFrame(frame);
setInterval(() => { if (performance.now() - lastTickAt > 40) frame(performance.now()); }, 16);

// ---------------- debug / test API
window.ERRANT = {
  game, S, setSetting, start: startGame,
  state() { const p = game.player; return { state: game.state, player: { pos: p.pos.toArray().map(n => +n.toFixed(2)), vel: p.vel.toArray().map(n => +n.toFixed(2)), st: p.state, hp: p.hp, sta: Math.round(p.stamina), ground: p.body.onGround, yaw: +p.yaw.toFixed(2) }, enemies: game.enemies.map(e => ({ n: e.name, st: e.state, hp: e.hp, alive: e.alive, pos: e.pos.toArray().map(n => +n.toFixed(1)) })), gems: game.stats.gems, boss: game.bossActive, checkpoint: game.checkpoint.name }; },
  teleport(x, y, z) { game.player.pos.set(x, y, z); game.player.vel.set(0, 0, 0); game.player.lastGround.set(x, y, z); followCam.reset(game.player.pos, game.player.yaw); },
  go(where) { const P = { landing: [0, 0, -3], stones: [0, 0.5, 13], courtyard: [0, 6, 47], bridge: [0, 6, 64], ledge: [0, 7.5, 95], spiral: [0, 8.5, 105.4], cap: [0, 33, 112], arena: [0, 36, 132] }; const p = P[where]; if (p) this.teleport(...p); return p; },
  god(v = true) { game.player.god = v; },
  kill() { for (const e of game.enemies) if (e.alive && !e.isBoss) e.die(); },
  render() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.7); },
  info() { return renderer.info.render; },
};
$('boot').hidden = true;
console.log('ERRANT ready');
