// European roulette: result first, animation second. Full bet layout.
import { get, adjust, recordBet, fmt } from './state.js';
import { sfx } from './audio.js';
import { cryptoInt, toast, reducedMotion } from './casino.js';

export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG = 360 / 37;

export function pocketColor(n) { return n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black'; }

export function buildWheel(wheelEl, numbersEl) {
  const stops = WHEEL_ORDER.map((n, i) => {
    const c = n === 0 ? '#1d7a4f' : REDS.has(n) ? '#b32340' : '#1c1626';
    return `${c} ${i * SEG}deg ${(i + 1) * SEG}deg`;
  });
  wheelEl.style.background = `conic-gradient(from 0deg, ${stops.join(',')})`;
  numbersEl.replaceChildren();
  WHEEL_ORDER.forEach((n, i) => {
    const span = document.createElement('span');
    span.textContent = String(n);
    span.style.transform = `rotate(${i * SEG + SEG / 2}deg) translateY(calc(var(--wheel-r) * -1))`;
    numbersEl.appendChild(span);
  });
}

// Spin so the result pocket lands under the top pointer; ball counter-spins and settles at top.
export function spinWheel(wheelEl, ballTrackEl, result, duration = 4600) {
  return new Promise((resolve) => {
    const idx = WHEEL_ORDER.indexOf(result);
    const targetMod = ((-(idx * SEG + SEG / 2)) % 360 + 360) % 360;
    const wheelNow = parseFloat(wheelEl.dataset.rot || '0');
    const wheelMod = ((wheelNow % 360) + 360) % 360;
    const wheelTarget = wheelNow + 360 * 5 + ((targetMod - wheelMod + 360) % 360);
    const ballNow = parseFloat(ballTrackEl.dataset.rot || '0');
    const ballTarget = ballNow - 360 * 8 - (((ballNow % 360) + 360) % 360); // ends at 0 mod 360 = top

    if (reducedMotion) duration = 400;
    wheelEl.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.8, 0.18, 1)`;
    ballTrackEl.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.2, 1)`;
    wheelEl.style.transform = `rotate(${wheelTarget}deg)`;
    ballTrackEl.style.transform = `rotate(${ballTarget}deg)`;
    wheelEl.dataset.rot = String(wheelTarget);
    ballTrackEl.dataset.rot = String(ballTarget);

    let ticks = 0;
    const tickTimer = reducedMotion ? 0 : setInterval(() => {
      ticks++;
      if (ticks * 130 < duration * 0.8) sfx.tick();
      else clearInterval(tickTimer);
    }, 130);

    setTimeout(() => { clearInterval(tickTimer); resolve(); }, duration + 60);
  });
}

// ---------- bet table ----------
const bets = new Map();
let lastBets = null;
let chip = 100;
let spinning = false;
const recent = [];

const tableEl = document.getElementById('bet-table');
const totalEl = document.getElementById('bet-total');
const spinBtn = document.getElementById('spin-btn');
const resultEl = document.getElementById('roulette-result');

const OUTSIDE = [
  ['low', '1–18'], ['even', 'EVEN'], ['red', '◆ RED'], ['black', '◆ BLACK'], ['odd', 'ODD'], ['high', '19–36'],
];

function betWins(key, r) {
  if (key.startsWith('n:')) return Number(key.slice(2)) === r;
  if (r === 0) return false;
  switch (key) {
    case 'red': return REDS.has(r);
    case 'black': return !REDS.has(r);
    case 'odd': return r % 2 === 1;
    case 'even': return r % 2 === 0;
    case 'low': return r <= 18;
    case 'high': return r >= 19;
    case 'd1': return r <= 12;
    case 'd2': return r >= 13 && r <= 24;
    case 'd3': return r >= 25;
    case 'c1': return r % 3 === 1;
    case 'c2': return r % 3 === 2;
    case 'c3': return r % 3 === 0;
    default: return false;
  }
}
function betMultiple(key) { return key.startsWith('n:') ? 36 : key.startsWith('d') || key.startsWith('c') ? 3 : 2; }

function totalBet() { let t = 0; for (const v of bets.values()) t += v; return t; }

function renderBets() {
  totalEl.textContent = fmt(totalBet());
  tableEl.querySelectorAll('[data-bet]').forEach((cell) => {
    const amt = bets.get(cell.dataset.bet) || 0;
    let badge = cell.querySelector('.chip-badge');
    if (amt > 0) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'chip-badge'; cell.appendChild(badge); }
      badge.textContent = fmt(amt);
    } else if (badge) badge.remove();
  });
  spinBtn.disabled = spinning || totalBet() === 0;
}

function placeBet(key, amount) {
  if (spinning) return;
  if (totalBet() + amount > get().wallet) { sfx.error(); toast('Not enough coins for that chip.', 'lose'); return; }
  bets.set(key, (bets.get(key) || 0) + amount);
  sfx.chip();
  renderBets();
}

