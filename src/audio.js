// Audio engine. Sound effects and music come from CC0 files decoded into AudioBuffers (no <audio> elements anywhere:
// a MediaElementSource can double up or phase against itself, which was the prime suspect for the reported noise).
// Everything has a synthesised fallback so a missing file is never silence. Settings: sound (files/synth),
// musicSource (files/synth/off), ambience (on/off).
import { S } from './settings.js';

let ctx = null, master = null, sfxBus = null, musBus = null, ambBus = null, analyser = null, noiseBuf = null;
const buffers = {};            // name -> AudioBuffer[]
const tracks = {};             // url -> AudioBuffer | Promise
let manifestState = 'idle';    // idle | loading | ready | failed
const analyserData = new Uint8Array(1024);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
  master.connect(analyser); analyser.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  loadManifest();
}
export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = S.master; sfxBus.gain.value = S.sfx; musBus.gain.value = S.music * 0.7; ambBus.gain.value = (S.ambience ? 1 : 0) * S.music * 0.55;
}
export function audioReady() { return !!ctx; }

async function loadManifest() {
  if (manifestState !== 'idle') return; manifestState = 'loading';
  try {
    const man = await (await fetch('audio/manifest.json')).json();
    await Promise.all(Object.entries(man).map(async ([name, files]) => {
      const bufs = await Promise.all(files.map(async url => { try { const ab = await (await fetch(url)).arrayBuffer(); return await ctx.decodeAudioData(ab); } catch { return null; } }));
      buffers[name] = bufs.filter(Boolean);
    }));
    manifestState = 'ready';
  } catch (e) { manifestState = 'failed'; console.warn('sfx manifest failed', e); }
}
function loadTrack(url) {
  if (tracks[url]) return Promise.resolve(tracks[url]);
  const p = (async () => { const ab = await (await fetch(url)).arrayBuffer(); const b = await ctx.decodeAudioData(ab); tracks[url] = b; return b; })();
  tracks[url] = p; p.catch(() => { delete tracks[url]; }); return p;
}

// ---------------------------------------------------------------- synth helpers
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

