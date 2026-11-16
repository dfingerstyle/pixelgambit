import { stockfishMove } from './stockfish.js';
import { START_FEN, parseFen, toFen, legalMoves, makeMove, statusOf, moveNotation, sqName, colorOf, kingSquare } from './chess.js';
import { pieceImg, pieceSprite } from './sprites.js';
import { sfx } from './audio.js';
import { addXp, update } from './state.js';
import { playFinisher } from './cosmetics.js';

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('game-status');
const movelistEl = document.getElementById('movelist');
const promoOverlay = document.getElementById('promo-overlay');
const promoChoices = document.getElementById('promo-choices');
const endOverlay = document.getElementById('end-overlay');
const topPlayer = document.getElementById('top-player');
const bottomPlayer = document.getElementById('bottom-player');
const capturedTop = document.getElementById('captured-top');
const capturedBottom = document.getElementById('captured-bottom');
const difficultyField = document.getElementById('difficulty-field');
const difficultyEl = document.getElementById('difficulty');
const timeControlEl = document.getElementById('time-control');
const clockTopEl = document.getElementById('clock-top');
const clockBottomEl = document.getElementById('clock-bottom');

let state, history, notations, positionKeys, selected, legalCache, flipped, mode, pendingPromo, cpuTimer, gameOver;
let resultRecorded = false;
function recordResult(kind, winner) {
  if (resultRecorded) return;
  resultRecorded = true;
  update(s => { s.chessHistory.unshift({ t: Date.now(), mode, kind, winner: winner || null }); s.chessHistory = s.chessHistory.slice(0, 30); });
}
let clockBase = 0, clocks = { w: 0, b: 0 }, clockTimer = 0;

function fmtClock(s) {
  if (clockBase === 0) return '∞';
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderClocks() {
  const topSide = flipped ? 'w' : 'b';
  const bottomSide = flipped ? 'b' : 'w';
  clockTopEl.textContent = fmtClock(clocks[topSide]);
  clockBottomEl.textContent = fmtClock(clocks[bottomSide]);
  clockTopEl.classList.toggle('low', clockBase > 0 && clocks[topSide] <= 15);
  clockBottomEl.classList.toggle('low', clockBase > 0 && clocks[bottomSide] <= 15);
  clockTopEl.classList.toggle('running', !gameOver && history.length > 0 && state.turn === topSide);
  clockBottomEl.classList.toggle('running', !gameOver && history.length > 0 && state.turn === bottomSide);
}

function startClockLoop() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (gameOver || clockBase === 0 || history.length === 0 || pendingPromo) return;
    clocks[state.turn] -= 0.5;
    if (clocks[state.turn] <= 0) {
      clocks[state.turn] = 0;
      gameOver = true;
      recordResult('timeout', state.turn === 'w' ? 'b' : 'w');
      clearTimeout(cpuTimer);
      sfx.lose();
      const winner = state.turn === 'w' ? 'BLACK' : 'WHITE';
      document.getElementById('end-kicker').textContent = 'FLAG FALL';
      document.getElementById('end-title').textContent = 'TIMEOUT';
      document.getElementById('end-sub').textContent = `${winner} wins on time.`;
      endOverlay.hidden = false;
    }
    renderClocks();
  }, 500);
}

function resetClocks() {
  clockBase = Number(timeControlEl.value);
  clocks = { w: clockBase, b: clockBase };
  renderClocks();
}

function freshGame() {
  resultRecorded = false;
  clearTimeout(cpuTimer);
  state = parseFen(START_FEN);
  history = [];
  notations = [];
  positionKeys = new Map([[toFen(state).split(' ').slice(0, 4).join(' '), 1]]);
  selected = null;
  lastMoveRecord = null;
  legalCache = legalMoves(state);
  pendingPromo = null;
  gameOver = false;
  promoOverlay.hidden = true;
  endOverlay.hidden = true;
  resetClocks();
  render();
}

function posKey(s) { return toFen(s).split(' ').slice(0, 4).join(' '); }

function pushState(next, notation) {
  history.push({ state, notation });
  notations.push(notation);
  state = next;
  const key = posKey(state);
  positionKeys.set(key, (positionKeys.get(key) || 0) + 1);
  legalCache = legalMoves(state);
}

function currentStatus() {
  return statusOf(state, positionKeys.get(posKey(state)) || 1);
}

let lastMoveRecord = null;