function buildTable() {
  tableEl.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'bet-grid';
  const zero = document.createElement('button');
  zero.className = 'bet-cell zero';
  zero.dataset.bet = 'n:0';
  zero.textContent = '0';
  grid.appendChild(zero);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const n = col * 3 + (3 - row);
      const cell = document.createElement('button');
      cell.className = 'bet-cell num ' + pocketColor(n);
      cell.dataset.bet = 'n:' + n;
      cell.textContent = String(n);
      grid.appendChild(cell);
    }
    const colBet = document.createElement('button');
    colBet.className = 'bet-cell outside col-bet';
    colBet.dataset.bet = 'c' + (3 - row);
    colBet.textContent = '2:1';
    grid.appendChild(colBet);
  }
  tableEl.appendChild(grid);

  const dozens = document.createElement('div');
  dozens.className = 'bet-dozens';
  [['d1', '1st 12'], ['d2', '2nd 12'], ['d3', '3rd 12']].forEach(([k, label]) => {
    const b = document.createElement('button');
    b.className = 'bet-cell outside';
    b.dataset.bet = k;
    b.textContent = label;
    dozens.appendChild(b);
  });
  tableEl.appendChild(dozens);

  const outside = document.createElement('div');
  outside.className = 'bet-outside';
  OUTSIDE.forEach(([k, label]) => {
    const b = document.createElement('button');
    b.className = 'bet-cell outside ' + (k === 'red' ? 'red-bet' : k === 'black' ? 'black-bet' : '');
    b.dataset.bet = k;
    b.textContent = label;
    outside.appendChild(b);
  });
  tableEl.appendChild(outside);

  tableEl.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-bet]');
    if (cell) placeBet(cell.dataset.bet, chip);
  });
  tableEl.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest('[data-bet]');
    if (!cell || spinning) return;
    e.preventDefault();
    const key = cell.dataset.bet;
    const cur = bets.get(key) || 0;
    if (cur > 0) {
      const next = cur - chip;
      if (next > 0) bets.set(key, next); else bets.delete(key);
      sfx.click();
      renderBets();
    }
  });
}

function renderRecent() {
  const el = document.getElementById('roulette-history');
  el.replaceChildren();
  for (const n of recent.slice(0, 12)) {
    const s = document.createElement('span');
    s.className = 'hist-num ' + pocketColor(n);
    s.textContent = String(n);
    el.appendChild(s);
  }
}

async function spin() {
  const total = totalBet();
  if (spinning || total === 0) return;
  if (!adjust(-total, 'Roulette bet')) { sfx.error(); toast('Not enough coins.', 'lose'); return; }
  spinning = true;
  spinBtn.disabled = true;
  tableEl.classList.add('locked');
  resultEl.className = 'stage-result';
  resultEl.textContent = 'NO MORE BETS…';
  lastBets = new Map(bets);

  const result = cryptoInt(37); // authoritative result, decided before any animation
  await spinWheel(document.getElementById('wheel'), document.getElementById('ball-track'), result);

  let payout = 0;
  const winners = [];
  for (const [key, amt] of bets) {
    if (betWins(key, result)) { payout += amt * betMultiple(key); winners.push(key); }
  }
  if (payout > 0) adjust(payout, 'Roulette payout');
  recordBet('roulette', total, payout, `#${result} ${pocketColor(result)}`);

  recent.unshift(result);
  renderRecent();
  tableEl.querySelectorAll('[data-bet]').forEach((c) => c.classList.toggle('hit', winners.includes(c.dataset.bet)));
  const color = pocketColor(result);
  resultEl.textContent = `${result} ${color.toUpperCase()} · ${payout > 0 ? 'PAID ' + fmt(payout) + ' ◉' : 'HOUSE TAKES ' + fmt(total)}`;
  resultEl.classList.add(payout > 0 ? 'win' : 'lose');
  if (payout >= total * 10 && payout > 0) { sfx.bigWin(); toast(`BIG WIN · ${fmt(payout)} coins!`, 'win'); }
  else if (payout > 0) sfx.cash();
  else sfx.lose();

  bets.clear();
  spinning = false;
  tableEl.classList.remove('locked');
  renderBets();
  setTimeout(() => tableEl.querySelectorAll('.hit').forEach((c) => c.classList.remove('hit')), 2600);
}

document.getElementById('chip-row').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chip]');
  if (!b) return;
  chip = Number(b.dataset.chip);
  sfx.chip();
  document.querySelectorAll('#chip-row .chip').forEach((c) => c.classList.toggle('active', c === b));
});
document.getElementById('clear-bets').addEventListener('click', () => { if (!spinning) { bets.clear(); sfx.click(); renderBets(); } });
document.getElementById('rebet').addEventListener('click', () => {
  if (spinning || !lastBets) return;
  const total = [...lastBets.values()].reduce((a, b) => a + b, 0);
  if (total > get().wallet) { sfx.error(); toast('Not enough coins to rebet.', 'lose'); return; }
  bets.clear();
  for (const [k, v] of lastBets) bets.set(k, v);
  sfx.chip();
  renderBets();
});
spinBtn.addEventListener('click', spin);

buildWheel(document.getElementById('wheel'), document.getElementById('wheel-numbers'));
buildTable();
renderBets();