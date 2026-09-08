// Scene, sky, light rig, distant islands, clouds and drifting motes.
// Three lights minimum: a warm key that models form, a cool rim that separates silhouettes, and a hemisphere floor.
import * as THREE from 'three';
import { S } from './settings.js';
import { SPRITE } from './fx.js';

export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

const SKY = {
  top: new THREE.Color(0x2b1f6e), horizon: new THREE.Color(0xffc192), bottom: new THREE.Color(0x6b4a8e),
  sunDir: new THREE.Vector3(0.38, 0.6, 0.62).normalize(), sun: new THREE.Color(0xffe6b0),
};

function makeSky() {
  const geo = new THREE.SphereGeometry(900, 32, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY.top }, horizon: { value: SKY.horizon }, bottom: { value: SKY.bottom }, sunDir: { value: SKY.sunDir }, sun: { value: SKY.sun } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top, horizon, bottom, sunDir, sun;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, bottom, pow(-h, 0.55));
        float s = max(dot(d, sunDir), 0.0);
        c += sun * (pow(s, 240.0) * 1.6 + pow(s, 10.0) * 0.28 + pow(s, 2.0) * 0.06);
        // a few faint bands of high cloud
        float band = sin(d.y * 40.0 + d.x * 3.0) * 0.5 + 0.5; c += vec3(0.05, 0.03, 0.06) * band * smoothstep(0.05, 0.35, h) * (1.0 - smoothstep(0.35, 0.7, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe9b9a8, 70, 420);
  const sky = makeSky(); scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffdcb0, 2.9);
  sun.position.copy(SKY.sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  const sunTarget = new THREE.Object3D(); scene.add(sunTarget); sun.target = sunTarget; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4); rim.position.set(-30, 25, -70); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0x9fb8ff, 0x6b4a2e, 0.95); scene.add(hemi);
  const amb = new THREE.AmbientLight(0x3a2c4a, 0.35); scene.add(amb);

  // Environment for metals: a PMREM of the sky itself, so armour reflects the sunset.
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(makeSky());
  scene.environment = pm.fromScene(envScene, 0.02).texture; scene.environmentIntensity = 0.55;
  pm.dispose();

  // Distant floating islands, well clear of the route (route is |x| < 24, -20 < z < 175).
  const bg = buildBackgroundIslands();
  scene.add(bg.group);
  const clouds = buildClouds(); scene.add(clouds.mesh);
  const motes = buildMotes(); scene.add(motes.points);

  function applyShadowSetting() {
    const q = S.shadows;
    sun.castShadow = q !== 'off';
    renderer.shadowMap.enabled = q !== 'off';
    const size = q === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    renderer.shadowMap.needsUpdate = true;
  }
  applyShadowSetting();

  const tmp = new THREE.Vector3();
  function update(dt, t, focus, camera) {
    sky.position.copy(camera.position);
    // shadow frustum tracks the player
    sunTarget.position.copy(focus); sun.position.copy(SKY.sunDir).multiplyScalar(80).add(focus);
    bg.update(t); clouds.update(t); motes.update(dt, focus);
  }
  return { scene, sun, rim, hemi, update, applyShadowSetting, SKY };
}

function rockGeometry(radius, height, seed) {
  const g = new THREE.ConeGeometry(radius, height, 9, 4, false);
  g.rotateX(Math.PI); // point down
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z); if (r < 0.01) continue;
    const n = 0.72 + 0.56 * hash(seed + i * 7.13 + Math.round(y * 3));
    pos.setXYZ(i, x * n, y + (hash(seed + i) - 0.5) * height * 0.06, z * n);
  }
  g.computeVertexNormals();
  return g;
}
export { rockGeometry };