const SYNTH = {
  swing(o) { const t = ctx.currentTime; const g = gain(0.5 * (o.heavy ? 1.3 : 1)); const t1 = env(g, t, 0.01, 0.12, 0, 0.08, 0.6, 0.3); noise(t, t1, g, 'bandpass', o.heavy ? 500 : 1400, o.heavy ? 2400 : 3600, 0.8); },
  hit(o) { const t = ctx.currentTime; const g = gain(0.9); const t1 = env(g, t, 0.004, 0.09, 0, 0.16, 1, 0.3); noise(t, t1, g, 'lowpass', 3000, 300, 0.7); const g2 = gain(0.6); env(g2, t, 0.004, 0.08, 0, 0.1, 1, 0.2); const k = osc('sine', o.heavy ? 90 : 140, t, t + 0.25, g2); k.frequency.exponentialRampToValueAtTime(40, t + 0.2); },
  clang() { const t = ctx.currentTime; const g = gain(0.35); const t1 = env(g, t, 0.003, 0.3, 0, 0.5, 1, 0.25); for (const f of [2100, 3350, 5200, 780]) osc('triangle', f, t, t1, g, (Math.random() - 0.5) * 30); noise(t, t + 0.08, g, 'highpass', 4000, 4000); },
  parry() { const t = ctx.currentTime; const g = gain(0.45); const t1 = env(g, t, 0.003, 0.4, 0, 0.7, 1, 0.3); for (const f of [1568, 2349, 3136, 4186]) osc('sine', f, t, t1, g); noise(t, t + 0.06, g, 'highpass', 5000, 5000); },
  jump() { const t = ctx.currentTime; const g = gain(0.25); const t1 = env(g, t, 0.01, 0.12, 0, 0.06, 1, 0.3); const o = osc('triangle', 300, t, t1, g); o.frequency.exponentialRampToValueAtTime(620, t + 0.12); },
  dash() { const t = ctx.currentTime; const g = gain(0.4); const t1 = env(g, t, 0.01, 0.16, 0, 0.12, 1, 0.3); noise(t, t1, g, 'bandpass', 900, 3200, 1.2); const o = osc('sine', 420, t, t1, g); o.frequency.exponentialRampToValueAtTime(900, t + 0.15); },
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
  growl() { const t = ctx.currentTime; const g = gain(0.35); const t1 = env(g, t, 0.05, 0.4, 0, 0.5, 1, 0.5); const o = osc('sawtooth', 70, t, t1, g); o.frequency.linearRampToValueAtTime(55, t1); noise(t, t1, g, 'lowpass', 500, 200); },
  roar() { const t = ctx.currentTime; const g = gain(0.7); const t1 = env(g, t, 0.08, 0.8, 0, 0.9, 1, 0.6); for (const f of [55, 82, 110]) { const o = osc('sawtooth', f, t, t1, g); o.frequency.linearRampToValueAtTime(f * 0.8, t1); } noise(t, t1, g, 'lowpass', 900, 150, 0.5); },
  slam() { const t = ctx.currentTime; const g = gain(1.0); const t1 = env(g, t, 0.004, 0.3, 0, 0.5, 1, 0.3); noise(t, t1, g, 'lowpass', 600, 60); const k = osc('sine', 70, t, t + 0.5, g); k.frequency.exponentialRampToValueAtTime(25, t + 0.45); },
  bolt() { const t = ctx.currentTime; const g = gain(0.25); const t1 = env(g, t, 0.005, 0.12, 0, 0.1, 1, 0.3); const o = osc('square', 900, t, t1, g); o.frequency.exponentialRampToValueAtTime(300, t + 0.2); },
  crumble() { const t = ctx.currentTime; const g = gain(0.4); const t1 = env(g, t, 0.05, 0.5, 0, 0.3, 1, 0.5); noise(t, t1, g, 'lowpass', 700, 150, 0.8); },
  victory() { const t = ctx.currentTime; const g = gain(0.35); env(g, t, 0.02, 2.5, 0, 1.5, 1, 0.5); [523, 659, 784, 1046, 1318].forEach((f, i) => { osc('triangle', f, t + i * 0.12, t + 4, g); osc('sine', f * 0.5, t + i * 0.12, t + 4, g); }); },
  ui() { const t = ctx.currentTime; const g = gain(0.15); const t1 = env(g, t, 0.003, 0.08, 0, 0.06, 1, 0.3); osc('sine', 880, t, t1, g); },
  horn() { const t = ctx.currentTime; const g = gain(0.5); const t1 = env(g, t, 0.05, 0.6, 0, 0.6, 1, 0.6); for (const f of [220, 330, 442]) { const o = osc('sawtooth', f, t, t1, g); o.frequency.linearRampToValueAtTime(f * 1.02, t1); } },
  drum() { const t = ctx.currentTime; const g = gain(0.6); env(g, t, 0.004, 0.25, 0, 0.2, 1, 0.3); const k = osc('sine', 80, t, t + 0.4, g); k.frequency.exponentialRampToValueAtTime(40, t + 0.3); noise(t, t + 0.05, g, 'lowpass', 800, 300); },
  snap() { const t = ctx.currentTime; const g = gain(0.5); const t1 = env(g, t, 0.003, 0.12, 0, 0.2, 1, 0.3); noise(t, t1, g, 'bandpass', 1800, 500, 1.5); },
  boing() { const t = ctx.currentTime; const g = gain(0.35); const t1 = env(g, t, 0.01, 0.25, 0, 0.2, 1, 0.4); const o = osc('sine', 180, t, t1, g); o.frequency.exponentialRampToValueAtTime(520, t + 0.18); o.frequency.exponentialRampToValueAtTime(320, t1); },
};

