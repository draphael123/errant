// DOM heads-up display. Cheap: only touches the DOM when a value changes.
import { S } from './settings.js';

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.hpFill = document.getElementById('hpfill'); this.hpGhost = document.getElementById('hpghost'); this.hpText = document.getElementById('hptext'); this.ghostV = 100; this.stamina = document.getElementById('stamina');
    this.gemcount = document.getElementById('gemcount'); this.gemtotal = document.getElementById('gemtotal');
    this.hintEl = document.getElementById('hint'); this.toastEl = document.getElementById('toast');
    this.bossbar = document.getElementById('bossbar'); this.bosshp = document.getElementById('bosshp'); this.bosspoise = document.getElementById('bosspoise'); this.bossname = document.getElementById('bossname');
    this.vignette = document.getElementById('vignette'); this.staminaWrap = document.getElementById('stamina-wrap'); this.lowhp = document.getElementById('lowhp'); this.lockhint = document.getElementById('lockhint');
    this._hp = -1; this._max = -1; this._sta = -1; this._gems = -1; this.hintT = 0; this.toastT = 0; this.vigT = 0; this._boss = false;
  }
  show(v) { this.el.hidden = !v; }
  setHealth(hp, max) {
    if (hp === this._hp && max === this._max) return;
    const v = Math.max(0, hp / max * 100);
    this.hpFill.style.width = v + '%'; this.hpText.textContent = Math.round(hp);
    this.hpFill.classList.toggle('low', v < 30);
    if (hp > this._hp) this.ghostV = v; // heals snap the ghost
    this._hp = hp; this._max = max;
  }
  setStamina(frac, low) { const v = Math.round(frac * 100); if (v !== this._sta) { this._sta = v; this.stamina.style.width = v + '%'; } this.stamina.classList.toggle('low', !!low); if (this.staminaWrap) this.staminaWrap.classList.toggle('full', v >= 100); }
  setGems(n, total) { if (n !== this._gems) { this._gems = n; this.gemcount.textContent = n; this.gemtotal.textContent = total; } }
  hint(text, seconds = 4) { if (!S.hints && !text) return; this.hintEl.textContent = text; this.hintEl.classList.add('show'); this.hintT = seconds; }
  toast(text, seconds = 2.4) { this.toastEl.textContent = text; this.toastEl.classList.add('show'); this.toastT = seconds; }
  boss(show, hp, poise, name) { if (show !== this._boss) { this._boss = show; this.bossbar.classList.toggle('show', show); } if (show) { this.bosshp.style.width = Math.max(0, hp * 100) + '%'; this.bosspoise.style.width = Math.max(0, poise * 100) + '%'; if (name) this.bossname.textContent = name; } }
  damage() { this.vignette.style.opacity = 1; this.vigT = 0.25; }
  update(dt, locked, hpFrac) {
    const v = Math.max(0, hpFrac * 100); if (this.ghostV > v) { this.ghostV = Math.max(v, this.ghostV - dt * 45); this.hpGhost.style.width = this.ghostV + '%'; } else if (this.ghostV < v) { this.ghostV = v; this.hpGhost.style.width = v + '%'; }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.hintEl.classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('show'); }
    if (this.vigT > 0) { this.vigT -= dt; if (this.vigT <= 0) this.vignette.style.opacity = 0; }
    this.lockhint.style.opacity = locked ? 0 : 0.8;
    this.lowhp.style.opacity = hpFrac <= 0.34 ? 0.5 + Math.sin(performance.now() * 0.006) * 0.3 : 0;
  }
}