function buildBackgroundIslands() {
  const group = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x5a4d6c, roughness: 0.95, flatShading: true });
  const grass = new THREE.MeshStandardMaterial({ color: 0x5f9c46, roughness: 0.9 });
  const items = [];
  for (let i = 0; i < 26; i++) {
    const a = hash(i * 3.1) * Math.PI * 2; const rad = 110 + hash(i * 5.7) * 200;
    let x = Math.cos(a) * rad, z = 80 + Math.sin(a) * rad;
    if (Math.abs(x) < 60 && z > -40 && z < 210) x += x < 0 ? -70 : 70;
    const y = -30 + hash(i * 9.3) * 110;
    const w = 14 + hash(i * 2.2) * 30, h = w * (1.1 + hash(i) * 0.9);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const r = new THREE.Mesh(rockGeometry(w * 0.5, h, i * 13), rock); r.position.y = -h / 2; g.add(r);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.52, 2.5, 9), grass); top.position.y = 0.6; g.add(top);
    for (let k = 0; k < 3; k++) { // little tree blobs
      const tr = new THREE.Mesh(new THREE.SphereGeometry(2 + hash(i + k) * 3, 7, 5), new THREE.MeshStandardMaterial({ color: k % 2 ? 0x3f8a3a : 0x6fb15a, roughness: 0.9 }));
      tr.position.set((hash(i * 7 + k) - 0.5) * w * 0.6, 3, (hash(i * 11 + k) - 0.5) * w * 0.6); g.add(tr);
    }
    group.add(g); items.push({ g, y, ph: hash(i * 4.4) * 6.28, amp: 1 + hash(i) * 2 });
  }
  return { group, update(t) { for (const it of items) it.g.position.y = it.y + Math.sin(t * 0.25 + it.ph) * it.amp; } };
}

function buildClouds() {
  const n = 34;
  const geo = new THREE.SphereGeometry(1, 10, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfff2ea, roughness: 1, transparent: true, opacity: 0.72, emissive: 0xffd8c8, emissiveIntensity: 0.25 });
  const mesh = new THREE.InstancedMesh(geo, mat, n * 3);
  const d = new THREE.Object3D(); const base = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = hash(i * 1.7) * Math.PI * 2, rad = 120 + hash(i * 2.3) * 260;
    const x = Math.cos(a) * rad, z = 80 + Math.sin(a) * rad, y = 15 + hash(i * 3.9) * 90;
    for (let k = 0; k < 3; k++) {
      const sx = 10 + hash(i * 5 + k) * 18, sy = sx * 0.32, sz = sx * (0.6 + hash(i + k) * 0.5);
      base.push({ x: x + (k - 1) * sx * 0.7, y: y + hash(i * 9 + k) * 3, z, sx, sy, sz, ph: hash(i) * 6.28 });
      idx++;
    }
  }
  function update(t) {
    for (let i = 0; i < base.length; i++) { const b = base[i]; d.position.set(b.x + Math.sin(t * 0.05 + b.ph) * 6, b.y, b.z); d.scale.set(b.sx, b.sy, b.sz); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}

function buildMotes() {
  const N = 500; const R = 26;
  const pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * R * 2; pos[i * 3 + 1] = (Math.random() - 0.5) * R; pos[i * 3 + 2] = (Math.random() - 0.5) * R * 2; vel.push({ x: (Math.random() - 0.5) * 0.4, y: 0.15 + Math.random() * 0.3, z: (Math.random() - 0.5) * 0.4, ph: Math.random() * 6.28 }); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.22, map: SPRITE, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  const centre = new THREE.Vector3();
  function update(dt, focus) {
    centre.copy(focus); const a = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const v = vel[i]; let x = a[i * 3] + v.x * dt + Math.sin(performance.now() * 0.001 + v.ph) * dt * 0.3, y = a[i * 3 + 1] + v.y * dt, z = a[i * 3 + 2] + v.z * dt;
      // wrap inside the box around the player (positions are stored relative to the world, box follows focus)
      if (x < centre.x - R) x += R * 2; else if (x > centre.x + R) x -= R * 2;
      if (z < centre.z - R) z += R * 2; else if (z > centre.z + R) z -= R * 2;
      if (y > centre.y + R * 0.5) y -= R; else if (y < centre.y - R * 0.5) y += R;
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points, update };
}