// Which file set a synth name maps to (with optional pitch / volume), when files are enabled and loaded.
const FILE_FOR = {
  swing: o => ({ n: 'swing', pitch: o.heavy ? 0.8 : 1.05, vol: 0.55 }),
  hit: o => ({ n: o.heavy ? 'hitHeavy' : 'hit', vol: 1 }),
  clang: () => ({ n: 'clang', vol: 0.8 }), parry: () => ({ n: 'parry', vol: 0.9 }),
  enemyHit: () => ({ n: 'enemyHit', vol: 0.8 }), enemyDie: () => ({ n: 'gobDie', vol: 0.9 }),
  gobGrunt: () => ({ n: 'gobGrunt', vol: 0.7 }), gobHurt: () => ({ n: 'gobHurt', vol: 0.7 }), gobChatter: () => ({ n: 'gobChatter', vol: 0.35 }),
  growl: () => ({ n: 'growl', vol: 0.7 }), roar: () => ({ n: 'roar', vol: 1 }), bossHurt: () => ({ n: 'bossHurt', vol: 0.7 }),
  bolt: () => ({ n: 'bolt', pitch: 1.4, vol: 0.5 }), stoneHit: () => ({ n: 'stoneHit', vol: 0.7 }),
  step: o => ({ n: o.wood ? 'stepWood' : 'step', vol: 0.5 }), land: o => ({ n: 'land', pitch: o.hard ? 0.8 : 1, vol: o.hard ? 1 : 0.6 }),
  slam: () => ({ n: 'slam', pitch: 0.75, vol: 1 }), crumble: () => ({ n: 'crumble', pitch: 0.7, vol: 0.8 }), snap: () => ({ n: 'crumble', pitch: 1.4, vol: 0.9 }),
  stagger: () => ({ n: 'stagger', vol: 0.7 }), ui: () => ({ n: 'ui', vol: 0.4 }), hurt: () => ({ n: 'hurt', vol: 0.8 }), unsheathe: () => ({ n: 'unsheathe', vol: 0.6 }),
};
const rateLimit = { land: 0.12, step: 0.09, hit: 0.03, clang: 0.05, gobChatter: 0.5, enemyHit: 0.03 }; const lastPlayed = {};

function playBuffer(name, pitch = 1, vol = 1) {
  const list = buffers[name]; if (!list || !list.length) return false;
  const src = ctx.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = pitch * (1 + (Math.random() - 0.5) * 0.12);
  const g = ctx.createGain(); g.gain.value = vol * (1 + (Math.random() - 0.5) * 0.25); src.connect(g); g.connect(sfxBus); src.start(); return true;
}
export function sfx(name, opts = {}) {
  if (!ctx || S.sfx <= 0) return;
  if (rateLimit[name]) { const now = ctx.currentTime; if (now - (lastPlayed[name] || -9) < rateLimit[name]) return; lastPlayed[name] = now; }
  try {
    if (S.sound !== 'synth' && FILE_FOR[name]) { const f = FILE_FOR[name](opts); if (playBuffer(f.n, (f.pitch || 1) * (opts.pitch || 1), (f.vol ?? 1) * (opts.vol ?? 1))) return; }
    if (SYNTH[name]) SYNTH[name](opts);
  } catch { /* an audio hiccup must never break a frame */ }
}

