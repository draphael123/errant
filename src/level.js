// Goblin Wood. One long forest route along +z, rising: the Glade → stepping stones → the Goblin Camp → the gorge
// (rope bridge + swinging log) → the Mushroom Hollow → the Root Maze → the great hollow tree → the Canopy Walk →
// the Warlord's Yard. Every prop registers its collision through `solid`, and every placement is logged for the audit.
import * as THREE from 'three';
import { Box } from './physics.js';
import * as D from './decor.js';
import * as F from './forest.js';
import * as F2 from './forest2.js';
import { hash } from './world.js';

export function buildLevel(scene, phys) {
  const L = { spawn: new THREE.Vector3(0, 0, -3), shrines: [], gems: [], hearts: [], movers: [], swings: [], rotten: [], enemySpecs: [], banners: [], fires: [], mists: [], props: [], spores: [], critters: [], dapples: [], hazards: [], areas: [] };
  const boxTag = (b, tag) => { b.tag = tag; return b; };
  const solid = (x, z, w, d, y0, h, tag = 'prop') => boxTag(phys.add(new Box(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2)), tag);
  const prop = (name, x, y, z) => L.props.push({ name, x, y, z });
  const ground = (x, z, w, d, top, thick = 3, opts = {}) => { F.groundChunk(scene, { x, z, w, d, top, thick, seed: Math.abs(x * 7 + z * 13 + top), ...opts }); return boxTag(phys.add(Box.fromTop(x, z, w, d, top, thick)), 'ground'); };
  const rock = (x, z, w, d, top, thick = 1.6) => { D.island(scene, { x, z, w, d, top, thick, seed: x * 3 + z * 5, kind: 'moss', tufts: false }); return boxTag(phys.add(Box.fromTop(x, z, w, d, top, thick)), 'rock'); };
  const stumpP = (x, z, r, top, seed = 1) => { F.outcrop(scene, null, x, z, top - 1.6, r * 2.3, seed + 7); boxTag(phys.add(Box.fromTop(x, z, r * 2.3, r * 2.3, top - 1.6, 3)), 'outcrop'); F.stump(scene, x, top, z, r, 1.6, seed); prop('stump', x, top - 1.6, z); return boxTag(phys.add(Box.fromTop(x, z, r * 1.7, r * 1.7, top, 1.6)), 'stump'); };
  const gem = (x, y, z) => L.gems.push(D.gem(scene, x, y, z));
  const heart = (x, y, z) => L.hearts.push(D.heart(scene, x, y, z));
  const shrine = (x, y, z, name) => { const s = D.shrine(scene, x, y, z); s.name = name; L.shrines.push(s); solid(x, z, 2.0, 2.0, y, 1.8, 'shrine'); prop('shrine', x, y, z); return s; };
  const goblin = (kind, x, y, z, extra = {}) => L.enemySpecs.push({ type: 'goblin', kind, x, y, z, ...extra });
  const pine = (x, y, z, seed, scale = 1, col = true) => { F.pine(scene, x, y, z, seed, scale); prop('pine', x, y, z); if (col) solid(x, z, 0.8 * scale, 0.8 * scale, y, 7 * scale, 'trunk'); };
  const oak = (x, y, z, seed, scale = 1, col = true) => { F.oak(scene, x, y, z, seed, scale); prop('oak', x, y, z); if (col) solid(x, z, 1.0 * scale, 1.0 * scale, y, 5 * scale, 'trunk'); };
  const birch = (x, y, z, seed, scale = 1) => { F2.birch(scene, x, y, z, seed, scale); prop('birch', x, y, z); solid(x, z, 0.45 * scale, 0.45 * scale, y, 6 * scale, 'trunk'); };
  const snag = (x, y, z, seed, scale = 1) => { F2.snag(scene, x, y, z, seed, scale); prop('snag', x, y, z); solid(x, z, 0.8 * scale, 0.8 * scale, y, 5 * scale, 'trunk'); };
  const shroom = (x, y, z, seed, big = false) => { D.mushroom(scene, x, y, z, seed, big); prop('mushroom', x, y, z); const s = big ? 1.6 + hash(seed) * 1.2 : 0.45 + hash(seed) * 0.4; solid(x, z, 0.4 * s, 0.4 * s, y, 1.1 * s, 'mushroom'); if (big) boxTag(phys.add(Box.fromTop(x, z, 0.9 * s, 0.9 * s, y + 1.35 * s, 0.4)), 'capTop'); };
  const fernP = (x, y, z, seed, scale = 1) => { F.fern(scene, x, y, z, seed, scale); prop('fern', x, y, z); };
  const crystal = (x, y, z, seed, mag = false) => { D.crystals(scene, x, y, z, seed, mag); prop('crystals', x, y, z); solid(x, z, 1.2, 1.2, y, 0.9, 'crystal'); };
  const lantern = (x, y, z, light = true) => { D.lantern(scene, x, y, z, light); prop('lantern', x, y, z); solid(x, z, 0.3, 0.3, y, 2.6, 'lantern'); };
  const sign = (x, y, z, text, rot) => { D.sign(scene, x, y, z, text, rot); prop('sign', x, y, z); solid(x, z, 0.3, 0.3, y, 1.6, 'sign'); };
  const menhir = (x, y, z, h, seed) => { F2.totem; F.menhir(scene, x, y, z, h, seed); prop('menhir', x, y, z); solid(x, z, 1.1, 0.7, y, h, 'menhir'); };
  const totem = (x, y, z, seed) => { F2.totem(scene, x, y, z, seed); prop('totem', x, y, z); solid(x, z, 0.9, 0.9, y, 4.4, 'totem'); };
  const tent = (x, y, z, rot, seed) => { F.tent(scene, x, y, z, rot, seed); prop('tent', x, y, z); solid(x, z, 3.2, 3.2, y, 2.2, 'tent'); };
  const fire = (x, y, z) => { L.fires.push(F.campfire(scene, x, y, z)); prop('campfire', x, y, z); L.hazards.push({ x, z, y, r: 1.0, dps: 0, touch: 5, kind: 'fire' }); };
  const outTree = (kind, x, top, z, seed, scale) => { F.outcrop(scene, null, x, z, top, 4 + hash(seed) * 2, seed); boxTag(phys.add(Box.fromTop(x, z, 4, 4, top, 3)), 'outcrop'); if (kind === 'oak') oak(x, top, z, seed, scale, false); else pine(x, top, z, seed, scale, false); };
  const canopy = (x, baseY, z, h, spread, seed) => { F2.canopyTree(scene, x, baseY, z, h, spread, seed); prop('canopyTree', x, baseY, z); };
  const mover = (x, y, z, w, d, to, period, phase = 0) => {
    const g = D.stoneSlab(scene, w, d, 1.2, 'mover'); const box = boxTag(phys.add(Box.fromTop(x, z, w, d, y, 1.2, 'mover')), 'mover');
    const mv = { group: g, box, w, d, from: new THREE.Vector3(x, y, z), to: new THREE.Vector3(to[0], to[1], to[2]), period, phase, last: new THREE.Vector3(x, y, z) };
    box.delta = new THREE.Vector3(); box.ref = mv; L.movers.push(mv); return mv;
  };
  const rotten = (x, y, z, tx, tz, w = 3.5) => {
    const r = F2.rottenBranch(scene, x, y, z, tx, tz, w); const box = boxTag(phys.add(Box.fromTop(x, z, w * 0.9, w * 0.9, y, 0.9, 'crumble')), 'rotten');
    const c = { group: r.group, axis: r.axis, box, state: 'idle', timer: 0, angle: 0 }; box.ref = c; L.rotten.push(c); prop('rottenBranch', x, y, z); return c;
  };

  F.treeWall(scene); F.ravineFloor(scene, -34);

  // ================= A. The Glade (z -11..11, y 0)
  ground(0, 0, 22, 22, 0, 3.5, { seed: 1 });
  shrine(0, 0, -6, 'The Glade').activate();
  L.spawn.set(0, 0, -3);
  sign(3.2, 0, 1, 'WASD TO MOVE\nSPACE TO JUMP', -0.4);
  oak(-8, 0, -7, 1, 1.2); pine(8.5, 0, -8, 2, 1.1); oak(-9, 0, 5, 3, 1); pine(9, 0, 6, 4, 1.2); birch(-3.5, 0, -9.5, 5, 1.0); pine(4, 0, 9.5, 6, 0.8);
  shroom(-5, 0, 7, 1, true); shroom(6, 0, -2, 2); shroom(-3, 0, -8, 3); fernP(6, 0, 3, 3); fernP(-6.5, 0, -2, 4); fernP(2, 0, 8, 5);
  crystal(8, 0, 0, 1); lantern(-2.5, 0, -6.5); lantern(2.5, 0, -6.5, false);
  F.shaft(scene, -4, 0, -2); F.shaft(scene, 5, 0, 4, 16, 1.6);
  gem(-6, 0, 0); gem(6, 0, 3);
  L.mists.push(F.mist(scene, 0, -7, 26, 60, 40, 3));
  canopy(-16, -34, -4, 50, 11, 1); canopy(17, -34, 2, 52, 11, 2);
  L.critters.push(F2.butterflies(scene, 2, 0, 2, 7, 6, 1)); L.critters.push(F2.deer(scene, -5, 0, 4, 2.4));
  L.dapples.push(F2.dapple(scene, [{ x: -4, y: 0, z: 1, r: 3 }, { x: 5, y: 0, z: -3, r: 2.6 }, { x: 1, y: 0, z: 7, r: 2.2 }]));

  // ================= B. Stepping stones (jump school: gaps sized for jump, then jump + dash)
  ground(0, 13, 5, 5, 0.5, 2.4, { seed: 2, plants: false }); fernP(1.6, 0.5, 14.5, 7, 0.8);
  stumpP(3, 19.5, 2.1, 1.5, 3); gem(3, 1.5, 19.5);
  rock(-2, 26, 4, 4, 3); gem(-2, 3, 26);
  sign(-3.9, 3, 26.5, 'JUMP, THEN SHIFT\nTO DASH ACROSS', 0.5);
  stumpP(2, 34.5, 2.1, 4.5, 4); gem(2, 4.5, 34.5);
  ground(0, 42.5, 5, 5, 5.5, 2.4, { seed: 5, plants: false }); gem(0, 5.5, 42.5);
  crystal(-1.3, 4.5, 35.5, 2, true); outTree('pine', -7, -2, 20, 21, 1.4); outTree('pine', 8, -1, 28, 22, 1.5); outTree('oak', -8, 0, 37, 23, 1.1);

  // ================= C. The Goblin Camp (z 45..71, y 6)
  ground(0, 58, 26, 26, 6, 5, { seed: 9 });
  F.palisade(scene, -12, 6, 58, 22, Math.PI / 2, 3); F.palisade(scene, 12, 6, 58, 22, Math.PI / 2, 4); F.palisade(scene, -7, 6, 70.5, 9, 0, 5); F.palisade(scene, 7, 6, 70.5, 9, 0, 6);
  boxTag(phys.add(new Box(-12.6, 6, 47, -11.4, 9, 69)), 'palisade'); boxTag(phys.add(new Box(11.4, 6, 47, 12.6, 9, 69)), 'palisade'); boxTag(phys.add(new Box(-11.5, 6, 70.1, -2.5, 9, 70.9)), 'palisade'); boxTag(phys.add(new Box(2.5, 6, 70.1, 11.5, 9, 70.9)), 'palisade');
  F.skullPole(scene, -2.4, 6, 47.5); F.skullPole(scene, 2.4, 6, 47.5); solid(-2.4, 47.5, 0.3, 0.3, 6, 3, 'pole'); solid(2.4, 47.5, 0.3, 0.3, 6, 3, 'pole');
  pine(-6, 6, 52, 31, 1.1); oak(6, 6, 52, 32, 1.15); oak(-6, 6, 64, 33, 1.15); pine(6, 6, 64, 34, 1.1);
  tent(-8.5, 6, 60, 1.2, 1); tent(8.5, 6, 65, -1.3, 2); tent(-8, 6, 67.5, 0.4, 3);
  fire(3, 6, 59);
  L.banners.push(D.banner(scene, -10.5, 6, 50, 1, 0.3), D.banner(scene, 10.5, 6, 50, 1, -0.3));
  lantern(-3, 6, 49.5, false); lantern(3, 6, 49.5, false);
  shrine(0, 6, 51.5, 'The Camp');
  sign(4.5, 6, 48.5, 'STRIKE: LMB   HEAVY: E\nGUARD: RMB   DASH: SHIFT', -0.5);
  shroom(-9, 6, 62, 9); crystal(9, 6, 68, 3); fernP(-10, 6, 54, 11); fernP(10, 6, 56, 12); fernP(-4, 6, 68, 13); F.shaft(scene, -6, 6, 58, 16, 1.4);
  goblin('knave', -5, 6, 56, { patrol: 4 }); goblin('skirmisher', 6, 6, 60, { patrol: 4 }); goblin('slinger', 0, 6, 65, { patrol: 3 }); goblin('knave', -6, 6, 65, { patrol: 3 });
  gem(-9, 6, 54); gem(9, 6, 54); gem(0, 6, 60); heart(-9, 6, 67);
  sign(4.5, 6, 69.2, 'GUARD (RMB) TURNS\nSTONES ASIDE', Math.PI);
  outTree('pine', -16.5, 4, 54, 41, 1.6); outTree('pine', 17, 4, 62, 42, 1.7); outTree('oak', -16.5, 5, 66, 43, 1.3); outTree('pine', 16.5, 5, 50, 44, 1.5);
  canopy(-17, -34, 58, 58, 12, 3); canopy(18, -34, 66, 56, 12, 4);
  L.dapples.push(F2.dapple(scene, [{ x: -3, y: 6, z: 56, r: 3 }, { x: 7, y: 6, z: 62, r: 2.8 }, { x: -7, y: 6, z: 66, r: 2.4 }]));
  L.critters.push(F2.crows(scene, [[-11.5, 9.4, 52], [-11.5, 9.4, 57], [11.5, 9.4, 60], [4, 9.3, 70.5]]));

  // ================= D. The gorge: rope bridge, then the swinging log (z 71..100)
  L.mists.push(F.mist(scene, 0, 0, 86, 40, 50, 3));
  F2.ropeBridge(scene, phys, [0, 6, 70.6], [0, 6.4, 80.2], 1.9, 1.0);
  ground(0, 82, 4.5, 4, 6.4, 2.2, { seed: 17, plants: false }); gem(0, 6.4, 82);
  L.swings.push(F2.swingLog(scene, phys, 0, 7.2, 88.5, 3.8, 7, 0.5, 3.4));
  ground(0, 97, 10, 8, 7.5, 3, { seed: 21 });
  goblin('slinger', 0, 7.5, 99.5, { patrol: 2 });
  lantern(-4, 7.5, 94); sign(4, 7.5, 94.5, 'RIDE THE LOG\nTHEN LEAP', -0.6);
  pine(4.2, 7.5, 99.8, 11, 0.9); shroom(-4, 7.5, 99, 12, true); fernP(-2, 7.5, 95, 14);
  gem(-3.5, 7.5, 97);
  outTree('pine', -10, 2, 80, 45, 1.6); outTree('pine', 10.5, 3, 90, 46, 1.7);
  canopy(-14, -34, 86, 54, 12, 5); canopy(14, -34, 96, 55, 12, 6);

  // ================= E. The Mushroom Hollow (z 102..126, y 6.5)
  ground(0, 114, 24, 24, 6.5, 5, { seed: 61 });
  L.areas.push({ name: 'THE MUSHROOM HOLLOW', z0: 101, z1: 126, y: 6.5 });
  F2.bounceCap(scene, phys, -6, 6.5, 110, 2.0, false); F2.bounceCap(scene, phys, 5, 6.5, 117, 1.8, true); F2.bounceCap(scene, phys, -4, 6.5, 121, 2.2, true);
  shroom(8, 6.5, 106, 51, true); shroom(-9, 6.5, 118, 52, true); shroom(9, 6.5, 123, 53, true); shroom(2, 6.5, 107, 54); shroom(-2, 6.5, 113, 55); shroom(7, 6.5, 112, 56);
  L.spores.push(F2.sporeCloud(scene, -1, 6.5, 116, 2.6)); L.spores.push(F2.sporeCloud(scene, 7, 6.5, 121, 2.2));
  fernP(-8, 6.5, 106, 57); fernP(10, 6.5, 116, 58); fernP(-10, 6.5, 124, 59); snag(-9.5, 6.5, 111, 60, 1.1); birch(9.5, 6.5, 118, 61, 1.1);
  goblin('skirmisher', -3, 6.5, 108, { patrol: 3 }); goblin('skirmisher', 6, 6.5, 114, { patrol: 3 }); goblin('brute', 0, 6.5, 120, { patrol: 2 });
  gem(-6, 6.5, 110); gem(5, 6.5, 117); gem(0, 6.5, 125);
  shrine(-7, 6.5, 124.5, 'The Hollow');
  lantern(3, 6.5, 125, true);
  // exit: a bounce cap launches you onto the high stump that leads to the roots
  F2.bounceCap(scene, phys, 3, 6.5, 129.5, 2.4, true, 21);
  stumpP(0, 134, 2.4, 10.5, 71); gem(0, 10.5, 134);
  canopy(-16, -34, 108, 58, 13, 7); canopy(16, -34, 118, 60, 13, 8);
  L.dapples.push(F2.dapple(scene, [{ x: -2, y: 6.5, z: 110, r: 3 }, { x: 6, y: 6.5, z: 120, r: 2.5 }]));
  L.critters.push(F2.butterflies(scene, 0, 6.5, 114, 8, 8, 3));

  // ================= F. The Root Maze (z 138..156, y 9 / 11.5 / 14)
  ground(0, 147, 20, 18, 9, 6, { seed: 81 });
  L.areas.push({ name: 'THE ROOT MAZE', z0: 137, z1: 157, y: 9 });
  const rootKnot = (x, y, z, tx, tz, w = 3) => { F2.organicBranch(scene, x, y, z, tx, tz, w, Math.round(x + z)); boxTag(phys.add(Box.fromTop(x, z, w * 0.9, w * 0.9, y, 0.6)), 'root'); prop('rootKnot', x, y, z); };
  // roots that loop up out of the floor
  rootKnot(-6, 11.5, 143, -9.5, 140); rootKnot(-1, 11.5, 148, -4, 151); rootKnot(4, 14, 145, 7.5, 142.5); rootKnot(-3, 14, 153, -6, 155.5);
  rootKnot(7, 14, 152, 9.5, 155, 3.5); // slinger nest: needs a dash from (4,14,145)
  goblin('slinger', 7, 14, 152, { patrol: 0.5 }); goblin('knave', 2, 9, 150, { patrol: 3 }); goblin('knave', -5, 9, 145, { patrol: 3 });
  heart(-3, 14, 153); gem(-6, 11.5, 143); gem(4, 14, 145); gem(7, 14, 152);
  snag(-8.5, 9, 150, 82, 1.2); birch(8.5, 9, 140, 83, 1.0); fernP(-7, 9, 155, 84); fernP(6, 9, 156, 85); shroom(-2, 9, 141, 86);
  sign(-3, 9, 139.5, 'THE ROOTS CLIMB\nDASH BETWEEN THEM', 0.3);
  shrine(0, 9, 155, 'The Roots');
  canopy(-15, -34, 147, 62, 12, 9); canopy(15, -34, 150, 64, 12, 10);

  // ================= G. The great hollow tree (z ~160..175, spiral of living branches up to y 33)
  const TX = 0, TZ = 168, TR = 3.2;
  F.hollowTree(scene, TX, -34, TZ, TR, 68); prop('hollowTree', TX, -34, TZ);
  boxTag(phys.add(new Box(TX - TR, -8, TZ - TR, TX + TR, 33, TZ + TR)), 'trunk');
  ground(0, 159, 6, 5, 9.5, 3, { seed: 91, plants: false }); // the foot of the tree
  const spiralPos = i => { const a = -Math.PI / 2 + i * Math.PI / 4; return { x: TX + Math.cos(a) * 6.6, z: TZ + Math.sin(a) * 6.6, y: 11 + i * 1.6, a }; };
  for (let i = 0; i < 12; i++) {
    const p = spiralPos(i);
    if (i === 3 || i === 7 || i === 10) { rotten(p.x, p.y, p.z, TX, TZ); continue; }
    const wide = i === 5 || i === 9; const w = wide ? 5 : 3.5;
    F2.organicBranch(scene, p.x, p.y, p.z, TX, TZ, w, i + 100); boxTag(phys.add(Box.fromTop(p.x, p.z, w * 0.9, w * 0.9, p.y, 0.6)), 'branch'); prop('branch', p.x, p.y, p.z);
    if (i === 5) goblin('brute', p.x, p.y, p.z, { patrol: 0.8 });
    if (i === 9) goblin('slinger', p.x, p.y, p.z, { patrol: 0.6 });
    if (i === 2 || i === 6 || i === 8 || i === 11) gem(p.x, p.y, p.z);
  }
  { const p = spiralPos(12); mover(p.x, 30.1, p.z, 3.5, 3.5, [p.x, 35.7, p.z], 6.0, 0.5); }
  ground(TX, TZ, 8, 8, 35.5, 1.4, { seed: 8, plants: false });
  for (let i = 0; i < 9; i++) { const a = -0.35 + i / 8 * Math.PI * 1.7 + Math.PI * 0.65; const r = 5.6 + hash(i * 3) * 1.2; const bx = TX + Math.cos(a) * r, by = 36.1 + hash(i) * 1.5, bz = TZ + Math.sin(a) * r; F.canopyBlob(scene, bx, by, bz, 2.2 + hash(i * 7) * 0.8, i + 60); F.limb(scene, bx, by - 0.6, bz, TX, TZ, 0.35); }
  shrine(-2.2, 35.5, 166, 'The Treetop'); heart(2.5, 35.5, 166.5); gem(2.5, 35.5, 169.5);
  lantern(2.8, 35.5, 164.8); sign(-2.8, 35.5, 170.5, 'THE CANOPY WALK\nLIES AHEAD', 0);
  L.mists.push(F.mist(scene, 0, 2, 168, 40, 40, 3));
  sign(-3, 9.5, 158, 'ROTTEN BRANCHES\nSNAP UNDERFOOT', 0.4);

  // ================= H. The Canopy Walk (three tree crowns joined by rope bridges, y 35 → 31)
  L.areas.push({ name: 'THE CANOPY WALK', z0: 173, z1: 205, y: 30 });
  const crown = (x, z, top, seed) => { F2.canopyTree(scene, x, -34, z, top + 34 - 7.5, 9, seed); ground(x, z, 7, 7, top, 1.2, { seed, plants: false }); F.limb(scene, x, top - 0.6, z, x, z + 0.01, 0.2); prop('crown', x, top, z); };
  crown(11, 182, 35, 11); crown(0, 196, 33.5, 12); crown(-2, 209, 31, 13);
  F2.ropeBridge(scene, phys, [2.5, 35.5, 171.5], [8.5, 35, 179.5], 1.9, 0.9);
  F2.ropeBridge(scene, phys, [9, 35, 185.5], [1.5, 33.5, 193.5], 1.9, 1.1);
  // the third bridge was cut: it hangs as a steep plank ramp down to the yard's gate ledge
  F2.ropeBridge(scene, phys, [-0.5, 33.5, 199.5], [-2, 31, 206], 1.9, 0.4);
  L.critters.push(F2.crows(scene, [[11, 35.6, 179], [13, 35.6, 184], [0, 34.1, 193], [-4, 31.6, 210]]));
  gem(11, 35, 182); gem(0, 33.5, 196); gem(-2, 31, 209);
  shrine(-0.5, 31, 211, 'The Canopy');
  sign(-4.5, 31, 211.5, 'THE WARLORD\'S YARD\nBELOW', 0.5);
  L.mists.push(F.mist(scene, 0, 24, 195, 50, 50, 3));

  // ================= I. The Warlord's Yard (z 215..243, y 28): palisade ring with two gates
  const YX = 0, YZ = 229, YY = 28;
  ground(YX, YZ, 28, 28, YY, 6, { seed: 44 });
  L.areas.push({ name: "THE WARLORD'S YARD", z0: 214, z1: 244, y: YY });
  // ramp down from the canopy ledge onto the yard: a broad root
  F2.organicBranch(scene, -2, 29.5, 214, -2, 208, 4, 140); boxTag(phys.add(Box.fromTop(-2, 214, 3.6, 3.6, 29.5, 0.6)), 'branch'); prop('branch', -2, 29.5, 214);
  const ring = 13.2; const gates = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (i === 12 || i === 4) { gates.push({ x: YX + Math.cos(a) * ring, z: YZ + Math.sin(a) * ring }); continue; } const gx = YX + Math.cos(a) * ring, gz = YZ + Math.sin(a) * ring; F.palisade(scene, gx, YY, gz, 5.4, -a + Math.PI / 2, 200 + i); }
  L.bossWalls = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const gx = YX + Math.cos(a) * ring, gz = YZ + Math.sin(a) * ring; const b = new Box(gx - 2.9, YY, gz - 2.9, gx + 2.9, YY + 5, gz + 2.9, 'wall'); b.solid = (i !== 12 && i !== 4); if (i === 12 || i === 4) { b.gate = true; L.bossWalls.push(b); } else boxTag(b, 'palisade'); phys.add(b); }
  L.yard = { cx: YX, cz: YZ, y: YY, r: ring, gates, triggerZ: 219 };
  totem(-8, YY, 221, 1); totem(8, YY, 221, 2); totem(-9, YY, 236, 3); totem(9, YY, 236, 4);
  F2.warDrum(scene, 9, YY, 229); solid(9, 229, 1.8, 1.8, YY, 1.2, 'drum'); prop('drum', 9, YY, 229);
  fire(-6, YY, 230); L.yardFire = L.hazards[L.hazards.length - 1];
  tent(-9.5, YY, 226, 0.8, 5); tent(9.5, YY, 224, -0.8, 6);
  F.skullPole(scene, -2.6, YY, 216.5); F.skullPole(scene, 2.6, YY, 216.5); solid(-2.6, 216.5, 0.3, 0.3, YY, 3, 'pole'); solid(2.6, 216.5, 0.3, 0.3, YY, 3, 'pole');
  L.banners.push(D.banner(scene, -6, YY, 217, 1, 0.5), D.banner(scene, 6, YY, 217, 1, -0.5));
  lantern(-4, YY, 218); lantern(4, YY, 218);
  fernP(-11, YY, 231, 15); fernP(11, YY, 233, 16); shroom(-10, YY, 238, 17); crystal(10, YY, 239, 18, true);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; outTree('pine', Math.cos(a) * 19.5, YY - 2 + hash(i * 3) * 2, YZ + Math.sin(a) * 19.5, 70 + i, 1.6 + hash(i) * 0.5); }
  canopy(-20, -34, 222, 60, 13, 14); canopy(21, -34, 236, 62, 13, 15);
  const runeFloor = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.2, 48), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.3 })); runeFloor.rotation.x = -Math.PI / 2; runeFloor.position.set(YX, YY + 0.03, YZ); scene.add(runeFloor);
  L.bossGate = D.bossGate(scene, YX, YZ, YY, ring);
  L.bossArena = { cx: YX, cz: YZ, r: ring, triggerZ: 219, y: YY };
  L.enemySpecs.push({ type: 'warlord', x: YX, y: YY, z: YZ + 6 });
  L.portal = D.portal(scene, YX, YY, YZ);
  heart(-8, YY, 220.5);
  L.mists.push(F.mist(scene, 0, 22, 229, 60, 60, 3));

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
  for (const sw of L.swings) F2.updateSwing(sw, t);
  for (const c of L.rotten) {
    if (c.state === 'idle') { if (player.body.groundBox === c.box) { c.state = 'shake'; c.timer = 0.6; sfx('crumble'); } }
    else if (c.state === 'shake') { c.timer -= dt; c.group.rotation.x = (Math.random() - 0.5) * 0.03; c.group.rotation.z = (Math.random() - 0.5) * 0.03; if (c.timer <= 0) { c.state = 'fall'; c.timer = 0; c.box.solid = false; sfx('snap'); } }
    else if (c.state === 'fall') { c.timer += dt; c.angle = Math.min(1.35, c.timer * c.timer * 4.5); c.group.quaternion.setFromAxisAngle(c.axis, -c.angle); if (c.timer > 4.5) { c.state = 'idle'; c.angle = 0; c.group.quaternion.identity(); c.group.rotation.set(0, 0, 0); c.box.solid = true; } }
  }
  for (const g of L.gems) if (!g.taken) { g.mesh.rotation.y = t * 1.8 + g.ph; g.mesh.position.y = g.base + Math.sin(t * 2.2 + g.ph) * 0.15; }
  for (const h of L.hearts) if (!h.taken) { h.mesh.rotation.y = t * 1.2 + h.ph; h.mesh.position.y = h.base + Math.sin(t * 2 + h.ph) * 0.12; const s = 1 + Math.sin(t * 6 + h.ph) * 0.06; h.mesh.scale.set(s, s * 0.9, s * 0.8); }
  for (const s of L.shrines) s.update(t);
  for (const b of L.banners) { const f = b.userData.flag; f.rotation.y = Math.sin(t * 2.1 + b.position.x) * 0.25; f.rotation.x = Math.sin(t * 3.3 + b.position.z) * 0.08; }
  for (const f of L.fires) f.update(t);
  for (const s of L.spores) s.update(t);
  for (const d of L.dapples) d.update(t);
  F.updateGrass(t);
  L.portal.update(t);
}
export function updateCritters(L, dt, t, playerPos, phys) { for (const c of L.critters) c.update(dt, t, playerPos, phys); }

// Ground audit: every logged prop must sit on a collision top within 0.35 m, and every box should be tagged.
export function auditLevel(L, phys) {
  const floating = [], untagged = [];
  for (const p of L.props) { if (p.y < -30) continue; const fl = phys.floorAt(p.x, p.z, p.y - 0.4); const gap = fl ? p.y - fl.max.y : Infinity; if (gap > 0.35 || gap < -0.6) floating.push({ ...p, gap: fl ? +gap.toFixed(2) : null }); }
  for (const b of phys.boxes) if (!b.tag && b.kind !== 'wall' && b.kind !== 'mover') untagged.push({ min: b.min.toArray().map(n => +n.toFixed(1)), max: b.max.toArray().map(n => +n.toFixed(1)), kind: b.kind });
  return { props: L.props.length, boxes: phys.boxes.length, floating, untagged };
}
