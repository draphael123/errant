// Forest props: pines, oaks, ferns, logs, stumps, forest-floor chunks, the great hollow tree, menhirs,
// mist, light shafts, a goblin camp, and the ring of giant trees that encloses the level.
import * as THREE from 'three';
import { MAT, TEX } from './decor.js';
import { hash, rockGeometry } from './world.js';
import { worldMap, makeGrassClump } from './textures.js';
import { SPRITE } from './fx.js';

const FM = {
  floor: worldMap(new THREE.MeshStandardMaterial({ color: 0x9fca86, roughness: 0.95 }), TEX.grass, 0.26),
  needle: [0x2f6b3a, 0x3f8a48, 0x4f9c50].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true })),
  needleFar: new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 1, flatShading: true }),
  oak: [0x4f9c3e, 0x7bc35a, 0x8fd06a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
  fern: new THREE.MeshStandardMaterial({ color: 0x3f8f3f, roughness: 0.9, side: THREE.DoubleSide }),
  fernLight: new THREE.MeshStandardMaterial({ color: 0x6ab55a, roughness: 0.9, side: THREE.DoubleSide }),
  logEnd: new THREE.MeshStandardMaterial({ color: 0xc9a67a, roughness: 0.9 }),
  canvas: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95, side: THREE.DoubleSide }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff5a20 }),
  mist: new THREE.MeshBasicMaterial({ color: 0xdfeee0, transparent: true, opacity: 0.35, depthWrite: false, map: SPRITE, side: THREE.DoubleSide }),
  shaft: new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.085, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  ravine: new THREE.MeshStandardMaterial({ color: 0x142a1c, roughness: 1 }),
};
export { FM };