// ---------------------------------------------------------------- music (buffer loops, never <audio> elements)
const TRACKS = { title: 'audio/menu_theme.mp3', explore: 'audio/forest_theme2.mp3' };
const music = { mode: null, kind: null, src: null, gain: null, token: 0, timer: 0, pad: null, padGain: null, step: 0, next: 0 };
function fadeOutAndStop(src, g, sec = 0.8) {
  if (!src || !g) return; try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + sec); } catch { }
  setTimeout(() => { try { src.stop(); } catch { } try { src.disconnect(); g.disconnect(); } catch { } }, sec * 1000 + 100);
}
export function startMusic(mode) {
  if (!ctx) return;
  if (music.mode === mode) return;
  stopMusic(); music.mode = mode;
  const src = S.musicSource || 'files';
  if (src === 'off') return;
  if (src === 'files' && TRACKS[mode]) {
    const token = ++music.token;
    loadTrack(TRACKS[mode]).then(buf => {
      if (token !== music.token || music.mode !== mode) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(g); g.connect(musBus); s.start();
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.0);
      music.src = s; music.gain = g; music.kind = 'file';
    }).catch(() => { if (token === music.token && music.mode === mode) startSynth(mode); });
    return;
  }
  startSynth(mode);
}
export function stopMusic() {
  music.token++;
  if (music.src) fadeOutAndStop(music.src, music.gain, 0.8);
  music.src = null; music.gain = null;
  if (music.timer) clearInterval(music.timer); music.timer = 0;
  if (music.padGain) { const g = music.padGain, oscs = music.pad; try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); } catch { } setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch { } }); }, 1500); }
  music.pad = null; music.padGain = null; music.mode = null; music.kind = null;
}
const SCALE_EXPLORE = [0, 3, 5, 7, 10, 12, 15, 17, 19], SCALE_BOSS = [0, 1, 5, 6, 8, 12, 13, 17], ROOT = 146.83;
function note(semi) { return ROOT * Math.pow(2, semi / 12); }
function startSynth(mode) {
  music.kind = 'synth'; music.step = 0; music.next = ctx.currentTime + 0.1;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(musBus);
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = mode === 'boss' ? 420 : 620; fl.connect(g);
  const rootF = note(-12);
  const oa = ctx.createOscillator(); oa.type = 'triangle'; oa.frequency.value = rootF; oa.detune.value = -3; oa.connect(fl); oa.start();
  const ob = ctx.createOscillator(); ob.type = 'triangle'; ob.frequency.value = rootF * (mode === 'boss' ? 1.4983 : 1.5); ob.detune.value = 3; ob.connect(fl); ob.start();
  const oc = ctx.createOscillator(); oc.type = 'sine'; oc.frequency.value = rootF * 0.5; oc.connect(fl); oc.start();
  g.gain.linearRampToValueAtTime(mode === 'boss' ? 0.2 : 0.11, ctx.currentTime + 2.5);
  music.pad = [oa, ob, oc]; music.padGain = g;
  music.timer = setInterval(() => scheduleSynth(mode), 120);
}
function scheduleSynth(mode) {
  if (!ctx || music.kind !== 'synth') return;
  const boss = mode === 'boss'; const beat = boss ? 0.21 : 0.42;
  if (music.next < ctx.currentTime - 1) music.next = ctx.currentTime + 0.05; // never catch up a backlog in one burst
  while (music.next < ctx.currentTime + 0.35) {
    const t = music.next, i = music.step, scale = boss ? SCALE_BOSS : SCALE_EXPLORE, bar = Math.floor(i / 8) % 4;
    const shape = boss ? [0, 3, 5, 3, 7, 5, 3, 1] : [0, 2, 4, 6, 4, 2, 1, 3];
    const degree = (shape[i % 8] + [0, 0, 1, -1][bar]) % scale.length; const f = note(scale[Math.max(0, degree)] + (boss ? 0 : 12));
    const g = ctx.createGain(); g.connect(musBus); const amp = (i % 8 === 0 ? 0.11 : 0.06) * (boss ? 1.3 : 1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * (boss ? 1.6 : 2.4));
    const o = ctx.createOscillator(); o.type = boss ? 'square' : 'sine'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + beat * 3);
    if (boss && i % 4 === 0) { const dg = ctx.createGain(); dg.connect(musBus); dg.gain.setValueAtTime(0.5, t); dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); const d = ctx.createOscillator(); d.frequency.setValueAtTime(90, t); d.frequency.exponentialRampToValueAtTime(35, t + 0.2); d.connect(dg); d.start(t); d.stop(t + 0.3); }
    music.next += beat; music.step++;
  }
}

// ---------------------------------------------------------------- ambience (forest bed)
const amb = { src: null, gain: null, token: 0, level: 1 };
export function startAmbience() {
  if (!ctx || amb.src) return; const token = ++amb.token;
  loadTrack('audio/forest_ambience.mp3').then(buf => {
    if (token !== amb.token || amb.src) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(g); g.connect(ambBus); s.start();
    g.gain.linearRampToValueAtTime(amb.level, ctx.currentTime + 3); amb.src = s; amb.gain = g;
  }).catch(() => { });
}
export function stopAmbience() { amb.token++; if (amb.src) fadeOutAndStop(amb.src, amb.gain, 1.2); amb.src = null; amb.gain = null; }
export function setAmbienceLevel(v) { amb.level = v; if (amb.gain && ctx) amb.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.8); }

// ---------------------------------------------------------------- probe for the F3 overlay
export function audioProbe() {
  if (!ctx) return 'audio: not started';
  analyser.getByteTimeDomainData(analyserData); let sum = 0; for (let i = 0; i < analyserData.length; i++) { const v = (analyserData[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / analyserData.length);
  const loaded = Object.values(buffers).reduce((a, b) => a + b.length, 0);
  return `audio ${ctx.state} · sfx ${S.sound || 'files'} (${loaded} clips ${manifestState}) · music ${music.mode || '-'}/${music.kind || (S.musicSource === 'off' ? 'off' : '-')} · amb ${amb.src ? 'on' : 'off'} · rms ${rms.toFixed(3)} · <audio> ${document.querySelectorAll('audio').length}`;
}
