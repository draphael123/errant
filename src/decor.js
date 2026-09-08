// Props. Everything is built from primitives with shared materials; statics freeze their matrices.
import * as THREE from 'three';
import { hash, rockGeometry } from './world.js';
import { makeTextures, worldMap } from './textures.js';
const TEX = makeTextures();

const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x6fae4e, roughness: 0.92 }),
  grassDark: new THREE.MeshStandardMaterial({ color: 0x4f8f3e, roughness: 0.95 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x7a5535, roughness: 1 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x5b4f6e, roughness: 0.95, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: 0xa79c8e, roughness: 0.9 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x7d7268, roughness: 0.92 }),
  stoneMoss: new THREE.MeshStandardMaterial({ color: 0x8d9a6e, roughness: 0.92 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5b3b1f, roughness: 0.9 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.95 }),
  leaf1: new THREE.MeshStandardMaterial({ color: 0x4f9c3e, roughness: 0.9, flatShading: true }),
  leaf2: new THREE.MeshStandardMaterial({ color: 0x7bc35a, roughness: 0.9, flatShading: true }),
  leaf3: new THREE.MeshStandardMaterial({ color: 0xe08a4a, roughness: 0.9, flatShading: true }),
  leaf4: new THREE.MeshStandardMaterial({ color: 0xd85a8a, roughness: 0.9, flatShading: true }),
  shroomRed: new THREE.MeshStandardMaterial({ color: 0xd8483c, roughness: 0.7 }),
  shroomBlue: new THREE.MeshStandardMaterial({ color: 0x4a7fd8, roughness: 0.7, emissive: 0x1a3a8a, emissiveIntensity: 0.5 }),
  shroomStem: new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.8 }),
  spot: new THREE.MeshStandardMaterial({ color: 0xfff5e0, roughness: 0.8 }),
  crystalC: new THREE.MeshStandardMaterial({ color: 0x9ff4ff, emissive: 0x3ac8e0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }),
  crystalM: new THREE.MeshStandardMaterial({ color: 0xf0a0ff, emissive: 0xc040e0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.6, metalness: 0.5 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb340, emissiveIntensity: 2.2 }),
  gem: new THREE.MeshStandardMaterial({ color: 0x8ef6ff, emissive: 0x3ad8f0, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.2 }),
  heart: new THREE.MeshStandardMaterial({ color: 0xff5a6a, emissive: 0xc0102a, emissiveIntensity: 1.0, roughness: 0.3 }),
  rune: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0x3aa0ff, emissiveIntensity: 1.8, roughness: 0.3 }),
  runeOff: new THREE.MeshStandardMaterial({ color: 0x6a6f80, emissive: 0x202838, emissiveIntensity: 0.4, roughness: 0.6 }),
  flower: [0xfff08a, 0xff9ac8, 0xa8d8ff, 0xffffff].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
  banner: [0x2f56a8, 0x8a2634, 0x3f7a3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })),
};
// world-space textures: same tiling on every box regardless of size
worldMap(MAT.grass, TEX.grass, 0.28); MAT.grass.color.setHex(0xf2fff0);
worldMap(MAT.stone, TEX.stone, 0.32); MAT.stone.color.setHex(0xffffff);
worldMap(MAT.stoneDark, TEX.stone, 0.32); MAT.stoneDark.color.setHex(0xa89c90);
worldMap(MAT.stoneMoss, TEX.moss, 0.3); MAT.stoneMoss.color.setHex(0xffffff);
worldMap(MAT.rock, TEX.rock, 0.11); MAT.rock.color.setHex(0xffffff);
worldMap(MAT.bark, TEX.bark, 0.7); MAT.bark.color.setHex(0xffffff);
worldMap(MAT.wood, TEX.bark, 0.9); MAT.wood.color.setHex(0xb08a66);
worldMap(MAT.dirt, TEX.dirt, 0.3); MAT.dirt.color.setHex(0xffffff);
export { MAT, TEX };

const GEO = {
  tuft: new THREE.ConeGeometry(0.12, 0.45, 4),
  flower: new THREE.SphereGeometry(0.09, 6, 5),
  leafBlob: new THREE.IcosahedronGeometry(1, 1),
  gem: new THREE.OctahedronGeometry(0.32, 0),
  heart: new THREE.IcosahedronGeometry(0.3, 0),
};

function m(geo, mat, x = 0, y = 0, z = 0, cast = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; }
function freeze(o) { o.traverse(c => { c.matrixAutoUpdate = false; c.updateMatrix(); }); return o; }