function applyMove(m) {
  lastMoveRecord = m;
  const notation = moveNotation(state, m, legalCache);
  const wasCapture = Boolean(m.captured);
  pushState(makeMove(state, m), notation);
  selected = null;
  pendingPromo = null;
  promoOverlay.hidden = true;
  const st = currentStatus();
  if (st.over) {
    gameOver = true;
    recordResult(st.kind, st.winner);
    if (st.kind === 'checkmate') playFinisher();
    if (st.kind === 'checkmate') {
      (st.winner === 'w' ? sfx.win : sfx.lose)();
      if (mode === 'cpu' && st.winner === 'w') addXp(20);
    }
    else sfx.draw();
    showEnd(st);
  } else if (st.check) sfx.check();
  else if (wasCapture) sfx.capture();
  else sfx.move();
  render();
  if (!gameOver && mode === 'cpu' && state.turn === 'b') scheduleCpu();
}

function scheduleCpu() {
  clearTimeout(cpuTimer);
  const position = state;
  cpuTimer = setTimeout(async () => {
    if (gameOver || mode !== 'cpu' || state.turn !== 'b' || state !== position) return;
    try {
      const m = await stockfishMove(position, legalCache, difficultyEl.value);
      if (!gameOver && mode === 'cpu' && state === position) applyMove(m);
    } catch (error) {
      if (state === position && !gameOver) statusEl.textContent = error.message + ' Start a new game to retry.';
    }
  }, 200);
}

function onSquareClick(sq) {
  sfx.unlock();
  if (gameOver || pendingPromo) return;
  if (mode === 'cpu' && state.turn === 'b') return;
  const piece = state.board[sq];
  if (selected != null) {
    const candidates = legalCache.filter((m) => m.from === selected && m.to === sq);
    if (candidates.length) {
      if (candidates[0].promotion) { openPromotion(candidates); return; }
      applyMove(candidates[0]);
      return;
    }
  }
  if (piece && colorOf(piece) === state.turn) {
    selected = selected === sq ? null : sq;
    if (selected != null) sfx.select();
  } else selected = null;
  render();
}

function openPromotion(candidates) {
  pendingPromo = candidates;
  promoChoices.replaceChildren();
  for (const m of candidates) {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Promote to ' + m.promotion.toUpperCase());
    btn.appendChild(pieceImg(m.promotion, state.turn));
    btn.addEventListener('click', () => { sfx.click(); applyMove(m); });
    promoChoices.appendChild(btn);
  }
  promoOverlay.hidden = false;
}

function showEnd(st) {
  const kicker = document.getElementById('end-kicker');
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  if (st.kind === 'checkmate') {
    kicker.textContent = 'GAME OVER';
    title.textContent = 'CHECKMATE';
    const winner = st.winner === 'w' ? 'WHITE' : 'BLACK';
    sub.textContent = mode === 'cpu'
      ? (st.winner === 'w' ? 'You beat the machine. Well played.' : 'The machine got you this time. Rematch?')
      : `${winner} wins. Well played.`;
  } else {
    kicker.textContent = 'DRAWN';
    title.textContent = { stalemate: 'STALEMATE', 'fifty-move': 'FIFTY MOVES', repetition: 'REPETITION', material: 'BARE KINGS' }[st.kind] || 'DRAW';
    sub.textContent = 'Nobody wins. Everybody keeps their coins.';
  }
  endOverlay.hidden = false;
}

function capturedPieces() {
  const initial = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const counts = { w: {}, b: {} };
  for (const p of state.board) if (p) {
    const c = colorOf(p), t = p.toLowerCase();
    counts[c][t] = (counts[c][t] || 0) + 1;
  }
  const missing = (c) => Object.entries(initial)
    .flatMap(([t, n]) => Array(Math.max(0, n - (counts[c][t] || 0))).fill(t === 'k' ? null : t))
    .filter(Boolean);
  return { w: missing('w'), b: missing('b') };
}

