// Procedural character rigs. Every mesh reads from one proportion table so the silhouette has hierarchy:
// shoulders : chest : waist : head  ≈  3 : 2 : 1.3 : 1, and the head is taller than it is wide.
// Faces are real geometry (brows, eyes, mouth) driven by pose keys so characters can EMOTE.
import * as THREE from 'three';

const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s),
  sph: (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h),
  dome: (r) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
};

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function grp(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

class Rig {
  constructor(group, parts, mats) {
    this.group = group; this.parts = parts; this.mats = mats; this.cur = {}; this._flash = 0; this._idle = new Map();
    this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    for (const m of mats) this._idle.set(m, [m.emissive.getHex(), m.emissiveIntensity]);
  }
  flash(seconds = 0.08) {
    this._flash = seconds;
    for (const m of this.mats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.9; }
  }
  tick(dt) {
    if (this._flash > 0) { this._flash -= dt; if (this._flash <= 0) for (const m of this.mats) { const [c, i] = this._idle.get(m); m.emissive.setHex(c); m.emissiveIntensity = i; } }
    // blink: a quick close/open, a few seconds apart
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 1; if (this.blinkT < -0.13) { this.blink = 0; this.blinkT = 2.5 + Math.random() * 3.5; } }
  }
  // Smoothly move the current pose toward q. rate in 1/s; Infinity snaps.
  blend(q, rate, dt) {
    const k = rate === Infinity ? 1 : 1 - Math.exp(-rate * dt);
    for (const key in q) {
      const v = q[key];
      if (typeof v === 'number') this.cur[key] = (this.cur[key] ?? 0) + (v - (this.cur[key] ?? 0)) * k;
      else { const c = this.cur[key] || (this.cur[key] = { x: 0, y: 0, z: 0 }); for (const a of ['x', 'y', 'z']) { const t = v[a] ?? 0; c[a] += (t - c[a]) * k; } }
    }
    this.apply();
  }
}

// Shared face builder: brows, eyes (white + pupil), mouth. Returns parts and an applier.
function buildFace(parent, opts) {
  const { y = 0, z = 0, w = 0.1, skin, eyeR = 0.026, eyeGap = 0.05, browW = 0.055, pupilColor = 0x1a1210, browMat, mouthMat } = opts;
  const white = new THREE.MeshBasicMaterial({ color: 0xfff6ea }), pupil = new THREE.MeshBasicMaterial({ color: pupilColor });
  const eyeL = grp(-eyeGap, y, z), eyeR_ = grp(eyeGap, y, z);
  for (const e of [eyeL, eyeR_]) { const wm = mesh(G.sph(eyeR, 10, 8), white, 0, 0, 0); wm.scale.z = 0.55; wm.castShadow = false; e.add(wm); const p = mesh(G.sph(eyeR * 0.5, 8, 6), pupil, 0, 0, eyeR * 0.5); p.castShadow = false; e.add(p); }
  const browL = mesh(G.box(browW, 0.014, 0.02), browMat, -eyeGap, y + eyeR + 0.02, z + 0.005); browL.castShadow = false;
  const browR = mesh(G.box(browW, 0.014, 0.02), browMat, eyeGap, y + eyeR + 0.02, z + 0.005); browR.castShadow = false;
  const mouth = mesh(G.box(w * 0.55, 0.012, 0.02), mouthMat, 0, y - eyeR - 0.045, z); mouth.castShadow = false;
  parent.add(eyeL, eyeR_, browL, browR, mouth);
  return { eyeL, eyeR: eyeR_, browL, browR, mouth, baseY: y, eyeRad: eyeR, gap: eyeGap };
}
function applyFace(f, c, blink) {
  const open = Math.max(0.05, Math.min(1, (c.eyeOpen ?? 1) * (1 - blink)));
  f.eyeL.scale.set(1, open, 1); f.eyeR.scale.set(1, open, 1);
  const bl = c.browL ?? 0, br = c.browR ?? 0, by = c.browY ?? 0;
  f.browL.rotation.z = -bl; f.browR.rotation.z = br; f.browL.position.y = f.baseY + f.eyeRad + 0.02 + by; f.browR.position.y = f.baseY + f.eyeRad + 0.02 + by;
  const mo = c.mouthOpen ?? 0, mw = c.mouthW ?? 1;
  f.mouth.scale.set(mw, 1 + mo * 6, 1); f.mouth.position.y = f.baseY - f.eyeRad - 0.045 - mo * 0.03;
  f.mouth.rotation.z = 0; f.mouth.position.x = 0;
  // a smile is the corners lifting: approximate by a slight upward bow via two rotations is overkill — use scale + brow signal
}

