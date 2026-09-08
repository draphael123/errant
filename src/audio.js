// Entirely synthesised audio: no files to load, nothing to miss on a CDN.
import { S } from './settings.js';

let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.connect(master);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.disconnect(); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}
export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = S.master; sfxBus.gain.value = S.sfx; musBus.gain.value = S.music * 0.6;
}
export function audioReady() { return !!ctx; }

function env(node, t0, a, d, s, r, peak = 1, sus = 0.4, hold = 0) {
  const g = node.gain; g.cancelScheduledValues(t0); g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + a); g.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t0 + a + d);
  g.setValueAtTime(Math.max(0.0001, peak * sus), t0 + a + d + hold); g.exponentialRampToValueAtTime(0.0001, t0 + a + d + hold + r);
  return t0 + a + d + hold + r;
}
function osc(type, f, t0, t1, dest, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune; o.connect(dest); o.start(t0); o.stop(t1 + 0.05); return o;
}
function noise(t0, t1, dest, filterType = 'bandpass', f0 = 1000, f1 = f0, q = 1) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t1);
  src.connect(fl); fl.connect(dest); src.start(t0); src.stop(t1 + 0.05); return src;
}
function gain(v = 1) { const g = ctx.createGain(); g.gain.value = v; g.connect(sfxBus); return g; }

