// Forest, second helping: organic branches that grow from the trunk, rotten branches that snap, a rope bridge,
// a swinging log, leaf litter, canopy trees, dappled light, birch / snag / fallen giant, bouncy mushrooms,
// critters (butterflies, crows, a deer), and the goblin yard dressing.
import * as THREE from 'three';
import { MAT } from './decor.js';
import { FM, fern } from './forest.js';
import { hash, rockGeometry } from './world.js';
import { Box } from './physics.js';

function m(geo, mat, x = 0, y = 0, z = 0, cast = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; }
function freeze(o) { o.traverse(c => { c.matrixAutoUpdate = false; c.updateMatrix(); }); o.userData.static = true; return o; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A tapered cylinder from a to b.
function bone(a, b, r0, r1, mat, seg = 7) {
  const len = a.distanceTo(b); const c = m(new THREE.CylinderGeometry(r1, r0, len, seg), mat); c.position.copy(a).lerp(b, 0.5);
  c.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); return c;
}

// ---------- organic branch: grows out of the trunk at (tx, y-1.6, tz), curves up to a flat knot whose top is at y
export function organicBranch(scene, x, y, z, tx, tz, w = 3.5, seed = 1) {
  const g = new THREE.Group();
  const root = V(tx + (x - tx) * 0.02, y - 2.2, tz + (z - tz) * 0.02), tip = V(x, y - 0.45, z);
  const mid1 = root.clone().lerp(tip, 0.4); mid1.y -= 0.9; const mid2 = root.clone().lerp(tip, 0.75); mid2.y -= 0.15;
  const pts = [root, mid1, mid2, tip]; const radii = [0.9, 0.7, 0.5, 0.36];
  for (let i = 0; i < 3; i++) g.add(bone(pts[i], pts[i + 1], radii[i], radii[i + 1], MAT.bark));
  for (let i = 1; i < 3; i++) g.add(m(new THREE.SphereGeometry(radii[i] * 1.02, 8, 6), MAT.bark, pts[i].x, pts[i].y, pts[i].z));
  // the knot: a flattened burl you can stand on
  const knot = m(new THREE.CylinderGeometry(w * 0.55, w * 0.62, 0.55, 12), MAT.bark, x, y - 0.28, z); knot.scale.set(1, 1, 0.85); g.add(knot);
  g.add(m(new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.06, 12), MAT.stoneMoss, x, y + 0.02, z, false));
  // twigs and leaves past the tip
  const dir = tip.clone().sub(root).setY(0).normalize();
  for (let i = 0; i < 2; i++) { const a = (i ? 1 : -1) * 1.25; const d = dir.clone().applyAxisAngle(V(0, 1, 0), a); const tw = tip.clone().addScaledVector(d, w * 0.5 + 0.7); tw.y -= 0.9; g.add(bone(tip.clone().addScaledVector(d, w * 0.35).setY(tip.y - 0.3), tw, 0.16, 0.07, MAT.bark, 5)); const lf = m(new THREE.IcosahedronGeometry(0.55 + hash(seed + i) * 0.35, 1), FM.oak[(seed + i) % 3], tw.x, tw.y - 0.1, tw.z); lf.scale.y = 0.7; g.add(lf); }
  scene.add(freeze(g)); return g;
}

