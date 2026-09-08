// The one level: a climb from a meadow landing, through a ruined courtyard and across a broken bridge,
// up the spiral of the watchtower, to the Warden's ring. Route runs along +z and up.
import * as THREE from 'three';
import { Box } from './physics.js';
import * as D from './decor.js';
import { hash } from './world.js';

export function buildLevel(scene, phys) {
  const L = { spawn: new THREE.Vector3(0, 0, -3), shrines: [], gems: [], hearts: [], movers: [], crumblers: [], enemySpecs: [], banners: [], areas: [] };

  const plat = (x, z, w, d, top, thick = 2, opts = {}) => { D.island(scene, { x, z, w, d, top, thick, seed: x * 7 + z * 13 + top, ...opts }); return phys.add(Box.fromTop(x, z, w, d, top, thick)); };
  const gem = (x, y, z) => L.gems.push(D.gem(scene, x, y, z));
  const heart = (x, y, z) => L.hearts.push(D.heart(scene, x, y, z));
  const shrine = (x, y, z, name) => { const s = D.shrine(scene, x, y, z); s.name = name; L.shrines.push(s); return s; };
  const mover = (x, y, z, w, d, to, period, phase = 0) => {
    const g = D.stoneSlab(scene, w, d, 1.2, 'mover'); const box = phys.add(Box.fromTop(x, z, w, d, y, 1.2, 'mover'));
    const mv = { group: g, box, w, d, from: new THREE.Vector3(x, y, z), to: new THREE.Vector3(to[0], to[1], to[2]), period, phase, last: new THREE.Vector3(x, y, z) };
    box.delta = new THREE.Vector3(); box.ref = mv; L.movers.push(mv); return mv;
  };
  const crumble = (x, y, z, w = 3.5, d = 3.5) => {
    const g = D.stoneSlab(scene, w, d, 1.0, 'crumble'); g.position.set(x, y, z);
    const box = phys.add(Box.fromTop(x, z, w, d, y, 1.0, 'crumble'));
    const c = { group: g, box, home: new THREE.Vector3(x, y, z), state: 'idle', timer: 0 }; box.ref = c; L.crumblers.push(c); return c;
  };
  const enemy = (type, x, y, z, extra = {}) => L.enemySpecs.push({ type, x, y, z, ...extra });

  // ---------------- A. Meadow landing
  plat(0, 0, 20, 20, 0, 3);
  shrine(0, 0, -6, 'The Landing').activate();
  L.spawn.set(0, 0, -3);
  D.sign(scene, 3.2, 0, 1, 'WASD TO MOVE\nSPACE TO JUMP', -0.4);
  D.tree(scene, -7, 0, -6, 1, 0); D.tree(scene, 7.5, 0, -7, 2, 1); D.tree(scene, -8, 0, 4, 3, 3); D.tree(scene, 8, 0, 6, 4, 0);
  D.mushroom(scene, -5, 0, 7, 1, true); D.mushroom(scene, 6, 0, -2, 2); D.mushroom(scene, -3, 0, -8, 3);
  D.crystals(scene, 8, 0, 0, 1); D.lantern(scene, -2.5, 0, -6.5); D.lantern(scene, 2.5, 0, -6.5, false);
  gem(-6, 0, 0); gem(6, 0, 3);

  // ---------------- B. Stepping stones (jump school)
  const stones = [[0, 13, 5, 5, 0.5], [3, 19, 4, 4, 1.5], [-2, 25, 4, 4, 3], [2, 32, 4, 4, 4.5], [0, 40, 5, 5, 5.5]];
  stones.forEach((s, i) => { plat(s[0], s[1], s[2], s[3], s[4], 1.8, { tufts: i % 2 === 0 }); if (i > 0) gem(s[0], s[4], s[1]); });
  D.sign(scene, -3.9, 3, 26, 'IN THE AIR,\nPRESS SPACE AGAIN', 0.5);
  D.mushroom(scene, 1.5, 0.5, 14.5, 5); D.crystals(scene, -1.3, 4.5, 33, 2, true);

  // ---------------- C. Ruined courtyard
  plat(0, 54, 26, 26, 6, 4, { seed: 9 });
  D.arch(scene, 0, 6, 43.5, 0);
  D.wall(scene, -12, 6, 54, 22, 3.2, Math.PI / 2, true, 3); D.wall(scene, 12, 6, 54, 22, 3.2, Math.PI / 2, true, 4);
  D.wall(scene, -7, 6, 66.5, 9, 3, 0, true, 5); D.wall(scene, 7, 6, 66.5, 9, 3, 0, true, 6);
  phys.add(new Box(-12.6, 6, 43, -11.4, 9, 65)); phys.add(new Box(11.4, 6, 43, 12.6, 9, 65));
  phys.add(new Box(-11.5, 6, 66.1, -2.5, 9, 66.9)); phys.add(new Box(2.5, 6, 66.1, 11.5, 9, 66.9));
  D.column(scene, -6, 6, 48, 4, true, 1); D.column(scene, 6, 6, 48, 4, false, 2); D.column(scene, -6, 6, 60, 4, true, 3); D.column(scene, 6, 6, 60, 4, true, 4);
  for (const [x, z] of [[-6, 48], [6, 48], [-6, 60], [6, 60]]) phys.add(new Box(x - 0.45, 6, z - 0.45, x + 0.45, 8.5, z + 0.45));
  L.banners.push(D.banner(scene, -10.5, 6, 46, 0, 0.3), D.banner(scene, 10.5, 6, 46, 1, -0.3), D.banner(scene, -10.5, 6, 62, 2, 0.3), D.banner(scene, 10.5, 6, 62, 0, -0.3));
  D.lantern(scene, -3, 6, 45.5); D.lantern(scene, 3, 6, 45.5, false);
  shrine(0, 6, 47.5, 'The Courtyard');
  D.sign(scene, 4.5, 6, 44.5, 'STRIKE: LMB   HEAVY: E\nGUARD: RMB   ROLL: SHIFT', -0.5);
  D.tree(scene, -10, 6, 52, 7, 2); D.tree(scene, 10, 6, 57, 8, 3); D.mushroom(scene, -9, 6, 58, 9); D.crystals(scene, 9, 6, 64, 3);
  enemy('knave', -5, 6, 52, { patrol: 4 }); enemy('knave', 6, 6, 56, { patrol: 4 }); enemy('knave', 0, 6, 61, { patrol: 4 });
  gem(-9, 6, 50); gem(9, 6, 50); gem(0, 6, 56); heart(-9, 6, 63);
  D.sign(scene, 4.5, 6, 65.2, 'GUARD (RMB) TURNS\nBOLTS ASIDE', Math.PI);

  // ---------------- D. Broken bridge (movers) + first thornshot
  mover(-6, 6, 72, 4, 4, [6, 6, 72], 5.2, 0);
  plat(0, 78.5, 3.5, 3.5, 6.5, 1.6, { kind: 'stone', tufts: false }); gem(0, 6.5, 78.5);
  mover(0, 7, 83, 4, 4, [0, 7, 91], 5.6, 0.25);
  plat(0, 96, 10, 8, 7.5, 3, { seed: 21 });
  enemy('thornshot', 0, 7.5, 98.5);
  D.lantern(scene, -4, 7.5, 93); D.sign(scene, 4, 7.5, 93.5, 'CRACKED STONE\nWILL NOT HOLD', -0.6);
  D.tree(scene, 4.2, 7.5, 98.5, 11, 3); D.mushroom(scene, -4, 7.5, 98, 12, true);
  gem(-3.5, 7.5, 96);

  // ---------------- E. Watchtower spiral
  const TX = 0, TZ = 112, TR = 3.2;
  D.tower(scene, TX, -6, TZ, TR, 39);
  phys.add(new Box(TX - TR, -6, TZ - TR, TX + TR, 33, TZ + TR));
  const spiralPos = i => { const a = -Math.PI / 2 + i * Math.PI / 4; return { x: TX + Math.cos(a) * 6.6, z: TZ + Math.sin(a) * 6.6, y: 8.5 + i * 1.6, a }; };
  for (let i = 0; i < 12; i++) {
    const p = spiralPos(i);
    if (i === 3 || i === 7 || i === 10) { crumble(p.x, p.y, p.z); continue; }
    const wide = i === 5 || i === 9;
    plat(p.x, p.z, wide ? 5 : 3.5, wide ? 5 : 3.5, p.y, 1.4, { kind: wide ? 'moss' : 'stone', tufts: false });
    if (i === 5) enemy('knave', p.x, p.y, p.z, { patrol: 1.4 });
    if (i === 9) enemy('thornshot', p.x, p.y, p.z);
    if (i === 2 || i === 6 || i === 8 || i === 11) gem(p.x, p.y, p.z);
  }
  { const p = spiralPos(12); mover(p.x, 27.6, p.z, 3.5, 3.5, [p.x, 33.2, p.z], 6.0, 0.5); }
  plat(TX, TZ, 8, 8, 33, 1.2, { kind: 'stone', tufts: false });
  for (let i = -3; i <= 3; i += 1.5) { D.merlon(scene, TX - 3.7, 33, TZ + i); D.merlon(scene, TX + 3.7, 33, TZ + i); D.merlon(scene, TX + i, 33, TZ - 3.7); }
  shrine(-2.2, 33, 110, 'The Watchtower'); heart(2.5, 33, 110.5); gem(2.5, 33, 113.5);
  D.lantern(scene, 2.8, 33, 108.8); D.sign(scene, -2.8, 33, 114.5, 'THE WARDEN\nWAITS BEYOND', 0);
  L.banners.push(D.banner(scene, 3.2, 33, 115, 1, 0), D.banner(scene, -3.2, 33, 115, 0, 0));

  // ---------------- F. The Warden's ring
  plat(0, 122, 4, 4, 34, 1.6, { kind: 'stone', tufts: false }); gem(0, 34, 122);
  plat(0, 128, 4, 4, 35, 1.6, { kind: 'stone', tufts: false });
  plat(0, 146, 24, 24, 36, 5, { seed: 44 });
  D.arch(scene, 0, 36, 135.5, 0);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(a - Math.PI * 1.5) < 0.4) continue; D.column(scene, Math.cos(a) * 10.8, 36, 146 + Math.sin(a) * 10.8, 3.5, i % 3 !== 0, i + 30); }
  L.banners.push(D.banner(scene, -9.5, 36, 137, 1, 0.5), D.banner(scene, 9.5, 36, 137, 1, -0.5), D.banner(scene, -9.5, 36, 155, 1, 2.6), D.banner(scene, 9.5, 36, 155, 1, -2.6));
  D.crystals(scene, -8, 36, 146, 5, true); D.crystals(scene, 8, 36, 146, 6, true); D.mushroom(scene, -6, 36, 154, 7, true); D.mushroom(scene, 7, 36, 153, 8, true);
  D.lantern(scene, -4, 36, 137.5); D.lantern(scene, 4, 36, 137.5);
  const runeFloor = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.2, 48), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.35 })); runeFloor.rotation.x = -Math.PI / 2; runeFloor.position.set(0, 36.03, 146); scene.add(runeFloor);
  L.bossGate = D.bossGate(scene, 0, 146, 36, 11.6);
  L.bossWalls = [new Box(-12.5, 36, 133.5, 12.5, 46, 134.5, 'wall'), new Box(-12.5, 36, 157.5, 12.5, 46, 158.5, 'wall'), new Box(-12.5, 36, 134, -11.5, 46, 158, 'wall'), new Box(11.5, 36, 134, 12.5, 46, 158, 'wall')];
  for (const w of L.bossWalls) { w.solid = false; phys.add(w); }
  L.bossArena = { cx: 0, cz: 146, r: 11.6, triggerZ: 137.5, y: 36 };
  enemy('warden', 0, 36, 151);
  L.portal = D.portal(scene, 0, 36, 146);
  heart(-8, 36, 138.5);

  L.gemTotal = L.gems.length;
  return L;
}

