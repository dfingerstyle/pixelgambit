import { cp, mkdir, writeFile } from 'node:fs/promises';
const engine = 'stockfish-19-lite-single';
await mkdir('vendor/stockfish', { recursive: true });
for (const extension of ['js', 'wasm']) await cp(`node_modules/stockfish/bin/${engine}.${extension}`, `vendor/stockfish/${engine}.${extension}`);
await cp('node_modules/stockfish/Copying.txt', 'vendor/stockfish/Copying.txt');
await writeFile('vendor/stockfish/SOURCE.txt', 'Stockfish.js 19.0.1, GPLv3. Corresponding source: https://github.com/nmrugg/stockfish.js/tree/v19.0.1\n');
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'css', 'js', 'vendor']) await cp(file, `dist/${file}`, { recursive: true });
