import { toFen, sqName } from './chess.js';

export async function stockfishMove(position, moves, difficulty = 'sharp') {
  const worker = new Worker(new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url));
  const fen = toFen(position);
  const skill = difficulty === 'chill' ? 0 : difficulty === 'ruthless' ? 18 : 8;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Stockfish timed out.')), 15000);
      const fail = message => { clearTimeout(timer); reject(new Error(message)); };
      worker.onerror = () => fail('Stockfish could not load.');
      worker.onmessage = event => {
        const line = String(event.data);
        if (line === 'uciok') {
          worker.postMessage(`setoption name Skill Level value ${skill}`);
          worker.postMessage('isready');
        } else if (line === 'readyok') {
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage('go movetime 500');
        } else if (line.startsWith('bestmove ')) {
          clearTimeout(timer);
          const uci = line.split(' ')[1];
          const move = moves.find(m => sqName(m.from) + sqName(m.to) + (m.promotion?.toLowerCase() || '') === uci);
          if (!move) reject(new Error('Stockfish returned no legal move.'));
          else resolve(move);
        }
      };
      worker.postMessage('uci');
    });
  } finally { worker.terminate(); }
}