// ------------------------------------------------------------------ KNIGHT
export const KNIGHT_PALETTE = { steel: 0xb8c3d3, dark: 0x3a3f4c, trim: 0xe7c26a, cloth: 0x2f56a8, plume: 0xc9352f, leather: 0x5a3a22, blade: 0xe4ecf4, cape: 0x8a2634, skin: 0xe9b995, hair: 0x4a2e1a, eyes: 0 };
export const WARDEN_PALETTE = { steel: 0x4a4656, dark: 0x1e1a26, trim: 0x8b6d2a, cloth: 0x2a1f3a, plume: 0x5a1a2a, leather: 0x2c2018, blade: 0x8a93a3, cape: 0x2a0f18, skin: 0x2a2030, hair: 0x100c14, eyes: 0xff7a2a };

export function buildKnight(opts = {}) {
  const P = { ...KNIGHT_PALETTE, ...(opts.palette || {}) };
  const scale = opts.scale || 1;
  const mats = [];
  const M = (key, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: P[key], roughness: 0.75, metalness: 0.05, ...o }); mats.push(m); return m; };
  const steel = M('steel', { roughness: 0.42, metalness: 0.45 });
  const dark = M('dark', { roughness: 0.55, metalness: 0.4 });
  const trim = M('trim', { roughness: 0.35, metalness: 0.7 });
  const cloth = M('cloth', { roughness: 0.9 });
  const plume = M('plume', { roughness: 0.9 });
  const leather = M('leather', { roughness: 0.85 });
  const blade = M('blade', { roughness: 0.25, metalness: 0.75 });
  const cape = M('cape', { roughness: 0.95, side: THREE.DoubleSide });
  const skin = M('skin', { roughness: 0.8 });
  const hair = M('hair', { roughness: 0.9 });

  const group = new THREE.Group();
  const body = grp(0, 0.95, 0); group.add(body);
  // torso
  body.add(mesh(G.box(0.34, 0.22, 0.24), dark, 0, 0.0, 0));                       // waist
  body.add(mesh(G.cyl(0.21, 0.34, 0.28, 12), steel, 0, -0.16, 0));                // fauld (flared skirt)
  body.add(mesh(G.cyl(0.2, 0.27, 0.06, 12), trim, 0, -0.02, 0));                    // belt ring
  body.add(mesh(G.box(0.52, 0.48, 0.30), steel, 0, 0.36, 0));                        // chest
  body.add(mesh(G.box(0.30, 0.62, 0.04), cloth, 0, 0.22, 0.165));                    // tabard
  body.add(mesh(G.box(0.08, 0.62, 0.045), trim, 0, 0.22, 0.165));                    // heraldic stripe
  body.add(mesh(G.box(0.24, 0.10, 0.34), steel, 0, 0.56, 0));                        // gorget
  for (const s of [-1, 1]) {
    const p = mesh(G.dome(0.19), steel, s * 0.34, 0.56, 0); p.scale.set(1, 0.75, 1.1); body.add(p);
    body.add(mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 14), trim, s * 0.34, 0.56, 0)).rotation.x = Math.PI / 2;
  }
  // head: an open-faced helm with the visor raised, so the knight has a face
  const head = grp(0, 0.66, 0); body.add(head);
  head.add(mesh(G.cyl(0.07, 0.08, 0.12, 8), skin, 0, 0.04, 0));                    // neck
  const faceBall = mesh(G.sph(0.135, 12, 9), skin, 0, 0.22, 0.02); faceBall.scale.set(1, 1.1, 0.95); head.add(faceBall);
  head.add(mesh(G.cyl(0.15, 0.16, 0.26, 12, 1, false, Math.PI * 0.62, Math.PI * 1.76), steel, 0, 0.22, 0)); // helm bowl, open at the front
  const crown = mesh(G.sph(0.152, 12, 8), steel, 0, 0.35, 0); crown.scale.y = 0.75; head.add(crown);
  for (const s of [-1, 1]) head.add(mesh(G.box(0.05, 0.22, 0.09), steel, s * 0.125, 0.2, 0.1));  // cheek guards
  const visor = mesh(G.box(0.26, 0.05, 0.16), steel, 0, 0.36, 0.1); visor.rotation.x = -0.75; head.add(visor);
  head.add(mesh(G.box(0.03, 0.06, 0.02), trim, 0, 0.36, 0.17));                     // visor pin
  const face = buildFace(head, { y: 0.245, z: 0.14, w: 0.14, skin, eyeR: 0.027, eyeGap: 0.05, browW: 0.055, browMat: hair, mouthMat: new THREE.MeshBasicMaterial({ color: 0x4a1f1a }), pupilColor: P.eyes ? 0x000000 : 0x1e2a44 });
  if (P.eyes) { const em = new THREE.MeshBasicMaterial({ color: P.eyes }); for (const e of [face.eyeL, face.eyeR]) { e.children[0].material = em; e.children[1].visible = false; } }
  if (opts.horns) { for (const s of [-1, 1]) { const h = mesh(G.cone(0.05, 0.42, 8), dark, s * 0.16, 0.4, 0); h.rotation.z = -s * 0.9; h.rotation.x = -0.2; head.add(h); } }
  else { const pl = mesh(G.cone(0.055, 0.34, 8), plume, 0, 0.5, -0.06); pl.rotation.x = 0.5; head.add(pl); }
  // arms
  const armR = grp(0.36, 0.5, 0), armL = grp(-0.36, 0.5, 0); body.add(armR, armL);
  const foreR = grp(0, -0.3, 0), foreL = grp(0, -0.3, 0);
  for (const [arm, fore] of [[armR, foreR], [armL, foreL]]) {
    arm.add(mesh(G.cyl(0.07, 0.065, 0.3, 8), cloth, 0, -0.15, 0));
    arm.add(mesh(G.sph(0.085, 10, 8), steel, 0, -0.3, 0)); // couter
    arm.add(fore);
    fore.add(mesh(G.cyl(0.065, 0.07, 0.28, 8), steel, 0, -0.14, 0));
    fore.add(mesh(G.box(0.13, 0.11, 0.13), dark, 0, -0.3, 0));
  }
  const sword = grp(0, -0.32, 0); foreR.add(sword);
  const bl = opts.greatsword ? [0.11, 1.5, 0.035] : [0.075, 0.95, 0.025];
  sword.add(mesh(G.box(0.24, 0.04, 0.06), trim, 0, -0.04, 0));
  sword.add(mesh(G.cyl(0.025, 0.028, 0.16, 8), leather, 0, 0.05, 0));
  sword.add(mesh(G.sph(0.035, 8, 6), trim, 0, 0.14, 0));
  const bladeMesh = mesh(G.box(bl[0], bl[1], bl[2]), blade, 0, -0.06 - bl[1] / 2, 0); sword.add(bladeMesh);
  sword.add(mesh(G.box(bl[0] * 0.3, bl[1] * 0.9, bl[2] * 1.4), dark, 0, -0.06 - bl[1] / 2, 0));
  const tip = mesh(G.cone(bl[0] / 2, bl[0] * 1.4, 4), blade, 0, -0.06 - bl[1] - bl[0] * 0.7, 0); tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; sword.add(tip);
  let shield = null;
  if (opts.shield !== false) {
    shield = grp(-0.1, -0.18, 0); foreL.add(shield);
    shield.add(mesh(G.box(0.04, 0.44, 0.38), steel, 0, 0, 0));
    const pt = mesh(G.cone(0.19, 0.2, 4), steel, 0, -0.32, 0); pt.rotation.x = Math.PI; pt.rotation.y = Math.PI / 4; pt.scale.set(0.1, 1, 1.4); shield.add(pt);
    shield.add(mesh(G.box(0.045, 0.36, 0.1), cloth, 0, 0.02, 0));
    shield.add(mesh(G.box(0.05, 0.1, 0.32), cloth, 0, 0.08, 0));
    shield.add(mesh(G.box(0.05, 0.05, 0.05), trim, 0, 0.08, 0));
  }
  // legs with ankles
  const hipR = grp(0.11, -0.06, 0), hipL = grp(-0.11, -0.06, 0); body.add(hipR, hipL);
  const kneeR = grp(0, -0.42, 0), kneeL = grp(0, -0.42, 0);
  const ankleR = grp(0, -0.4, 0), ankleL = grp(0, -0.4, 0);
  for (const [hip, knee, ankle] of [[hipR, kneeR, ankleR], [hipL, kneeL, ankleL]]) {
    hip.add(mesh(G.cyl(0.085, 0.075, 0.42, 8), cloth, 0, -0.21, 0));
    hip.add(mesh(G.cyl(0.095, 0.085, 0.2, 8), steel, 0, -0.12, 0));
    hip.add(knee);
    knee.add(mesh(G.sph(0.085, 8, 6), steel, 0, 0, 0));
    knee.add(mesh(G.cyl(0.07, 0.065, 0.38, 8), steel, 0, -0.2, 0));
    knee.add(ankle);
    ankle.add(mesh(G.box(0.13, 0.09, 0.27), dark, 0, -0.045, 0.05));
    const toe = mesh(G.cone(0.065, 0.12, 4), dark, 0, -0.05, 0.22); toe.rotation.x = Math.PI / 2; toe.rotation.y = Math.PI / 4; ankle.add(toe);
  }
  const capeG = grp(0, 0.58, -0.17); body.add(capeG);
  const capeM = mesh(G.box(0.5, 0.82, 0.015), cape, 0, -0.41, 0); capeM.castShadow = false; capeG.add(capeM);

  group.scale.setScalar(scale);
  const rig = new Rig(group, { body, head, armR, foreR, armL, foreL, sword, shield, hipR, hipL, kneeR, kneeL, ankleR, ankleL, cape: capeG, blade: bladeMesh, face, visor }, mats);
  rig.kind = 'knight';
  rig.apply = function () {
    const c = this.cur, p = this.parts;
    p.body.position.set(c.bodyX || 0, 0.95 + (c.bodyY || 0), c.bodyZ || 0);
    p.body.rotation.set((c.lean || 0) + (c.tumble || 0), c.yaw || 0, c.roll || 0);
    p.head.rotation.set(c.headX || 0, c.headY || 0, c.headZ || 0);
    const aR = c.armR || {}, aL = c.armL || {};
    p.armR.rotation.set(aR.x || 0, aR.y || 0, aR.z || 0);
    p.armL.rotation.set(aL.x || 0, aL.y || 0, aL.z || 0);
    p.foreR.rotation.set(c.foreR || 0, c.foreRy || 0, 0);
    p.foreL.rotation.set(c.foreL || 0, c.foreLy || 0, 0);
    p.sword.rotation.set(c.swordX || 0, 0, c.swordZ || 0);
    p.hipR.rotation.set(c.hipR || 0, 0, c.hipRz || 0); p.hipL.rotation.set(c.hipL || 0, 0, c.hipLz || 0);
    p.kneeR.rotation.set(c.kneeR || 0, 0, 0); p.kneeL.rotation.set(c.kneeL || 0, 0, 0);
    p.ankleR.rotation.set(c.footR || 0, 0, 0); p.ankleL.rotation.set(c.footL || 0, 0, 0);
    p.cape.rotation.set(c.cape || 0, 0, 0);
    applyFace(p.face, c, this.blink);
  };
  return rig;
}