function m(geo, mat, x = 0, y = 0, z = 0, cast = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; }
function freeze(o) { o.traverse(c => { c.matrixAutoUpdate = false; c.updateMatrix(); }); o.userData.static = true; return o; }
const G = { fern: new THREE.ConeGeometry(0.5, 1.4, 3), tuft: new THREE.ConeGeometry(0.12, 0.45, 4), flower: new THREE.SphereGeometry(0.08, 6, 5) };
// crossed quads for a grass clump: two vertical planes at 90°, pivot at the base
function crossQuadGeometry(w = 0.9, h = 0.7) {
  const g = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
  const addQuad = (ax, az) => { const b = pos.length / 3; pos.push(-ax, 0, -az, ax, 0, az, ax, h, az, -ax, h, -az); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  addQuad(w / 2, 0); addQuad(0, w / 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const GRASS_GEO = crossQuadGeometry();
export const GRASS_MATS = [];
function grassMaterial(seed) {
  const mat = new THREE.MeshStandardMaterial({ map: makeGrassClump(seed), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, color: 0xe6ffd8 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }; mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n float gph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;\n#else\n float gph = 0.0;\n#endif\n float sway = sin(uTime * 1.6 + gph) * 0.5 + sin(uTime * 2.9 + gph * 1.7) * 0.25;\n transformed.x += sway * uv.y * uv.y * 0.16; transformed.z += cos(uTime * 1.3 + gph) * uv.y * uv.y * 0.08;');
  };
  GRASS_MATS.push(mat); return mat;
}
const GRASS_MAT = [grassMaterial(1), grassMaterial(2), grassMaterial(3)];
export function updateGrass(t) { for (const m of GRASS_MATS) if (m.userData.shader) m.userData.shader.uniforms.uTime.value = t; }
export function grassPatch(parent, w, d, seed, density = 0.55) {
  const n = Math.min(160, Math.floor(w * d * density));
  const inst = new THREE.InstancedMesh(GRASS_GEO, GRASS_MAT[seed % 3], n); inst.castShadow = false; inst.receiveShadow = true;
  const dm = new THREE.Object3D();
  for (let i = 0; i < n; i++) { dm.position.set((hash(seed + i * 3.3) - 0.5) * (w - 0.9), 0, (hash(seed + i * 7.7) - 0.5) * (d - 0.9)); dm.rotation.y = hash(i + seed) * 6; const sc = 0.7 + hash(seed * 2 + i) * 0.8; dm.scale.set(sc, sc * (0.8 + hash(i * 9) * 0.6), sc); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); }
  parent.add(inst); return inst;
}

// ---------- trees
export function pine(scene, x, y, z, seed = 1, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  const h = 7 + hash(seed) * 3;
  g.add(m(new THREE.CylinderGeometry(0.22, 0.38, h, 7), MAT.bark, 0, h / 2, 0));
  const tiers = 4 + Math.floor(hash(seed * 3) * 2);
  for (let i = 0; i < tiers; i++) {
    const u = i / tiers; const r = 2.6 * (1 - u * 0.75) * (0.9 + hash(seed + i) * 0.25), ch = 2.6 * (1 - u * 0.4);
    const c = m(new THREE.ConeGeometry(r, ch, 8), FM.needle[(i + Math.floor(hash(seed) * 3)) % 3], 0, h * 0.35 + u * h * 0.72, 0); c.rotation.y = hash(seed + i * 7) * 3; g.add(c);
  }
  g.rotation.y = hash(seed * 5) * 6; g.rotation.z = (hash(seed * 11) - 0.5) * 0.06; scene.add(freeze(g)); return g;
}
export function oak(scene, x, y, z, seed = 1, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  const h = 3.5 + hash(seed) * 2;
  g.add(m(new THREE.CylinderGeometry(0.32, 0.5, h, 7), MAT.bark, 0, h / 2, 0));
  for (const s of [-1, 1]) { const b = m(new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6), MAT.bark, s * 0.9, h - 0.6, 0); b.rotation.z = s * 0.9; g.add(b); }
  const blobs = 5 + Math.floor(hash(seed * 3) * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 1.5 + hash(seed + i * 4) * 1.3;
    const b = m(new THREE.IcosahedronGeometry(r, 1), FM.oak[(i + Math.floor(hash(seed))) % 3], (hash(seed + i) - 0.5) * 3.2, h + 0.4 + (hash(seed * 2 + i) - 0.3) * 1.6, (hash(seed * 5 + i) - 0.5) * 3.2);
    b.scale.y = 0.8; b.rotation.set(hash(i) * 3, hash(i * 2) * 3, 0); g.add(b);
  }
  g.rotation.y = hash(seed * 9) * 6; scene.add(freeze(g)); return g;
}
export function fern(scene, x, y, z, seed = 1, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale * (0.7 + hash(seed) * 0.6));
  const n = 6 + Math.floor(hash(seed * 2) * 3);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + hash(seed) * 3; const f = m(G.fern, i % 2 ? FM.fern : FM.fernLight, Math.cos(a) * 0.35, 0.5, Math.sin(a) * 0.35, false); f.rotation.set(0, -a + Math.PI / 2, 0); f.rotation.z = -0.9; f.rotateY(-a); f.scale.set(0.6, 1, 0.15); f.lookAt(new THREE.Vector3(x + Math.cos(a) * 3, y + 1.2, z + Math.sin(a) * 3)); f.rotateX(Math.PI / 2 - 0.4); g.add(f); }
  scene.add(freeze(g)); return g;
}
export function log(scene, x, y, z, len, alongX = false, r = 0.5) {
  const g = new THREE.Group(); g.position.set(x, y - r, z); g.rotation.y = alongX ? Math.PI / 2 : 0;
  const c = m(new THREE.CylinderGeometry(r, r, len, 10), MAT.bark, 0, 0, 0); c.rotation.x = Math.PI / 2; g.add(c);
  for (const s of [-1, 1]) g.add(m(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.05, 10), FM.logEnd, 0, 0, s * len / 2)).rotation.x = Math.PI / 2;
  g.add(m(new THREE.BoxGeometry(r * 1.4, 0.06, len * 0.85), MAT.stoneMoss, 0, r - 0.02, 0, false)); // moss on top
  scene.add(freeze(g)); return g;
}
export function stump(scene, x, y, z, r = 1.5, h = 1.4, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y - h, z);
  g.add(m(new THREE.CylinderGeometry(r, r * 1.15, h, 12), MAT.bark, 0, h / 2, 0));
  g.add(m(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.06, 12), FM.logEnd, 0, h + 0.02, 0));
  for (let i = 1; i < 4; i++) g.add(m(new THREE.TorusGeometry(r * 0.25 * i, 0.02, 4, 24), MAT.wood, 0, h + 0.06, 0, false)).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + hash(seed + i); const root = m(new THREE.CylinderGeometry(0.12, 0.3, r * 1.4, 6), MAT.bark, Math.cos(a) * r * 1.1, 0.2, Math.sin(a) * r * 1.1); root.lookAt(new THREE.Vector3(x + Math.cos(a) * 5, y - h - 1.5, z + Math.sin(a) * 5)); root.rotateX(Math.PI / 2); g.add(root); }
  scene.add(freeze(g)); return g;
}

