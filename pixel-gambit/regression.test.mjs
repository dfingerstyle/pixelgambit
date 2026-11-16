import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { stockfishMove } from './js/stockfish.js';
import { START_FEN, parseFen, toFen, legalMoves, makeMove, sqName, statusOf } from './js/chess.js';

function perft(position, depth) {
  if (!depth) return 1;
  return legalMoves(position).reduce((sum, move) => sum + perft(makeMove(position, move), depth - 1), 0);
}
function play(position, uci) {
  const move = legalMoves(position).find(m => sqName(m.from) + sqName(m.to) + (m.promotion?.toLowerCase() || '') === uci);
  assert.ok(move, `Legal move: ${uci}`);
  return makeMove(position, move);
}

test('starting FEN round-trips and legal move generation matches perft', () => {
  const position = parseFen(START_FEN);
  assert.equal(toFen(position), START_FEN);
  for (const [depth, expected] of [[1, 20], [2, 400], [3, 8902]]) assert.equal(perft(position, depth), expected);
  assert.equal(toFen(position), START_FEN);
});

test('castling-rich position matches reference perft', () => {
  const position = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(position, 1), 48);
  assert.equal(perft(position, 2), 2039);
});

test('en passant removes the captured pawn', () => {
  let position = parseFen(START_FEN);
  for (const move of ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']) position = play(position, move);
  assert.equal(position.board.findIndex((p, i) => sqName(i) === 'd5' && p), -1);
  assert.ok(toFen(position).startsWith('rnbqkbnr/1pp1pppp/p2P4/'));
});

test('promotion exposes four legal choices', () => {
  const moves = legalMoves(parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1'));
  assert.deepEqual(moves.filter(m => sqName(m.to) === 'a8').map(m => m.promotion.toLowerCase()).sort(), ['b', 'n', 'q', 'r']);
});

test('fools mate ends the game with black winning', () => {
  let position = parseFen(START_FEN);
  for (const move of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) position = play(position, move);
  const status = statusOf(position);
  assert.equal(status.kind, 'checkmate');
  assert.equal(status.winner, 'b');
});

test('Stockfish accepts only legal moves and always terminates its worker', async t => {
  const original = globalThis.Worker;
  let reply = 'e2e4';
  let terminated = 0;
  globalThis.Worker = class {
    postMessage(command) {
      const response = command === 'uci' ? 'uciok' : command === 'isready' ? 'readyok' : command.startsWith('go ') ? `bestmove ${reply}` : null;
      if (response) queueMicrotask(() => this.onmessage({ data: response }));
    }
    terminate() { terminated++; }
  };
  t.after(() => { if (original === undefined) delete globalThis.Worker; else globalThis.Worker = original; });
  const position = parseFen(START_FEN);
  const moves = legalMoves(position);
  const move = await stockfishMove(position, moves);
  assert.equal(sqName(move.from) + sqName(move.to), 'e2e4');
  reply = 'e2e5';
  await assert.rejects(stockfishMove(position, moves), /no legal move/);
  assert.equal(terminated, 2);
});

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: pathname }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    }).on('error', reject);
  });
}

test('static server rejects malformed URLs and private paths without crashing', async t => {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  // Port zero lets the OS reserve an unused test port.
  const port = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited: ${code}`)));
    child.stdout.once('data', data => resolve(Number(String(data).match(/localhost:(\d+)/)[1])));
  });
  assert.equal(await request(port, '/'), 200);
  assert.equal(await request(port, '/%E0%A4%A'), 400);
  assert.equal(await request(port, '/tools/anything'), 404);
  assert.equal(await request(port, '/.gitignore'), 404);
  assert.equal(await request(port, '/../pixel-gambit-other/file'), 403);
  assert.equal(await request(port, '/'), 200);
});