// ---------- rotten branch: same shape, but hinged at the trunk so it can snap and swing down
export function rottenBranch(scene, x, y, z, tx, tz, w = 3.5) {
  const pivot = new THREE.Group(); pivot.position.set(tx + (x - tx) * 0.02, y - 2.2, tz + (z - tz) * 0.02);
  const g = new THREE.Group(); pivot.add(g);
  const root = V(0, 0, 0), tip = V(x - pivot.position.x, y - 0.45 - pivot.position.y, z - pivot.position.z);
  const mid1 = root.clone().lerp(tip, 0.45); mid1.y -= 0.6;
  const dark = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  g.add(bone(root, mid1, 0.7, 0.5, dark)); g.add(bone(mid1, tip, 0.5, 0.32, dark)); g.add(m(new THREE.SphereGeometry(0.52, 8, 6), dark, mid1.x, mid1.y, mid1.z));
  const knot = m(new THREE.CylinderGeometry(w * 0.5, w * 0.56, 0.5, 10), dark, tip.x, tip.y + 0.2, tip.z); g.add(knot);
  g.add(m(new THREE.CylinderGeometry(w * 0.45, w * 0.45, 0.05, 10), MAT.stoneMoss, tip.x, tip.y + 0.47, tip.z, false));
  for (let i = 0; i < 6; i++) { const a = i * 1.05; g.add(m(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshStandardMaterial({ color: 0xd8b86a, roughness: 1 }), tip.x + Math.cos(a) * w * 0.3, tip.y + 0.5, tip.z + Math.sin(a) * w * 0.3, false)); } // fungus
  // hinge axis: perpendicular to the branch direction in the horizontal plane
  const dir = V(x - pivot.position.x, 0, z - pivot.position.z).normalize(); const axis = V(-dir.z, 0, dir.x);
  scene.add(pivot);
  return { group: pivot, axis, w, knotTop: y, knotPos: V(x, y, z) };
}

// ---------- rope bridge between two anchor points; returns the collision boxes along the sag
export function ropeBridge(scene, phys, a, b, width = 1.9, sag = 0.9) {
  const g = new THREE.Group(); const boxes = [];
  const A = V(...a), B = V(...b); const len = A.distanceTo(B); const n = Math.max(6, Math.round(len / 0.75));
  const dir = B.clone().sub(A).setY(0).normalize(); const side = V(-dir.z, 0, dir.x);
  const plank = new THREE.BoxGeometry(width, 0.12, 0.6); const rope = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1 });
  let prevL = null, prevR = null;
  for (let i = 0; i <= n; i++) {
    const u = i / n; const p = A.clone().lerp(B, u); p.y -= Math.sin(u * Math.PI) * sag;
    if (i < n) { const q = A.clone().lerp(B, (i + 0.5) / n); q.y -= Math.sin((i + 0.5) / n * Math.PI) * sag; const pl = m(plank, MAT.wood, q.x, q.y, q.z); pl.rotation.y = Math.atan2(dir.x, dir.z); pl.rotation.x = -Math.cos((i + 0.5) / n * Math.PI) * sag * Math.PI / len * 1.2; g.add(pl);
      const bb = phys.add(new Box(q.x - width / 2 - 0.2, q.y - 0.3, q.z - width / 2 - 0.2, q.x + width / 2 + 0.2, q.y + 0.06, q.z + width / 2 + 0.2)); bb.tag = 'bridge'; boxes.push(bb); }
    const L = p.clone().addScaledVector(side, width / 2), R = p.clone().addScaledVector(side, -width / 2);
    if (prevL) { g.add(bone(prevL.clone().setY(prevL.y + 0.05), L.clone().setY(L.y + 0.05), 0.035, 0.035, rope, 4)); g.add(bone(prevR.clone().setY(prevR.y + 0.05), R.clone().setY(R.y + 0.05), 0.035, 0.035, rope, 4)); g.add(bone(prevL.clone().setY(prevL.y + 1.0), L.clone().setY(L.y + 1.0), 0.03, 0.03, rope, 4)); g.add(bone(prevR.clone().setY(prevR.y + 1.0), R.clone().setY(R.y + 1.0), 0.03, 0.03, rope, 4)); }
    if (i % 2 === 0) { g.add(bone(L, L.clone().setY(L.y + 1.0), 0.025, 0.025, rope, 4)); g.add(bone(R, R.clone().setY(R.y + 1.0), 0.025, 0.025, rope, 4)); }
    prevL = L; prevR = R;
  }
  for (const P of [A, B]) for (const s of [-1, 1]) { const q = P.clone().addScaledVector(side, s * width / 2); g.add(m(new THREE.CylinderGeometry(0.14, 0.18, 1.5, 6), MAT.wood, q.x, q.y + 0.6, q.z)); }
  scene.add(freeze(g)); return boxes;
}

