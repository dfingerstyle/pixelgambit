// Dice: one fair d6, four bet families, dynamic risk/payout. Result before animation.
import { get, adjust, recordBet, fmt } from './state.js';
import { sfx } from './audio.js';
import { cryptoInt, toast, reducedMotion } from './casino.js';

const die = document.getElementById('die');
const resultEl = document.getElementById('dice-result');
const betInput = document.getElementById('dice-bet');
const rollBtn = document.getElementById('roll-btn');
const targetInput = document.getElementById('dice-target');
const targetLabel = document.getElementById('dice-target-label');
const chanceEl = document.getElementById('dice-chance');
const payoutEl = document.getElementById('dice-payout');
const targetField = document.getElementById('dice-target-field');
const parityField = document.getElementById('dice-parity-field');

let type = 'over';
let parity = 'odd';
let rolling = false;

// pip layouts on a 3x3 grid (indices 0..8)
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
die.querySelectorAll('.die-face').forEach((face, i) => {
  const v = i + 1;
  for (let c = 0; c < 9; c++) {
    const pip = document.createElement('i');
    if (PIPS[v].includes(c)) pip.className = 'pip';
    face.appendChild(pip);
  }
});

// cube orientation that brings face v to the front
const FACE_ROT = { 1: [0, 0], 2: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [90, 0] };

function target() { return Number(targetInput.value); }

function winCount() {
  const t = target();
  if (type === 'over') return 6 - t;
  if (type === 'under') return t - 1;
  if (type === 'exact') return 1;
  return 3;
}
function multiplier() {
  if (type === 'parity') return 1.9;
  return Math.round((6 / winCount()) * 0.95 * 100) / 100;
}
function wins(roll) {
  const t = target();
  if (type === 'over') return roll > t;
  if (type === 'under') return roll < t;
  if (type === 'exact') return roll === t;
  return (roll % 2 === 1) === (parity === 'odd');
}

function renderOdds() {
  const t = target();
  targetLabel.textContent = type === 'over' ? `roll over ${t}` : type === 'under' ? `roll under ${t}` : `roll exactly ${t}`;
  chanceEl.textContent = ((winCount() / 6) * 100).toFixed(1) + '%';
  payoutEl.textContent = 'pays ' + multiplier().toFixed(2) + '×';
  targetField.hidden = type === 'parity';
  parityField.hidden = type !== 'parity';
  targetInput.min = type === 'exact' ? '1' : '1';
  targetInput.max = type === 'exact' ? '6' : '5';
  if (type !== 'exact' && t > 5) targetInput.value = '5';
  if (type === 'under' && t < 2) targetInput.value = '2';
}

function bet() {
  const v = Math.floor(Number(betInput.value) || 0);
  return Math.max(25, Math.min(v, Math.max(get().wallet, 25)));
}

function roll() {
  sfx.unlock();
  if (rolling) return;
  const stake = Math.min(bet(), get().wallet);
  if (stake < 25) { toast('You need at least 25 coins.', 'lose'); return; }
  if (!adjust(-stake, 'Dice bet')) return;
  betInput.value = String(stake);
  rolling = true;
  rollBtn.disabled = true;
  resultEl.className = 'stage-result';
  resultEl.textContent = 'THE DIE IS TUMBLING…';
  sfx.dice();

  const roll = cryptoInt(6) + 1;
  const [fx, fy] = FACE_ROT[roll];
  const spins = reducedMotion ? 0 : 3;
  const rx = fx + 360 * spins;
  const ry = fy + 360 * (spins + 1);
  die.style.transitionDuration = reducedMotion ? '0.3s' : '1.5s';
  die.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

  setTimeout(() => {
    const won = wins(roll);
    const payout = won ? Math.round(stake * multiplier()) : 0;
    if (payout) adjust(payout, 'Dice win');
    const desc = type === 'parity' ? `${parity} · rolled ${roll}` : `${type} ${target()} · rolled ${roll}`;
    recordBet('dice', stake, payout, desc);
    resultEl.textContent = won ? `ROLLED ${roll} · YOU WIN ${fmt(payout - stake)}` : `ROLLED ${roll} · YOU LOSE ${fmt(stake)}`;
    resultEl.classList.add(won ? 'win' : 'lose');
    if (won) sfx.cash(); else sfx.lose();
    rolling = false;
    rollBtn.disabled = false;
  }, reducedMotion ? 350 : 1550);
}

document.getElementById('dice-type-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dtype]');
  if (!b) return;
  sfx.click();
  type = b.dataset.dtype;
  for (const x of b.parentElement.children) x.classList.toggle('active', x === b);
  renderOdds();
});
document.getElementById('dice-parity-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-parity]');
  if (!b) return;
  sfx.click();
  parity = b.dataset.parity;
  for (const x of b.parentElement.children) x.classList.toggle('active', x === b);
});
targetInput.addEventListener('input', renderOdds);
rollBtn.addEventListener('click', roll);
document.getElementById('dice-bet-minus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.max(25, bet() - 25)); });
document.getElementById('dice-bet-plus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.min(Math.max(get().wallet, 25), bet() + 25)); });
betInput.addEventListener('change', () => { betInput.value = String(bet()); });

renderOdds();