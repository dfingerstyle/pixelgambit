import { get, adjust, subscribe } from './state.js';
import { drawCharacter } from './character.js';
import { sfx } from './audio.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const bartender = { skin: '#eac29f', hair: '#292033', hairStyle: 'long', shirt: '#a52e60', pants: '#241c36', jacket: 'none', neckwear: 'none', eyewear: 'none', headwear: 'none' };
const drinks = [
  { name: 'Cyan Sprint', effect: 'speed', price: 60, color: '#62f5eb', description: 'Citrus soda · +35% walking speed' },
  { name: 'Moonberry Lift', effect: 'jump', price: 60, color: '#ef92ff', description: 'Berry fizz · +20% jump impulse in town' },
];
let boost = null, servingUntil = 0;
const hud = document.createElement('output'); hud.className = 'lounge-boost'; hud.hidden = true; document.body.append(hud);
export function movementBoost(now = performance.now()) {
  if (boost && now >= boost.until) boost = null;
  return { speed: boost?.effect === 'speed' ? 1.35 : 1, jump: boost?.effect === 'jump' ? 1.2 : 1 };
}
function refresh() {
  movementBoost(); hud.hidden = !boost;
  if (boost) hud.textContent = `${boost.name.toUpperCase()} · ${Math.ceil((boost.until - performance.now()) / 1000)}s`;
}
setInterval(refresh, 250);
let world = get(); subscribe(s => { if (s !== world) { boost = null; world = s; refresh(); } });
export function openBar(content, openPanel) {
  openPanel('Luna · Neon Lounge', 'Welcome, darling. Something bright for your next adventure? All drinks are alcohol-free. Effects last 60 seconds; a new drink replaces the current effect, never stacks. No effect on odds or payouts.');
  const portrait = document.createElement('canvas'); portrait.width = 96; portrait.height = 112; portrait.className = 'dialogue-portrait'; drawCharacter(portrait.getContext('2d'), bartender, 16, 7, 4); content.prepend(portrait);
  const status = document.createElement('p'); status.setAttribute('role', 'status'); content.append(status);
  for (const drink of drinks) {
    const row = document.createElement('article'); row.className = 'catalog-card';
    const title = document.createElement('h3'); title.textContent = drink.name; title.style.color = drink.color;
    const text = document.createElement('p'); text.textContent = drink.description;
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = `ORDER & DRINK · ${drink.price} COINS`;
    button.disabled = get().wallet < drink.price;
    button.onclick = () => {
      if (performance.now() < servingUntil) return;
      if (!adjust(-drink.price, `Lounge drink: ${drink.name}`)) { status.textContent = 'Not enough coins.'; return; }
      servingUntil = performance.now() + (reduced ? 200 : 1100);
      content.querySelectorAll('button').forEach(b => b.disabled = true);
      status.textContent = 'Luna is shaking, pouring and garnishing your drink…';
      portrait.classList.add('bartender-serving'); sfx.chip();
      const orderedWorld = get();
      setTimeout(() => {
        if (get() !== orderedWorld) return;
        boost = { ...drink, until: performance.now() + 60000 }; refresh(); sfx.cash();
        portrait.classList.remove('bartender-serving'); status.textContent = `${drink.name} consumed. Enjoy your 60-second ${drink.effect} boost!`;
        content.querySelectorAll('button').forEach((b, i) => b.disabled = get().wallet < drinks[i].price);
      }, reduced ? 200 : 1100);
    };
    row.append(title, text, button); content.append(row);
  }
}
export function drawLounge(c, project, camera) {
  const time = reduced ? 0 : performance.now() / 1000;
  const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  c.save();
  const counterTop = project(180, 200).y - (camera === 'top' ? 0 : 20);
  c.beginPath(); c.rect(0, 0, 900, counterTop); c.clip();
  const p = project(450, 205);
  drawCharacter(c, bartender, p.x - 24, p.y - 72, 3, { action: 'idle', facing: 1 });
  rect(p.x - 12, p.y - 40, 5, 5, '#e8c36a'); rect(p.x + 10, p.y - 40, 5, 5, '#e8c36a');
  const serving = performance.now() < servingUntil;
  const handX = p.x + 30 + (serving ? Math.sin(time * 18) * 8 : 0);
  rect(handX, p.y - 32, 9, 16, serving ? '#ceeaf3' : '#ed91e8'); rect(handX + 2, p.y - 30, 5, 8, '#72ebe3');
  c.restore();
}