// ---------- swinging log on chains from an overhead limb; the level moves its box each frame via `swing`
export function swingLog(scene, phys, x, y, z, len = 3.6, drop = 7, amp = 0.55, period = 3.2) {
  const pivot = new THREE.Group(); pivot.position.set(x, y + drop, z);
  const limb = m(new THREE.CylinderGeometry(0.5, 0.7, 14, 8), MAT.bark, 0, 0.6, 0); limb.rotation.z = Math.PI / 2; limb.rotation.y = 0.2; limb.position.set(x, y + drop + 0.6, z); scene.add(freeze(limb));
  const chain = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.5 });
  for (const s of [-1, 1]) pivot.add(bone(V(s * len * 0.4, 0, 0), V(s * len * 0.4, -drop, 0), 0.06, 0.06, chain, 5));
  const log = m(new THREE.CylinderGeometry(0.5, 0.5, len, 10), MAT.bark, 0, -drop, 0); log.rotation.z = Math.PI / 2; pivot.add(log);
  pivot.add(m(new THREE.BoxGeometry(len * 0.85, 0.08, 0.7), MAT.stoneMoss, 0, -drop + 0.5, 0, false));
  scene.add(pivot);
  const box = phys.add(new Box(x - len / 2, y - 0.5, z - 0.5, x + len / 2, y + 0.5, z + 0.5, 'mover')); box.delta = new THREE.Vector3();
  return { group: pivot, box, x, y, z, len, drop, amp, period, last: V(x, y, z) };
}
export function updateSwing(sw, t) {
  const th = Math.sin(t * Math.PI * 2 / sw.period) * sw.amp; sw.group.rotation.x = th;
  const px = sw.x, py = sw.y + sw.drop - Math.cos(th) * sw.drop, pz = sw.z + Math.sin(th) * sw.drop;
  sw.box.delta.set(px - sw.last.x, py - sw.last.y, pz - sw.last.z); sw.last.set(px, py, pz);
  sw.box.min.set(px - sw.len / 2, py - 0.5, pz - 0.5); sw.box.max.set(px + sw.len / 2, py + 0.5, pz + 0.5);
}