function render() {
  const st = currentStatus();
  const checkSq = !st.over && st.check ? kingSquare(state) : null;
  const lastMove = lastMoveRecord;
  boardEl.replaceChildren();
  const targets = selected != null ? new Map(legalCache.filter((m) => m.from === selected).map((m) => [m.to, m])) : new Map();
  for (let visual = 0; visual < 64; visual++) {
    const r = flipped ? 7 - (visual >> 3) : visual >> 3;
    const c = flipped ? 7 - (visual & 7) : visual & 7;
    const sq = r * 16 + c;
    const btn = document.createElement('button');
    btn.className = 'square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
    btn.setAttribute('role', 'gridcell');
    btn.dataset.sq = String(sq);
    const piece = state.board[sq];
    btn.setAttribute('aria-label', sqName(sq) + (piece ? ' ' + piece : ' empty'));
    if (sq === selected) btn.classList.add('selected');
    if (lastMove && (sq === lastMove.from || sq === lastMove.to)) btn.classList.add('last-move');
    if (sq === checkSq) btn.classList.add('in-check');
    if ((flipped ? r === 0 : r === 7)) {
      const f = document.createElement('span');
      f.className = 'coord file';
      f.textContent = 'abcdefgh'[c];
      btn.appendChild(f);
    }
    if ((flipped ? c === 7 : c === 0)) {
      const rk = document.createElement('span');
      rk.className = 'coord rank';
      rk.textContent = String(8 - r);
      btn.appendChild(rk);
    }
    if (piece) btn.appendChild(pieceImg(piece, colorOf(piece)));
    const t = targets.get(sq);
    if (t) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (t.captured ? ' capture' : '');
      btn.appendChild(dot);
    }
    btn.addEventListener('click', () => onSquareClick(sq));
    boardEl.appendChild(btn);
  }

  // move list
  movelistEl.replaceChildren();
  if (!notations.length) {
    const li = document.createElement('li');
    li.className = 'movelist-empty';
    li.textContent = 'No moves yet. White begins.';
    movelistEl.appendChild(li);
  } else {
    notations.forEach((n, i) => {
      const li = document.createElement('li');
      li.textContent = (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + n;
      movelistEl.appendChild(li);
    });
    movelistEl.scrollTop = movelistEl.scrollHeight;
  }

  // captured trays: top shows pieces the top player captured
  const cap = capturedPieces();
  const topSide = flipped ? 'w' : 'b';
  const bottomSide = flipped ? 'b' : 'w';
  capturedTop.replaceChildren(...cap[bottomSide].map((t) => pieceImg(t, bottomSide)));
  capturedBottom.replaceChildren(...cap[topSide].map((t) => pieceImg(t, topSide)));

  // player bars
  const diffLabel = difficultyEl.value.toUpperCase();
  const blackLabel = mode === 'cpu' ? `♜ CPU · ${diffLabel}` : '♜ BLACK';
  topPlayer.textContent = flipped ? '♙ WHITE' : blackLabel;
  bottomPlayer.textContent = flipped ? blackLabel : '♙ WHITE';
  topPlayer.classList.toggle('turn', !gameOver && state.turn === (flipped ? 'w' : 'b'));
  bottomPlayer.classList.toggle('turn', !gameOver && state.turn === (flipped ? 'b' : 'w'));

  // status line
  statusEl.classList.remove('alert');
  if (gameOver) {
    statusEl.textContent = 'Game over — hit PLAY AGAIN for a rematch.';
  } else if (mode === 'cpu' && state.turn === 'b') {
    statusEl.textContent = st.check ? 'The CPU is in check…' : 'CPU is thinking…';
  } else {
    const who = mode === 'cpu' ? 'Your' : (state.turn === 'w' ? "White's" : "Black's");
    statusEl.textContent = `${who} move${st.check ? ' — CHECK!' : '.'}`;
    if (st.check) statusEl.classList.add('alert');
  }
  renderClocks();
}

function undo() {
  sfx.click();
  clearTimeout(cpuTimer);
  if (!history.length) return;
  const steps = mode === 'cpu' && state.turn === 'w' && history.length >= 2 ? 2 : 1;
  for (let i = 0; i < steps && history.length; i++) {
    const prev = history.pop();
    const key = posKey(state);
    positionKeys.set(key, Math.max(0, (positionKeys.get(key) || 1) - 1));
    notations.pop();
    state = prev.state;
  }
  lastMoveRecord = null;
  selected = null;
  gameOver = false;
  endOverlay.hidden = true;
  legalCache = legalMoves(state);
  render();
  if (mode === 'cpu' && state.turn === 'b') scheduleCpu();
}

// controls
document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('flip-btn').addEventListener('click', () => { sfx.click(); flipped = !flipped; render(); });
document.getElementById('restart-btn').addEventListener('click', () => { sfx.click(); freshGame(); if (mode === 'cpu' && state.turn === 'b') scheduleCpu(); });
document.getElementById('end-restart').addEventListener('click', () => { sfx.click(); freshGame(); });
document.getElementById('mode-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  sfx.click();
  mode = btn.dataset.mode;
  for (const b of btn.parentElement.children) b.classList.toggle('active', b === btn);
  difficultyField.style.display = mode === 'cpu' ? '' : 'none';
  freshGame();
});
difficultyEl.addEventListener('change', () => { sfx.click(); render(); });
timeControlEl.addEventListener('change', () => { sfx.click(); resetClocks(); });

mode = 'cpu';
flipped = false;
freshGame();
startClockLoop();