// Settings: one object, persisted to localStorage, with a schema the UI renders from.
const KEY = 'errant.settings.v1';

export const SCHEMA = [
  { group: 'Sound' },
  { key: 'master', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.8, fmt: pct },
  { key: 'music', label: 'Music volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.45, fmt: pct },
  { key: 'sfx', label: 'Effects volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.9, fmt: pct },
  { group: 'Camera' },
  { key: 'sens', label: 'Mouse sensitivity', type: 'range', min: 0.2, max: 3, step: 0.1, def: 1.0, fmt: v => v.toFixed(1) + '×' },
  { key: 'invertY', label: 'Invert look Y', type: 'toggle', def: false },
  { key: 'camDist', label: 'Camera distance', type: 'range', min: 4.5, max: 12, step: 0.5, def: 7.5, fmt: v => v.toFixed(1) + ' m' },
  { key: 'fov', label: 'Field of view', type: 'range', min: 55, max: 95, step: 1, def: 70, fmt: v => v + '°' },
  { key: 'autoFollow', label: 'Camera follows the knight', type: 'toggle', def: true, hint: 'Swings behind you while you run' },
  { group: 'Display' },
  { key: 'shadows', label: 'Shadows', type: 'select', options: [['off', 'Off'], ['low', 'Low'], ['high', 'High']], def: 'high' },
  { key: 'renderScale', label: 'Render scale', type: 'range', min: 0.5, max: 1, step: 0.05, def: 1, fmt: pct, hint: 'Lower if the frame rate drops' },
  { key: 'postfx', label: 'Bloom & grading', type: 'toggle', def: true, hint: 'Glow on crystals, lanterns and runes' },
  { key: 'shake', label: 'Screen shake', type: 'toggle', def: true },
  { key: 'hitstop', label: 'Hit stop', type: 'toggle', def: true, hint: 'A tiny freeze when a blow lands' },
  { key: 'hints', label: 'Show hints', type: 'toggle', def: true },
  { group: 'Challenge' },
  { key: 'difficulty', label: 'Difficulty', type: 'select', options: [['squire', 'Squire'], ['knight', 'Knight'], ['champion', 'Champion']], def: 'knight', hint: 'Enemy damage and toughness' },
];

function pct(v) { return Math.round(v * 100) + '%'; }

export const DEFAULTS = Object.fromEntries(SCHEMA.filter(r => r.key).map(r => [r.key, r.def]));

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw);
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (k in j) out[k] = j[k];
    return out;
  } catch { return { ...DEFAULTS }; }
}

export const S = load();
const listeners = new Set();

export function setSetting(k, v) {
  if (!(k in DEFAULTS)) return;
  S[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ }
  for (const fn of listeners) fn(k, v);
}
export function resetSettings() { for (const k of Object.keys(DEFAULTS)) setSetting(k, DEFAULTS[k]); }
export function onSetting(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const DIFF = {
  squire: { enemyDmg: 0.5, enemyHp: 0.75, playerDmg: 1.25 },
  knight: { enemyDmg: 1, enemyHp: 1, playerDmg: 1 },
  champion: { enemyDmg: 1.5, enemyHp: 1.35, playerDmg: 0.9 },
};
export function diff() { return DIFF[S.difficulty] || DIFF.knight; }

// Render the settings rows into a container. Idempotent.
export function renderSettings(container) {
  container.innerHTML = '';
  for (const r of SCHEMA) {
    if (r.group) { const h = document.createElement('div'); h.style.cssText = 'font-family:Cinzel,serif;color:#a8873a;letter-spacing:.14em;font-size:13px;margin:14px 0 2px'; h.textContent = r.group.toUpperCase(); container.appendChild(h); continue; }
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('label'); lab.textContent = r.label; if (r.hint) { const s = document.createElement('small'); s.textContent = r.hint; lab.appendChild(s); }
    const ctl = document.createElement('div'); ctl.className = 'ctl';
    if (r.type === 'range') {
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.value = S[r.key];
      const val = document.createElement('span'); val.className = 'val'; val.textContent = r.fmt(S[r.key]);
      inp.oninput = () => { const v = parseFloat(inp.value); setSetting(r.key, v); val.textContent = r.fmt(v); };
      ctl.append(inp, val);
    } else if (r.type === 'toggle') {
      const t = document.createElement('div'); t.className = 'toggle' + (S[r.key] ? ' on' : ''); t.setAttribute('role', 'switch');
      t.onclick = () => { setSetting(r.key, !S[r.key]); t.classList.toggle('on', S[r.key]); };
      ctl.append(t);
    } else if (r.type === 'select') {
      const sel = document.createElement('select');
      for (const [v, l] of r.options) { const o = document.createElement('option'); o.value = v; o.textContent = l; if (S[r.key] === v) o.selected = true; sel.appendChild(o); }
      sel.onchange = () => setSetting(r.key, sel.value);
      ctl.append(sel);
    }
    row.append(lab, ctl); container.appendChild(row);
  }
}