// ---------- leaf litter (instanced flat quads) and canopy trees
let leafTex = null;
function leafTexture() {
  if (leafTex) return leafTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#c8783a'; g.beginPath(); g.ellipse(32, 32, 26, 14, 0.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#7a4a22'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 44); g.lineTo(54, 20); g.stroke();
  leafTex = new THREE.CanvasTexture(c); leafTex.colorSpace = THREE.SRGBColorSpace; return leafTex;
}
const litterGeo = new THREE.PlaneGeometry(0.45, 0.3); let litterMats = null;
export function leafLitter(parent, w, d, seed, density = 0.5) {
  if (!litterMats) litterMats = [0xc8783a, 0xa85a2a, 0xd8a04a].map(col => new THREE.MeshStandardMaterial({ map: leafTexture(), color: col, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }));
  const n = Math.min(120, Math.floor(w * d * density)); if (n < 4) return null;
  const inst = new THREE.InstancedMesh(litterGeo, litterMats[seed % 3], n); inst.castShadow = false; inst.receiveShadow = true; const dm = new THREE.Object3D();
  for (let i = 0; i < n; i++) { dm.position.set((hash(seed * 5 + i * 2.1) - 0.5) * (w - 0.6), 0.03 + hash(i) * 0.02, (hash(seed * 9 + i * 4.3) - 0.5) * (d - 0.6)); dm.rotation.set(-Math.PI / 2 + (hash(i * 3) - 0.5) * 0.4, 0, hash(i * 7 + seed) * 6); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); }
  parent.add(inst); return inst;
}
// A giant tree rising from baseY beside the route whose crown spreads over it.
export function canopyTree(scene, x, baseY, z, height, spread = 9, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, baseY, z);
  g.add(m(new THREE.CylinderGeometry(1.0, 1.9, height, 9), MAT.bark, 0, height / 2, 0));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + hash(seed + i) * 0.6; const root = m(new THREE.CylinderGeometry(0.3, 0.9, 5, 6), MAT.bark, Math.cos(a) * 1.8, 1.5, Math.sin(a) * 1.8); root.lookAt(V(x + Math.cos(a) * 9, baseY - 3, z + Math.sin(a) * 9)); root.rotateX(Math.PI / 2); g.add(root); }
  const crownY = height - 2;
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4 + hash(seed * 3 + i); const tip = V(Math.cos(a) * spread * 0.75, crownY + 2 + hash(i) * 2, Math.sin(a) * spread * 0.75); g.add(bone(V(0, crownY - 2, 0), tip, 0.7, 0.3, MAT.bark)); const lf = m(new THREE.IcosahedronGeometry(3.2 + hash(seed + i * 7) * 1.6, 1), FM.oak[(seed + i) % 3], tip.x, tip.y + 1.2, tip.z); lf.scale.y = 0.55; g.add(lf); }
  const top = m(new THREE.IcosahedronGeometry(4.2, 1), FM.oak[seed % 3], 0, crownY + 3.5, 0); top.scale.y = 0.6; g.add(top);
  scene.add(freeze(g)); return g;
}
// Dappled light: soft dark sprites that drift over the ground plane at the given height.
export function dapple(scene, spots) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, 'rgba(0,20,0,0.5)'); r.addColorStop(0.5, 'rgba(0,20,0,0.22)'); r.addColorStop(1, 'rgba(0,20,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
  const items = spots.map((s, i) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 2, s.r * 2), mat); p.rotation.x = -Math.PI / 2; p.position.set(s.x, s.y + 0.08, s.z); p.renderOrder = 2; scene.add(p); return { mesh: p, base: s, ph: hash(i) * 6.28 }; });
  return { update(t) { for (const it of items) { it.mesh.position.x = it.base.x + Math.sin(t * 0.13 + it.ph) * 1.6; it.mesh.position.z = it.base.z + Math.cos(t * 0.1 + it.ph) * 1.2; it.mesh.material.opacity = 0.75 + Math.sin(t * 0.3 + it.ph) * 0.2; } } };
}

