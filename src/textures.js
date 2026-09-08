// Procedural surface textures (grass, stone, rock, bark, dirt) and a world-space triplanar mapper,
// so every box and cone tiles at the same scale regardless of its UVs.
import * as THREE from 'three';

function valueNoise(size, seed, oct = 4, persist = 0.5) {
  // returns Float32Array size*size in [0,1]
  const out = new Float32Array(size * size);
  let amp = 1, freq = 4, norm = 0;
  const h = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  for (let o = 0; o < oct; o++) {
    const f = freq; const cells = f;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = x / size * cells, gy = y / size * cells; const x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = h(x0 % cells, y0 % cells, seed + o), b = h((x0 + 1) % cells, y0 % cells, seed + o), c = h(x0 % cells, (y0 + 1) % cells, seed + o), d = h((x0 + 1) % cells, (y0 + 1) % cells, seed + o);
      const v = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
      out[y * size + x] += v * amp;
    }
    norm += amp; amp *= persist; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

function canvasTex(size, paint) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  paint(img.data, size, ctx, img);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
const mix = (a, b, t) => a + (b - a) * t;
function put(d, i, r, g, b) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }

export function makeTextures() {
  const S = 256;
  const T = {};
  // grass: mottled greens with fine blade strokes
  { const n1 = valueNoise(S, 3, 4, 0.55), n2 = valueNoise(S, 9, 2, 0.5);
    T.grass = canvasTex(S, (d, s, ctx, img) => {
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const a = n1[y * s + x], b = n2[y * s + x]; const k = mix(0.55, 1.15, a) * mix(0.9, 1.1, b);
        put(d, i, 88 * k + 18 * b, 158 * k + 10 * a, 62 * k); }
      // blade strokes
      ctx.putImageData(img, 0, 0);
      for (let k = 0; k < 900; k++) { const x = Math.random() * s, y = Math.random() * s, l = 3 + Math.random() * 6; ctx.strokeStyle = `rgba(${40 + Math.random() * 60 | 0},${120 + Math.random() * 80 | 0},${40 + Math.random() * 30 | 0},0.55)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - l); ctx.stroke(); }
      const id = ctx.getImageData(0, 0, s, s); d.set(id.data);
    }); }
  // stone blocks: mortar grid + per-block tint + noise
  { const n1 = valueNoise(S, 5, 4, 0.5);
    T.stone = canvasTex(S, (d, s) => {
      const bw = 64, bh = 32;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const row = Math.floor(y / bh); const xo = (row % 2) * (bw / 2); const bx = ((x + xo) % bw), by = y % bh;
        const mortar = bx < 3 || by < 3; const blk = Math.floor((x + xo) / bw) + row * 7; const tint = 0.85 + ((Math.sin(blk * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.3; const nz = n1[y * s + x];
        const base = mortar ? 0.55 : tint * mix(0.85, 1.12, nz); put(d, i, 170 * base, 158 * base, 142 * base); } }); }
  // rock: dark violet-grey noise with cracks
  { const n1 = valueNoise(S, 7, 5, 0.6), n2 = valueNoise(S, 11, 3, 0.5);
    T.rock = canvasTex(S, (d, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const a = n1[y * s + x], b = n2[y * s + x]; const crack = Math.abs(b - 0.5) < 0.012 ? 0.55 : 1; const k = mix(0.7, 1.25, a) * crack; put(d, i, 96 * k, 84 * k, 116 * k); } }); }
  // bark: vertical streaks
  { const n1 = valueNoise(S, 13, 4, 0.5);
    T.bark = canvasTex(S, (d, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const a = n1[y * s + x]; const st = 0.75 + 0.35 * Math.abs(Math.sin(x * 0.35 + a * 6)); const k = mix(0.7, 1.15, a) * st; put(d, i, 110 * k, 76 * k, 46 * k); } }); }
  // dirt
  { const n1 = valueNoise(S, 17, 4, 0.55);
    T.dirt = canvasTex(S, (d, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const a = n1[y * s + x]; const k = mix(0.7, 1.2, a); const pebble = a > 0.72 ? 1.2 : 1; put(d, i, 128 * k * pebble, 90 * k * pebble, 56 * k); } }); }
  // moss stone
  { const n1 = valueNoise(S, 19, 4, 0.5), n2 = valueNoise(S, 23, 3, 0.5);
    T.moss = canvasTex(S, (d, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const a = n1[y * s + x], b = n2[y * s + x]; const m = b > 0.55 ? (b - 0.55) * 2.2 : 0; const k = mix(0.8, 1.15, a); put(d, i, mix(160, 110, m) * k, mix(150, 160, m) * k, mix(135, 70, m) * k); } }); }
  return T;
}

// Patch a MeshStandardMaterial so its map is sampled in WORLD space by the face normal (triplanar).
export function worldMap(mat, tex, scale = 0.25) {
  mat.map = tex;
  mat.userData.triScale = scale;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTriScale;')
      .replace('#include <map_fragment>', `
        vec3 nw = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
        vec3 wgt = abs(nw); wgt = pow(wgt, vec3(6.0)); wgt /= (wgt.x + wgt.y + wgt.z);
        vec4 tx = texture2D(map, vWPos.zy * uTriScale);
        vec4 ty = texture2D(map, vWPos.xz * uTriScale);
        vec4 tz = texture2D(map, vWPos.xy * uTriScale);
        diffuseColor *= tx * wgt.x + ty * wgt.y + tz * wgt.z;`);
  };
  mat.needsUpdate = true;
  return mat;
}