// ------------------------------------------------------------------ KNAVE (goblin-ish footpad)
export function buildKnave() {
  const mats = [];
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o }); mats.push(m); return m; };
  const skin = M(0x6f9a3c), belly = M(0x9bbf62), leather = M(0x4a3020), rust = M(0x6d4a3a, { roughness: 0.6, metalness: 0.3 }), wood = M(0x5a3a1e);
  const group = new THREE.Group();
  const body = grp(0, 0.5, 0); group.add(body);
  const bel = mesh(G.sph(0.24, 12, 9), skin, 0, 0.06, 0); bel.scale.set(1, 0.9, 0.85); body.add(bel);
  const bb = mesh(G.sph(0.18, 10, 8), belly, 0, 0.0, 0.1); bb.scale.set(1, 0.8, 0.6); body.add(bb);
  body.add(mesh(G.cyl(0.2, 0.28, 0.18, 8), leather, 0, -0.14, 0));
  const head = grp(0, 0.34, 0.06); body.add(head);
  const hd = mesh(G.sph(0.21, 12, 9), skin, 0, 0.1, 0); hd.scale.set(1, 0.95, 1); head.add(hd);
  head.add(mesh(G.cone(0.03, 0.09, 4), belly, 0, 0.04, 0.2)).rotation.x = Math.PI / 2; // nose
  for (const s of [-1, 1]) { const ear = mesh(G.cone(0.06, 0.28, 5), skin, s * 0.22, 0.14, -0.02); ear.rotation.z = s * -1.9; ear.rotation.x = -0.3; head.add(ear); }
  const face = buildFace(head, { y: 0.11, z: 0.17, w: 0.16, skin, eyeR: 0.04, eyeGap: 0.075, browW: 0.08, browMat: leather, mouthMat: new THREE.MeshBasicMaterial({ color: 0x2a1010 }), pupilColor: 0xff3b2a });
  for (const s of [-1, 1]) { const tooth = mesh(G.cone(0.012, 0.035, 4), new THREE.MeshBasicMaterial({ color: 0xfff4d8 }), s * 0.03, 0.0, 0.19); tooth.castShadow = false; head.add(tooth); }
  const pot = mesh(G.dome(0.2), rust, 0, 0.18, 0); pot.scale.set(1.1, 0.8, 1.1); head.add(pot);
  const armR = grp(0.24, 0.16, 0), armL = grp(-0.24, 0.16, 0); body.add(armR, armL);
  for (const a of [armR, armL]) { a.add(mesh(G.cyl(0.05, 0.045, 0.3, 7), skin, 0, -0.15, 0)); a.add(mesh(G.sph(0.06, 7, 5), skin, 0, -0.31, 0)); }
  const club = grp(0, -0.31, 0); armR.add(club);
  club.add(mesh(G.cyl(0.03, 0.035, 0.24, 6), wood, 0, -0.06, 0));
  club.add(mesh(G.cyl(0.09, 0.05, 0.32, 7), wood, 0, -0.32, 0));
  for (let i = 0; i < 5; i++) { const sp = mesh(G.cone(0.02, 0.08, 4), rust, Math.cos(i * 1.26) * 0.09, -0.3, Math.sin(i * 1.26) * 0.09); sp.lookAt(new THREE.Vector3(Math.cos(i * 1.26) * 2, -0.3, Math.sin(i * 1.26) * 2)); sp.rotateX(Math.PI / 2); club.add(sp); }
  const hipR = grp(0.1, -0.18, 0), hipL = grp(-0.1, -0.18, 0); body.add(hipR, hipL);
  const ankleR = grp(0, -0.28, 0), ankleL = grp(0, -0.28, 0);
  for (const [h, a] of [[hipR, ankleR], [hipL, ankleL]]) { h.add(mesh(G.cyl(0.065, 0.055, 0.28, 7), skin, 0, -0.14, 0)); h.add(a); a.add(mesh(G.box(0.12, 0.07, 0.2), leather, 0, -0.02, 0.04)); }
  const rig = new Rig(group, { body, head, armR, armL, hipR, hipL, ankleR, ankleL, club, face }, mats);
  rig.kind = 'knave';
  rig.apply = function () {
    const c = this.cur, p = this.parts; const aR = c.armR || {}, aL = c.armL || {};
    p.body.position.set(0, 0.5 + (c.bodyY || 0), 0); p.body.rotation.set(c.lean || 0, c.yaw || 0, c.roll || 0);
    p.head.rotation.set(c.headX || 0, c.headY || 0, c.headZ || 0);
    p.armR.rotation.set(aR.x || 0, aR.y || 0, aR.z || 0); p.armL.rotation.set(aL.x || 0, aL.y || 0, aL.z || 0);
    p.hipR.rotation.set(c.hipR || 0, 0, 0); p.hipL.rotation.set(c.hipL || 0, 0, 0);
    p.ankleR.rotation.set(c.footR || 0, 0, 0); p.ankleL.rotation.set(c.footL || 0, 0, 0);
    applyFace(p.face, c, this.blink);
  };
  return rig;
}