// ---------- forest floor chunk: mossy top, dirt band, hanging rock, roots and undergrowth
export function groundChunk(scene, { x, z, w, d, top, thick = 3, seed = 1, plants = true }) {
  const g = new THREE.Group(); g.position.set(x, top, z);
  const slab = m(new THREE.BoxGeometry(w, thick, d), FM.floor, 0, -thick / 2, 0); g.add(slab);
  const lip = m(new THREE.BoxGeometry(w + 0.1, thick * 0.75, d + 0.1), MAT.dirt, 0, -thick * 0.62, 0); g.add(lip);
  const rr = Math.min(w, d) * 0.55, rh = Math.max(4, Math.min(w, d) * 0.9 + hash(seed) * 3);
  const rock = m(rockGeometry(rr, rh, seed * 17), MAT.rock, 0, -thick - rh / 2 + 0.8, 0); rock.scale.set(w / (rr * 2) * 1.05, 1, d / (rr * 2) * 1.05); g.add(rock);
  // roots draped over the edges
  const nroots = Math.min(8, Math.floor((w + d) / 4));
  for (let i = 0; i < nroots; i++) {
    const side = i % 4; const t = (hash(seed * 3 + i) - 0.5);
    const px = side === 0 ? -w / 2 : side === 1 ? w / 2 : t * w * 0.9, pz = side === 2 ? -d / 2 : side === 3 ? d / 2 : t * d * 0.9;
    const root = m(new THREE.CylinderGeometry(0.1, 0.22, 2.2 + hash(i) * 1.5, 6), MAT.bark, px, -0.6, pz);
    root.rotation.z = side === 0 ? 0.5 : side === 1 ? -0.5 : 0; root.rotation.x = side === 2 ? -0.5 : side === 3 ? 0.5 : 0; g.add(root);
  }
  if (plants && w * d > 12) {
    grassPatch(g, w, d, Math.abs(Math.round(seed)));
    const fn = Math.min(14, Math.floor(w * d * 0.05));
    for (let i = 0; i < fn; i++) { const f = m(G.flower, MAT.flower[i % 4], (hash(seed + i * 5.1) - 0.5) * (w - 1), 0.1, (hash(seed + i * 9.9) - 0.5) * (d - 1), false); f.scale.set(1, 0.7, 1); g.add(f); }
    const nf = Math.min(6, Math.floor(w * d * 0.02));
    for (let i = 0; i < nf; i++) fern(g, (hash(seed * 13 + i) - 0.5) * (w - 1.5), 0, (hash(seed * 17 + i) - 0.5) * (d - 1.5), seed + i, 0.7);
  }
  scene.add(freeze(g)); return g;
}