export function updateLevel(L, dt, t, player, sfx) {
  for (const mv of L.movers) {
    const u = 0.5 - 0.5 * Math.cos((t / mv.period + mv.phase) * Math.PI * 2);
    const p = mv.from.clone().lerp(mv.to, u);
    mv.box.delta.subVectors(p, mv.last); mv.last.copy(p);
    mv.group.position.copy(p);
    mv.box.min.set(p.x - mv.w / 2, p.y - 1.2, p.z - mv.d / 2); mv.box.max.set(p.x + mv.w / 2, p.y, p.z + mv.d / 2);
  }
  for (const c of L.crumblers) {
    if (c.state === 'idle') { if (player.body.groundBox === c.box) { c.state = 'shake'; c.timer = 0.65; sfx('crumble'); } }
    else if (c.state === 'shake') { c.timer -= dt; c.group.position.set(c.home.x + (Math.random() - 0.5) * 0.08, c.home.y - (0.65 - c.timer) * 0.1, c.home.z + (Math.random() - 0.5) * 0.08); if (c.timer <= 0) { c.state = 'fall'; c.timer = 0; c.box.solid = false; } }
    else if (c.state === 'fall') { c.timer += dt; c.group.position.y = c.home.y - 0.07 - c.timer * c.timer * 9; c.group.rotation.x = c.timer * 0.5; c.group.visible = c.timer < 2.5; if (c.timer > 4.5) { c.state = 'idle'; c.group.position.copy(c.home); c.group.rotation.x = 0; c.group.visible = true; c.box.solid = true; } }
  }
  for (const g of L.gems) if (!g.taken) { g.mesh.rotation.y = t * 1.8 + g.ph; g.mesh.position.y = g.base + Math.sin(t * 2.2 + g.ph) * 0.15; }
  for (const h of L.hearts) if (!h.taken) { h.mesh.rotation.y = t * 1.2 + h.ph; h.mesh.position.y = h.base + Math.sin(t * 2 + h.ph) * 0.12; const s = 1 + Math.sin(t * 6 + h.ph) * 0.06; h.mesh.scale.set(s, s * 0.9, s * 0.8); }
  for (const s of L.shrines) s.update(t);
  for (const b of L.banners) { const f = b.userData.flag; f.rotation.y = Math.sin(t * 2.1 + b.position.x) * 0.25; f.rotation.x = Math.sin(t * 3.3 + b.position.z) * 0.08; }
  L.portal.update(t);
}
