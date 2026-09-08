// Level select: a little overworld in the spirit of Super Mario 3D Land. A path of stone tiles winds over a
// green hill; the knight token hops between nodes; Space/Enter sets forth. Renders with its own scene and camera.
import * as THREE from 'three';
import { buildKnight } from './rigs.js';
import { MAT } from './decor.js';
import * as F from './forest.js';
import { sfx } from './audio.js';

export const NODES = [
  { id: 'training', name: 'Training Yard', blurb: 'Learn the blade, the guard and the roll against a straw knight.', mode: 'tutorial', x: -16, z: 2 },
  { id: 'wood', name: 'Goblin Wood', blurb: 'A glade, a goblin camp, the great hollow tree, and the Hollow Warden.', mode: 'adventure', x: -5, z: -2 },
  { id: 'gorge', name: 'The Sunken Gorge', blurb: 'Coming soon.', locked: true, x: 6, z: 3 },
  { id: 'crown', name: "The Warden's Crown", blurb: 'Coming soon.', locked: true, x: 16, z: -3 },
];

function label(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.font = 'bold 54px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(text, 256, 60); g.fillStyle = '#ffe9b0'; g.fillText(text, 256, 60);
  if (sub) { g.font = '30px Cinzel, Georgia, serif'; g.strokeText(sub, 256, 118); g.fillStyle = sub === 'LOCKED' ? '#c99' : '#bfe6a8'; g.fillText(sub, 256, 118); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(5.2, 1.6, 1); sp.renderOrder = 10; return sp;
}

export class WorldMap {
  constructor(renderer, input) {
    this.renderer = renderer; this.input = input; this.active = false; this.cur = 1; this.hop = null; this.time = 0; this.unlocked = 2;
    const scene = this.scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fc9a3); scene.fog = new THREE.Fog(0x8fc9a3, 30, 90);
    this.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    const sun = new THREE.DirectionalLight(0xfff0cc, 2.4); sun.position.set(20, 40, 15); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.far = 120; scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x3a5a2a, 1.0));
    // rolling hill: a big disc with a gentle dome
    const hill = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), MAT.grass); hill.scale.set(1, 0.015, 1); hill.position.y = -1.2; hill.receiveShadow = true; scene.add(hill);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(70, 60, 6, 48), MAT.dirt); base.position.y = -5; scene.add(base);
    // path
    const pts = NODES.map(n => new THREE.Vector3(n.x, 0, n.z)); const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.6); this.curve = curve;
    const L = curve.getLength(); const tile = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 10);
    for (let d = 0; d < L; d += 1.1) { const p = curve.getPointAt(d / L); const m = new THREE.Mesh(tile, MAT.stone); m.position.set(p.x + Math.sin(d * 3) * 0.12, 0.05, p.z + Math.cos(d * 2) * 0.12); m.rotation.y = d; m.receiveShadow = true; m.castShadow = true; scene.add(m); }
    // nodes
    this.nodeMeshes = [];
    NODES.forEach((n, i) => {
      const g = new THREE.Group(); g.position.set(n.x, 0, n.z);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 16), n.locked ? MAT.stoneDark : MAT.stoneMoss); disc.position.y = 0.2; disc.castShadow = true; disc.receiveShadow = true; g.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 6, 32), n.locked ? MAT.runeOff : MAT.rune); ring.rotation.x = Math.PI / 2; ring.position.y = 0.42; g.add(ring);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 6), MAT.wood); pole.position.set(0, 1.5, -1.2); g.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.03), MAT.banner[n.locked ? 1 : i % 3]); flag.position.set(0.55, 2.6, -1.2); g.add(flag);
      const lb = label(n.name, n.locked ? 'LOCKED' : (i === 0 ? 'TRAINING' : 'LEVEL ' + i)); lb.position.set(0, 3.6, 0); g.add(lb);
      g.userData.ring = ring; g.userData.label = lb; scene.add(g); this.nodeMeshes.push(g);
    });
    // scenery: a wood on the far side, a few near trees, mushrooms; the hollow tree in the distance for level 1
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; const r = 26 + (i % 5) * 3; const zz = Math.sin(a) * r * 0.55 - 8; if (zz > 6) continue; F.pine(scene, Math.cos(a) * r, 0, zz, i + 3, 1.2 + (i % 3) * 0.3); }
    F.oak(scene, -10, 0, -9, 40, 1.1); F.oak(scene, 11, 0, -10, 41, 1.0); F.pine(scene, 1, 0, -12, 42, 1.1); F.pine(scene, -24, 0, -6, 43, 1.0); F.oak(scene, 24, 0, -4, 44, 0.9);
    F.hollowTree(scene, -5, 0, -18, 2.2, 22); F.menhir(scene, 16, 0, -9, 3, 5); F.menhir(scene, 18.5, 0, -8, 2.4, 6); F.tent(scene, 2, 0, -8, 0.6, 2);
    for (const [x, z] of [[-13, -4], [3, 4], [12, 5], [-2, -6], [-8, 4]]) F.fern(scene, x, 0, z, x + z);
    // the token
    this.rig = buildKnight({ scale: 0.9 }); scene.add(this.rig.group); this.rig.group.position.set(NODES[1].x, 0.4, NODES[1].z);
    this.ui = document.getElementById('mapui'); this.uiName = document.getElementById('map-name'); this.uiBlurb = document.getElementById('map-blurb'); this.uiHint = document.getElementById('map-hint');
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
  }
  show(cur) {
    this.active = true; if (cur !== undefined) this.cur = cur; this.ui.hidden = false; this.setNode(this.cur, true);
    const n = NODES[this.cur]; this.rig.group.position.set(n.x, 0.4, n.z); this.camPos.set(n.x + 1, 11.5, n.z + 13); this.camLook.set(n.x, 1, n.z);
  }
  hide() { this.active = false; this.ui.hidden = true; }
  setNode(i, instant) {
    const n = NODES[i]; this.cur = i;
    this.uiName.textContent = n.name; this.uiBlurb.textContent = n.blurb;
    this.uiHint.innerHTML = n.locked ? 'This road is not yet open &nbsp;·&nbsp; <kbd>A</kbd><kbd>D</kbd> choose &nbsp;·&nbsp; <kbd>Esc</kbd> back' : '<kbd>Space</kbd> / <kbd>Enter</kbd> set forth &nbsp;·&nbsp; <kbd>A</kbd><kbd>D</kbd> choose &nbsp;·&nbsp; <kbd>Esc</kbd> back';
    if (!instant) { const from = this.rig.group.position.clone(); this.hop = { from, to: new THREE.Vector3(n.x, 0.4, n.z), t: 0 }; sfx('jump'); }
  }
  update(dt, onSelect, onBack) {
    if (!this.active) return;
    this.time += dt; const inp = this.input;
    if (!this.hop) {
      if (inp.just('right') || inp.pressed.has('KeyD') || inp.pressed.has('ArrowRight')) { if (this.cur < NODES.length - 1) this.setNode(this.cur + 1); }
      else if (inp.just('left') || inp.pressed.has('KeyA') || inp.pressed.has('ArrowLeft')) { if (this.cur > 0) this.setNode(this.cur - 1); }
      else if (inp.just('jump') || inp.pressed.has('Enter') || inp.pressed.has('NumpadEnter') || inp.just('light')) { const n = NODES[this.cur]; if (n.locked) { sfx('clang'); this.shakeT = 0.3; } else { sfx('shrine'); onSelect(n); return; } }
    }
    if (inp.pressed.has('Escape') || inp.pressed.has('Pad1')) { onBack(); return; }
    // token hop
    const g = this.rig.group;
    if (this.hop) { this.hop.t += dt / 0.45; const u = Math.min(1, this.hop.t); g.position.lerpVectors(this.hop.from, this.hop.to, u); g.position.y = 0.4 + Math.sin(u * Math.PI) * 1.4; g.rotation.y = Math.atan2(this.hop.to.x - this.hop.from.x, this.hop.to.z - this.hop.from.z); if (u >= 1) { this.hop = null; sfx('land', {}); } }
    const q = this.hop ? { hipR: -0.9, hipL: 0.3, kneeR: 1.2, kneeL: 0.4, armR: { x: -0.7, y: 0, z: 0.6 }, armL: { x: -0.5, y: 0, z: -0.6 }, cape: 0.6, browY: 0.01, mouthW: 1.4, mouthOpen: 0.1 } : { hipR: 0, hipL: 0, kneeR: 0, kneeL: 0, armR: { x: 0.12, y: 0, z: 0.14 }, armL: { x: 0.08, y: 0, z: -0.16 }, foreR: -0.25, foreL: -0.35, foreLy: 0.3, bodyY: Math.sin(this.time * 2) * 0.012, cape: 0.05, headY: Math.sin(this.time * 0.7) * 0.2, mouthW: 1.3, browY: 0.005 };
    this.rig.blend(q, this.hop ? 30 : 10, dt); this.rig.tick(dt);
    if (!this.hop) g.rotation.y += (Math.PI - g.rotation.y) * (1 - Math.exp(-dt * 4));
    if (this.shakeT > 0) { this.shakeT -= dt; g.position.x += (Math.random() - 0.5) * 0.08; }
    // rings pulse, labels bob
    this.nodeMeshes.forEach((nm, i) => { const sel = i === this.cur; nm.userData.ring.scale.setScalar(sel ? 1.12 + Math.sin(this.time * 5) * 0.06 : 1); nm.userData.label.position.y = 3.6 + (sel ? Math.sin(this.time * 3) * 0.12 : 0); nm.userData.label.material.opacity = sel ? 1 : 0.75; });
    // camera
    const tp = g.position; const k = 1 - Math.exp(-dt * 4);
    this.camPos.lerp(new THREE.Vector3(tp.x + 1, 11.5, tp.z + 13), k); this.camLook.lerp(new THREE.Vector3(tp.x, 1, tp.z), k);
    this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook);
  }
  render() { const r = this.renderer; const w = r.domElement.width / r.getPixelRatio(), h = r.domElement.height / r.getPixelRatio(); if (Math.abs(this.cam.aspect - w / h) > 0.001) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); } r.render(this.scene, this.cam); }
}