// ------------------------------------------------------------------ THORNSHOT (a rooted plant that spits)
export function buildThornshot() {
  const mats = [];
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o }); mats.push(m); return m; };
  const clay = M(0x8c5a3c), stalk = M(0x4b7a2e), bulb = M(0x4a2a6a), thorn = M(0x2c1a3c), petal = M(0xb23a6a);
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), pupil = new THREE.MeshBasicMaterial({ color: 0x1a0410 });
  const group = new THREE.Group();
  group.add(mesh(G.cyl(0.36, 0.28, 0.4, 10), clay, 0, 0.2, 0));
  group.add(mesh(G.cyl(0.4, 0.36, 0.08, 10), clay, 0, 0.42, 0));
  group.add(mesh(G.cyl(0.07, 0.1, 0.7, 7), stalk, 0, 0.75, 0));
  const head = grp(0, 1.15, 0); group.add(head);
  head.add(mesh(G.sph(0.3, 12, 9), bulb, 0, 0, 0));
  const petals = grp(0, 0, 0); head.add(petals);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const p = mesh(G.cone(0.09, 0.42, 5), petal, Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.05); p.lookAt(new THREE.Vector3(Math.cos(a) * 3, 1.15 + Math.sin(a) * 3, -0.6)); p.rotateX(Math.PI / 2); petals.add(p); }
  for (let i = 0; i < 12; i++) { const a = i * 2.4, b = (i % 3) * 0.7 - 0.5; const t = mesh(G.cone(0.035, 0.16, 4), thorn, Math.cos(a) * 0.28 * Math.cos(b), Math.sin(b) * 0.28, Math.sin(a) * 0.28 * Math.cos(b)); t.lookAt(new THREE.Vector3(Math.cos(a) * Math.cos(b) * 5, 1.15 + Math.sin(b) * 5, Math.sin(a) * Math.cos(b) * 5)); t.rotateX(Math.PI / 2); head.add(t); }
  const eye = grp(0, 0.02, 0.24); head.add(eye);
  eye.add(mesh(G.sph(0.13, 10, 8), eyeW, 0, 0, 0)); eye.add(mesh(G.sph(0.065, 8, 6), pupil, 0, 0, 0.1));
  const lid = mesh(G.sph(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), bulb, 0, 0.0, 0); eye.add(lid);
  const mouth = mesh(G.sph(0.09, 8, 6), pupil, 0, -0.12, 0.26); mouth.scale.set(1.3, 0.5, 0.6); head.add(mouth);
  for (const s of [-1, 1]) { const lf = mesh(G.cone(0.14, 0.55, 5), stalk, s * 0.3, 0.6, 0); lf.rotation.z = s * 1.2; lf.rotation.x = 0.3; group.add(lf); }
  const rig = new Rig(group, { head, petals, mouth, eye, lid }, mats);
  rig.kind = 'thornshot';
  rig.apply = function () {
    const c = this.cur, p = this.parts;
    p.head.rotation.set((c.headX || 0), c.headY || 0, 0);
    p.head.position.set(0, 1.15 + (c.bob || 0), (c.recoil || 0));
    const o = 1 + (c.open || 0) * 0.6; p.petals.scale.set(o, o, 1);
    p.mouth.scale.set(1.3, 0.5 + (c.open || 0) * 1.2, 0.6);
    const lidDown = (c.lidDown ?? 0) + this.blink * 0.9; p.lid.rotation.x = -1.1 + lidDown * 1.6;
  };
  return rig;
}

