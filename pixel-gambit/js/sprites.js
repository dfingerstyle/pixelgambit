import { get } from './state.js';
const MAPS = {
  P: [
    '....XX......',
    '...XXXX.....',
    '...XXXX.....',
    '....XX......',
    '...XXXX.....',
    '..XXXXXX....',
    '....XX......',
    '....XX......',
    '...XXXX.....',
    '..XXXXXX....',
    '.XXXXXXXX...',
    'XXXXXXXXXX..',
  ],
  R: [
    'XX..XXXX..XX',
    'XX..XXXX..XX',
    'XXXXXXXXXXXX',
    '.XXXXXXXXXX.',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    '............',
  ],
  N: [
    '....XXX.....',
    '...XXXXX....',
    '..XXXXXXX...',
    '..XX.XXXXX..',
    '..XXXXXXX...',
    '...XXXXXX...',
    '..XXXXXX....',
    '..XXXXX.....',
    '.XXXXXXX....',
    'XXXXXXXXX...',
    'XXXXXXXXXX..',
    'XXXXXXXXXX..',
  ],
  B: [
    '.....XX.....',
    '....XXXX....',
    '....XXXX....',
    '...XXXXXX...',
    '...XX.XXX...',
    '...XXXXXX...',
    '....XXXX....',
    '...XXXXXX...',
    '..XXXXXXXX..',
    '....XXXX....',
    '..XXXXXXXX..',
    'XXXXXXXXXXXX',
  ],
  Q: [
    '.X..XX..X...',
    '.X..XX..X...',
    '.XXXXXXXX...',
    '..XXXXXX....',
    '..XXXXXX....',
    '...XXXX.....',
    '...XXXX.....',
    '..XXXXXX....',
    '.XXXXXXXX...',
    'XXXXXXXXXX..',
    'XXXXXXXXXX..',
    '............',
  ],
  K: [
    '.....XX.....',
    '.....XX.....',
    '...XXXXXX...',
    '...XXXXXX...',
    '.....XX.....',
    '....XXXX....',
    '...XXXXXX...',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    '............',
  ],
};

const cache = new Map();

export function pieceSprite(type, side) {
  type = type.toUpperCase();
  const key = `${type}${side}`;
  if (cache.has(key)) return cache.get(key);
  const map = MAPS[type];
  const W = 12, H = 12, S = 4;
  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  const body = side === 'w' ? '#f6ecd4' : '#2c1a45';
  const shade = side === 'w' ? '#c9a86a' : '#170b28';
  const outline = side === 'w' ? '#4a2f14' : '#b07fe8';
  const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && map[y][x] === 'X';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (map[y][x] !== 'X') {
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          ctx.fillStyle = outline;
          ctx.fillRect(x * S, y * S, S, S);
        }
        continue;
      }
      ctx.fillStyle = !filled(x + 1, y) || !filled(x, y + 1) ? shade : body;
      ctx.fillRect(x * S, y * S, S, S);
    }
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

const CLASSIC_PATHS = {
  P: '<circle cx="32" cy="16" r="8"/><path d="M26 25h12l-3 15 9 8H20l9-8z"/>',
  R: '<path d="M18 8h7v7h5V8h5v7h5V8h7v15l-8 5v14l7 6H18l7-6V28l-7-5z"/>',
  N: '<path d="M19 47l4-16-8-1 2-12L33 7l7 7c10 5 10 19 5 26l1 7z"/><path d="M18 24l14-5M29 10l-1 9" fill="none"/><circle cx="34" cy="18" r="2" fill="#777"/>',
  B: '<path d="M32 7c-17 15-16 22-5 26l-4 10-5 5h28l-5-5-4-10c11-4 12-11-5-26z"/><path d="M33 13l-7 11" fill="none"/>',
  Q: '<path d="M16 17l9 10 7-13 7 13 9-10-6 20H22zM23 37h18l-3 7 8 4H18l8-4z"/><circle cx="16" cy="14" r="3"/><circle cx="32" cy="10" r="3"/><circle cx="48" cy="14" r="3"/>',
  K: '<path d="M32 5v13M26 11h12" fill="none" stroke-width="4"/><path d="M21 22q11-10 22 0l-6 14 3 8 6 4H18l6-4 3-8z"/>',
};
export function smoothSprite(type, side, style = 'classic') {
  const colors = style === 'chrome' ? ['#eff6ff', '#365b80', '#52718e'] : style === 'ember' ? ['#fff0cd', '#79313f', '#bc8851'] : ['#faf7ef', '#30333b', '#50515b'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="${side === 'w' ? colors[0] : colors[1]}" stroke="${colors[2]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${CLASSIC_PATHS[type.toUpperCase()] || CLASSIC_PATHS.P}<path d="M18 48h28l3 7H15z"/><path d="M15 56h34v3H15z"/></g></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
export function pieceImg(type, side, alt = '', style = get().cosmetics?.equipped?.pieces || 'classic') {
  const img = document.createElement('img');
  img.src = style === 'pixel' ? pieceSprite(type, side) : smoothSprite(type, side, style);
  img.dataset.piece = type; img.dataset.side = side; img.dataset.pieceStyle = style;
  img.alt = alt || `${side === 'w' ? 'White' : 'Black'} ${type}`;
  img.style.imageRendering = style === 'pixel' ? 'pixelated' : 'auto';
  img.draggable = false;
  return img;
}