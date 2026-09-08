// The one level, set entirely in a forest: a glade landing, mossy stepping stones over a misty ravine, a goblin
// camp, rune-stones across the gorge, the branches of a great hollow tree, and the Warden's glade of standing stones.
// Route runs along +z and up.
import * as THREE from 'three';
import { Box } from './physics.js';
import * as D from './decor.js';
import * as F from './forest.js';
import { hash } from './world.js';

export function buildLevel(scene, phys) {
  const L = { spawn: new THREE.Vector3(0, 0, -3), shrines: [], gems: [], hearts: [], movers: [], crumblers: [], enemySpecs: [], banners: [], fires: [], mists: [], areas: [] };

  const ground = (x, z, w, d, top, thick = 3, opts = {}) => { F.groundChunk(scene, { x, z, w, d, top, thick, seed: x * 7 + z * 13 + top, ...opts }); return phys.add(Box.fromTop(x, z, w, d, top, thick)); };
  const rock = (x, z, w, d, top, thick = 1.6) => { D.island(scene, { x, z, w, d, top, thick, seed: x * 3 + z * 5, kind: 'moss', tufts: false }); return phys.add(Box.fromTop(x, z, w, d, top, thick)); };
  const stumpP = (x, z, r, top, seed = 1) => { F.stump(scene, x, top, z, r, 1.6, seed); return phys.add(Box.fromTop(x, z, r * 1.7, r * 1.7, top, 1.6)); };
  const logP = (x, z, len, top, alongX = false) => { F.log(scene, x, top, z, len, alongX, 0.55); return phys.add(Box.fromTop(x, z, alongX ? len : 1.1, alongX ? 1.1 : len, top, 1.1)); };
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
  const goblin = (kind, x, y, z, extra = {}) => L.enemySpecs.push({ type: 'goblin', kind, x, y, z, ...extra });
  const treeCol = (x, y, z, seed, big = false) => { if (big) F.oak(scene, x, y, z, seed, 1.15); else F.pine(scene, x, y, z, seed, 1.1); phys.add(new Box(x - 0.45, y, z - 0.45, x + 0.45, y + 6, z + 0.45)); };

  F.treeWall(scene); F.ravineFloor(scene, -34);
  const outTree = (kind, x, top, z, seed, scale) => { F.outcrop(scene, null, x, z, top, 4 + hash(seed) * 2, seed); phys.add(Box.fromTop(x, z, 4, 4, top, 3)); if (kind === 'oak') F.oak(scene, x, top, z, seed, scale); else F.pine(scene, x, top, z, seed, scale); };

  // ---------------- A. The Glade (landing)
  ground(0, 0, 22, 22, 0, 3.5, { seed: 1 });
  shrine(0, 0, -6, 'The Glade').activate();
  L.spawn.set(0, 0, -3);
  D.sign(scene, 3.2, 0, 1, 'WASD TO MOVE\nSPACE TO JUMP', -0.4);
  F.oak(scene, -8, 0, -7, 1, 1.2); F.pine(scene, 8.5, 0, -8, 2, 1.1); F.oak(scene, -9, 0, 5, 3, 1); F.pine(scene, 9, 0, 6, 4, 1.2); F.pine(scene, -3, 0, -9.5, 5, 0.9); F.pine(scene, 4, 0, 9.5, 6, 0.8);
  D.mushroom(scene, -5, 0, 7, 1, true); D.mushroom(scene, 6, 0, -2, 2); D.mushroom(scene, -3, 0, -8, 3); F.fern(scene, 6, 0, 3, 3); F.fern(scene, -6.5, 0, -2, 4); F.fern(scene, 2, 0, 8, 5);
  D.crystals(scene, 8, 0, 0, 1); D.lantern(scene, -2.5, 0, -6.5); D.lantern(scene, 2.5, 0, -6.5, false);
  F.shaft(scene, -4, 0, -2); F.shaft(scene, 5, 0, 4, 16, 1.6);
  gem(-6, 0, 0); gem(6, 0, 3);
  L.mists.push(F.mist(scene, 0, -7, 26, 60, 40, 3));

  // ---------------- B. Stepping stones over the ravine (jump school)
  ground(0, 13, 5, 5, 0.5, 2.4, { seed: 2, plants: false }); F.fern(scene, 1.6, 0.5, 14.5, 7, 0.8);
  stumpP(3, 19, 2.1, 1.5, 3); gem(3, 1.5, 19);
  rock(-2, 25, 4, 4, 3); gem(-2, 3, 25);
  stumpP(2, 32, 2.1, 4.5, 4); gem(2, 4.5, 32);
  ground(0, 40, 5, 5, 5.5, 2.4, { seed: 5, plants: false }); gem(0, 5.5, 40);
  D.sign(scene, -3.9, 3, 26, 'IN THE AIR,\nPRESS SPACE AGAIN', 0.5);
  D.crystals(scene, -1.3, 4.5, 33, 2, true); outTree('pine', -7, -2, 20, 21, 1.4); outTree('pine', 8, -1, 28, 22, 1.5); outTree('oak', -8, 0, 36, 23, 1.1);

  // ---------------- C. The Goblin Camp
  ground(0, 54, 26, 26, 6, 5, { seed: 9 });
  F.palisade(scene, -12, 6, 54, 22, Math.PI / 2, 3); F.palisade(scene, 12, 6, 54, 22, Math.PI / 2, 4);
  F.palisade(scene, -7, 6, 66.5, 9, 0, 5); F.palisade(scene, 7, 6, 66.5, 9, 0, 6);
  phys.add(new Box(-12.6, 6, 43, -11.4, 9, 65)); phys.add(new Box(11.4, 6, 43, 12.6, 9, 65));
  phys.add(new Box(-11.5, 6, 66.1, -2.5, 9, 66.9)); phys.add(new Box(2.5, 6, 66.1, 11.5, 9, 66.9));
  F.skullPole(scene, -2.4, 6, 43.5); F.skullPole(scene, 2.4, 6, 43.5);
  treeCol(-6, 6, 48, 31); treeCol(6, 6, 48, 32, true); treeCol(-6, 6, 60, 33, true); treeCol(6, 6, 60, 34);
  F.tent(scene, -8.5, 6, 56, 1.2, 1); F.tent(scene, 8.5, 6, 61, -1.3, 2); F.tent(scene, -8, 6, 63.5, 0.4, 3);
  L.fires.push(F.campfire(scene, 3, 6, 55));
  L.banners.push(D.banner(scene, -10.5, 6, 46, 1, 0.3), D.banner(scene, 10.5, 6, 46, 1, -0.3));
  D.lantern(scene, -3, 6, 45.5, false); D.lantern(scene, 3, 6, 45.5, false);
  shrine(0, 6, 47.5, 'The Camp');
  D.sign(scene, 4.5, 6, 44.5, 'STRIKE: LMB   HEAVY: E\nGUARD: RMB   ROLL: SHIFT', -0.5);
  D.mushroom(scene, -9, 6, 58, 9); D.crystals(scene, 9, 6, 64, 3); F.fern(scene, -10, 6, 50, 11); F.fern(scene, 10, 6, 52, 12); F.fern(scene, -4, 6, 64, 13); F.shaft(scene, -6, 6, 54, 16, 1.4);
  goblin('knave', -5, 6, 52, { patrol: 4 }); goblin('skirmisher', 6, 6, 56, { patrol: 4 }); goblin('slinger', 0, 6, 61, { patrol: 3 }); goblin('knave', -6, 6, 61, { patrol: 3 });
  gem(-9, 6, 50); gem(9, 6, 50); gem(0, 6, 56); heart(-9, 6, 63);
  D.sign(scene, 4.5, 6, 65.2, 'GUARD (RMB) TURNS\nSTONES ASIDE', Math.PI);
  outTree('pine', -16.5, 4, 50, 41, 1.6); outTree('pine', 17, 4, 58, 42, 1.7); outTree('oak', -16.5, 5, 62, 43, 1.3); outTree('pine', 16.5, 5, 46, 44, 1.5);

  // ---------------- D. The gorge (rune-stones) + slinger ledge
  L.mists.push(F.mist(scene, 0, 0, 84, 40, 50, 3));
  mover(-6, 6, 72, 4, 4, [6, 6, 72], 5.2, 0);
  logP(0, 78.5, 4.2, 6.5, false); gem(0, 6.5, 78.5);
  mover(0, 7, 83, 4, 4, [0, 7, 91], 5.6, 0.25);
  ground(0, 96, 10, 8, 7.5, 3, { seed: 21 });
  goblin('slinger', 0, 7.5, 98.5, { patrol: 2 });
  D.lantern(scene, -4, 7.5, 93); D.sign(scene, 4, 7.5, 93.5, 'ROTTEN WOOD\nWILL NOT HOLD', -0.6);
  F.pine(scene, 4.2, 7.5, 98.8, 11, 0.9); D.mushroom(scene, -4, 7.5, 98, 12, true); F.fern(scene, -2, 7.5, 94, 14);
  gem(-3.5, 7.5, 96);
  outTree('pine', -10, 2, 78, 45, 1.6); outTree('pine', 10.5, 3, 88, 46, 1.7);

  // ---------------- E. The great hollow tree (spiral of branches)
  const TX = 0, TZ = 112, TR = 3.2;
  F.hollowTree(scene, TX, -34, TZ, TR, 68);
  phys.add(new Box(TX - TR, -8, TZ - TR, TX + TR, 33, TZ + TR));
  const spiralPos = i => { const a = -Math.PI / 2 + i * Math.PI / 4; return { x: TX + Math.cos(a) * 6.6, z: TZ + Math.sin(a) * 6.6, y: 8.5 + i * 1.6, a }; };
  for (let i = 0; i < 12; i++) {
    const p = spiralPos(i);
    if (i === 3 || i === 7 || i === 10) { crumble(p.x, p.y, p.z); F.limb(scene, p.x, p.y - 1.0, p.z, TX, TZ, 0.28); continue; }
    const wide = i === 5 || i === 9; const w = wide ? 5 : 3.5;
    F.branch(scene, p.x, p.y, p.z, w, w, TX, TZ); phys.add(Box.fromTop(p.x, p.z, w, w, p.y, 0.9));
    if (i === 5) goblin('brute', p.x, p.y, p.z, { patrol: 0.8 });
    if (i === 9) goblin('slinger', p.x, p.y, p.z, { patrol: 0.6 });
    if (i === 2 || i === 6 || i === 8 || i === 11) gem(p.x, p.y, p.z);
  }
  { const p = spiralPos(12); mover(p.x, 27.6, p.z, 3.5, 3.5, [p.x, 33.2, p.z], 6.0, 0.5); }
  ground(TX, TZ, 8, 8, 33, 1.4, { seed: 8, plants: false });
  for (let i = 0; i < 9; i++) { const a = -0.35 + i / 8 * Math.PI * 1.7 + Math.PI * 0.65; const r = 5.6 + hash(i * 3) * 1.2; const bx = TX + Math.cos(a) * r, by = 33.6 + hash(i) * 1.5, bz = TZ + Math.sin(a) * r; F.canopyBlob(scene, bx, by, bz, 2.2 + hash(i * 7) * 0.8, i + 60); F.limb(scene, bx, by - 0.6, bz, TX, TZ, 0.35); }
  shrine(-2.2, 33, 110, 'The Treetop'); heart(2.5, 33, 110.5); gem(2.5, 33, 113.5);
  D.lantern(scene, 2.8, 33, 108.8); D.sign(scene, -2.8, 33, 114.5, 'THE WARDEN\nWAITS BEYOND', 0);
  L.mists.push(F.mist(scene, 0, 2, 112, 40, 40, 3));

  // ---------------- F. The Warden's Glade
  rock(0, 122, 4, 4, 34); gem(0, 34, 122);
  rock(0, 128, 4, 4, 35);
  ground(0, 146, 24, 24, 36, 6, { seed: 44 });
  F.oak(scene, -4.5, 36, 134.5, 51, 1.3); F.oak(scene, 4.5, 36, 134.5, 52, 1.3);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(a - Math.PI * 1.5) < 0.4) continue; const mx = Math.cos(a) * 10.4, mz = 146 + Math.sin(a) * 10.4; F.menhir(scene, mx, 36, mz, 3 + hash(i) * 1.5, i + 30); phys.add(new Box(mx - 0.55, 36, mz - 0.35, mx + 0.55, 40, mz + 0.35)); }
  L.banners.push(D.banner(scene, -9.5, 36, 137, 1, 0.5), D.banner(scene, 9.5, 36, 137, 1, -0.5));
  D.crystals(scene, -8, 36, 146, 5, true); D.crystals(scene, 8, 36, 146, 6, true); D.mushroom(scene, -6, 36, 154, 7, true); D.mushroom(scene, 7, 36, 153, 8, true); F.fern(scene, -9, 36, 150, 15); F.fern(scene, 9, 36, 141, 16);
  D.lantern(scene, -4, 36, 137.5); D.lantern(scene, 4, 36, 137.5);
  F.shaft(scene, -3, 36, 150, 22, 2); F.shaft(scene, 6, 36, 143, 22, 1.5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; outTree('pine', Math.cos(a) * 17.5, 34 + hash(i * 3) * 2, 146 + Math.sin(a) * 17.5, 70 + i, 1.6 + hash(i) * 0.5); }
  const runeFloor = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.2, 48), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.35 })); runeFloor.rotation.x = -Math.PI / 2; runeFloor.position.set(0, 36.03, 146); scene.add(runeFloor);
  L.bossGate = D.bossGate(scene, 0, 146, 36, 11.6);
  L.bossWalls = [new Box(-12.5, 36, 133.5, 12.5, 46, 134.5, 'wall'), new Box(-12.5, 36, 157.5, 12.5, 46, 158.5, 'wall'), new Box(-12.5, 36, 134, -11.5, 46, 158, 'wall'), new Box(11.5, 36, 134, 12.5, 46, 158, 'wall')];
  for (const w of L.bossWalls) { w.solid = false; phys.add(w); }
  L.bossArena = { cx: 0, cz: 146, r: 11.6, triggerZ: 137.5, y: 36 };
  L.enemySpecs.push({ type: 'warden', x: 0, y: 36, z: 151 });
  L.portal = D.portal(scene, 0, 36, 146);
  heart(-8, 36, 138.5);
  L.mists.push(F.mist(scene, 0, 30, 146, 50, 50, 3));

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
  for (const f of L.fires) f.update(t);
  F.updateGrass(t);
  L.portal.update(t);
}