// ---------- more tree kinds
const birchMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.9 }), birchTick = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 1 });
export function birch(scene, x, y, z, seed = 1, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); const h = 6 + hash(seed) * 2;
  g.add(m(new THREE.CylinderGeometry(0.14, 0.22, h, 7), birchMat, 0, h / 2, 0));
  for (let i = 0; i < 9; i++) g.add(m(new THREE.BoxGeometry(0.18, 0.05, 0.12), birchTick, Math.cos(i * 2.3) * 0.16, 0.6 + i * 0.55 + hash(seed + i) * 0.3, Math.sin(i * 2.3) * 0.16, false));
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + hash(seed); const tip = V(Math.cos(a) * 1.4, h - 0.5 + hash(i) * 1.5, Math.sin(a) * 1.4); g.add(bone(V(0, h - 2, 0), tip, 0.12, 0.05, birchMat, 5)); const lf = m(new THREE.IcosahedronGeometry(1.0 + hash(seed * 3 + i) * 0.6, 1), FM.oak[(i + 1) % 3], tip.x, tip.y + 0.5, tip.z); lf.scale.y = 0.75; g.add(lf); }
  scene.add(freeze(g)); return g;
}
export function snag(scene, x, y, z, seed = 1, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); const dead = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }); const h = 5 + hash(seed) * 3;
  g.add(m(new THREE.CylinderGeometry(0.2, 0.42, h, 7), dead, 0, h / 2, 0));
  for (let i = 0; i < 3; i++) { const a = i * 2.2 + hash(seed); g.add(bone(V(0, h * (0.5 + i * 0.15), 0), V(Math.cos(a) * 2.2, h * (0.6 + i * 0.15) + 0.8, Math.sin(a) * 2.2), 0.14, 0.04, dead, 5)); }
  g.rotation.z = (hash(seed * 7) - 0.5) * 0.15; scene.add(freeze(g)); return g;
}
// A fallen giant trunk lying along z with a hollow you can walk through; collision = the two halves beside the hollow.
export function fallenGiant(scene, phys, x, y, z, len = 12, r = 2.2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const shell = m(new THREE.CylinderGeometry(r, r * 1.08, len, 14, 1, true), MAT.bark, 0, r * 0.75, 0); shell.rotation.x = Math.PI / 2; shell.material = MAT.bark; g.add(shell);
  const inner = m(new THREE.CylinderGeometry(r * 0.8, r * 0.8, len * 0.98, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1, side: THREE.BackSide }), 0, r * 0.75, 0); inner.rotation.x = Math.PI / 2; g.add(inner);
  for (const s of [-1, 1]) g.add(m(new THREE.TorusGeometry(r * 0.92, r * 0.16, 6, 16), FM.logEnd, 0, r * 0.75, s * len / 2)).rotation.y = 0;
  for (let i = 0; i < 6; i++) g.add(m(new THREE.IcosahedronGeometry(0.5 + hash(i) * 0.4, 0), MAT.stoneMoss, (hash(i * 3) - 0.5) * 2, r * 1.6 + hash(i) * 0.3, (hash(i * 5) - 0.5) * len * 0.8, false));
  scene.add(freeze(g));
  // solid walls either side of the hollow, and the top is walkable
  phys.add(new Box(x - r, y, z - len / 2, x - r * 0.55, y + r * 1.5, z + len / 2)).tag = 'giant'; phys.add(new Box(x + r * 0.55, y, z - len / 2, x + r, y + r * 1.5, z + len / 2)).tag = 'giant';
  phys.add(new Box(x - r, y + r * 1.45, z - len / 2, x + r, y + r * 1.75, z + len / 2)).tag = 'giant';
  return g;
}

// ---------- bouncy mushroom: a big cap you can land on and get launched from
export function bounceCap(scene, phys, x, y, z, r = 1.8, blue = false, launch = 19) {
  const g = new THREE.Group(); g.position.set(x, y, z); const h = 1.0 + r * 0.6;
  g.add(m(new THREE.CylinderGeometry(r * 0.28, r * 0.42, h, 9), MAT.shroomStem, 0, h / 2, 0));
  const cap = m(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), blue ? MAT.shroomBlue : MAT.shroomRed, 0, h, 0); cap.scale.y = 0.42; g.add(cap);
  for (let i = 0; i < 7; i++) { const a = hash(x + i) * 6.28, rr = r * (0.2 + hash(i * 3 + z) * 0.6); const sp = m(new THREE.SphereGeometry(r * 0.09, 6, 5), MAT.spot, Math.cos(a) * rr, h + r * 0.42 * Math.sqrt(1 - (rr / r) ** 2) - 0.02, Math.sin(a) * rr, false); sp.scale.y = 0.35; g.add(sp); }
  scene.add(freeze(g));
  phys.add(new Box(x - r * 0.3, y, z - r * 0.3, x + r * 0.3, y + h, z + r * 0.3)).tag = 'stem';
  const top = phys.add(Box.fromTop(x, z, r * 1.5, r * 1.5, y + h + r * 0.42, 0.5)); top.bounce = launch; top.kind = 'bounce'; top.tag = 'cap';
  if (blue) { const l = new THREE.PointLight(0x4a8aff, 30, 9, 2); l.position.set(x, y + h + 0.6, z); scene.add(l); }
  return top;
}
// spore cloud: a slow zone (visual only; the level tests distance)
export function sporeCloud(scene, x, y, z, r) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xb8ffb0, transparent: true, opacity: 0.16, depthWrite: false });
  const s = m(new THREE.SphereGeometry(r, 12, 8), mat, x, y + r * 0.6, z, false); scene.add(s); return { mesh: s, x, y, z, r, update(t) { s.scale.setScalar(1 + Math.sin(t * 0.8 + x) * 0.08); mat.opacity = 0.13 + Math.sin(t * 1.3 + z) * 0.04; } };
}

