// Board workshop: preset palettes + custom colours, saved to the shared profile.
import { get, update } from './state.js';
import { sfx } from './audio.js';

const PRESETS = {
  void: { name: 'Void', light: '#cbb8f0', dark: '#5b3f96' },
  sakura: { name: 'Sakura', light: '#f6d3e0', dark: '#a34a6e' },
  sea: { name: 'Sea', light: '#b8e6f0', dark: '#2a6f8f' },
  classic: { name: 'Classic', light: '#eed7b0', dark: '#9a6b42' },
  neon: { name: 'Neon', light: '#c8ffe9', dark: '#1f7a5c' },
  midnight: { name: 'Midnight', light: '#9aa4c0', dark: '#2e3350' },
};

const lightInput = document.getElementById('board-light');
const darkInput = document.getElementById('board-dark');
const presetsEl = document.getElementById('board-presets');

const textureCache = new Map();
export function boardTexture(preset, dark = false) {
  const material = preset === 'classic' ? 'wood' : preset === 'glacier' ? 'glass' : ['marble', 'obsidian', 'jade', 'rose'].includes(preset) ? 'stone' : 'plain';
  const key = material + dark;
  if (textureCache.has(key)) return textureCache.get(key);
  if (material === 'plain') return 'none';
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), pixels = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const grain = noise - Math.floor(noise);
    const cloud = Math.sin(x / 17 + Math.sin(y / 23)) * Math.cos(y / 19) + Math.sin(x / 7 + y / 13) * .35;
    const wave = Math.sin(x * .6 + Math.sin(y / 24) * 2 + Math.sin(x / 19) * 4);
    const tone = material === 'wood' ? wave * .55 + grain * .45 : material === 'glass' && dark ? (grain - .5) * 2 : cloud * .6 + (grain - .5) * .4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = tone > 0 ? 255 : 0;
    pixels.data[i + 3] = Math.min(95, Math.abs(tone) * (material === 'wood' ? 48 : 65));
  }
  ctx.putImageData(pixels, 0, 0);
  if (material === 'stone') {
    ctx.strokeStyle = dark ? '#ffffff12' : '#59482b20'; ctx.lineWidth = 1;
    for (let n = 0; n < 3; n++) { ctx.beginPath(); for (let x = 0; x <= 128; x++) { const y = 22 + n * 43 + Math.sin(x / 26 + n) * 14 + x * .2; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  }
  if (material === 'glass' && !dark) {
    ctx.clearRect(0, 0, 128, 128); ctx.fillStyle = '#ffffff38'; ctx.beginPath(); ctx.moveTo(0, 92); ctx.lineTo(92, 0); ctx.lineTo(113, 0); ctx.lineTo(0, 113); ctx.fill();
    ctx.fillStyle = '#ffffff65'; ctx.fillRect(91, 22, 2, 12); ctx.fillRect(86, 27, 12, 2);
  }
  const url = `url("${c.toDataURL()}")`; textureCache.set(key, url); return url;
}

export function applyBoard() {
  const b = get().board;
  const p = PRESETS[b.preset] || PRESETS.void;
  const light = b.light || p.light;
  const dark = b.dark || p.dark;
  document.documentElement.style.setProperty('--board-light', light);
  document.documentElement.style.setProperty('--board-dark', dark);
  document.documentElement.style.setProperty('--board-texture-light', boardTexture(b.preset));
  document.documentElement.style.setProperty('--board-texture-dark', boardTexture(b.preset, true));
  lightInput.value = light;
  darkInput.value = dark;
  presetsEl.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn.dataset.preset === b.preset && !b.light && !b.dark));
}

for (const [key, p] of Object.entries(PRESETS)) {
  const btn = document.createElement('button');
  btn.dataset.preset = key;
  btn.title = p.name;
  btn.setAttribute('aria-label', p.name + ' board');
  btn.innerHTML = `<i style="background:${p.light}"></i><i style="background:${p.dark}"></i>`;
  btn.addEventListener('click', () => {
    sfx.click();
    update((s) => { s.board = { preset: key, light: null, dark: null }; });
    applyBoard();
  });
  presetsEl.appendChild(btn);
}

lightInput.addEventListener('input', () => {
  update((s) => { s.board.light = lightInput.value; });
  applyBoard();
});
darkInput.addEventListener('input', () => {
  update((s) => { s.board.dark = darkInput.value; });
  applyBoard();
});

applyBoard();