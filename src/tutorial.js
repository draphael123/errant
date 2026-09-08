// Guided tutorial: condition-driven steps on the Landing with a training dummy. Ends by handing over to the normal route.
import { S } from './settings.js';

const KB = (k, p) => `<kbd>${k}</kbd>${p ? ` <span class="pad">${p}</span>` : ''}`;

export const STEPS = [
  { id: 'move', title: 'Walk', html: `Move with ${KB('W')}${KB('A')}${KB('S')}${KB('D')} or the left stick. Movement follows the camera.`, done: g => g.player.stats.moved > 5 },
  { id: 'look', title: 'Look', html: `Click the view to capture the mouse, then look around. On a pad, use the right stick. ${KB('[')} ${KB(']')} also turn the camera.`, done: g => g.player.stats.lookMoved > 0.8 },
  { id: 'jump', title: 'Jump', html: `Press ${KB('Space', 'A')} to jump. Hold it for a higher leap, tap for a short hop.`, done: g => g.player.stats.jumps >= 2 },
  { id: 'double', title: 'Double jump', html: `In the air, press ${KB('Space', 'A')} again to double jump. Use it to save a short leap.`, done: g => g.player.stats.doubles >= 1 },
  { id: 'strike', title: 'Strike', html: `Face the training dummy and strike with ${KB('LMB', 'X')} (or ${KB('J')}). Three strikes chain into a combo.`, done: g => g.dummy.hits.light >= 3, focus: true },
  { id: 'heavy', title: 'Heavy strike', html: `Land a heavy strike with ${KB('E', 'Y')} (or ${KB('K')}). It is slow, cannot be interrupted, and breaks poise.`, done: g => g.dummy.hits.heavy >= 1, focus: true },
  { id: 'guard', title: 'Guard', html: `The dummy will swing at you now. Hold ${KB('RMB', 'LB')} (or ${KB('L')}) facing it to guard. Guarding drains stamina.`, onStart: g => { g.dummy.mode = 'swing'; }, done: g => g.dummy.results.blocked >= 1, focus: true },
  { id: 'parry', title: 'Parry', html: `Raise your guard <em>just</em> as the swing lands to parry: the attacker staggers. Press ${KB('N', 'Select')} to skip.`, done: g => g.dummy.results.parried >= 1, skippable: true, focus: true },
  { id: 'roll', title: 'Roll', html: `Roll through a swing with ${KB('Shift', 'B')}. You cannot be hurt through the middle of the roll.`, done: g => g.dummy.results.dodged >= 1, focus: true },
  { id: 'stamina', title: 'Stamina', html: `Strikes, rolls and guarding spend the green bar. Let it refill; an empty bar breaks your guard. Rest a moment.`, done: g => g.player.stamina >= 99, onStart: g => { g.dummy.mode = 'idle'; } },
  { id: 'go', title: 'Set forth', html: `Well fought. The road climbs across the stepping stones ahead: reach the goblin camp. Shrines light as you pass and call you back if you fall.`, done: g => g.player.pos.z > 12 },
];

export class Tutorial {
  constructor(game) {
    this.game = game; this.index = -1; this.active = false; this.flashT = 0; this.stepT = 0;
    this.card = document.getElementById('objective');
    this.kicker = document.getElementById('obj-kicker'); this.title = document.getElementById('obj-title'); this.text = document.getElementById('obj-text'); this.check = document.getElementById('obj-check');
  }
  start() { this.active = true; this.index = -1; this.card.hidden = false; this.next(); }
  stop() { this.active = false; this.card.hidden = true; if (this.game.dummy) this.game.dummy.mode = 'idle'; }
  get step() { return STEPS[this.index]; }
  next() {
    this.index++; this.stepT = 0;
    if (this.index >= STEPS.length) { this.finish(); return; }
    const s = this.step; if (s.onStart) s.onStart(this.game);
    this.kicker.textContent = `TRAINING · ${this.index + 1} / ${STEPS.length}`; this.title.textContent = s.title; this.text.innerHTML = s.html;
    this.card.classList.remove('done'); this.card.classList.add('pop'); setTimeout(() => this.card.classList.remove('pop'), 260);
  }
  skip() { if (this.active && this.step && this.step.skippable) { this.game.sfx('ui'); this.complete(); } }
  complete() { this.card.classList.add('done'); this.game.sfx('gem'); this.flashT = 0.9; }
  finish() { this.active = false; this.game.hud.toast('TRAINING COMPLETE', 2.5); this.game.hud.hint('Hints stay on. Good luck, knight.', 4); setTimeout(() => { this.card.hidden = true; }, 1200); if (this.game.dummy) this.game.dummy.mode = 'idle'; }
  update(dt, input) {
    if (!this.active) return;
    this.stepT += dt;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.next(); return; }
    const s = this.step; if (!s) return;
    if (input.just('skip')) this.skip();
    if (s.done(this.game)) this.complete();
  }
}