// ---------- critters
export function butterflies(scene, cx, cy, cz, radius, n = 6, seed = 1) {
  const items = []; const geo = new THREE.PlaneGeometry(0.22, 0.18);
  for (let i = 0; i < n; i++) { const mat = new THREE.MeshBasicMaterial({ color: [0xffe066, 0x8ac8ff, 0xffffff, 0xff9ac8][i % 4], side: THREE.DoubleSide }); const g = new THREE.Group(); const l = new THREE.Mesh(geo, mat), r = new THREE.Mesh(geo, mat); l.position.x = -0.11; r.position.x = 0.11; g.add(l, r); scene.add(g); items.push({ g, l, r, ph: hash(seed + i) * 6.28, sp: 0.5 + hash(i * 3) * 0.5 }); }
  return { update(t) { for (const b of items) { const a = t * 0.25 * b.sp + b.ph; b.g.position.set(cx + Math.cos(a) * radius * (0.5 + 0.5 * Math.sin(a * 0.7)), cy + 1 + Math.sin(t * 1.7 + b.ph) * 0.5, cz + Math.sin(a * 1.3) * radius * 0.7); b.g.rotation.y = -a; const fl = Math.sin(t * 18 + b.ph) * 0.9; b.l.rotation.y = fl; b.r.rotation.y = -fl; } } };
}
export function crows(scene, spots) {
  const black = new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.9 });
  const items = spots.map(([x, y, z], i) => { const g = new THREE.Group(); g.position.set(x, y, z); const body = m(new THREE.SphereGeometry(0.16, 7, 6), black); body.scale.set(1, 0.8, 1.5); g.add(body); g.add(m(new THREE.ConeGeometry(0.05, 0.16, 5), new THREE.MeshStandardMaterial({ color: 0x3a3a30 }), 0, 0.02, 0.25)).rotation.x = Math.PI / 2; const wl = m(new THREE.BoxGeometry(0.34, 0.03, 0.18), black, -0.2, 0.05, 0), wr = m(new THREE.BoxGeometry(0.34, 0.03, 0.18), black, 0.2, 0.05, 0); g.add(wl, wr); scene.add(g); return { g, wl, wr, home: V(x, y, z), state: 'perch', t: hash(i) * 6, dir: V(Math.cos(i * 2.1), 1, Math.sin(i * 2.1)).normalize() }; });
  return { update(dt, t, pp) { for (const c of items) { if (c.state === 'perch') { c.g.rotation.y = Math.sin(t * 0.4 + c.t) * 0.4; c.wl.rotation.z = 0; c.wr.rotation.z = 0; if (c.g.position.distanceTo(pp) < 8) { c.state = 'fly'; c.t = 0; } } else { c.t += dt; c.g.position.addScaledVector(c.dir, dt * 7); c.g.position.y += dt * 2; const f = Math.sin(t * 22) * 0.9; c.wl.rotation.z = f; c.wr.rotation.z = -f; c.g.rotation.y = Math.atan2(c.dir.x, c.dir.z); if (c.t > 6) { c.state = 'gone'; c.g.visible = false; } } } } };
}
export function deer(scene, x, y, z, faceYaw = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = faceYaw; const fur = new THREE.MeshStandardMaterial({ color: 0xa8763e, roughness: 0.95 }), belly = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.95 });
  const body = m(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.32, 0.9, 4, 8) : new THREE.SphereGeometry(0.4, 8, 6), fur, 0, 1.05, 0); body.rotation.x = Math.PI / 2; g.add(body);
  g.add(m(new THREE.SphereGeometry(0.28, 8, 6), belly, 0, 0.92, 0.1, false));
  const neck = bone(V(0, 1.15, 0.5), V(0, 1.75, 0.85), 0.14, 0.11, fur); g.add(neck); const head = m(new THREE.BoxGeometry(0.22, 0.24, 0.42), fur, 0, 1.82, 1.0); g.add(head);
  for (const s of [-1, 1]) { g.add(m(new THREE.ConeGeometry(0.04, 0.16, 4), fur, s * 0.1, 1.98, 0.9)); const ant = bone(V(s * 0.08, 1.95, 0.92), V(s * 0.3, 2.4, 0.8), 0.03, 0.015, belly, 4); g.add(ant); }
  const legs = []; for (const [lx, lz] of [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]]) { const l = new THREE.Group(); l.position.set(lx, 0.95, lz); l.add(m(new THREE.CylinderGeometry(0.06, 0.045, 0.95, 6), fur, 0, -0.47, 0)); g.add(l); legs.push(l); }
  scene.add(g);
  const st = { state: 'graze', t: 0, dir: V(Math.sin(faceYaw), 0, Math.cos(faceYaw)) };
  return { group: g, update(dt, t, pp, phys) {
    if (st.state === 'graze') { head.position.y = 1.82 - Math.max(0, Math.sin(t * 0.6)) * 0.5; if (g.position.distanceTo(pp) < 9) { st.state = 'bolt'; st.t = 0; const away = g.position.clone().sub(pp).setY(0).normalize(); st.dir.copy(away); g.rotation.y = Math.atan2(away.x, away.z); } }
    else if (st.state === 'bolt') { st.t += dt; const fl = phys.floorAt(g.position.x + st.dir.x * 1.2, g.position.z + st.dir.z * 1.2, g.position.y + 0.5); if (fl && g.position.y - fl.max.y < 1.5) g.position.addScaledVector(st.dir, dt * 9); else { st.dir.applyAxisAngle(V(0, 1, 0), 1.2); g.rotation.y = Math.atan2(st.dir.x, st.dir.z); } g.position.y += ((fl ? fl.max.y : g.position.y) - g.position.y) * 0.5; legs.forEach((l, i) => l.rotation.x = Math.sin(t * 14 + (i % 2) * Math.PI) * 0.7); if (st.t > 5) { st.state = 'gone'; g.visible = false; } }
  } };
}

