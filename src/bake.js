// Static batching. The forest is thousands of little meshes; three.js pays per draw call, so props marked static are
// merged into one mesh per material after the level is built. Rigs get the same treatment per bone group.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

function normalise(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

// Merge every mesh under scene roots flagged `userData.static` into one mesh per (material, shadow flags).
// Instanced meshes and multi-material meshes are kept as they are (re-attached at their world transform).
export function bakeStatics(scene) {
  scene.updateMatrixWorld(true);
  const roots = []; scene.traverse(o => { if (o.userData.static) roots.push(o); });
  const groups = new Map(); const keep = [];
  let before = 0;
  for (const root of roots) {
    root.traverse(m => {
      if (!m.isMesh) return; before++;
      if (m.isInstancedMesh || Array.isArray(m.material) || m.userData.keep) { keep.push(m); return; }
      const key = m.material.uuid + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0);
      let g = groups.get(key); if (!g) { g = { material: m.material, cast: m.castShadow, recv: m.receiveShadow, geos: [] }; groups.set(key, g); }
      const geo = normalise(m.geometry); geo.applyMatrix4(m.matrixWorld); g.geos.push(geo);
    });
  }
  for (const m of keep) scene.attach(m);
  for (const root of roots) { root.removeFromParent(); }
  let after = keep.length;
  for (const g of groups.values()) {
    const merged = mergeGeometries(g.geos, false); for (const geo of g.geos) geo.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, g.material); mesh.castShadow = g.cast; mesh.receiveShadow = g.recv; mesh.matrixAutoUpdate = false; mesh.userData.baked = true;
    scene.add(mesh); after++;
  }
  return { before, after };
}

// Within a rig, merge the direct mesh children of every group by material, except meshes flagged `userData.anim`
// (face parts that scale each frame). Bone groups themselves keep animating.
export function bakeRig(root) {
  const groupsToDo = []; root.traverse(o => { if (o.isGroup || o === root) groupsToDo.push(o); });
  for (const grp of groupsToDo) {
    const byMat = new Map();
    for (const c of grp.children) {
      if (!c.isMesh || c.userData.anim || Array.isArray(c.material)) continue;
      const key = c.material.uuid + '|' + (c.castShadow ? 1 : 0);
      (byMat.get(key) || byMat.set(key, []).get(key)).push(c);
    }
    for (const list of byMat.values()) {
      if (list.length < 2) continue;
      const geos = list.map(c => { c.updateMatrix(); const g = normalise(c.geometry); g.applyMatrix4(c.matrix); return g; });
      const merged = mergeGeometries(geos, false); for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = true;
      for (const c of list) grp.remove(c);
      grp.add(mesh);
    }
  }
  return root;
}