const SFX = {
  swing(o) { const t = ctx.currentTime; const g = gain(0.5 * (o.heavy ? 1.3 : 1)); const t1 = env(g, t, 0.01, 0.12, 0, 0.08, 0.6, 0.3); noise(t, t1, g, 'bandpass', o.heavy ? 500 : 1400, o.heavy ? 2400 : 3600, 0.8); },
  hit(o) { const t = ctx.currentTime; const g = gain(0.9); const t1 = env(g, t, 0.004, 0.09, 0, 0.16, 1, 0.3); noise(t, t1, g, 'lowpass', 3000, 300, 0.7);
    const g2 = gain(0.6); env(g2, t, 0.004, 0.08, 0, 0.1, 1, 0.2); const k = osc('sine', o.heavy ? 90 : 140, t, t + 0.25, g2); k.frequency.exponentialRampToValueAtTime(40, t + 0.2); },
  clang() { const t = ctx.currentTime; const g = gain(0.35); const t1 = env(g, t, 0.003, 0.3, 0, 0.5, 1, 0.25);
    for (const f of [2100, 3350, 5200, 780]) osc('triangle', f, t, t1, g, (Math.random() - 0.5) * 30); noise(t, t + 0.08, g, 'highpass', 4000, 4000); },
  parry() { const t = ctx.currentTime; const g = gain(0.45); const t1 = env(g, t, 0.003, 0.4, 0, 0.7, 1, 0.3);
    for (const f of [1568, 2349, 3136, 4186]) osc('sine', f, t, t1, g); noise(t, t + 0.06, g, 'highpass', 5000, 5000); },
  jump() { const t = ctx.currentTime; const g = gain(0.25); const t1 = env(g, t, 0.01, 0.12, 0, 0.06, 1, 0.3); const o = osc('triangle', 300, t, t1, g); o.frequency.exponentialRampToValueAtTime(620, t + 0.12); },
  djump() { const t = ctx.currentTime; const g = gain(0.28); const t1 = env(g, t, 0.01, 0.16, 0, 0.1, 1, 0.3); const o = osc('sine', 500, t, t1, g); o.frequency.exponentialRampToValueAtTime(1100, t + 0.14); noise(t, t + 0.12, g, 'bandpass', 2000, 4000, 2); },
  land(o) { const t = ctx.currentTime; const g = gain(0.35 * (o.hard ? 1.5 : 1)); const t1 = env(g, t, 0.004, 0.08, 0, 0.08, 1, 0.2); noise(t, t1, g, 'lowpass', 900, 200); const k = osc('sine', 110, t, t + 0.15, g); k.frequency.exponentialRampToValueAtTime(45, t + 0.12); },
  step() { const t = ctx.currentTime; const g = gain(0.16); const t1 = env(g, t, 0.004, 0.06, 0, 0.05, 1, 0.15); noise(t, t1, g, 'lowpass', 420 + Math.random() * 120, 160, 0.6); const k = osc('sine', 95 + Math.random() * 20, t, t + 0.09, g); k.frequency.exponentialRampToValueAtTime(50, t + 0.08); },
  roll() { const t = ctx.currentTime; const g = gain(0.3); const t1 = env(g, t, 0.02, 0.25, 0, 0.15, 1, 0.4); noise(t, t1, g, 'lowpass', 1200, 300, 0.5); },
  hurt() { const t = ctx.currentTime; const g = gain(0.5); const t1 = env(g, t, 0.005, 0.15, 0, 0.2, 1, 0.3); const o = osc('sawtooth', 220, t, t1, g); o.frequency.exponentialRampToValueAtTime(90, t + 0.3); noise(t, t + 0.12, g, 'lowpass', 2500, 400); },
  death() { const t = ctx.currentTime; const g = gain(0.5); const t1 = env(g, t, 0.01, 0.9, 0, 0.6, 1, 0.5); const o = osc('sawtooth', 200, t, t1, g); o.frequency.exponentialRampToValueAtTime(40, t + 1.4); const o2 = osc('sine', 100, t, t1, g); o2.frequency.exponentialRampToValueAtTime(30, t + 1.4); },
  gem() { const t = ctx.currentTime; const g = gain(0.22); env(g, t, 0.005, 0.25, 0, 0.3, 1, 0.3); osc('sine', 1318, t, t + 0.5, g); osc('sine', 1975, t + 0.07, t + 0.55, g); osc('triangle', 2637, t + 0.12, t + 0.6, g); },
  heart() { const t = ctx.currentTime; const g = gain(0.3); env(g, t, 0.01, 0.5, 0, 0.5, 1, 0.4); [523, 659, 784, 1046].forEach((f, i) => osc('sine', f, t + i * 0.08, t + 0.9, g)); },
  shrine() { const t = ctx.currentTime; const g = gain(0.3); env(g, t, 0.05, 1.2, 0, 1.0, 1, 0.5); [392, 587, 784, 988, 1175].forEach((f, i) => osc('sine', f, t + i * 0.1, t + 2.2, g)); noise(t, t + 1.5, g, 'bandpass', 3000, 6000, 3); },
  enemyHit() { const t = ctx.currentTime; const g = gain(0.5); const t1 = env(g, t, 0.004, 0.1, 0, 0.12, 1, 0.3); noise(t, t1, g, 'bandpass', 900, 250, 0.8); const k = osc('square', 160, t, t + 0.12, g); k.frequency.exponentialRampToValueAtTime(60, t + 0.1); },
  enemyDie() { const t = ctx.currentTime; const g = gain(0.45); const t1 = env(g, t, 0.01, 0.35, 0, 0.3, 1, 0.3); noise(t, t1, g, 'lowpass', 2000, 200); const o = osc('sawtooth', 300, t, t1, g); o.frequency.exponentialRampToValueAtTime(60, t + 0.5); },
  stagger() { const t = ctx.currentTime; const g = gain(0.4); const t1 = env(g, t, 0.005, 0.3, 0, 0.3, 1, 0.3); for (const f of [660, 990, 1320]) { const o = osc('square', f, t, t1, g); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.5); } },
  growl() { const t = ctx.currentTime; const g = gain(0.35); const t1 = env(g, t, 0.05, 0.4, 0, 0.5, 1, 0.5); const o = osc('sawtooth', 70, t, t1, g); o.frequency.linearRampToValueAtTime(55, t1); const o2 = osc('square', 71.5, t, t1, g); o2.frequency.linearRampToValueAtTime(52, t1); noise(t, t1, g, 'lowpass', 500, 200); },
  roar() { const t = ctx.currentTime; const g = gain(0.7); const t1 = env(g, t, 0.08, 0.8, 0, 0.9, 1, 0.6); for (const f of [55, 82, 110]) { const o = osc('sawtooth', f, t, t1, g); o.frequency.linearRampToValueAtTime(f * 0.8, t1); } noise(t, t1, g, 'lowpass', 900, 150, 0.5); },
  slam() { const t = ctx.currentTime; const g = gain(1.0); const t1 = env(g, t, 0.004, 0.3, 0, 0.5, 1, 0.3); noise(t, t1, g, 'lowpass', 600, 60); const k = osc('sine', 70, t, t + 0.5, g); k.frequency.exponentialRampToValueAtTime(25, t + 0.45); },
  bolt() { const t = ctx.currentTime; const g = gain(0.25); const t1 = env(g, t, 0.005, 0.12, 0, 0.1, 1, 0.3); const o = osc('square', 900, t, t1, g); o.frequency.exponentialRampToValueAtTime(300, t + 0.2); },
  crumble() { const t = ctx.currentTime; const g = gain(0.4); const t1 = env(g, t, 0.05, 0.5, 0, 0.3, 1, 0.5); noise(t, t1, g, 'lowpass', 700, 150, 0.8); },
  victory() { const t = ctx.currentTime; const g = gain(0.35); env(g, t, 0.02, 2.5, 0, 1.5, 1, 0.5); [523, 659, 784, 1046, 1318].forEach((f, i) => { osc('triangle', f, t + i * 0.12, t + 4, g); osc('sine', f * 0.5, t + i * 0.12, t + 4, g); }); },
  ui() { const t = ctx.currentTime; const g = gain(0.15); const t1 = env(g, t, 0.003, 0.08, 0, 0.06, 1, 0.3); osc('sine', 880, t, t1, g); },
};

const rateLimit = { land: 0.12, step: 0.09, hit: 0.03, clang: 0.05 }; const lastPlayed = {};
export function sfx(name, opts = {}) {
  if (!ctx || S.sfx <= 0) return;
  if (rateLimit[name]) { const now = ctx.currentTime; if (now - (lastPlayed[name] || -9) < rateLimit[name]) return; lastPlayed[name] = now; }
  try { SFX[name] && SFX[name](opts); } catch { /* an audio hiccup must never break a frame */ }
}