// A floating island: slab top with a dirt lip and a hanging rock underside.
export function island(scene, { x, z, w, d, top, thick = 2, seed = 1, kind = 'grass', tufts = true }) {
  const g = new THREE.Group(); g.position.set(x, top, z);
  const topMat = kind === 'stone' ? MAT.stone : kind === 'moss' ? MAT.stoneMoss : MAT.grass;
  const slab = m(new THREE.BoxGeometry(w, thick, d), topMat, 0, -thick / 2, 0); slab.receiveShadow = true; g.add(slab);
  if (kind === 'grass') { const lip = m(new THREE.BoxGeometry(w + 0.08, thick * 0.7, d + 0.08), MAT.dirt, 0, -thick * 0.55 - thick * 0.3, 0); g.add(lip); }
  const rr = Math.min(w, d) * 0.55, rh = Math.max(3, Math.min(w, d) * 0.9 + hash(seed) * 3);
  const rock = m(rockGeometry(rr, rh, seed * 17), MAT.rock, 0, -thick - rh / 2 + 0.6, 0); rock.scale.set(w / (rr * 2) * 1.05, 1, d / (rr * 2) * 1.05); g.add(rock);
  if (tufts && kind === 'grass' && w * d > 12) {
    const n = Math.min(60, Math.floor(w * d * 0.35));
    const inst = new THREE.InstancedMesh(GEO.tuft, MAT.grassDark, n); inst.castShadow = false; inst.receiveShadow = true;
    const dm = new THREE.Object3D();
    for (let i = 0; i < n; i++) { dm.position.set((hash(seed + i * 3.3) - 0.5) * (w - 0.6), 0.2, (hash(seed + i * 7.7) - 0.5) * (d - 0.6)); dm.rotation.y = hash(i) * 6; dm.scale.setScalar(0.7 + hash(seed * 2 + i) * 0.8); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); }
    g.add(inst);
    const fn = Math.min(18, Math.floor(w * d * 0.06));
    for (let i = 0; i < fn; i++) { const f = m(GEO.flower, MAT.flower[i % 4], (hash(seed + i * 5.1) - 0.5) * (w - 1), 0.12, (hash(seed + i * 9.9) - 0.5) * (d - 1), false); f.scale.set(1, 0.7, 1); g.add(f); }
  }
  scene.add(freeze(g)); return g;
}

export function tree(scene, x, y, z, seed = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const h = 2.2 + hash(seed) * 1.8;
  g.add(m(new THREE.CylinderGeometry(0.16, 0.26, h, 7), MAT.bark, 0, h / 2, 0));
  const leaf = [MAT.leaf1, MAT.leaf2, MAT.leaf3, MAT.leaf4][kind % 4];
  const alt = [MAT.leaf2, MAT.leaf1, MAT.leaf4, MAT.leaf3][kind % 4];
  const blobs = 3 + Math.floor(hash(seed * 3) * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 0.9 + hash(seed + i * 4) * 0.9;
    const b = m(GEO.leafBlob, i % 2 ? alt : leaf, (hash(seed + i) - 0.5) * 1.4, h + (hash(seed * 2 + i) - 0.3) * 1.2, (hash(seed * 5 + i) - 0.5) * 1.4);
    b.scale.set(r, r * 0.85, r); b.rotation.set(hash(i) * 3, hash(i * 2) * 3, 0); g.add(b);
  }
  g.rotation.y = hash(seed * 9) * 6; scene.add(freeze(g)); return g;
}

export function mushroom(scene, x, y, z, seed = 1, big = false) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const s = big ? 1.6 + hash(seed) * 1.2 : 0.45 + hash(seed) * 0.4;
  const blue = hash(seed * 3) > 0.55;
  g.add(m(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.1 * s, 8), MAT.shroomStem, 0, 0.55 * s, 0));
  const cap = m(new THREE.SphereGeometry(0.55 * s, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), blue ? MAT.shroomBlue : MAT.shroomRed, 0, 0.95 * s, 0); cap.scale.y = 0.85; g.add(cap);
  for (let i = 0; i < 5; i++) { const a = hash(seed + i) * 6.28, r = 0.3 * s; const sp = m(new THREE.SphereGeometry(0.07 * s, 6, 5), MAT.spot, Math.cos(a) * r, 0.95 * s + 0.4 * s, Math.sin(a) * r, false); sp.scale.y = 0.4; g.add(sp); }
  g.rotation.z = (hash(seed * 7) - 0.5) * 0.3; scene.add(freeze(g)); return g;
}

export function crystals(scene, x, y, z, seed = 1, magenta = false) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const n = 3 + Math.floor(hash(seed) * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.6 + hash(seed + i * 2) * 1.2;
    const c = m(new THREE.ConeGeometry(0.16 + hash(i) * 0.1, h, 5), magenta ? MAT.crystalM : MAT.crystalC, (hash(seed + i) - 0.5) * 0.8, h / 2 - 0.1, (hash(seed * 3 + i) - 0.5) * 0.8);
    c.rotation.set((hash(i * 5 + seed) - 0.5) * 0.7, hash(i) * 6, (hash(i * 9 + seed) - 0.5) * 0.7); g.add(c);
  }
  scene.add(freeze(g)); return g;
}