// ------------------------------------------------------------------ TRAINING DUMMY (tutorial)
export function buildDummy() {
  const mats = [];
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, ...o }); mats.push(m); return m; };
  const wood = M(0x6a4526), straw = M(0xd8b86a), cloth = M(0x8a3a2a), iron = M(0x4a4a52, { roughness: 0.5, metalness: 0.5 });
  const group = new THREE.Group();
  group.add(mesh(G.cyl(0.32, 0.4, 0.2, 10), wood, 0, 0.1, 0));
  group.add(mesh(G.cyl(0.07, 0.09, 1.0, 8), wood, 0, 0.7, 0));
  const body = grp(0, 1.15, 0); group.add(body);
  const torso = mesh(G.cyl(0.24, 0.3, 0.6, 10), straw, 0, 0.1, 0); body.add(torso);
  body.add(mesh(G.box(0.22, 0.5, 0.05), cloth, 0, 0.1, 0.27));
  body.add(mesh(G.cyl(0.05, 0.05, 0.9, 6), wood, 0, 0.3, 0)).rotation.z = Math.PI / 2;
  const head = grp(0, 0.55, 0); body.add(head);
  head.add(mesh(G.sph(0.19, 10, 8), straw, 0, 0.1, 0));
  head.add(mesh(G.dome(0.2), iron, 0, 0.15, 0));
  const face = buildFace(head, { y: 0.1, z: 0.15, w: 0.14, eyeR: 0.03, eyeGap: 0.06, browW: 0.06, browMat: wood, mouthMat: new THREE.MeshBasicMaterial({ color: 0x3a2010 }) });
  const armR = grp(0.44, 0.3, 0); body.add(armR);
  armR.add(mesh(G.cyl(0.04, 0.04, 0.5, 6), wood, 0, -0.25, 0));
  armR.add(mesh(G.cyl(0.06, 0.12, 0.35, 7), wood, 0, -0.6, 0));
  const armL = grp(-0.44, 0.3, 0); body.add(armL);
  armL.add(mesh(G.cyl(0.04, 0.04, 0.4, 6), wood, 0, -0.2, 0));
  armL.add(mesh(G.box(0.05, 0.4, 0.34), iron, -0.05, -0.35, 0));
  const rig = new Rig(group, { body, head, armR, armL, face }, mats);
  rig.kind = 'dummy';
  rig.apply = function () {
    const c = this.cur, p = this.parts; const aR = c.armR || {}, aL = c.armL || {};
    p.body.position.set(0, 1.15 + (c.bodyY || 0), 0); p.body.rotation.set(c.lean || 0, c.yaw || 0, c.roll || 0);
    p.head.rotation.set(c.headX || 0, c.headY || 0, 0);
    p.armR.rotation.set(aR.x || 0, aR.y || 0, aR.z || 0); p.armL.rotation.set(aL.x || 0, aL.y || 0, aL.z || 0);
    applyFace(p.face, c, this.blink);
  };
  return rig;
}

export function buildWarden() {
  return buildKnight({ scale: 2.1, palette: WARDEN_PALETTE, horns: true, greatsword: true, shield: false });
}
