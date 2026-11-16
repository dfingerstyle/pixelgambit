// Coin flip on the shared wallet. Fair 50/50, result decided before animation.
import { get, adjust, recordBet, fmt } from './state.js';
import { pieceImg } from './sprites.js';
import { sfx } from './audio.js';
import { cryptoInt, toast, reducedMotion } from './casino.js';

const coin = document.getElementById('coin');
const resultEl = document.getElementById('coin-result');
const streakEl = document.getElementById('coin-streak');
const betInput = document.getElementById('bet-input');
const flipBtn = document.getElementById('flip-btn-coin');
const historyEl = document.getElementById('flip-history');

let call = 'heads';
let flipping = false;
let rotation = 0;
let streak = 0;
let flips = [];

coin.querySelector('.coin-heads').appendChild(pieceImg('Q', 'w'));
coin.querySelector('.coin-tails').appendChild(pieceImg('N', 'b'));

function bet() {
  const v = Math.floor(Number(betInput.value) || 0);
  return Math.max(25, Math.min(v, Math.max(get().wallet, 25)));
}

function render() {
  flipBtn.disabled = flipping || get().wallet < 25;
  streakEl.textContent = streak > 1 ? `🔥 ${streak} WIN STREAK` : '';
  historyEl.replaceChildren();
  if (!flips.length) {
    const li = document.createElement('li');
    li.className = 'movelist-empty';
    li.textContent = 'The coin awaits its first victim.';
    historyEl.appendChild(li);
    return;
  }
  for (const f of flips.slice(0, 8)) {
    const li = document.createElement('li');
    li.className = f.won ? 'win' : 'lose';
    const left = document.createElement('span');
    left.textContent = `${f.result.toUpperCase()} · bet ${fmt(f.bet)}`;
    const right = document.createElement('span');
    right.textContent = (f.won ? '+' : '−') + fmt(f.bet);
    li.append(left, right);
    historyEl.appendChild(li);
  }
}

function flip() {
  sfx.unlock();
  if (flipping) return;
  const stake = Math.min(bet(), get().wallet);
  if (stake < 25) { toast('You need at least 25 coins.', 'lose'); return; }
  if (!adjust(-stake, 'Coin flip bet')) return;
  betInput.value = String(stake);
  flipping = true;
  render();
  resultEl.className = 'coin-result';
  resultEl.textContent = 'THE COIN IS IN THE AIR…';
  sfx.coinSpin();

  const result = cryptoInt(2) === 0 ? 'heads' : 'tails';
  const won = result === call;
  const targetMod = result === 'heads' ? 0 : 180;
  const currentMod = ((rotation % 360) + 360) % 360;
  rotation += (reducedMotion ? 360 : 1800) + ((targetMod - currentMod + 360) % 360);
  coin.classList.add('tossing');
  coin.style.transitionDuration = reducedMotion ? '0.3s' : '1.6s';
  coin.style.transform = `rotateY(${rotation}deg)`;

  setTimeout(() => {
    coin.classList.remove('tossing');
    const payout = won ? stake * 2 : 0;
    if (payout) adjust(payout, 'Coin flip win');
    recordBet('coinflip', stake, payout, `${result} · called ${call}`);
    streak = won ? streak + 1 : 0;
    flips.unshift({ result, bet: stake, won });
    flipping = false;
    resultEl.textContent = won ? `${result.toUpperCase()}! YOU WIN ${fmt(stake)}` : `${result.toUpperCase()}. YOU LOSE ${fmt(stake)}`;
    resultEl.classList.add(won ? 'win' : 'lose');
    if (won) { sfx.coinWin(); if (streak >= 3) toast(`🔥 ${streak} in a row!`, 'win'); }
    else sfx.coinLose();
    render();
  }, reducedMotion ? 350 : 1650);
}

flipBtn.addEventListener('click', flip);
document.getElementById('bet-minus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.max(25, bet() - 25)); });
document.getElementById('bet-plus').addEventListener('click', () => { sfx.click(); betInput.value = String(Math.min(Math.max(get().wallet, 25), bet() + 25)); });
betInput.addEventListener('change', () => { betInput.value = String(bet()); });
document.getElementById('coin-presets').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-bet]');
  if (!btn) return;
  sfx.click();
  if (flipping) return;
  const choice = btn.dataset.bet;
  const value = choice === 'max' ? get().wallet : choice === 'half' ? bet() / 2 : choice === 'double' ? bet() * 2 : choice === 'repeat' ? flips[0]?.bet || bet() : Number(choice);
  betInput.value = String(Math.max(25, Math.min(Math.floor(value), Math.max(get().wallet, 25))));
});
document.getElementById('call-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-call]');
  if (!btn) return;
  sfx.click();
  if (flipping) return;
  call = btn.dataset.call;
  for (const b of btn.parentElement.children) b.classList.toggle('active', b === btn);
});

render();