// glTF models: Kenney Nature Kit props (static, baked), KayKit knight and Quaternius goblin (skinned, animated).
// Everything is preloaded before the level is built so placement stays synchronous.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from '../vendor/three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = {};            // url -> gltf
export const MODELS = {};    // short name -> { gltf, size: Vector3, min: Vector3 }
const sharedMats = new Map();

export const NATURE = ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD', 'tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC', 'tree_pineGroundA', 'tree_pineGroundB',
  'tree_oak', 'tree_oak_dark', 'tree_detailed', 'tree_detailed_dark', 'tree_fat', 'tree_default', 'tree_default_dark', 'tree_blocks_fall', 'tree_thin', 'tree_thin_fall',
  'mushroom_red', 'mushroom_redGroup', 'mushroom_redTall', 'mushroom_tan', 'mushroom_tanGroup', 'mushroom_tanTall',
  'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_smallA', 'rock_smallB', 'rock_smallC',
  'stump_old', 'stump_oldTall', 'stump_round', 'stump_roundDetailed', 'log', 'log_large', 'log_stack',
  'plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall', 'plant_flatTall', 'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge',
  'flower_purpleA', 'flower_redA', 'flower_yellowA', 'tent_detailedClosed', 'tent_smallClosed', 'campfire_logs', 'hanging_moss', 'sign', 'statue_obelisk', 'statue_column', 'statue_columnDamaged', 'fence_simple', 'fence_simpleHigh', 'stone_tallA', 'stone_largeA', 'path_stone', 'lily_large'];

function load(url) {
  if (cache[url]) return cache[url];
  cache[url] = new Promise((res, rej) => loader.load(url, res, undefined, rej));
  return cache[url];
}
function register(name, gltf) {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  MODELS[name] = { gltf, size: box.getSize(new THREE.Vector3()), min: box.min.clone(), max: box.max.clone() };
}
export async function preloadModels(onProgress) {
  const jobs = [['knight', 'models/knight.glb'], ['goblin', 'models/goblin.glb'], ...NATURE.map(n => [n, `models/nature/${n}.glb`])];
  let done = 0;
  await Promise.all(jobs.map(async ([name, url]) => { try { register(name, await load(url)); } catch (e) { console.warn('model failed', name, e); } done++; if (onProgress) onProgress(done / jobs.length); }));
  return MODELS;
}
export function has(name) { return !!MODELS[name]; }

// Share materials across prop instances so the static baker can merge them into one draw per material.
function shareMaterial(m) {
  const key = (m.name || '') + '|' + (m.color ? m.color.getHex() : 0) + '|' + (m.map ? m.map.uuid : '') + '|' + (m.vertexColors ? 'vc' : '');
  let s = sharedMats.get(key); if (!s) { s = m.clone(); s.roughness = 0.9; s.metalness = 0; s.flatShading = false; sharedMats.set(key, s); } return s;
}

// A static prop. `height` scales the model so its bounding height matches; returns { group, box (world Box3) }.
export function prop(scene, name, x, y, z, { rotY = 0, height = null, scale = 1, static: isStatic = true } = {}) {
  const M = MODELS[name]; if (!M) return null;
  const g = M.gltf.scene.clone(true);
  g.traverse(o => { if (o.isMesh) { o.material = shareMaterial(o.material); o.castShadow = true; o.receiveShadow = true; } });
  const s = height ? height / M.size.y : scale;
  g.scale.setScalar(s); g.position.set(x, y - M.min.y * s, z); g.rotation.y = rotY;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (isStatic) { g.traverse(c => { c.matrixAutoUpdate = false; c.updateMatrix(); }); g.userData.static = true; }
  scene.add(g); return { group: g, box, scale: s };
}

// A skinned, animated character with the same surface as the procedural rigs (group, flash, tick, blend).
export class CharacterModel {
  constructor(name, { height = 1.7, tint = null, yawOffset = 0 } = {}) {
    const M = MODELS[name]; this.name = name;
    this.group = new THREE.Group(); this.inner = new THREE.Group(); this.group.add(this.inner);
    this.model = skeletonClone(M.gltf.scene); this.inner.add(this.model);
    const s = height / M.size.y; this.model.scale.setScalar(s); this.model.position.y = -M.min.y * s; this.inner.rotation.y = yawOffset;
    this.mats = [];
    this.model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const mat = o.material.clone(); if (tint) mat.color.multiply(new THREE.Color(tint)); o.material = mat; this.mats.push(mat); } });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of M.gltf.animations) { const short = clip.name.split('|').pop(); const a = this.mixer.clipAction(clip); a.enabled = true; this.actions[short] = a; this.actions[clip.name] = a; }
    this.current = null; this.driven = null; this._flash = 0; this.cur = {}; this.blinkT = 0; this.blink = 0;
    this.height = height; this.followers = [];
  }
  bone(name) { let b = null; this.model.traverse(o => { if (!b && o.name === name) b = o; }); return b; }
  // Keep obj glued to a bone: world position from the bone, orientation = bone × offset rotation, then a local nudge.
  attach(boneName, obj, { pos = [0, 0, 0], rot = [0, 0, 0] } = {}) {
    const b = this.bone(boneName); if (!b) { console.warn('no bone', boneName); return null; }
    obj.matrixAutoUpdate = true; this.group.parent ? this.group.parent.add(obj) : this.group.add(obj);
    const f = { bone: b, obj, pos: new THREE.Vector3(...pos), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) }; this.followers.push(f); return f;
  }
  updateFollowers() {
    for (const f of this.followers) {
      f.bone.getWorldQuaternion(f.obj.quaternion); f.obj.quaternion.multiply(f.q);
      f.bone.getWorldPosition(f.obj.position); f.obj.position.add(f.pos.clone().applyQuaternion(f.obj.quaternion));
      f.obj.visible = this.group.visible;
    }
  }
  has(name) { return !!this.actions[name]; }
  // Crossfade to a looping (or one-shot) clip.
  play(name, { fade = 0.15, loop = true, speed = 1, clamp = false } = {}) {
    const a = this.actions[name]; if (!a) return;
    if (this.driven && this.driven !== a) { this.driven.paused = false; this.driven = null; }
    if (this.current === a) { a.timeScale = speed; return; }
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = clamp || !loop; a.timeScale = speed; a.paused = false; a.enabled = true;
    if (this.current) { a.crossFadeFrom(this.current, fade, true); } a.play();
    this.current = a;
  }
  // Scrub a clip to a normalised time; used for frame-data-driven moves so the design, not the clip, sets timing.
  drive(name, u, fade = 0.08) {
    const a = this.actions[name]; if (!a) return;
    if (this.current !== a) { a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.enabled = true; a.timeScale = 1; if (this.current) a.crossFadeFrom(this.current, fade, true); a.play(); this.current = a; }
    a.paused = true; a.time = Math.max(0, Math.min(0.999, u)) * a.getClip().duration; this.driven = a;
  }
  flash(seconds = 0.08) { this._flash = seconds; for (const m of this.mats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.9; } }
  tick(dt) {
    this.mixer.update(dt); this.group.updateMatrixWorld(true); if (this.followers.length) this.updateFollowers();
    if (this._flash > 0) { this._flash -= dt; if (this._flash <= 0) for (const m of this.mats) { m.emissive.setHex(0); m.emissiveIntensity = 0; } }
  }
  blend() { /* procedural pose keys are ignored by skinned models */ }
  apply() { }
}