// ---------- the great hollow tree (replaces the watchtower): trunk, root flare, a dark hollow, bark ridges
export function hollowTree(scene, x, y, z, radius, height) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const trunk = m(new THREE.CylinderGeometry(radius * 0.92, radius * 1.25, height, 16), MAT.bark, 0, height / 2, 0); g.add(trunk);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const ridge = m(new THREE.CylinderGeometry(0.35, 0.6, height * 0.9, 5), MAT.bark, Math.cos(a) * radius * 0.95, height * 0.45, Math.sin(a) * radius * 0.95); g.add(ridge); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; const root = m(new THREE.CylinderGeometry(0.3, 0.9, radius * 2.2, 6), MAT.bark, Math.cos(a) * radius * 1.4, 1.2, Math.sin(a) * radius * 1.4); root.lookAt(new THREE.Vector3(x + Math.cos(a) * 8, y - 2, z + Math.sin(a) * 8)); root.rotateX(Math.PI / 2); g.add(root); }
  const hollow = m(new THREE.BoxGeometry(1.6, 2.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x08110a }), 0, 8.4, -radius + 0.2, false); g.add(hollow);
  for (let i = 0; i < 6; i++) { const a = i * 1.9; const hh = 8 + hash(i * 7) * (height - 14); const stub = m(new THREE.CylinderGeometry(0.15, 0.4, 2.6, 6), MAT.bark, Math.cos(a) * radius, hh, Math.sin(a) * radius); stub.lookAt(new THREE.Vector3(x + Math.cos(a) * 9, y + hh + 1.5, z + Math.sin(a) * 9)); stub.rotateX(Math.PI / 2); g.add(stub); }
  scene.add(freeze(g)); return g;
}
export function canopyBlob(scene, x, y, z, r, seed = 1) {
  const b = m(new THREE.IcosahedronGeometry(r, 1), FM.oak[Math.floor(hash(seed) * 3)], x, y, z); b.scale.y = 0.75; b.rotation.set(hash(seed) * 3, hash(seed * 2) * 3, 0); scene.add(freeze(b)); return b;
}
// A branch platform: flat bark slab with a supporting limb angled back toward the trunk.
export function branch(scene, x, y, z, w, d, towardX, towardZ) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.BoxGeometry(w, 0.9, d), MAT.bark, 0, -0.45, 0));
  g.add(m(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.9), MAT.stoneMoss, 0, 0.02, 0, false));
  const dx = towardX - x, dz = towardZ - z; const len = Math.hypot(dx, dz);
  const limb = m(new THREE.CylinderGeometry(0.35, 0.6, len + 1, 7), MAT.bark, dx / 2, -1.2, dz / 2); limb.lookAt(new THREE.Vector3(x + dx, y - 2.2, z + dz)); limb.rotateX(Math.PI / 2); g.add(limb);
  for (let i = 0; i < 2; i++) { const sx = (hash(x * 3 + i) > 0.5 ? 1 : -1) * (w / 2 + 0.5), sz = (hash(z * 3 + i) - 0.5) * d * 0.8; const lf = m(new THREE.IcosahedronGeometry(0.55 + hash(x + i) * 0.35, 1), FM.oak[i % 3], sx, -0.7, sz); g.add(lf); }
  scene.add(freeze(g)); return g;
}

// ---------- standing stones, mist, light shafts, ravine floor
export function menhir(scene, x, y, z, h = 3.5, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const s = m(new THREE.BoxGeometry(1.1, h, 0.7), MAT.stoneMoss, 0, h / 2, 0); s.rotation.set((hash(seed) - 0.5) * 0.15, hash(seed * 3) * 6, (hash(seed * 7) - 0.5) * 0.15); g.add(s);
  g.add(m(new THREE.BoxGeometry(0.7, 0.4, 0.5), MAT.stoneDark, 0, h + 0.1, 0));
  scene.add(freeze(g)); return g;
}
export function mist(scene, x, y, z, w, d, layers = 3) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (let i = 0; i < layers; i++) { const p = m(new THREE.PlaneGeometry(w, d), FM.mist, (hash(x + i) - 0.5) * w * 0.3, -i * 2.5, (hash(z + i) - 0.5) * d * 0.3, false); p.rotation.x = -Math.PI / 2; p.rotation.z = hash(i * 5 + x) * 6; g.add(p); }
  scene.add(g); return g;
}
export function shaft(scene, x, y, z, h = 18, w = 1.2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (const a of [0, 1.05, 2.1]) { const p = m(new THREE.PlaneGeometry(w, h), FM.shaft, 0, h / 2, 0, false); p.rotation.y = a; g.add(p); }
  g.rotation.z = 0.28; g.rotation.x = 0.1; scene.add(freeze(g)); return g;
}
export function ravineFloor(scene, y = -34) {
  const p = m(new THREE.PlaneGeometry(900, 900), FM.ravine, 0, y, 80, false); p.rotation.x = -Math.PI / 2; scene.add(p); return p;
}

