import { startSky, setSkyTheme } from './background.js';
import { pieceImg } from './sprites.js';
import { sfx, soundEnabled, setSound } from './audio.js';
import { get, update, subscribe } from './state.js';
import { attachCharacterEditor } from './character.js';
import { startWorld, setActive as setWorldActive, setTheme as setWorldTheme, setDoorHandler } from './world.js';
import { init as initOnline } from './online.js';
import { enterInterior, setInteriorActive } from './interiors.js';
import './console.js';
import './casino.js';
import './game.js';
import './workshop.js';
import './roulette.js';
import './coinflip.js';
import './dice.js';
import './slots.js';
import './table.js';
import './economy.js';
import './account.js';
import { openCatalog } from './cosmetics.js';

// ---- view router ----
const VIEWS = ['world', 'play', 'casino', 'economy', 'interior', 'studio'];
const root = document.documentElement;

function go(view, focus) {
  if (!VIEWS.includes(view)) view = 'world';
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('[data-view-link]').forEach((a) => {
    if (a.classList.contains('nav-links') || a.closest('.nav-links')) {
      a.classList.toggle('active', a.dataset.viewLink === view);
    }
  });
  setWorldActive(view === 'world');
  setInteriorActive(view === 'interior');
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  window.scrollTo(0, 0);
  if (focus) {
    const el = document.getElementById(focus);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

document.querySelectorAll('[data-view-link]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    sfx.click();
    go(a.dataset.viewLink);
  });
});
setDoorHandler((target, focus, building) => {
  if (['clothing', 'gym'].includes(building?.kind)) { openCatalog(building.kind); return; }
  let room = building?.kind === 'chess' ? 'hall' : building?.kind === 'store' ? 'store' : building?.kind === 'property' ? 'office' : ['training', 'boutique', 'casino'].includes(building?.kind) ? building.kind : null;
  if (building?.kind === 'lot') {
    const owned = Object.keys(get().assets);
    const id = owned[building.assetSlot];
    room = id ? 'home:' + id : 'office';
  }
  if (room) { enterInterior(room, () => go('world')); go('interior'); }
  else go(target, focus);
});
document.getElementById('casino-return').onclick = () => { enterInterior('casino', () => go('world')); go('interior'); };
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
window.addEventListener('catalog-open', () => { setWorldActive(false); setInteriorActive(false); });
window.addEventListener('catalog-close', () => { setWorldActive(location.hash === '#world'); setInteriorActive(location.hash === '#interior'); });

// ---- theme ----
const savedTheme = localStorage.getItem('pg-theme');
const initialTheme = ['starry', 'sakura', 'sea', 'day'].includes(savedTheme) ? savedTheme : 'day';
function applyInterface(value) {
  root.dataset.ui = value === 'black' ? 'black' : 'modern'; localStorage.setItem('pg-ui', root.dataset.ui);
  document.querySelectorAll('[data-ui-choice]').forEach(b => b.classList.toggle('active', b.dataset.uiChoice === root.dataset.ui));
}
document.querySelectorAll('[data-ui-choice]').forEach(b => b.onclick = () => applyInterface(b.dataset.uiChoice));
applyInterface(localStorage.getItem('pg-ui'));

function applyTheme(theme, announce) {
  root.dataset.theme = theme;
  localStorage.setItem('pg-theme', theme);
  setSkyTheme(theme);
  setWorldTheme(theme);
  document.querySelectorAll('[data-theme-choice]').forEach((el) => {
    const active = el.dataset.themeChoice === theme;
    el.classList.toggle('active', active && el.classList.contains('theme-dot'));
    if (el.classList.contains('theme-card')) {
      el.classList.toggle('equipped', active);
      const action = el.querySelector('.tc-action');
      if (action) action.textContent = active ? 'SKY EQUIPPED ✓' : 'EQUIP SKY ↗';
    }
  });
  if (announce) sfx.theme();
}

document.querySelectorAll('[data-theme-choice]').forEach((el) => {
  el.addEventListener('click', () => { sfx.unlock(); applyTheme(el.dataset.themeChoice, true); });
});

// ---- sound toggle ----
const soundBtn = document.getElementById('sound-toggle');
function renderSound() { soundBtn.setAttribute('aria-pressed', String(soundEnabled())); }
soundBtn.addEventListener('click', () => {
  setSound(!soundEnabled());
  renderSound();
  if (soundEnabled()) sfx.click();
});
renderSound();
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// ---- brand sprite ----
document.getElementById('brand-piece').appendChild(pieceImg('N', 'w'));

// ---- settings modal + character editor ----
const settingsModal = document.getElementById('settings-modal');
const charEditor = attachCharacterEditor((cfg) => {
  update((s) => { s.character = cfg; });
});
document.getElementById('settings-btn').addEventListener('click', () => {
  sfx.click();
  charEditor.open(get().character);
  settingsModal.hidden = false;
});
function closeSettings() {
  settingsModal.hidden = true;
  charEditor.close();
}
document.getElementById('settings-close').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !settingsModal.hidden) closeSettings(); });

// ---- sky + world ----
startSky(initialTheme);
applyTheme(initialTheme, false);
startWorld(document.getElementById('world-canvas'));
initOnline();
if (location.hash === '#interior') enterInterior('hall', () => go('world'));
go(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'world');