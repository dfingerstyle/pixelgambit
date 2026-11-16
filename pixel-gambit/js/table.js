// Local pass-and-play roulette table: up to 4 seats, shared wheel, per-seat balances, chat, spectating.
import { get, update, adjust, recordBet, fmt } from './state.js';
import { sfx } from './audio.js';
import { cryptoInt, toast } from './casino.js';
import { buildWheel, spinWheel, pocketColor, REDS } from './roulette.js';

const seatsRow = document.getElementById('seats-row');
const betsEl = document.getElementById('table-bets');
const resultEl = document.getElementById('table-result');
const spinBtn = document.getElementById('table-spin');
const chatLog = document.getElementById('chat-log');
const chatSeat = document.getElementById('chat-seat');
const chatInput = document.getElementById('chat-input');

const QUICK = [
  ['red', '◆ RED'], ['black', '◆ BLACK'], ['odd', 'ODD'], ['even', 'EVEN'],
  ['low', '1–18'], ['high', '19–36'], ['d1', '1st 12'], ['d2', '2nd 12'], ['d3', '3rd 12'],
];
let activeSeat = 0;
let chip = 100;
let spinning = false;
const seatBets = new Map(); // seatIdx -> Map(key -> amount)

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
    default: return false;
  }
}
const multiple = (key) => key.startsWith('n:') ? 36 : key.startsWith('d') ? 3 : 2;
const seatTotal = (i) => [...(seatBets.get(i)?.values() || [])].reduce((a, b) => a + b, 0);
const seatBalance = (i) => i === 0 ? get().wallet : get().seats[i].balance;

function chatMsg(name, text, system = false) {
  update((s) => {
    s.tableChat.push({ t: Date.now(), name, text, system });
    if (s.tableChat.length > 60) s.tableChat.splice(0, s.tableChat.length - 60);
  });
}

function renderChat() {
  const log = get().tableChat;
  chatLog.replaceChildren();
  for (const m of log.slice(-30)) {
    const li = document.createElement('li');
    li.className = m.system ? 'system' : '';
    const who = document.createElement('strong');
    who.textContent = m.name;
    const txt = document.createElement('span');
    txt.textContent = m.text;
    li.append(who, txt);
    chatLog.appendChild(li);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
  chatSeat.replaceChildren();
  get().seats.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = s.name;
    chatSeat.appendChild(o);
  });
}

function renderSeats() {
  const seats = get().seats;
  seatsRow.replaceChildren();
  seats.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'seat-card' + (i === activeSeat ? ' active' : '');
    const name = document.createElement('input');
    name.className = 'seat-name';
    name.value = s.name;
    name.maxLength = 14;
    name.disabled = i === 0;
    name.setAttribute('aria-label', 'Seat ' + (i + 1) + ' name');
    name.addEventListener('change', () => {
      update((st) => { st.seats[i].name = name.value.trim() || 'Player ' + (i + 1); });
      renderChat();
    });
    const bal = document.createElement('strong');
    bal.className = 'seat-balance';
    bal.textContent = fmt(seatBalance(i)) + ' ◉';
    const betInfo = document.createElement('span');
    betInfo.className = 'seat-bet';
    betInfo.textContent = 'bet ' + fmt(seatTotal(i));
    card.append(name, bal, betInfo);
    card.addEventListener('click', (e) => {
      if (e.target === name) return;
      activeSeat = i;
      sfx.click();
      renderSeats();
      renderBetPanel();
    });
    if (i > 0) {
      const rm = document.createElement('button');
      rm.className = 'seat-remove';
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove seat');
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        if (spinning) return;
        seatBets.delete(i);
        update((st) => { st.seats.splice(i, 1); });
        if (activeSeat >= get().seats.length) activeSeat = 0;
        renderSeats();
        renderBetPanel();
        renderChat();
      });
      card.appendChild(rm);
    }
    seatsRow.appendChild(card);
  });
  document.getElementById('add-seat').disabled = seats.length >= 4 || spinning;
}

function renderBetPanel() {
  betsEl.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'table-bet-panel';
  const label = document.createElement('p');
  label.className = 'betting-as';
  label.innerHTML = `BETTING AS <strong></strong>`;
  label.querySelector('strong').textContent = get().seats[activeSeat].name;
  panel.appendChild(label);

  const chips = document.createElement('div');
  chips.className = 'chip-row';
  [25, 100, 250, 1000].forEach((v) => {
    const b = document.createElement('button');
    b.className = 'chip c' + v + (v === chip ? ' active' : '');
    b.textContent = v >= 1000 ? '1K' : String(v);
    b.addEventListener('click', () => { chip = v; sfx.chip(); renderBetPanel(); });
    chips.appendChild(b);
  });
  panel.appendChild(chips);

  const quick = document.createElement('div');
  quick.className = 'quick-bets';
  QUICK.forEach(([key, labelText]) => {
    const b = document.createElement('button');
    b.className = 'bet-cell outside' + (key === 'red' ? ' red-bet' : key === 'black' ? ' black-bet' : '');
    const amt = seatBets.get(activeSeat)?.get(key) || 0;
    b.textContent = labelText + (amt ? ` · ${fmt(amt)}` : '');
    b.addEventListener('click', () => addBet(key));
    quick.appendChild(b);
  });
  const numWrap = document.createElement('div');
  numWrap.className = 'quick-number';
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Straight number');
  for (let n = 0; n <= 36; n++) {
    const o = document.createElement('option');
    o.value = 'n:' + n;
    o.textContent = 'Straight ' + n;
    sel.appendChild(o);
  }
  const addNum = document.createElement('button');
  addNum.className = 'btn btn-small';
  addNum.textContent = '+ NUMBER';
  addNum.addEventListener('click', () => addBet(sel.value));
  numWrap.append(sel, addNum);
  quick.appendChild(numWrap);
  panel.appendChild(quick);

  const current = seatBets.get(activeSeat);
  if (current?.size) {
    const summary = document.createElement('p');
    summary.className = 'eco-note';
    summary.textContent = [...current.entries()].map(([k, v]) => `${k.replace('n:', '#')} ×${fmt(v)}`).join(' · ');
    panel.appendChild(summary);
  }
  betsEl.appendChild(panel);
}