// ---- Music: a slow modal arpeggio with a pad. Boss mode = faster, lower, tenser. ----
const music = { mode: null, next: 0, step: 0, timer: 0, pad: null, padGain: null };
const SCALE_EXPLORE = [0, 3, 5, 7, 10, 12, 15, 17, 19];   // D minor pentatonic-ish, root 146.8 Hz
const SCALE_BOSS = [0, 1, 5, 6, 8, 12, 13, 17];         // phrygian bite
const ROOT = 146.83;
function note(semi) { return ROOT * Math.pow(2, semi / 12); }

const TRACKS = { title: 'audio/menu_theme.mp3', explore: 'audio/forest_theme.mp3' };
const file = { el: null, gain: null, mode: null };
function stopFile() {
  if (!file.el) return; const el = file.el, g = file.gain;
  try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.35); } catch { }
  setTimeout(() => { try { el.pause(); el.src = ''; } catch { } }, 1400);
  file.el = null; file.gain = null; file.mode = null;
}
function startFile(mode) {
  const url = TRACKS[mode]; if (!url) return false;
  const el = new Audio(url); el.loop = true; el.preload = 'auto';
  let node; try { node = ctx.createMediaElementSource(el); } catch { return false; }
  const g = ctx.createGain(); g.gain.value = 0.0001; node.connect(g); g.connect(musBus);
  file.el = el; file.gain = g; file.mode = mode;
  el.addEventListener('error', () => { if (file.el === el) { stopFile(); startSynth(mode); } });
  el.play().then(() => { g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 2.5); }).catch(() => { if (file.el === el) { stopFile(); startSynth(mode); } });
  return true;
}
export function startMusic(mode) {
  if (!ctx) return;
  if (music.mode === mode || file.mode === mode) return;
  stopMusic();
  if (startFile(mode)) return;
  startSynth(mode);
}
function startSynth(mode) {
  music.mode = mode; music.step = 0; music.next = ctx.currentTime + 0.1;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(musBus);
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = mode === 'boss' ? 420 : 620; fl.connect(g);
  const rootF = note(-12);
  const oa = ctx.createOscillator(); oa.type = 'triangle'; oa.frequency.value = rootF; oa.detune.value = -3; oa.connect(fl); oa.start();
  const ob = ctx.createOscillator(); ob.type = 'triangle'; ob.frequency.value = rootF * (mode === 'boss' ? 1.4983 : 1.5); ob.detune.value = 3; ob.connect(fl); ob.start();
  const oc = ctx.createOscillator(); oc.type = 'sine'; oc.frequency.value = rootF * 0.5; oc.connect(fl); oc.start();
  g.gain.linearRampToValueAtTime(mode === 'boss' ? 0.2 : 0.11, ctx.currentTime + 2.5);
  music.pad = [oa, ob, oc]; music.padGain = g; music.filter = fl;
  music.timer = setInterval(scheduleMusic, 120);
}
export function stopMusic() {
  stopFile();
  if (music.timer) clearInterval(music.timer); music.timer = 0;
  if (music.padGain && ctx) { const g = music.padGain, oscs = music.pad; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch { } }); }, 1500); }
  music.pad = null; music.padGain = null; music.mode = null;
}
function scheduleMusic() {
  if (!ctx || !music.mode) return;
  const boss = music.mode === 'boss';
  const beat = boss ? 0.21 : 0.42;
  while (music.next < ctx.currentTime + 0.35) {
    const t = music.next; const i = music.step;
    const scale = boss ? SCALE_BOSS : SCALE_EXPLORE;
    const bar = Math.floor(i / 8) % 4;
    const shape = boss ? [0, 3, 5, 3, 7, 5, 3, 1] : [0, 2, 4, 6, 4, 2, 1, 3];
    const degree = (shape[i % 8] + [0, 0, 1, -1][bar]) % scale.length;
    const f = note(scale[Math.max(0, degree)] + (boss ? 0 : 12));
    const g = ctx.createGain(); g.connect(musBus);
    const amp = (i % 8 === 0 ? 0.11 : 0.06) * (boss ? 1.3 : 1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * (boss ? 1.6 : 2.4));
    const o = ctx.createOscillator(); o.type = boss ? 'square' : 'sine'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + beat * 3);
    if (boss && i % 4 === 0) { // low drum
      const dg = ctx.createGain(); dg.connect(musBus); dg.gain.setValueAtTime(0.5, t); dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      const d = ctx.createOscillator(); d.frequency.setValueAtTime(90, t); d.frequency.exponentialRampToValueAtTime(35, t + 0.2); d.connect(dg); d.start(t); d.stop(t + 0.3);
    } else if (!boss && i % 16 === 0) { // soft bell every two bars
      const bg = ctx.createGain(); bg.connect(musBus); bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.05, t + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f * 2; b.connect(bg); b.start(t); b.stop(t + 2.6);
    }
    music.next += beat; music.step++;
  }
}