// ---------- the Warlord's yard dressing
export function totem(scene, x, y, z, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = hash(seed) * 6;
  g.add(m(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 8), MAT.wood, 0, 2.1, 0));
  for (let i = 0; i < 3; i++) { const fy = 0.9 + i * 1.2; g.add(m(new THREE.BoxGeometry(0.9, 0.7, 0.5), i % 2 ? MAT.stoneDark : MAT.wood, 0, fy, 0.25)); g.add(m(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5a2a }), -0.2, fy + 0.1, 0.52, false)); g.add(m(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5a2a }), 0.2, fy + 0.1, 0.52, false)); }
  g.add(m(new THREE.ConeGeometry(0.12, 0.6, 4), FM.logEnd, 0, 4.5, 0)); scene.add(freeze(g)); return g;
}
export function warDrum(scene, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m(new THREE.CylinderGeometry(0.9, 0.8, 1.1, 12), MAT.wood, 0, 0.55, 0)); g.add(m(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 12), FM.logEnd, 0, 1.12, 0));
  for (let i = 0; i < 8; i++) g.add(m(new THREE.BoxGeometry(0.06, 1.1, 0.06), MAT.iron, Math.cos(i * 0.785) * 0.9, 0.55, Math.sin(i * 0.785) * 0.9, false));
  scene.add(freeze(g)); return g;
}
