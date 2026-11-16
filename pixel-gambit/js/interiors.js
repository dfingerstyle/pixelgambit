import { stockfishMove } from './stockfish.js';
import { movementBoost, openBar, drawLounge } from './casino-lounge.js';
import { get, update, adjust, ITEMS, ASSETS, fmt, assetRate } from './state.js';
import { drawCharacter, characterFor } from './character.js';
import { parseFen, START_FEN, legalMoves, makeMove, moveNotation, statusOf } from './chess.js';
import { pieceImg } from './sprites.js';
import { sfx } from './audio.js';
import { trackPresence } from './online.js';
import { roomFurniture, themeFor, drawFurnishing, drawArchitecture } from './furniture.js';
import { openCatalog } from './cosmetics.js';
import { adminSettings, onAdminSettings } from './admin-settings.js';
import { shopPrice } from './state.js';
import { FURNITURE } from './furniture.js';
import { ownsRoom, ensureRoom, propertyRoom, buyFurniture, placeFurniture, moveFurniture, rotateFurniture, storeFurniture, undoRoom, canUndoRoom, styleRoom, paintRoom, ROOM_STYLES, FURNITURE_PRICES } from './property.js';

const W = 900, H = 560;
const root = document.createElement('section');
root.id = 'view-interior';
root.className = 'view interior-view';
root.innerHTML = `<canvas id="room-canvas" aria-label="Walkable interior"></canvas><div class="room-toolbar"><button id="room-exit" class="btn">← TOWN</button><strong id="room-name"></strong><div id="room-cameras"><button data-camera="side">SIDE</button><button data-camera="top">TOP</button><button data-camera="three">¾</button></div></div><p class="room-help">WASD / arrows · tap to walk · E interact · V camera</p><button id="room-action" class="btn btn-primary" hidden></button><div class="room-touch"><button data-direction="a">←</button><button data-direction="w">↑</button><button data-direction="s">↓</button><button data-direction="d">→</button></div><section class="room-glass" id="room-panel" hidden><button id="room-panel-close" class="modal-close" aria-label="Close panel">×</button><div id="room-content"></div></section>`;
document.querySelector('main').append(root);
const bag = document.createElement('button'); bag.className = 'btn'; bag.textContent = 'BAG'; bag.onclick = () => openCatalog('inventory'); root.querySelector('.room-toolbar').append(bag);
const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
const panel = root.querySelector('#room-panel'), content = root.querySelector('#room-content');
const action = root.querySelector('#room-action');
const player = { x: 450, y: 475, facing: 1, frame: 0 };
let room = null, active = false, raf = 0, last = 0, camera = localStorage.getItem('pg-room-camera') || 'top';
let objects = [], target = null, nearby = null, onExit = () => {}, selected = null, currentMatch = null, mode = 'spectate';
const keys = new Set();
const matches = [0, 1, 2].map(i => ({ state: parseFen(START_FEN), moves: [], names: [['PixelQueen', 'RookStar'], ['KnightOwl', 'DeepSeaDan'], ['You', 'CPU']][i], clock: [300, 300], since: 0, done: false }));
let matchTick = performance.now();
const PUZZLES = [
  { name: 'Queen coordination', fen: '7k/7p/5KQ1/8/8/8/8/8 w - - 0 1', hint: 'Your king protects the queen’s mating square.' },
  { name: 'Back-rank finish', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', hint: 'Use the rook to attack the back rank.' },
];
let puzzleIndex = 0, puzzleFeedback = '';

let building = false, buildSelection = null, placingType = null, movingItem = false, buildNotice = '';
const buildButton = document.createElement('button'); buildButton.className = 'btn'; buildButton.textContent = 'BUILD'; buildButton.hidden = true; root.querySelector('.room-toolbar').append(buildButton);
const buildPanel = document.createElement('aside'); buildPanel.className = 'property-editor'; buildPanel.hidden = true; root.append(buildPanel);
function loadObjects() { objects = roomFurniture(room); }
function toggleBuild(on) {
  building = on && ownsRoom(room); root.classList.toggle('building', building); root.querySelectorAll('[data-camera]').forEach(b => b.disabled = building); buildPanel.hidden = !building; buildButton.textContent = building ? 'DONE' : 'BUILD'; buildSelection = null; placingType = null; movingItem = false; keys.clear(); target = null; panel.hidden = true; action.hidden = true;
  if (building) { ensureRoom(room); loadObjects(); setCamera('top'); } renderBuildPanel();
}
buildButton.onclick = () => toggleBuild(!building);
onAdminSettings(() => { if (building) renderBuildPanel(); });
function renderBuildPanel() {
  if (!building) return;
  buildPanel.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'PROPERTY WORKSHOP'; buildPanel.append(heading);
  const note = document.createElement('p'); note.className = 'build-notice'; note.setAttribute('role', 'status'); note.textContent = buildNotice || 'Select furniture on the floor. Move it with a second click, or choose a stored item to place. Placement snaps to a 10px grid.'; buildPanel.append(note);
  const selected = objects.find(o => o.uid === buildSelection);
  if (selected) { const label = document.createElement('strong'); label.textContent = selected.label; buildPanel.append(label); button('MOVE → CLICK FLOOR', () => { movingItem = true; placingType = null; buildNotice = 'Click a free floor position to move ' + selected.label; renderBuildPanel(); }, buildPanel); button('ROTATE 90°', () => finishBuild(rotateFurniture(room, selected.uid)), buildPanel); button('STORE ITEM', () => { const ok = storeFurniture(room, selected.uid); buildSelection = null; finishBuild(ok); }, buildPanel); }
  button('UNDO LAST EDIT', () => { buildSelection = null; placingType = null; finishBuild(undoRoom(room)); }, buildPanel).disabled = !canUndoRoom(room);
  const styles = document.createElement('div'); styles.className = 'build-styles'; buildPanel.append(styles);
  for (const style of Object.keys(ROOM_STYLES)) { const b = button(style.toUpperCase(), () => finishBuild(styleRoom(room, style)), styles); b.classList.toggle('selected', propertyRoom(room).style === style); }
  for (const surface of ['floor', 'wall']) { const label = document.createElement('label'); label.textContent = surface.toUpperCase() + ' COLOR '; const color = document.createElement('input'); color.type = 'color'; color.value = themeFor(room)[surface]; color.setAttribute('aria-label', surface + ' color'); color.onchange = () => finishBuild(paintRoom(room, surface, color.value)); label.append(color); styles.append(label); }
  const title = document.createElement('h3'); title.textContent = 'FURNITURE & DECORATIONS · ' + fmt(get().wallet) + ' COINS'; buildPanel.append(title);
  const info = document.createElement('p'); info.textContent = 'Rack furniture costs 2,400 coins and is decorative. Income-producing Server Rack assets remain in the Property Office (60,000 coins); furniture placement does not multiply income.'; buildPanel.append(info);
  const grid = document.createElement('div'); grid.className = 'furniture-catalog'; buildPanel.append(grid);
  for (const [type, def] of Object.entries(FURNITURE)) {
    const card = document.createElement('article'); card.dataset.furniture = type;
    const thumb = document.createElement('canvas'); thumb.width = 160; thumb.height = 115; const c = thumb.getContext('2d'); const scale = Math.min(130 / def.w, 85 / def.h); c.scale(scale, scale); drawFurnishing(c, { ...def, type, x: 10 / scale, y: 10 / scale }, themeFor(room), 'top', (x, y) => ({ x, y })); card.append(thumb);
    const name = document.createElement('strong'); name.textContent = def.name; card.append(name);
    const count = propertyRoom(room).stored[type] || 0; button('BUY · ' + fmt(shopPrice(FURNITURE_PRICES[type])), () => finishBuild(buyFurniture(room, type)), card).disabled = get().wallet < shopPrice(FURNITURE_PRICES[type]);
    button('PLACE · STORED ' + count, () => { placingType = type; movingItem = false; buildSelection = null; buildNotice = 'Click a free floor position to place ' + def.name; renderBuildPanel(); }, card).disabled = !count;
    grid.append(card);
  }
}
function finishBuild(ok) { loadObjects(); buildNotice = ok ? 'Saved. Use Undo to reverse this edit.' : 'Cannot place here: keep furniture inside the floor, clear of solid items and the exit.'; movingItem = false; renderBuildPanel(); }
function buildClick(x, y) {
  if (!ownsRoom(room)) return;
  if (placingType) { const ok = placeFurniture(room, placingType, x, y); if (ok) placingType = null; finishBuild(ok); return; }
  if (movingItem && buildSelection) { finishBuild(moveFurniture(room, buildSelection, x, y)); return; }
  const hit = objects.slice().reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
  buildSelection = hit?.uid || null; buildNotice = hit ? 'Selected ' + hit.label : 'Select a piece of furniture, or choose PLACE from your stored collection.'; renderBuildPanel();
}
function project(x, y) {
  if (camera === 'side') return { x, y: room === 'casino' ? y * 0.65 + 165 : 380 + (y - 280) * 0.22 };
  return { x, y: camera === 'three' ? y * 0.78 + 95 : y };
}
function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }
function drawRoom(c, asset, preview = false) {
  const view = preview ? 'top' : camera;
  const projection = preview ? (x, y) => ({ x, y }) : project;
  const theme = themeFor(asset);
  drawArchitecture(c, asset, view, projection);
  const list = (preview ? roomFurniture(asset) : objects).slice().sort((a, b) => (a.solid === false ? -1 : b.solid === false ? 1 : a.y + a.h - b.y - b.h));
  for (const o of list) {
    const p = projection(o.x, o.y);
    drawFurnishing(c, o, theme, view, projection, performance.now());
    if (preview) continue;
    if (o === nearby && room !== 'casino') { c.font = '12px Inter'; c.textAlign = 'center'; c.fillStyle = '#f4ecdc'; c.fillText(o.label, p.x + o.w / 2, p.y - 30); }
    if (o.kind === 'match') {
      const tableH = camera === 'side' ? Math.max(20, o.h * .3) : o.h * (camera === 'three' ? .78 : 1);
      const tableY = p.y - (camera === 'top' ? 0 : 20);
      const cellX = 8, cellY = camera === 'side' ? 2 : camera === 'three' ? 6 : 8;
      const boardX = p.x + (o.w - cellX * 8) / 2;
      const boardY = tableY + (tableH - cellY * 8) / 2;
      rect(c, boardX - 5, boardY - 3, cellX * 8 + 10, cellY * 8 + 6, '#38251f');
      rect(c, boardX - 3, boardY - 2, cellX * 8 + 6, cellY * 8 + 4, theme.trim);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) rect(c, boardX + x * cellX, boardY + y * cellY, cellX, cellY, (x + y) % 2 ? '#77654f' : '#e0ceaa');
      c.font = `bold ${Math.max(3, cellY)}px monospace`; c.textAlign = 'center';
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const piece = matches[o.index].state.board[y * 16 + x];
        if (piece) { c.fillStyle = piece === piece.toUpperCase() ? '#ffffff' : '#171d22'; c.fillText(piece.toUpperCase(), boardX + cellX / 2 + x * cellX, boardY + cellY + y * cellY); }
      }
      if (o.index < 2 || currentMatch === matches[2]) {
        for (const [i, name] of matches[o.index].names.entries()) {
          const chair = project(o.x + (i ? 163 : -40), o.y + 24);
          drawCharacter(c, o.index === 2 && i === 0 ? get().character : characterFor(name), chair.x, chair.y - 25, 2, { action: 'sit', facing: i ? -1 : 1 });
        }
      }
    }
  }
}
function render() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio);
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  const scale = Math.min(r.width / W, r.height / H) * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
  drawRoom(ctx, room);
  if (building) {
    ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 85; x <= 815; x += 10) { ctx.moveTo(x, 115); ctx.lineTo(x, 465); } for (let y = 115; y <= 465; y += 10) { ctx.moveTo(85, y); ctx.lineTo(815, y); } ctx.stroke();
    const o = objects.find(o => o.uid === buildSelection); if (o) { ctx.strokeStyle = '#f4cf75'; ctx.lineWidth = 3; ctx.strokeRect(o.x - 3, o.y - 3, o.w + 6, o.h + 6); }
    return;
  }
  if (room === 'store' || room === 'office') {
    const p = project(450, 205);
    ctx.fillStyle = '#d5b978'; ctx.fillRect(p.x - 27, p.y + 4, 54, 3); ctx.fillRect(p.x - 33, p.y - 1, 6, 3); ctx.fillRect(p.x + 27, p.y - 1, 6, 3);
    const merchant = adminSettings().npcs[room === 'store' ? 'Maple' : 'Rowan'];
    if (!merchant?.deleted) drawCharacter(ctx, merchant?.character || characterFor(room === 'store' ? 'Maple' : 'Rowan'), p.x - 24, p.y - 72, 3, { action: 'idle', facing: 1 });
    ctx.fillStyle = '#f2d084'; ctx.font = 'bold 22px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; if (!merchant?.deleted) ctx.fillText('?', p.x, p.y - 113);  }
  if (room === 'casino') drawLounge(ctx, project, camera);
  const p = project(player.x, player.y);
  ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
  drawCharacter(ctx, get().character, p.x - 24, p.y - 72, 3, { action: keys.size || target ? 'walk' : 'idle', frame: player.frame, facing: player.facing });
  ctx.fillStyle = '#eef0e2'; ctx.font = '14px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; if (room !== 'casino') ctx.fillText(get().profile.name, p.x, p.y - 83);
}
function blocked(x, y) { return objects.some(o => o.solid !== false && x > o.x - 15 && x < o.x + o.w + 15 && y > o.y - 8 && y < o.y + o.h + 12); }
function loop(now) {
  if (!active) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (building || !panel.hidden) { render(); raf = requestAnimationFrame(loop); return; }
  let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (target && !dx && !dy) { const dist = Math.hypot(target.x - player.x, target.y - player.y); if (dist < 8) target = null; else { dx = (target.x - player.x) / dist; dy = (target.y - player.y) / dist; } }
  const n = Math.max(1, Math.hypot(dx, dy));
  const x = Math.max(95, Math.min(805, player.x + dx / n * dt * 190 * movementBoost().speed));
  const y = Math.max(115, Math.min(475, player.y + dy / n * dt * 190 * movementBoost().speed));
  if (!blocked(x, player.y)) player.x = x;
  if (!blocked(player.x, y)) player.y = y;
  if (dx) player.facing = Math.sign(dx); player.frame = Math.floor(now / 120) % 4;
  nearby = room === 'casino' ? objects.filter(o => !['furniture', 'casino-stool'].includes(o.kind)).map(o => ({ o, distance: Math.hypot(Math.max(o.x - player.x, 0, player.x - o.x - o.w), Math.max(o.y - player.y, 0, player.y - o.y - o.h)) })).filter(v => v.distance < 70).sort((a, b) => a.distance - b.distance)[0]?.o || null : objects.find(o => o.kind !== 'furniture' && Math.hypot(player.x - (o.x + o.w / 2), player.y - (o.y + o.h / 2)) < o.w / 2 + 90);
  action.hidden = !nearby; action.textContent = nearby ? nearby.label + ' ↗' : '';
  trackPresence({ view: room, x: player.x, y: player.y }, false);
  render(); raf = requestAnimationFrame(loop);
}
function setCamera(value) { camera = ['side', 'top', 'three'].includes(value) ? value : 'top'; localStorage.setItem('pg-room-camera', camera); root.querySelectorAll('[data-camera]').forEach(b => { b.classList.toggle('active', b.dataset.camera === camera); b.setAttribute('aria-pressed', String(b.dataset.camera === camera)); }); }
export function setInteriorActive(on) { active = on; keys.clear(); target = null; cancelAnimationFrame(raf); if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } }
export function enterInterior(name, exit) {
  room = name; onExit = exit; player.x = 450; player.y = 475; currentMatch = null; panel.hidden = true; selected = null;
  const theme = themeFor(name);
  root.style.setProperty('--room-accent', theme.accent);
  root.style.setProperty('--room-trim', theme.trim);
  root.style.background = theme.bg;
  root.querySelector('#room-name').textContent = name === 'casino' ? 'NEON GAMBIT CASINO' : name === 'hall' ? 'TOURNAMENT HALL' : name === 'store' ? 'GENERAL STORE' : name === 'office' ? 'PROPERTY OFFICE' : name === 'training' ? 'TRAINING HALL' : name === 'boutique' ? 'CHESS BOUTIQUE' : ASSETS[name.replace('home:', '')]?.name || 'Home';
  toggleBuild(false); buildNotice = ''; buildButton.hidden = !ownsRoom(name); if (ownsRoom(name)) ensureRoom(name);
  loadObjects(); setCamera(camera);
  if (name === 'store' || name === 'office') { setTimeout(() => { if (active && room === name) greet(); }, 350); }
}
function button(label, fn, parent = content) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = () => { sfx.click(); fn(); }; parent.append(b); return b; }
function openPanel(title, text = '') { panel.classList.remove('dialogue-panel', 'match-panel'); panel.hidden = false; keys.clear(); target = null; content.replaceChildren(); const h = document.createElement('h2'); h.textContent = title; content.append(h); if (text) { const p = document.createElement('p'); p.textContent = text; content.append(p); } }
function dialogue(text) {
  const originalName = room === 'store' ? 'Maple' : 'Rowan';
  const merchant = adminSettings().npcs[originalName];
  const name = merchant?.name || originalName;
  openPanel(name); panel.classList.add('dialogue-panel');
  const portrait = document.createElement('canvas'); portrait.width = 96; portrait.height = 112; portrait.className = 'dialogue-portrait'; portrait.setAttribute('aria-label', name + ' portrait'); drawCharacter(portrait.getContext('2d'), merchant?.character || characterFor(originalName), 16, 7, 4); content.prepend(portrait);
  const role = document.createElement('span'); role.className = 'dialogue-role'; role.textContent = room === 'store' ? 'GENERAL MERCHANT' : 'PROPERTY AGENT'; content.append(role);
  const speech = document.createElement('p'); speech.className = 'dialogue-speech'; speech.textContent = text; content.append(speech);
  const choices = document.createElement('div'); choices.className = 'dialogue-choices'; content.append(choices);
  button(room === 'store' ? 'SHOW ME YOUR GOODS' : 'SHOW ME THE PROPERTIES', catalog, choices);
  button('ANY NEWS AROUND TOWN?', () => dialogue('The Tournament Hall has exhibition games running. The Training Hall has computers for practice. Take your time—there is plenty to discover.'), choices);
  button('MAYBE LATER', () => { panel.hidden = true; }, choices);
}
function greet() {
  const merchant = adminSettings().npcs[room === 'store' ? 'Maple' : 'Rowan'];
  if (merchant?.deleted) { catalog(); return; }
  if (merchant?.dialogue && !merchant.deleted) { dialogue(merchant.dialogue); return; }
  dialogue(room === 'store' ? 'Welcome, traveler! Fresh seeds, trusty tools, and a fair price for your catch. What can I help you find?' : 'A place to call your own? Let’s find something that suits you. You can inspect every property inside and out before buying.');
}
export function drawPropertyExterior(c, asset) {
  const t = themeFor(asset);
  rect(c, 180, 175, 540, 275, t.wall); rect(c, 155, 150, 590, 35, t.accent); rect(c, 180, 425, 540, 25, t.wood);
  for (let row = 0, y = 190; y < 420; y += 18, row++) { rect(c, 185, y, 530, 2, '#00000020'); for (let x = 185 + (row % 2) * 24; x < 710; x += 48) { rect(c, x, y, 1, 18, '#00000020'); rect(c, x + 3, y + 3, Math.min(40, 710 - x), 1, '#ffffff25'); } }
  rect(c, 720, 182, 20, 267, t.wood); rect(c, 180, 183, 540, 7, '#00000035');
  rect(c, 390, 325, 110, 125, t.trim); rect(c, 400, 335, 90, 115, t.wood); rect(c, 472, 390, 6, 6, t.trim);
  for (const x of [230, 570]) { rect(c, x - 7, 223, 114, 104, t.trim); rect(c, x, 230, 100, 90, '#8db2be'); rect(c, x + 47, 230, 6, 90, t.wall); rect(c, x, 272, 100, 6, t.wall); rect(c, x - 12, 330, 124, 15, t.accent); for (let i = 0; i < 5; i++) rect(c, x + i * 21, 320, 16, 13, '#5f8554'); }
  c.fillStyle = '#f8ebce'; c.font = '26px Inter'; c.textAlign = 'center'; c.fillText(ASSETS[asset].name, 450, 110);
}
function preview(asset, outside, parent) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 224; c.className = 'property-preview'; c.setAttribute('aria-label', `${ASSETS[asset].name} ${outside ? 'exterior' : 'interior'} preview`); parent.append(c);
  const cc = c.getContext('2d'); cc.scale(0.4, 0.4);
  if (!outside) drawRoom(cc, asset, true);
  else { rect(cc, 0, 0, W, H, '#24374b'); rect(cc, 0, 450, W, 110, '#477151'); drawPropertyExterior(cc, asset); }
}
function catalog() {
  openPanel(room === 'store' ? 'General store' : 'Property listings', `Wallet: ${fmt(get().wallet)} coins · virtual currency only`);
  if (room === 'store') {
    for (const [id, item] of Object.entries(ITEMS)) {
      const row = document.createElement('article'); row.className = 'catalog-card'; content.append(row);
      const h = document.createElement('h3'); h.textContent = item.name; row.append(h);
      const p = document.createElement('p'); p.textContent = `${item.desc} · Owned: ${get().inventory[id] || 0}`; row.append(p);
      if (item.buy !== null) { const b = button(`BUY · ${fmt(shopPrice(item.buy))}`, () => { if (adjust(-shopPrice(item.buy), 'Bought ' + item.name)) { update(s => { s.inventory[id] = (s.inventory[id] || 0) + 1; }); sfx.cash(); catalog(); } }, row); b.disabled = get().wallet < shopPrice(item.buy); }
      if (item.sell !== null) { const b = button(`SELL ONE · ${fmt(item.sell)}`, () => { update(s => { s.inventory[id]--; if (!s.inventory[id]) delete s.inventory[id]; }); adjust(item.sell, 'Sold ' + item.name); sfx.cash(); catalog(); }, row); b.disabled = !(get().inventory[id] > 0); }
    }
  } else {
    for (const [id, asset] of Object.entries(ASSETS)) {
      const row = document.createElement('article'); row.className = 'catalog-card'; content.append(row);
      const h = document.createElement('h3'); h.textContent = asset.name; row.append(h);
      const p = document.createElement('p'); p.textContent = `${asset.desc} · ${fmt(assetRate(id, 1))} coins/hour`; row.append(p);
      const previews = document.createElement('div'); previews.className = 'property-previews'; row.append(previews); preview(id, true, previews); preview(id, false, previews);
      if (get().assets[id]) button('VISIT OWNED INTERIOR', () => { enterInterior('home:' + id, onExit); }, row);
      else { const b = button(`BUY · ${fmt(shopPrice(asset.cost))}`, () => { if (adjust(-shopPrice(asset.cost), 'Bought ' + asset.name)) { update(s => { s.assets[id] = { level: 1 }; }); sfx.win(); catalog(); } }, row); b.disabled = get().wallet < shopPrice(asset.cost); }
    }
  }
}
function showTraining() {
  currentMatch = null; selected = null;
  openPanel('Chess computer', 'Practice without stakes. Choose a bot game or a curated mate-in-one puzzle.');
  button('PLAY BOT · DIFFICULTY OPTIONS', () => {
    panel.hidden = true; location.hash = 'play';
    document.querySelector('#mode-seg [data-mode="cpu"]').click();
  });
  button('PUZZLES · MATE IN ONE', startPuzzle);
}
function startPuzzle() {
  const puzzle = PUZZLES[puzzleIndex];
  currentMatch = { state: parseFen(puzzle.fen), moves: [], names: [get().profile.name, 'Puzzle'], done: false };
  mode = 'puzzle'; selected = null; puzzleFeedback = ''; showMatch();
}
function interact() { if (!nearby) return; sfx.select(); if (nearby.kind === 'bar') { openBar(content, openPanel); } else if (nearby.kind === 'casino-game') { document.querySelector(`.casino-tabs [data-game="${nearby.game}"]`).click(); location.hash = 'casino'; } else if (nearby.kind === 'boutique') openCatalog('boutique'); else if (nearby.kind === 'shop') greet(); else if (nearby.kind === 'computer') showTraining(); else { currentMatch = matches[nearby.index]; mode = nearby.index === 2 ? 'choose' : 'spectate'; selected = null; if (mode === 'choose') { openPanel('Take a seat', 'Local play for now. Exhibition opponents are simulated, not online players.'); button('PLAY CPU', () => { currentMatch.state = parseFen(START_FEN); currentMatch.moves = []; currentMatch.clock = [300, 300]; currentMatch.done = false; currentMatch.names = [get().profile.name, 'CPU']; mode = 'cpu'; showMatch(); }); button('PASS & PLAY', () => { currentMatch.state = parseFen(START_FEN); currentMatch.moves = []; currentMatch.clock = [300, 300]; currentMatch.done = false; currentMatch.names = ['White · local', 'Black · local']; mode = 'local'; showMatch(); }); } else showMatch(); } }
function showMatch() {
  const m = currentMatch;
  openPanel(mode === 'puzzle' ? PUZZLES[puzzleIndex].name : `${m.names[0]} vs ${m.names[1]}`, mode === 'puzzle' ? 'White to move · checkmate in one · no clock or coin stakes' : mode === 'spectate' ? 'LIVE EXHIBITION · SIMULATED PLAYERS · 5-minute game' : 'LOCAL MATCH · 5-minute game · promotion defaults to queen');
  panel.classList.add('match-panel');
  const status = document.createElement('p'); status.id = 'hall-match-status'; status.setAttribute('aria-live', 'polite'); status.textContent = mode === 'puzzle' ? puzzleFeedback || 'Find the mating move.' : m.done ? `Finished · ${m.result}` : `${m.state.turn === 'w' ? 'White' : 'Black'} to move · ${m.clock.map(t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`).join(' / ')}`; content.append(status);
  const board = document.createElement('div'); board.className = 'hall-board'; content.append(board);
  const legal = legalMoves(m.state);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const sq = y * 16 + x, b = document.createElement('button'); b.className = 'hall-square' + ((y + x) % 2 ? ' dark' : '') + (selected === sq ? ' selected' : '');
    b.setAttribute('aria-label', `${'abcdefgh'[x]}${8 - y}`); const piece = m.state.board[sq]; if (piece) b.append(pieceImg(piece.toUpperCase(), piece === piece.toUpperCase() ? 'w' : 'b'));
    b.disabled = mode === 'spectate' || m.done || (mode === 'cpu' && m.state.turn === 'b');
    if (selected !== null && legal.some(v => v.from === selected && v.to === sq)) b.classList.add('legal-target');
    b.onclick = () => {
      const move = legal.find(v => v.from === selected && v.to === sq && (!v.promotion || v.promotion.toLowerCase() === 'q'));
      if (move) {
        if (mode === 'puzzle' && statusOf(makeMove(m.state, move)).kind !== 'checkmate') puzzleFeedback = 'That move is legal, but not checkmate. Try again.';
        else { apply(m, move); if (mode === 'puzzle') puzzleFeedback = 'Solved · checkmate!'; }
        selected = null;
      } else selected = legal.some(v => v.from === sq) ? sq : null;
      showMatch();
    }; board.append(b);
  }
  const history = document.createElement('p'); history.textContent = m.moves.join(' '); history.className = 'hall-moves'; content.append(history);
  if (mode === 'puzzle') {
    button('HINT', () => { puzzleFeedback = PUZZLES[puzzleIndex].hint; showMatch(); });
    button(m.done ? 'NEXT PUZZLE' : 'RESTART PUZZLE', () => { if (m.done) puzzleIndex = (puzzleIndex + 1) % PUZZLES.length; startPuzzle(); });
  }
  button('LEAVE TABLE', () => { panel.hidden = true; currentMatch = null; selected = null; });
}
function apply(m, move) { const legal = legalMoves(m.state); m.moves.push(moveNotation(m.state, move, legal)); m.state = makeMove(m.state, move); const status = statusOf(m.state); if (status.over || m.moves.length >= 160) { m.done = true; m.result = status.winner ? `${status.winner === 'w' ? 'White' : 'Black'} wins by ${status.kind}` : status.kind || 'Exhibition complete'; } sfx.move(); }
setInterval(() => {
  const now = performance.now(), dt = Math.min(2, (now - matchTick) / 1000); matchTick = now;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i], exhibition = i < 2;
    if (m.done || (!exhibition && (currentMatch !== m || !['cpu', 'local'].includes(mode)))) continue;
    const side = m.state.turn === 'w' ? 0 : 1; m.clock[side] = Math.max(0, m.clock[side] - dt);
    if (!m.clock[side]) { m.done = true; m.result = `${side ? 'White' : 'Black'} wins on time`; }
    m.since += dt;
    if (!m.done && m.since > (exhibition ? 4 : 0.8) && (exhibition || (mode === 'cpu' && side === 1))) {
      m.since = 0; const moves = legalMoves(m.state);
      if (!exhibition && !m.thinking && moves.length) {
        m.thinking = true; const position = m.state;
        stockfishMove(position, moves).then(move => { if (m.state === position && !m.done && currentMatch === m && mode === 'cpu') apply(m, move); }).catch(() => { if (m.state === position) { m.done = true; m.result = 'Stockfish unavailable · restart to retry'; } }).finally(() => { m.thinking = false; });
      } else if (exhibition && moves.length) apply(m, moves[Math.floor(Math.random() * moves.length)]);
      else if (!moves.length) { m.done = true; m.result = statusOf(m.state).reason || 'Game over'; }
    }
  }
  if (active && !panel.hidden && currentMatch && !['choose', 'puzzle'].includes(mode)) { const scroll = panel.scrollTop; showMatch(); panel.scrollTop = scroll; }
}, 1000);
root.querySelector('#room-exit').onclick = () => { panel.hidden = true; onExit(); };
root.querySelector('#room-panel-close').onclick = () => { panel.hidden = true; currentMatch = null; };
action.onclick = interact;
root.querySelectorAll('[data-camera]').forEach(b => b.onclick = () => setCamera(b.dataset.camera));
window.addEventListener('keydown', e => { if (!active || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (building) { if (k === 'escape') toggleBuild(false); return; } if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); target = null; e.preventDefault(); } if (k === 'e') interact(); if (k === 'v') setCamera(['side', 'top', 'three'][(['side', 'top', 'three'].indexOf(camera) + 1) % 3]); if (k === 'escape') { panel.hidden = true; currentMatch = null; } });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / W, r.height / H);
  const x = (e.clientX - r.left - (r.width - W * scale) / 2) / scale;
  const sy = (e.clientY - r.top - (r.height - H * scale) / 2) / scale;
  const y = camera === 'side' ? (room === 'casino' ? (sy - 165) / 0.65 : (sy - 380) / 0.22 + 280) : camera === 'three' ? (sy - 95) / 0.78 : sy;
  if (!active) return;
  if (building) { buildClick(x, y); return; }
  target = { x: Math.max(95, Math.min(805, x)), y: Math.max(115, Math.min(475, y)) };
});
root.querySelectorAll('[data-direction]').forEach(b => { b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(b.dataset.direction); target = null; }; b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.direction); });