// ---------- goblin camp dressing
export function tent(scene, x, y, z, rotY = 0, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const c = m(new THREE.ConeGeometry(1.9, 2.4, 6, 1, true), FM.canvas, 0, 1.2, 0); g.add(c);
  g.add(m(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 5), MAT.wood, 0, 1.4, 0));
  g.add(m(new THREE.BoxGeometry(0.9, 1.3, 0.1), new THREE.MeshBasicMaterial({ color: 0x140c08 }), 0, 0.65, 1.55, false));
  scene.add(freeze(g)); return g;
}
export function campfire(scene, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const lg = m(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 5), MAT.wood, Math.cos(a) * 0.35, 0.25, Math.sin(a) * 0.35); lg.lookAt(new THREE.Vector3(x, y + 1.2, z)); lg.rotateX(Math.PI / 2); g.add(lg); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(m(new THREE.DodecahedronGeometry(0.22, 0), MAT.stoneDark, Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9)); }
  const flames = []; for (let i = 0; i < 3; i++) { const f = m(new THREE.ConeGeometry(0.28 - i * 0.06, 0.9 - i * 0.15, 6), i === 2 ? FM.ember : FM.flame, 0, 0.7 + i * 0.15, 0, false); g.add(f); flames.push(f); }
  const light = new THREE.PointLight(0xff9a40, 90, 14, 2); light.position.y = 1.2; g.add(light);
  scene.add(g);
  return { group: g, update(t) { for (let i = 0; i < flames.length; i++) { const f = flames[i]; f.scale.set(1 + Math.sin(t * 13 + i) * 0.15, 1 + Math.sin(t * 9 + i * 2) * 0.25, 1); f.rotation.y = t * (2 + i); } light.intensity = 80 + Math.sin(t * 11) * 14 + Math.sin(t * 23) * 8; } };
}
export function palisade(scene, x, y, z, len, rotY = 0, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const n = Math.round(len / 0.7);
  for (let i = 0; i < n; i++) { const px = -len / 2 + (i + 0.5) * 0.7; const h = 2.6 + hash(seed + i) * 0.8; g.add(m(new THREE.CylinderGeometry(0.28, 0.32, h, 6), MAT.wood, px, h / 2, 0)); const tip = m(new THREE.ConeGeometry(0.28, 0.5, 6), FM.logEnd, px, h + 0.25, 0); g.add(tip); }
  g.add(m(new THREE.BoxGeometry(len, 0.18, 0.1), MAT.bark, 0, 1.6, 0.34));
  scene.add(freeze(g)); return g;
}
export function skullPole(scene, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 5), MAT.wood, 0, 1.4, 0));
  g.add(m(new THREE.SphereGeometry(0.22, 8, 6), FM.logEnd, 0, 2.9, 0));
  g.add(m(new THREE.BoxGeometry(0.6, 0.7, 0.02), new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.95, side: THREE.DoubleSide }), 0.35, 2.2, 0, false));
  scene.add(freeze(g)); return g;
}

// ---------- the enclosing ring of giant trees (instanced), well outside the route
export function treeWall(scene) {
  const N = 110; const trunkGeo = new THREE.CylinderGeometry(1.4, 2.4, 60, 7); const coneGeo = new THREE.ConeGeometry(9, 22, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, MAT.bark, N); const c1 = new THREE.InstancedMesh(coneGeo, FM.needleFar, N), c2 = new THREE.InstancedMesh(coneGeo, FM.needle[0], N), c3 = new THREE.InstancedMesh(coneGeo, FM.needle[1], N);
  trunks.castShadow = false; c1.castShadow = false; c2.castShadow = false; c3.castShadow = false;
  const d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2 + hash(i) * 0.05; const rad = 52 + hash(i * 3) * 120;
    let x = Math.cos(a) * rad, z = 78 + Math.sin(a) * rad * 1.35;
    if (Math.abs(x) < 34 && z > -30 && z < 190) x += x < 0 ? -30 : 30;
    const base = -30 + hash(i * 5) * 6, s = 0.8 + hash(i * 7) * 0.9;
    d.position.set(x, base + 30 * s, z); d.scale.setScalar(s); d.rotation.set(0, hash(i) * 6, 0); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
    for (const [mesh, k] of [[c1, 0], [c2, 1], [c3, 2]]) { d.position.set(x, base + (34 + k * 12) * s, z); d.scale.set(s * (1.3 - k * 0.25), s, s * (1.3 - k * 0.25)); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
  }
  for (const mm of [trunks, c1, c2, c3]) { mm.instanceMatrix.needsUpdate = true; scene.add(mm); }
}

export function outcrop(scene, phys, x, z, top, size = 4, seed = 1) {
  groundChunk(scene, { x, z, w: size, d: size, top, thick: 3 + hash(seed) * 2, seed, plants: true });
  if (phys) { const { Box } = phys; }
  return { x, z, top };
}

// A limb from a point out to the trunk (for planks and canopy that would otherwise hang in the air).
export function limb(scene, x, y, z, tx, tz, r = 0.32) {
  const dx = tx - x, dz = tz - z; const len = Math.hypot(dx, dz) + 0.6;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const c = m(new THREE.CylinderGeometry(r * 0.8, r * 1.4, len, 7), MAT.bark, dx / 2, -0.4, dz / 2); c.lookAt(new THREE.Vector3(x + dx, y - 1.2, z + dz)); c.rotateX(Math.PI / 2); g.add(c);
  scene.add(freeze(g)); return g;
}