export function lantern(scene, x, y, z, withLight = true) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), MAT.wood, 0, 1.3, 0));
  g.add(m(new THREE.BoxGeometry(0.5, 0.06, 0.06), MAT.wood, 0.2, 2.5, 0));
  g.add(m(new THREE.BoxGeometry(0.26, 0.34, 0.26), MAT.iron, 0.42, 2.2, 0));
  g.add(m(new THREE.BoxGeometry(0.2, 0.26, 0.2), MAT.lamp, 0.42, 2.2, 0, false));
  if (withLight) { const l = new THREE.PointLight(0xffb650, 40, 9, 2); l.position.set(0.42, 2.2, 0); g.add(l); }
  scene.add(freeze(g)); return g;
}

export function banner(scene, x, y, z, color = 0, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  g.add(m(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), MAT.wood, 0, 2.1, 0));
  g.add(m(new THREE.BoxGeometry(1.1, 0.06, 0.06), MAT.wood, 0, 4.1, 0));
  const flag = m(new THREE.BoxGeometry(0.9, 1.6, 0.02), MAT.banner[color % 3], 0, 3.3, 0); flag.castShadow = false; g.add(flag);
  g.add(m(new THREE.ConeGeometry(0.1, 0.3, 6), MAT.iron, 0, 4.3, 0));
  scene.add(g); g.userData.flag = flag; return g;
}

export function wall(scene, x, y, z, len, h, rotY = 0, broken = true, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const segs = Math.max(2, Math.round(len / 1.5));
  for (let i = 0; i < segs; i++) {
    const sh = broken ? h * (0.45 + hash(seed + i * 3) * 0.7) : h;
    const b = m(new THREE.BoxGeometry(len / segs, sh, 0.8), i % 3 === 1 ? MAT.stoneMoss : MAT.stone, -len / 2 + (i + 0.5) * (len / segs), sh / 2, 0); g.add(b);
    if (!broken || sh > h * 0.9) { if (i % 2 === 0) g.add(m(new THREE.BoxGeometry(len / segs * 0.5, 0.5, 0.8), MAT.stoneDark, -len / 2 + (i + 0.5) * (len / segs), sh + 0.25, 0)); }
  }
  scene.add(freeze(g)); return g;
}

export function column(scene, x, y, z, h = 3, broken = true, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(0.55, 0.62, 0.35, 10), MAT.stoneDark, 0, 0.17, 0));
  const hh = broken ? h * (0.4 + hash(seed) * 0.6) : h;
  g.add(m(new THREE.CylinderGeometry(0.36, 0.42, hh, 10), MAT.stone, 0, 0.35 + hh / 2, 0));
  if (!broken) g.add(m(new THREE.CylinderGeometry(0.55, 0.42, 0.35, 10), MAT.stoneDark, 0, 0.35 + hh + 0.17, 0));
  scene.add(freeze(g)); return g;
}

export function arch(scene, x, y, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  for (const s of [-1, 1]) g.add(m(new THREE.BoxGeometry(0.9, 3.6, 0.9), MAT.stone, s * 2, 1.8, 0));
  const t = m(new THREE.TorusGeometry(2, 0.45, 8, 16, Math.PI), MAT.stoneMoss, 0, 3.6, 0); g.add(t);
  scene.add(freeze(g)); return g;
}

// Checkpoint shrine: plinth + hovering rune ring. Returns an object with an `activate()`.
export function shrine(scene, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(1.0, 1.15, 0.35, 10), MAT.stoneDark, 0, 0.17, 0));
  g.add(m(new THREE.CylinderGeometry(0.7, 0.8, 0.3, 10), MAT.stone, 0, 0.5, 0));
  g.add(m(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 8), MAT.stone, 0, 1.4, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), MAT.runeOff); ring.position.y = 2.7; g.add(ring);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), MAT.runeOff); core.position.y = 2.7; g.add(core);
  const light = new THREE.PointLight(0x5ab0ff, 0, 10, 2); light.position.y = 2.7; g.add(light);
  scene.add(g);
  const o = { group: g, ring, core, light, active: false, pos: new THREE.Vector3(x, y, z),
    activate() { this.active = true; ring.material = MAT.rune; core.material = MAT.rune; light.intensity = 60; },
    deactivate() { this.active = false; ring.material = MAT.runeOff; core.material = MAT.runeOff; light.intensity = 0; },
    update(t) { ring.rotation.y = t * 0.8; ring.rotation.x = Math.sin(t * 0.6) * 0.5; core.rotation.y = -t * 1.3; core.position.y = 2.7 + Math.sin(t * 2) * 0.1; if (this.active) light.intensity = 50 + Math.sin(t * 3) * 12; } };
  return o;
}

