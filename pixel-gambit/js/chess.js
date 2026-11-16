// Compact legal-move chess engine (0x88 board). Ported from the chess.gay engine.
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const KNIGHT_D = [31, 33, 14, 18, -31, -33, -14, -18];
const KING_D = [15, 17, -15, -17, 1, -1, 16, -16];
const ROOK_D = [1, -1, 16, -16];
const BISHOP_D = [15, 17, -15, -17];
const FILES = 'abcdefgh';

export const sqName = (i) => FILES[i & 7] + String(8 - (i >> 4));
export const isWhite = (p) => p && p === p.toUpperCase();
export const colorOf = (p) => (isWhite(p) ? 'w' : 'b');
const onBoard = (i) => (i & 0x88) === 0;

export function parseFen(fen) {
  const [placement, turn, castling, ep, half, full] = fen.split(' ');
  const board = new Array(128).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) { i += Number(ch); continue; }
    board[(i >> 3) * 16 + (i & 7)] = ch;
    i++;
  }
  return {
    board, turn,
    castling: { K: castling.includes('K'), Q: castling.includes('Q'), k: castling.includes('k'), b: castling.includes('q') },
    ep: ep === '-' ? null : ((8 - Number(ep[1])) * 16) + FILES.indexOf(ep[0]),
    half: Number(half || 0), full: Number(full || 1),
  };
}

export function toFen(s) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '', empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = s.board[r * 16 + c];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const c = (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') + (s.castling.k ? 'k' : '') + (s.castling.b ? 'q' : '');
  return `${rows.join('/')} ${s.turn} ${c || '-'} ${s.ep == null ? '-' : sqName(s.ep)} ${s.half} ${s.full}`;
}

function cloneState(s) {
  return { board: s.board.slice(), turn: s.turn, castling: { ...s.castling }, ep: s.ep, half: s.half, full: s.full };
}

export function isAttacked(s, sq, by) {
  const pawnDir = by === 'w' ? -16 : 16;
  for (const dx of [-1, 1]) {
    const from = sq - pawnDir + dx;
    if (onBoard(from) && s.board[from] === (by === 'w' ? 'P' : 'p')) return true;
  }
  for (const d of KNIGHT_D) {
    const from = sq + d;
    if (onBoard(from) && s.board[from] === (by === 'w' ? 'N' : 'n')) return true;
  }
  for (const d of KING_D) {
    const from = sq + d;
    if (onBoard(from) && s.board[from] === (by === 'w' ? 'K' : 'k')) return true;
  }
  for (const [dirs, types] of [[ROOK_D, 'rq'], [BISHOP_D, 'bq']]) {
    for (const d of dirs) {
      let from = sq + d;
      while (onBoard(from)) {
        const p = s.board[from];
        if (p) {
          if (colorOf(p) === by && types.includes(p.toLowerCase())) return true;
          break;
        }
        from += d;
      }
    }
  }
  return false;
}

export function kingSquare(s, color) {
  return s.board.indexOf(color === 'w' ? 'K' : 'k');
}

export function inCheck(s, color = s.turn) {
  return isAttacked(s, kingSquare(s, color), color === 'w' ? 'b' : 'w');
}

