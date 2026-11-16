// Casino hub: tabs, shared wallet, history, ambience, shared helpers.
import { get, subscribe, adjust, fmt, timeAgo } from './state.js';
import { sfx, setAmbience, ambienceEnabled, syncAmbience } from './audio.js';

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Uniform integer in [0, n) via crypto with rejection sampling.
export function cryptoInt(n) {
  const range = 0x100000000;
  const limit = range - (range % n);
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

let toastTimer = 0;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2600);
}

export function renderWallet() {
  const s = get();
  document.getElementById('casino-wallet').textContent = fmt(s.wallet);
  document.getElementById('casino-bailout').hidden = s.wallet >= 25;
}

export function renderHistory() {
  const list = document.getElementById('casino-history');
  const h = get().casino.history;
  list.replaceChildren();
  if (!h.length) {
    const li = document.createElement('li');
    li.className = 'movelist-empty';
    li.textContent = 'No bets yet. The tables are waiting.';
    list.appendChild(li);
    return;
  }
  for (const b of h.slice(0, 12)) {
    const li = document.createElement('li');
    const net = b.payout - b.stake;
    li.className = net > 0 ? 'win' : net < 0 ? 'lose' : '';
    const left = document.createElement('span');
    left.textContent = `${b.game.toUpperCase()} · ${b.detail}`;
    const mid = document.createElement('span');
    mid.textContent = `bet ${fmt(b.stake)}`;
    const right = document.createElement('span');
    right.textContent = (net >= 0 ? '+' : '−') + fmt(Math.abs(net)) + ' · ' + timeAgo(b.t);
    li.append(left, mid, right);
    list.appendChild(li);
  }
}

// Bailout keeps the casino playable when broke.
document.getElementById('casino-bailout').addEventListener('click', () => {
  adjust(500, 'Casino starter coins');
  sfx.cash();
  toast('+500 starter coins. Spend them wisely.', 'win');
});

// Ambience toggle
const ambBtn = document.getElementById('ambience-toggle');
function renderAmbience() {
  ambBtn.setAttribute('aria-pressed', String(ambienceEnabled()));
  ambBtn.textContent = ambienceEnabled() ? 'AMBIENCE ON' : 'AMBIENCE OFF';
}
ambBtn.addEventListener('click', () => {
  sfx.unlock();
  setAmbience(!ambienceEnabled());
  renderAmbience();
});
renderAmbience();
document.addEventListener('pointerdown', () => syncAmbience(), { once: true });

// Tabs
const tabs = document.querySelectorAll('.casino-tabs [data-game]');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    sfx.click();
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.game-stage').forEach((st) => { st.hidden = st.id !== 'stage-' + tab.dataset.game; });
  });
});

subscribe(() => { renderWallet(); renderHistory(); });
renderWallet();
renderHistory();