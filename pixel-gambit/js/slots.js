// Three-reel slots. Weighted crypto-random stops; reels animate to the decided result.
import { get, adjust, recordBet, fmt } from './state.js';
import { sfx } from './audio.js';
import { cryptoInt, toast, reducedMotion } from './casino.js';

const SYMBOLS = ['7', '♛', '♞', '◉', '★', '♦'];
const WEIGHTS = [1, 2, 3, 4, 5, 6];
const TOTAL_W = WEIGHTS.reduce((a, b) => a + b, 0);
const TRIPLE_PAY = { 7: 50, '♛': 20, '♞': 10, '◉': 6, '★': 4, '♦': 3 };
const PAIR_PAY = 1.5;
const CELL = 96;
const SPIN_CELLS = 24;

const resultEl = document.getElementById('slots-result');
const betInput = document.getElementById('slots-bet');
const spinBtn = document.getElementById('slots-spin');
const strips = [0, 1, 2].map((i) => document.querySelector(`#reel-${i} .reel-strip`));
let spinning = false;

function weightedSymbol() {
  let r = cryptoInt(TOTAL_W);
  for (let i = 0; i < SYMBOLS.length; i++) {
    if (r < WEIGHTS[i]) return SYMBOLS[i];
    r -= WEIGHTS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function fillStrip(strip, finalSymbol) {
  strip.replaceChildren();
  for (let i = 0; i < SPIN_CELLS; i++) {
    const sym = i === SPIN_CELLS - 1 ? finalSymbol : weightedSymbol();
    const cell = document.createElement('div');
    cell.className = 'slot-cell sym-' + SYMBOLS.indexOf(sym);
    cell.textContent = sym;
    strip.appendChild(cell);
  }
}

function bet() {
  const v = Math.floor(Number(betInput.value) || 0);
  return Math.max(25, Math.min(v, Math.max(get().wallet, 25)));
}

function payoutFor(result, stake) {
  const [a, b, c] = result;
  if (a === b && b === c) return Math.round(stake * TRIPLE_PAY[a]);
  if (a === b || b === c || a === c) return Math.round(stake * PAIR_PAY);
  return 0;
}

function spin() {
  sfx.unlock();
  if (spinning) return;
  const stake = Math.min(bet(), get().wallet);
  if (stake < 25) { toast('You need at least 25 coins.', 'lose'); return; }
  if (!adjust(-stake, 'Slots spin')) return;
  betInput.value = String(stake);
  spinning = true;
  spinBtn.disabled = true;
  resultEl.className = 'stage-result';
  resultEl.textContent = 'REELS SPINNING…';

  const result = [weightedSymbol(), weightedSymbol(), weightedSymbol()];
  const durations = reducedMotion ? [200, 250, 300] : [1200, 1800, 2400];
  const cellH = strips[0].firstChild?.offsetHeight || CELL;

  strips.forEach((strip, i) => {
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    fillStrip(strip, result[i]);
    void strip.offsetHeight; // restart transition
    strip.style.transition = `transform ${durations[i]}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
    strip.style.transform = `translateY(-${(SPIN_CELLS - 1) * cellH}px)`;
    setTimeout(() => sfx.reelStop(), durations[i]);
  });

  setTimeout(() => {
    const payout = payoutFor(result, stake);
    if (payout) adjust(payout, 'Slots payout');
    recordBet('slots', stake, payout, result.join(' '));
    resultEl.textContent = `${result.join(' ')} · ${payout > 0 ? 'PAID ' + fmt(payout) + ' ◉' : 'NO MATCH'}`;
    resultEl.classList.add(payout > 0 ? 'win' : 'lose');
    if (payout >= stake * 20) { sfx.bigWin(); toast(`★ JACKPOT · ${fmt(payout)} coins!`, 'win'); }
    else if (payout > 0) sfx.cash();
    else sfx.lose();
    spinning = false;
    spinBtn.disabled = false;
  }, durations[2] + 100);
}

spinBtn.addEventListener('click', spin);
document.getElementById('slots-bet-minus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.max(25, bet() - 25)); });
document.getElementById('slots-bet-plus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.min(Math.max(get().wallet, 25), bet() + 25)); });
betInput.addEventListener('change', () => { betInput.value = String(bet()); });

strips.forEach((strip) => fillStrip(strip, weightedSymbol()));