let signCanvas = null;
export function sign(scene, x, y, z, text, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  g.add(m(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), MAT.wood, 0, 0.8, 0));
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5b3b1f'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#7a5535'; ctx.fillRect(10, 10, 492, 236);
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = '#f7ecd4'; ctx.font = 'bold 40px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n'); lines.forEach((l, i) => ctx.fillText(l, 256, 128 + (i - (lines.length - 1) / 2) * 52));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const board = m(new THREE.BoxGeometry(2.0, 1.0, 0.08), [MAT.wood, MAT.wood, MAT.wood, MAT.wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), MAT.wood], 0, 1.9, 0);
  g.add(board);
  scene.add(freeze(g)); return g;
}

export function gem(scene, x, y, z) {
  const mesh = new THREE.Mesh(GEO.gem, MAT.gem); mesh.position.set(x, y + 1.0, z); mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, pos: new THREE.Vector3(x, y + 1.0, z), taken: false, base: y + 1.0, ph: hash(x * 3 + z) * 6.28 };
}
export function heart(scene, x, y, z) {
  const mesh = new THREE.Mesh(GEO.heart, MAT.heart); mesh.position.set(x, y + 1.0, z); mesh.castShadow = true; mesh.scale.set(1, 0.9, 0.8);
  scene.add(mesh);
  return { mesh, pos: new THREE.Vector3(x, y + 1.0, z), taken: false, base: y + 1.0, ph: hash(x + z * 5) * 6.28 };
}

// A moving/crumbling stone platform mesh (collision is added by the level).
export function stoneSlab(scene, w, d, thick, kind = 'mover') {
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(w, thick, d), kind === 'crumble' ? MAT.stoneDark : MAT.stone, 0, -thick / 2, 0));
  g.add(m(new THREE.BoxGeometry(w * 0.86, 0.1, d * 0.86), kind === 'crumble' ? MAT.stoneMoss : MAT.rune, 0, 0.02, 0, false));
  if (kind === 'mover') { const rock = m(rockGeometry(Math.min(w, d) * 0.45, thick * 1.6, w * 3), MAT.rock, 0, -thick - thick * 0.5, 0); g.add(rock); }
  else { for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; g.add(m(new THREE.BoxGeometry(0.4, 0.4, 0.4), MAT.stoneDark, Math.cos(a) * w * 0.35, -thick - 0.1, Math.sin(a) * d * 0.35)); } }
  scene.add(g); return g;
}

export function tower(scene, x, y, z, radius, height) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(radius, radius * 1.08, height, 14), MAT.stone, 0, height / 2, 0));
  for (let i = 0; i < 6; i++) { const b = m(new THREE.BoxGeometry(radius * 2.15, 0.35, radius * 2.15), MAT.stoneDark, 0, 3 + i * (height - 6) / 5, 0); b.rotation.y = i * 0.26; g.add(b); }
  // windows
  for (let i = 0; i < 10; i++) { const a = i * 1.9, hh = 4 + hash(i) * (height - 8); const w = m(new THREE.BoxGeometry(0.6, 1.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x0b0714 }), Math.cos(a) * radius, hh, Math.sin(a) * radius); w.lookAt(new THREE.Vector3(x + Math.cos(a) * radius * 2, y + hh, z + Math.sin(a) * radius * 2)); g.add(w); }
  scene.add(freeze(g)); return g;
}
export function merlon(scene, x, y, z) { const b = m(new THREE.BoxGeometry(0.7, 0.9, 0.7), MAT.stone, x, y + 0.45, z); scene.add(freeze(b)); return b; }

export function bossGate(scene, cx, cz, y, radius) {
  const g = new THREE.Group(); g.position.set(cx, y, cz);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
  const wallM = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 9, 32, 1, true), mat); wallM.position.y = 4.5; g.add(wallM);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0 })); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.1; g.add(ringM);
  scene.add(g);
  return { group: g, wall: wallM, ring: ringM, set(a) { mat.opacity = a * 0.18; ringM.material.opacity = a; } };
}

export function portal(scene, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.16, 8, 32), MAT.rune); ring.position.y = 1.8; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); disc.position.y = 1.8; g.add(disc);
  const light = new THREE.PointLight(0x7ad0ff, 80, 14, 2); light.position.y = 1.8; g.add(light);
  g.visible = false; scene.add(g);
  return { group: g, update(t) { ring.rotation.y = t; disc.rotation.z = -t * 0.5; g.scale.setScalar(1 + Math.sin(t * 2) * 0.04); } };
}