function pseudoMoves(s) {
  const moves = [];
  const us = s.turn;
  const add = (from, to, flags = {}) => moves.push({ from, to, piece: s.board[from], captured: s.board[to], ...flags });
  for (let from = 0; from < 128; from++) {
    if (from & 0x88) { from += 7; continue; }
    const p = s.board[from];
    if (!p || colorOf(p) !== us) continue;
    const t = p.toLowerCase();
    if (t === 'p') {
      const dir = us === 'w' ? -16 : 16;
      const startRow = us === 'w' ? 6 : 1;
      const promoRow = us === 'w' ? 0 : 7;
      const one = from + dir;
      if (onBoard(one) && !s.board[one]) {
        if ((one >> 4) === promoRow) for (const pr of 'qrbn') add(from, one, { promotion: us === 'w' ? pr.toUpperCase() : pr });
        else add(from, one);
        const two = from + dir * 2;
        if ((from >> 4) === startRow && !s.board[two]) add(from, two, { double: true });
      }
      for (const dx of [-1, 1]) {
        const to = from + dir + dx;
        if (!onBoard(to)) continue;
        if (s.board[to] && colorOf(s.board[to]) !== us) {
          if ((to >> 4) === promoRow) for (const pr of 'qrbn') add(from, to, { promotion: us === 'w' ? pr.toUpperCase() : pr });
          else add(from, to);
        } else if (to === s.ep) {
          add(from, to, { ep: true, captured: us === 'w' ? 'p' : 'P' });
        }
      }
    } else if (t === 'n' || t === 'k') {
      for (const d of (t === 'n' ? KNIGHT_D : KING_D)) {
        const to = from + d;
        if (onBoard(to) && (!s.board[to] || colorOf(s.board[to]) !== us)) add(from, to);
      }
      if (t === 'k') {
        const rights = us === 'w' ? ['K', 'Q'] : ['k', 'b'];
        const home = us === 'w' ? 116 : 4;
        const enemy = us === 'w' ? 'b' : 'w';
        if (from === home && !isAttacked(s, home, enemy)) {
          if (s.castling[rights[0]] && !s.board[home + 1] && !s.board[home + 2]
            && s.board[home + 3] === (us === 'w' ? 'R' : 'r')
            && !isAttacked(s, home + 1, enemy) && !isAttacked(s, home + 2, enemy)) add(from, home + 2, { castle: 'K' });
          if (s.castling[rights[1]] && !s.board[home - 1] && !s.board[home - 2] && !s.board[home - 3]
            && s.board[home - 4] === (us === 'w' ? 'R' : 'r')
            && !isAttacked(s, home - 1, enemy) && !isAttacked(s, home - 2, enemy)) add(from, home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'r' ? ROOK_D : t === 'b' ? BISHOP_D : [...ROOK_D, ...BISHOP_D];
      for (const d of dirs) {
        let to = from + d;
        while (onBoard(to)) {
          if (!s.board[to]) add(from, to);
          else { if (colorOf(s.board[to]) !== us) add(from, to); break; }
          to += d;
        }
      }
    }
  }
  return moves;
}

export function makeMove(s, m) {
  const n = cloneState(s);
  const us = s.turn;
  n.board[m.from] = null;
  n.board[m.to] = m.promotion || m.piece;
  if (m.ep) n.board[m.to + (us === 'w' ? 16 : -16)] = null;
  if (m.castle === 'K') { n.board[m.to - 1] = n.board[m.to + 1]; n.board[m.to + 1] = null; }
  if (m.castle === 'Q') { n.board[m.to + 1] = n.board[m.to - 2]; n.board[m.to - 2] = null; }
  if (m.piece === 'K') { n.castling.K = false; n.castling.Q = false; }
  if (m.piece === 'k') { n.castling.k = false; n.castling.b = false; }
  const cornerMap = { 112: 'Q', 119: 'K', 0: 'b', 7: 'k' };
  if (cornerMap[m.from]) n.castling[cornerMap[m.from]] = false;
  if (cornerMap[m.to]) n.castling[cornerMap[m.to]] = false;
  n.ep = m.double ? (m.from + m.to) / 2 : null;
  n.half = (m.piece.toLowerCase() === 'p' || m.captured) ? 0 : s.half + 1;
  if (us === 'b') n.full = s.full + 1;
  n.turn = us === 'w' ? 'b' : 'w';
  return n;
}

export function legalMoves(s) {
  return pseudoMoves(s).filter((m) => !inCheck(makeMove(s, m), s.turn));
}

export function insufficientMaterial(s) {
  const pieces = s.board.filter(Boolean).map((p) => p.toLowerCase());
  if (pieces.some((p) => p === 'p' || p === 'r' || p === 'q')) return false;
  return pieces.length <= 3;
}

export function statusOf(s, repetitions = 1) {
  const moves = legalMoves(s);
  if (moves.length === 0) {
    if (inCheck(s)) return { over: true, kind: 'checkmate', winner: s.turn === 'w' ? 'b' : 'w', moves };
    return { over: true, kind: 'stalemate', moves };
  }
  if (s.half >= 100) return { over: true, kind: 'fifty-move', moves };
  if (repetitions >= 3) return { over: true, kind: 'repetition', moves };
  if (insufficientMaterial(s)) return { over: true, kind: 'material', moves };
  return { over: false, check: inCheck(s), moves };
}

export function moveNotation(s, m, legal) {
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const t = m.piece.toLowerCase();
  let out = t === 'p' ? '' : m.piece.toUpperCase();
  if (t !== 'p') {
    const rivals = legal.filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from);
    if (rivals.length) {
      const sameFile = rivals.some((x) => (x.from & 7) === (m.from & 7));
      const sameRank = rivals.some((x) => (x.from >> 4) === (m.from >> 4));
      out += !sameFile ? FILES[m.from & 7] : !sameRank ? String(8 - (m.from >> 4)) : sqName(m.from);
    }
  } else if (m.captured) out += FILES[m.from & 7];
  if (m.captured) out += 'x';
  out += sqName(m.to);
  if (m.promotion) out += '=' + m.promotion.toUpperCase();
  const after = makeMove(s, m);
  if (inCheck(after)) out += legalMoves(after).length === 0 ? '#' : '+';
  return out;
}