function addBet(key) {
  if (spinning) return;
  const bal = seatBalance(activeSeat);
  if (seatTotal(activeSeat) + chip > bal) { sfx.error(); toast('That seat cannot cover the chip.', 'lose'); return; }
  if (!seatBets.has(activeSeat)) seatBets.set(activeSeat, new Map());
  const m = seatBets.get(activeSeat);
  m.set(key, (m.get(key) || 0) + chip);
  sfx.chip();
  renderSeats();
  renderBetPanel();
}

async function spin(spectate = false) {
  if (spinning) return;
  const seats = get().seats;
  const totals = seats.map((_, i) => seatTotal(i));
  const grand = totals.reduce((a, b) => a + b, 0);
  if (!spectate && grand === 0) { toast('Place at least one bet first.', 'lose'); return; }
  for (let i = 0; i < seats.length; i++) {
    if (totals[i] > seatBalance(i)) { sfx.error(); toast(`${seats[i].name} can't cover their bets.`, 'lose'); return; }
  }
  spinning = true;
  spinBtn.disabled = true;
  resultEl.className = 'stage-result';
  resultEl.textContent = spectate ? 'SPECTATING · NO STAKES' : 'NO MORE BETS…';

  // reserve all stakes before the wheel moves
  if (!spectate) {
    if (totals[0] > 0) adjust(-totals[0], 'Table roulette bet');
    update((s) => { for (let i = 1; i < seats.length; i++) s.seats[i].balance -= totals[i]; });
  }

  const result = cryptoInt(37);
  await spinWheel(document.getElementById('table-wheel'), document.getElementById('table-ball-track'), result, 4200);

  let anyWin = false;
  if (!spectate) {
    const lines = [];
    for (let i = 0; i < seats.length; i++) {
      const m = seatBets.get(i);
      if (!m || totals[i] === 0) continue;
      let payout = 0;
      for (const [key, amt] of m) if (betWins(key, result)) payout += amt * multiple(key);
      if (i === 0) {
        if (payout > 0) adjust(payout, 'Table roulette payout');
        recordBet('table', totals[0], payout, `#${result} ${pocketColor(result)}`);
      } else if (payout > 0) {
        update((s) => { s.seats[i].balance += payout; });
      }
      const net = payout - totals[i];
      if (net > 0) anyWin = true;
      lines.push(`${seats[i].name} ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`);
    }
    chatMsg('TABLE', `#${result} ${pocketColor(result)} · ${lines.join(' · ') || 'no bets'}`, true);
  } else {
    chatMsg('TABLE', `Spectated round: #${result} ${pocketColor(result)}`, true);
  }

  resultEl.textContent = `#${result} ${pocketColor(result).toUpperCase()}${spectate ? ' · SPECTATED' : anyWin ? ' · WINNERS PAID' : ' · HOUSE SWEEPS'}`;
  resultEl.classList.add(anyWin ? 'win' : 'lose');
  if (anyWin) sfx.bigWin(); else sfx.reelStop();
  seatBets.clear();
  spinning = false;
  spinBtn.disabled = false;
  renderSeats();
  renderBetPanel();
}

document.getElementById('add-seat').addEventListener('click', () => {
  if (get().seats.length >= 4) return;
  sfx.click();
  update((s) => { s.seats.push({ name: 'Player ' + (s.seats.length + 1), balance: 1000 }); });
  chatMsg('TABLE', `${get().seats[get().seats.length - 1].name} joined the table.`, true);
  renderSeats();
  renderBetPanel();
});
document.getElementById('table-clear').addEventListener('click', () => { if (!spinning) { seatBets.clear(); sfx.click(); renderSeats(); renderBetPanel(); } });
document.getElementById('table-spin').addEventListener('click', () => spin(false));
document.getElementById('spectate-btn').addEventListener('click', () => spin(true));
document.getElementById('chat-send').addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  const seat = get().seats[Number(chatSeat.value) || 0];
  chatMsg(seat.name, text);
  chatInput.value = '';
  sfx.click();
}

import { subscribe } from './state.js';
subscribe(() => { renderSeats(); renderChat(); });

buildWheel(document.getElementById('table-wheel'), document.getElementById('table-wheel-numbers'));
renderSeats();
renderBetPanel();
renderChat();