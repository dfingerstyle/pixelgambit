import { get, update, subscribe, fmt, levelOf, netWorth, ITEMS, shopPrice } from './state.js';
import { pieceImg, smoothSprite, pieceSprite } from './sprites.js';
import { drawCharacter } from './character.js';
import { applyBoard, boardTexture } from './workshop.js';
import { sfx } from './audio.js';
import { net, onNet } from './online.js';
import { FURNITURE, drawFurnishing, ROOM_THEMES } from './furniture.js';
import { renderAdminBook, resetAdminBookSession } from './admin-book.js';
import { setAdminPermitted } from './admin-settings.js';

export const BOARDS = {
  classic: { name: 'Classic Walnut', light: '#eed7b0', dark: '#9a6b42', cost: 0 },
  marble: { name: 'Silver Marble', light: '#e3deca', dark: '#716f68', cost: 550 },
  jade: { name: 'Jade Garden', light: '#d6ede0', dark: '#3b7a65', cost: 750 },
  rose: { name: 'Rose Quartz', light: '#f1d6df', dark: '#965773', cost: 750 },
  obsidian: { name: 'Obsidian Gold', light: '#bca986', dark: '#292c35', cost: 1200 },
  glacier: { name: 'Glacier Glass', light: '#dae7e9', dark: '#7d9094', cost: 900 },
};
const PRODUCTS = [
  ...Object.entries(BOARDS).map(([id, b]) => ({ id: 'board:' + id, category: 'boards', ...b, value: id, desc: 'Board palette · all playable chess interfaces.' })),
  { id: 'pieces:classic', category: 'pieces', name: 'Classic Staunton', value: 'classic', cost: 0, desc: 'Crisp scalable pieces. The default, not pixel art.' },
  { id: 'pieces:pixel', category: 'pieces', name: 'Pixel Heritage', value: 'pixel', cost: 0, desc: 'The original pixel set, now optional.' },
  { id: 'pieces:chrome', category: 'pieces', name: 'Silver Chrome', value: 'chrome', cost: 750, desc: 'Cool silver and blue, with clean outlines.' },
  { id: 'pieces:ember', category: 'pieces', name: 'Ember Royal', value: 'ember', cost: 950, desc: 'Ivory, burgundy and warm gold.' },
  { id: 'finish:spark', category: 'finishers', name: 'Golden Spark', value: 'spark', cost: 650, desc: 'A short gold celebration after checkmate.' },
  { id: 'finish:ice', category: 'finishers', name: 'Ice Pulse', value: 'ice', cost: 650, desc: 'A cool blue pulse after checkmate.' },
  { id: 'bundle:silver', category: 'bundles', name: 'Silver Collection', cost: 1100, contents: ['board:marble', 'pieces:chrome', 'finish:ice'], desc: 'Silver Marble + Chrome pieces + Ice Pulse.' },
  { id: 'bundle:royal', category: 'bundles', name: 'Royal Collection', cost: 1900, contents: ['board:obsidian', 'pieces:ember', 'finish:spark'], desc: 'Obsidian Gold + Ember pieces + Golden Spark.' },
  { id: 'outfit:sage', category: 'clothing', name: 'Sage Everyday', cost: 250, shirt: '#7fa650', pants: '#5c4a32', desc: 'A soft green shirt and warm brown trousers.' },
  { id: 'outfit:rose', category: 'clothing', name: 'Rose Streetwear', cost: 400, shirt: '#e05a8a', pants: '#22262e', desc: 'Rose shirt with charcoal trousers.' },
  { id: 'outfit:royal', category: 'clothing', name: 'Royal Evening', cost: 600, shirt: '#5a6fd8', pants: '#4a3b52', desc: 'Indigo and plum for your next tournament.' },
  { id: 'outfit:monochrome', category: 'clothing', name: 'Monochrome', cost: 350, shirt: '#e8e4df', pants: '#22262e', desc: 'Clean ivory and black.' },
  { id: 'outfit:charcoal-suit', category: 'clothing', name: 'Charcoal Suit', cost: 600, shirt: '#e8e4df', pants: '#34343f', jacket: 'charcoal', desc: 'Tailored jacket, lapels, ivory shirt and matching trousers. Add a tie separately.' },
  { id: 'outfit:navy-suit', category: 'clothing', name: 'Navy Suit', cost: 600, shirt: '#d5e4eb', pants: '#273952', jacket: 'navy', desc: 'A navy jacket with pocket detail and pale blue shirt.' },
  { id: 'outfit:ivory-suit', category: 'clothing', name: 'Ivory Evening Suit', cost: 800, shirt: '#34343f', pants: '#d6c9ae', jacket: 'ivory', desc: 'Warm ivory tailoring with a dark shirt. Pair with a bow tie.' },
  { id: 'accessory:red-tie', category: 'accessories', name: 'Crimson Tie', cost: 150, slot: 'neckwear', value: 'red', desc: 'Independent neckwear slot. Works with any shirt or suit.' },
  { id: 'accessory:gold-tie', category: 'accessories', name: 'Gold Tie', cost: 200, slot: 'neckwear', value: 'gold', desc: 'A warm gold tie for tournament night.' },
  { id: 'accessory:blue-tie', category: 'accessories', name: 'Blue Tie', cost: 150, slot: 'neckwear', value: 'blue', desc: 'A cool blue tie, equipped separately from your outfit.' },
  { id: 'accessory:bow-tie', category: 'accessories', name: 'Crimson Bow Tie', cost: 200, slot: 'neckwear', value: 'bow', desc: 'Compact formal neckwear with a bright knot.' },
  { id: 'accessory:glasses', category: 'accessories', name: 'Round Glasses', cost: 250, slot: 'eyewear', value: 'round', desc: 'Pixel frames with a separate eyewear slot.' },
  { id: 'accessory:shades', category: 'accessories', name: 'Midnight Shades', cost: 300, slot: 'eyewear', value: 'dark', desc: 'Dark lenses with a small reflected highlight.' },
  { id: 'accessory:fedora', category: 'accessories', name: 'Felt Fedora', cost: 350, slot: 'headwear', value: 'fedora', desc: 'A felt hat with a contrasting band. Does not replace your hairstyle.' },
  { id: 'outfit:track', category: 'gym', name: 'Crimson Training Kit', cost: 450, shirt: '#d84a4a', pants: '#2b3a4a', desc: 'Red athletic top and navy track trousers. Cosmetic only.' },
  { id: 'outfit:teal', category: 'gym', name: 'Teal Training Kit', cost: 450, shirt: '#4fae7a', pants: '#22262e', desc: 'Teal and black sportswear. Cosmetic only.' },
  { id: 'outfit:coach', category: 'gym', name: 'Coach Kit', cost: 600, shirt: '#e0a23a', pants: '#3b4252', desc: 'Amber sports top with slate trousers. Cosmetic only.' },
];
const BANNERS = { aurora: 'linear-gradient(125deg,#172d40,#476758,#593c79)', sakura: 'linear-gradient(125deg,#442740,#b96e8b,#e2a693)', inferno: 'linear-gradient(125deg,#1c1224,#9f3545,#d99547)', sea: 'linear-gradient(125deg,#112834,#28788b,#74b2ba)', midnight: 'linear-gradient(125deg,#080a10,#242a3e,#444564)', gold: 'linear-gradient(125deg,#292015,#957446,#dfbf77)' };
const modal = document.createElement('div'); modal.className = 'cosmetic-modal'; modal.hidden = true;
modal.innerHTML = '<section class="cosmetic-panel" role="dialog" aria-modal="true" aria-labelledby="catalog-title"><button class="cosmetic-close" aria-label="Close catalog">×</button><div id="catalog-content"></div></section>';
document.body.append(modal);
const content = modal.querySelector('#catalog-content');
let shop = 'boutique', tab = 'bundles', lastFocus;
function el(tag, text, className) { const n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; }
function btn(text, fn, parent, active = false) { const b = el('button', text, 'btn' + (active ? ' selected' : '')); b.type = 'button'; b.onclick = fn; parent.append(b); return b; }
function price(p) { return shopPrice(p.cost); }
function owns(p) { return price(p) === 0 || (p.contents ? p.contents.every(id => get().cosmetics.owned.includes(id)) : get().cosmetics.owned.includes(p.id)); }
function equipped(p) {
  const e = get().cosmetics.equipped;
  if (p.slot) return get().character[p.slot] === p.value;
  return p.category === 'boards' ? e.board === p.value : p.category === 'pieces' ? e.pieces === p.value : p.category === 'finishers' ? e.finish === p.value : p.shirt ? e.outfit === p.id && get().character.shirt === p.shirt && get().character.pants === p.pants && (get().character.jacket || 'none') === (p.jacket || 'none') : false;
}
function equip(p) {
  if (!owns(p)) return;
  if (p.contents) { for (const id of p.contents) equip(PRODUCTS.find(v => v.id === id)); return; }
  update(s => {
    if (p.category === 'boards') { s.cosmetics.equipped.board = p.value; s.board = { preset: p.value, light: BOARDS[p.value].light, dark: BOARDS[p.value].dark }; }
    if (p.category === 'pieces') s.cosmetics.equipped.pieces = p.value;
    if (p.category === 'finishers') s.cosmetics.equipped.finish = p.value;
    if (p.shirt) { s.cosmetics.equipped.outfit = p.id; s.character.shirt = p.shirt; s.character.pants = p.pants; s.character.jacket = p.jacket || 'none'; }
    if (p.slot) { s.character[p.slot] = p.value; s.cosmetics.equipped[p.slot] = p.id; }
  });
  applyBoard(); sfx.select();
}
function unequip(p) { update(s => { s.character[p.slot] = 'none'; delete s.cosmetics.equipped[p.slot]; }); sfx.select(); }
function buy(p) {
  if (owns(p) || get().wallet < price(p)) return;
  update(s => {
    s.wallet -= price(p);
    s.ledger.unshift({ t: Date.now(), amount: -price(p), reason: 'Cosmetic: ' + p.name }); s.ledger = s.ledger.slice(0, 120);
    for (const id of p.contents || [p.id]) if (!s.cosmetics.owned.includes(id)) s.cosmetics.owned.push(id);
  });
  sfx.cash(); renderCatalog();
}
function boardPreview(p, parent, large = false) {
  const config = p.contents ? PRODUCTS.find(v => v.id === p.contents.find(id => id.startsWith('board:'))) : p;
  const b = BOARDS[config?.category === 'boards' ? config.value : get().cosmetics.equipped.board] || BOARDS.classic;
  const style = p.category === 'pieces' ? p.value : p.contents ? p.contents.find(id => id.startsWith('pieces:'))?.split(':')[1] : get().cosmetics.equipped.pieces;
  const grid = el('div', '', 'cosmetic-board' + (large ? ' large' : '')); grid.style.setProperty('--preview-light', b.light); grid.style.setProperty('--preview-dark', b.dark); grid.dataset.palette = config?.value || 'classic'; grid.style.setProperty('--preview-texture-light', boardTexture(config?.category === 'boards' ? config.value : get().board.preset)); grid.style.setProperty('--preview-texture-dark', boardTexture(config?.category === 'boards' ? config.value : get().board.preset, true)); parent.append(grid);
  const ranks = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const cell = el('span', '', (x + y) % 2 ? 'dark' : ''); if (ranks[y][x]) { const t = ranks[y][x]; const img = pieceImg(t.toUpperCase(), y > 4 ? 'w' : 'b', '', style); img.dataset.previewPiece = 'true'; cell.append(img); } grid.append(cell); }
}
function productPreview(p, parent) {
  if (p.shirt || p.slot) { const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 180; canvas.className = 'outfit-preview'; parent.append(canvas); const c = canvas.getContext('2d'); c.fillStyle = '#202633'; c.fillRect(0, 0, 180, 180); drawCharacter(c, { ...get().character, ...(p.shirt ? { shirt: p.shirt, pants: p.pants, jacket: p.jacket || 'none' } : { [p.slot]: p.value }) }, 50, 24, 5, { action: 'idle' }); }
  else if (p.category === 'finishers') { const v = el('div', 'CHECKMATE', 'finisher-preview finish-' + p.value); parent.append(v); }
  else boardPreview(p, parent);
}
export function openCatalog(kind = 'boutique') {
  shop = kind; tab = kind === 'inventory' ? 'inventory' : kind === 'clothing' ? 'clothing' : kind === 'gym' ? 'gym' : 'bundles'; lastFocus = document.activeElement;
  renderCatalog(); modal.hidden = false; window.dispatchEvent(new Event('catalog-open')); modal.querySelector('.cosmetic-close').focus();
}
function closeCatalog() { testBookOpen = false; modal.hidden = true; window.dispatchEvent(new Event('catalog-close')); lastFocus?.focus(); }
modal.querySelector('.cosmetic-close').onclick = closeCatalog;
modal.onclick = e => { if (e.target === modal) closeCatalog(); };
window.addEventListener('keydown', e => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeCatalog();
  if (e.key === 'Tab') { const nodes = [...modal.querySelectorAll('button:not(:disabled),input,select,textarea')]; const i = nodes.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); nodes.at(-1)?.focus(); } else if (!e.shiftKey && i === nodes.length - 1) { e.preventDefault(); nodes[0]?.focus(); } }
});
function renderCatalog() {
  content.classList.remove('admin-book-content');
  if (shop === 'inventory') { renderBag(); return; }
  content.replaceChildren(); content.append(el('p', shop === 'inventory' ? 'PLAYER INVENTORY' : shop === 'gym' ? 'GYM · OUTDOOR SERVICE COUNTER' : shop === 'clothing' ? 'THREAD & PIXEL · WINDOW SHOP' : 'THE CHESS BOUTIQUE', 'kicker'));
  const title = el('h2', shop === 'inventory' ? 'Your bag & equipment.' : shop === 'gym' ? 'Ready for your next session.' : shop === 'clothing' ? 'Dress your world avatar.' : 'Make every game yours.'); title.id = 'catalog-title'; content.append(title);
  content.append(el('p', `${fmt(get().wallet)} coins · virtual currency only · purchases use the prototype wallet`, 'shop-wallet'));
  if (shop === 'clothing' || shop === 'gym') content.append(el('p', 'This storefront has no enterable interior. Browse here and equip your outfit immediately.', 'shop-note'));
  const tabs = el('nav', '', 'cosmetic-tabs'); content.append(tabs);
  for (const key of shop === 'boutique' ? ['bundles', 'boards', 'pieces', 'finishers', 'inventory'] : shop === 'inventory' ? ['inventory', 'clothing', 'accessories', 'boards', 'pieces', 'tools'] : shop === 'clothing' ? ['clothing', 'accessories', 'inventory'] : [shop, 'inventory']) btn(key.toUpperCase(), () => { tab = key; renderCatalog(); }, tabs, tab === key);
  const grid = el('div', '', 'cosmetic-grid'); content.append(grid);
  const items = PRODUCTS.filter(p => shop === 'inventory' ? owns(p) && !p.contents && (tab === 'inventory' || p.category === tab) : tab === 'inventory' ? owns(p) && !p.contents && (shop === 'boutique' ? !p.shirt && !p.slot : p.shirt || p.slot) : p.category === tab);
  for (const p of items) {
    const card = el('article', '', 'cosmetic-card'); card.dataset.product = p.id; grid.append(card); productPreview(p, card);
    card.append(el('span', owns(p) ? equipped(p) ? 'EQUIPPED' : 'OWNED' : p.contents ? 'COLLECTION' : 'COSMETIC', 'product-status'), el('h3', p.name), el('p', p.desc));
    btn('PREVIEW', () => {
      content.replaceChildren(); const detailTitle = el('h2', p.name); detailTitle.id = 'catalog-title'; content.append(detailTitle); productPreview(p, content); content.append(el('p', p.desc));
      btn('BACK TO CATALOG', renderCatalog, content);
      if (owns(p)) btn('EQUIP', () => { equip(p); renderCatalog(); }, content);
      else { const buyButton = btn('BUY · ' + fmt(price(p)), () => buy(p), content); buyButton.disabled = get().wallet < price(p); }
    }, card);
    if (p.slot && equipped(p)) btn('UNEQUIP', () => { unequip(p); renderCatalog(); }, card);
    else if (owns(p)) btn(equipped(p) ? 'EQUIPPED' : 'EQUIP', () => { equip(p); renderCatalog(); }, card).disabled = equipped(p);
    else btn('BUY · ' + fmt(price(p)), () => buy(p), card).disabled = get().wallet < price(p);
  }
  if (shop === 'inventory' && ['inventory', 'tools'].includes(tab)) renderResources(grid);
  if (shop === 'inventory' && tab === 'inventory') renderBookReservation(content);
  if (!grid.children.length) grid.append(el('p', 'No items in this category yet. Browse the town shops to grow your collection.'));
}

let bagSelection = null, bagFilter = 'all';
function bagItems() {
  const list = PRODUCTS.filter(p => !p.contents && owns(p)).map(p => ({ id: p.id, name: p.name, count: 1, kind: 'cosmetic', product: p }));
  for (const [id, count] of Object.entries(get().inventory)) if (ITEMS[id] && count > 0) list.push({ id: 'resource:' + id, name: ITEMS[id].name, count, kind: 'resource', resource: id });
  const stored = {};
  for (const r of Object.values(get().propertyRooms)) for (const [type, qty] of Object.entries(r.stored)) stored[type] = (stored[type] || 0) + qty;
  for (const [type, count] of Object.entries(stored)) if (count > 0 && FURNITURE[type]) list.push({ id: 'furniture:' + type, name: FURNITURE[type].name, count, kind: 'furniture', furniture: type });
  return list;
}
function bagIcon(item, parent) {
  if (item.product?.category === 'pieces') { parent.append(pieceImg('N', 'w', '', item.product.value)); return; }
  if (item.product?.category === 'boards') { const b = BOARDS[item.product.value]; const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const c = canvas.getContext('2d'); c.fillStyle = '#392b24'; c.fillRect(5, 5, 54, 54); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? b.dark : b.light; c.fillRect(8 + x * 12, 8 + y * 12, 12, 12); } parent.append(canvas); return; }
  if (item.product?.category === 'finishers') { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const c = canvas.getContext('2d'); c.fillStyle = item.product.value === 'ice' ? '#9bd5ec' : '#e6bd68'; c.fillRect(28, 7, 8, 50); c.fillRect(7, 28, 50, 8); c.fillRect(18, 18, 28, 28); c.fillStyle = '#fff2c4'; c.fillRect(26, 26, 12, 12); parent.append(canvas); return; }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; parent.append(canvas); const c = canvas.getContext('2d');
  if (item.product) { const p = item.product; drawCharacter(c, { ...get().character, ...(p.shirt ? { shirt: p.shirt, pants: p.pants, jacket: p.jacket || 'none' } : { [p.slot]: p.value }) }, 16, 5, 2); }
  else if (item.furniture) { const f = FURNITURE[item.furniture], scale = Math.min(50 / f.w, 48 / f.h); c.scale(scale, scale); drawFurnishing(c, { ...f, type: item.furniture, x: 6 / scale, y: 6 / scale }, ROOM_THEMES.flat, 'top', (x, y) => ({ x, y })); }
  else { const r = item.resource; c.fillStyle = '#b28451'; c.fillRect(28, 15, 5, 37); if (r === 'shovel') { c.fillStyle = '#b2c1c6'; c.fillRect(21, 39, 19, 15); c.fillStyle = '#e0d8b9'; c.fillRect(23, 12, 16, 5); } else if (r === 'fishing_rod') { c.fillRect(31, 12, 17, 4); c.fillStyle = '#c6d6d6'; c.fillRect(47, 16, 1, 32); c.fillStyle = '#b9534a'; c.fillRect(43, 43, 8, 7); } else { c.clearRect(0, 0, 64, 64); c.fillStyle = r.includes('carrot') ? '#d88c43' : '#669ba9'; c.fillRect(16, 24, 32, 20); c.fillStyle = '#97bb69'; c.fillRect(25, 13, 6, 13); c.fillRect(31, 10, 10, 6); c.fillStyle = '#e6dca1'; c.fillRect(19, 29, 5, 5); } }
}
function renderBag() {
  content.replaceChildren(); const title = el('h2', 'Inventory'); title.id = 'catalog-title'; content.append(title, el('p', 'Select a slot to inspect or equip. Select an item, then click a hotbar slot to pin it. Furniture stays in the property where it was purchased.', 'shop-note'));
  const layout = el('div', '', 'bag-layout'); content.append(layout);
  const equipment = el('section', '', 'bag-equipment'); equipment.append(el('h3', 'EQUIPMENT')); const portrait = el('div', '', 'bag-avatar'); renderPortrait(portrait, { ...get().presentation, portraitImage: null }); equipment.append(portrait); layout.append(equipment);
  const all = bagItems();
  for (const [label, slot] of [['HAT', 'headwear'], ['EYES', 'eyewear'], ['NECK', 'neckwear'], ['OUTFIT', 'outfit'], ['BOARD', 'board'], ['PIECES', 'pieces']]) {
    const row = el('div', '', 'equipment-row'); row.append(el('small', label)); const product = PRODUCTS.find(p => equipped(p) && (p.slot === slot || slot === 'outfit' && p.shirt || slot === 'board' && p.category === 'boards' || slot === 'pieces' && p.category === 'pieces'));
    const b = btn('', () => { bagSelection = product?.id || null; renderBag(); }, row); b.className = 'bag-slot'; b.setAttribute('aria-label', label + ': ' + (product?.name || 'empty')); if (product) bagIcon(all.find(i => i.id === product.id), b); equipment.append(row);
  }
  const storage = el('section', '', 'bag-storage'); layout.append(storage); const filters = el('nav', '', 'cosmetic-tabs'); storage.append(filters);
  for (const kind of ['all', 'cosmetic', 'resource', 'furniture']) btn(kind.toUpperCase(), () => { bagFilter = kind; renderBag(); }, filters, bagFilter === kind);
  const visible = all.filter(i => bagFilter === 'all' || i.kind === bagFilter); const grid = el('div', '', 'bag-grid'); storage.append(grid);
  const total = Math.max(36, Math.ceil(visible.length / 9) * 9);
  for (let index = 0; index < total; index++) { const item = visible[index]; const b = btn('', () => { bagSelection = item?.id || null; renderBag(); }, grid); b.className = 'bag-slot' + (item?.id === bagSelection ? ' selected' : ''); b.setAttribute('aria-label', item ? item.name + ' × ' + item.count : 'Empty slot ' + (index + 1)); if (item) { b.title = item.name; bagIcon(item, b); if (item.count > 1) b.append(el('span', String(item.count), 'stack-count')); } }
  storage.append(el('h3', 'HOTBAR · SAVED QUICK ACCESS')); const bar = el('div', '', 'bag-hotbar'); storage.append(bar);
  get().quickbar.forEach((id, index) => { const item = all.find(i => i.id === id); const b = btn('', () => { if (bagSelection && all.some(i => i.id === bagSelection)) update(s => { s.quickbar[index] = bagSelection; }); else bagSelection = item?.id || null; renderBag(); }, bar); b.className = 'bag-slot'; b.setAttribute('aria-label', 'Hotbar ' + (index + 1) + ': ' + (item?.name || 'empty')); b.append(el('small', String(index + 1), 'slot-number')); if (item) bagIcon(item, b); });
  btn('CLEAR HOTBAR', () => { update(s => { s.quickbar.fill(null); }); renderBag(); }, storage);
  const detail = el('section', '', 'bag-detail'); storage.append(detail); const item = all.find(i => i.id === bagSelection);
  if (item) { detail.append(el('h3', item.name), el('p', 'Quantity: ' + item.count)); if (item.product) { const p = item.product; detail.append(el('p', p.desc)); if (p.slot && equipped(p)) btn('UNEQUIP', () => { unequip(p); renderBag(); }, detail); else btn(equipped(p) ? 'EQUIPPED' : 'EQUIP', () => { equip(p); renderBag(); }, detail).disabled = equipped(p); } else detail.append(el('p', item.furniture ? 'Enter the owning property and choose BUILD → PLACE. This count totals storage across your properties.' : ITEMS[item.resource].desc + ' Use tools through their town activities, and sell resources at the General Store.')); }
  else detail.append(el('p', 'Select an item slot to see its details.'));
  renderBookReservation(content);
}
function renderResources(parent) {
  for (const [id, qty] of Object.entries(get().inventory)) {
    if (!ITEMS[id] || qty <= 0) continue;
    const card = el('article', '', 'cosmetic-card'); card.dataset.resource = id;
    card.append(el('span', ITEMS[id].kind.toUpperCase(), 'product-status'), el('h3', ITEMS[id].name), el('p', 'Quantity: ' + qty), el('p', ITEMS[id].desc)); parent.append(card);
  }
}
function renderBookReservation(parent) {
  const section = el('section', '', 'book-reservation'); const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 112;
  const c = canvas.getContext('2d'); c.fillStyle = '#180f1e'; c.fillRect(18, 13, 65, 85); c.fillStyle = '#a62f43'; c.fillRect(12, 7, 65, 85); c.fillStyle = '#542337'; c.fillRect(12, 7, 10, 85); c.fillStyle = '#d8bb73'; c.fillRect(23, 12, 49, 3); c.fillRect(23, 83, 49, 3); c.fillRect(23, 12, 3, 74); c.fillRect(69, 12, 3, 74); c.fillRect(39, 38, 17, 21); c.fillStyle = '#7b263c'; c.fillRect(42, 41, 11, 15); c.fillStyle = '#e4d2a1'; c.fillRect(23, 93, 54, 3); c.fillStyle = '#de9265'; c.fillRect(16, 19, 3, 58);
  canvas.setAttribute('aria-label', 'Red leather admin grimoire with gold trim'); section.append(canvas, el('h3', guestTestAllowed() ? 'Admin grimoire · guest test access' : 'Admin grimoire · reserved staff item'), el('p', guestTestAllowed() ? 'Local testing only. Open the book to test coins and inventory. This does not grant staff roles, crowns or multiplayer permissions.' : 'Staff roles and server-authorized actions must be configured before this book can open admin controls. Browser saves and avatar packets cannot grant access.'));
  if (guestTestAllowed()) btn('OPEN TEST ADMIN BOOK', openTestBook, section);
  parent.append(section);
}
function guestTestAllowed() { return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !net.user && ['local', 'signed-out'].includes(net.status); }
let testBookOpen = false;
function openTestBook() {
  if (!guestTestAllowed()) return;
  testBookOpen = true;
  setAdminPermitted(true);
  renderAdminBook(content, guestTestAllowed, openInventory, PRODUCTS);
}
onNet(() => { const allowed = guestTestAllowed(); setAdminPermitted(allowed); if (!allowed) { resetAdminBookSession(); if (testBookOpen) closeCatalog(); } });
export function openInventory() { testBookOpen = false; openCatalog('inventory'); }
const bagButton = el('button', 'BAG · I', 'btn world-bag'); bagButton.id = 'world-bag'; bagButton.onclick = openInventory; document.querySelector('#view-world').append(bagButton);
const worldHotbar = el('nav', '', 'world-hotbar'); worldHotbar.setAttribute('aria-label', 'Inventory quick access'); document.querySelector('#view-world').append(worldHotbar);
function renderWorldHotbar() {
  worldHotbar.replaceChildren(); const items = bagItems(); get().quickbar.forEach((id, index) => { const item = items.find(i => i.id === id); const b = btn('', () => { bagSelection = item?.id || null; openInventory(); }, worldHotbar); b.className = 'bag-slot'; b.setAttribute('aria-label', 'Quick slot ' + (index + 1) + ': ' + (item?.name || 'empty')); b.append(el('small', String(index + 1), 'slot-number')); if (item) bagIcon(item, b); });
}
subscribe(renderWorldHotbar); renderWorldHotbar();
window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'i' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && modal.hidden && ['#world', '#interior'].includes(location.hash) && !document.querySelector('#profile-modal:not([hidden]), #settings-modal:not([hidden])')) { e.preventDefault(); openInventory(); } });
const studio = document.createElement('section'); studio.id = 'view-studio'; studio.className = 'view studio-view'; studio.innerHTML = '<div class="studio-header"><button class="btn" id="studio-back">← TOWN</button><div><p class="kicker">PROFILE STUDIO</p><h1>Your identity, your style.</h1></div><button class="btn" id="studio-account">ACCOUNT</button></div><nav id="studio-tabs" class="cosmetic-tabs"></nav><div id="studio-body"></div>';
document.querySelector('main').append(studio);
let studioTab = 'appearance', draft = null;
const profileButton = el('button', 'OPEN PROFILE STUDIO', 'btn btn-primary'); profileButton.id = 'open-profile-studio';
document.querySelector('#profile-save').after(profileButton);
profileButton.onclick = () => { document.querySelector('#profile-modal').hidden = true; openStudio(); };
const wardrobeButton = el('button', 'WARDROBE & PROFILE STUDIO', 'btn'); wardrobeButton.onclick = () => { document.querySelector('#settings-close').click(); openStudio(); }; document.querySelector('.settings-side').append(wardrobeButton);
studio.querySelector('#studio-back').onclick = () => { location.hash = 'world'; };
studio.querySelector('#studio-account').onclick = () => document.querySelector('#profile-chip').click();
export function openStudio() { draft = structuredClone(get().presentation); studioTab = 'appearance'; renderStudio(); location.hash = 'studio'; }
function profileImage(value) { return typeof value === 'string' && value.length < 2000000 && /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : ''; }
function previewProfile(parent) { return renderProfileCard(parent, draft || get().presentation); }
export function renderPortrait(parent, p = get().presentation, size = 120) {
  parent.replaceChildren();
  if (profileImage(p.portraitImage)) { const image = document.createElement('img'); image.src = profileImage(p.portraitImage); image.alt = 'Profile portrait'; parent.append(image); }
  else { const c = document.createElement('canvas'); c.width = c.height = size; drawCharacter(c.getContext('2d'), get().character, size * .23, size * .1, size / 30); parent.append(c); }
}
export function renderProfileCard(parent, p = get().presentation) {
  const card = el('article', '', 'studio-profile');
  card.style.setProperty('--profile-accent', p.accent); card.dataset.particles = p.particles;
  card.style.background = p.banner === 'upload' && profileImage(p.bannerImage) ? `linear-gradient(#1113,#1119),url("${profileImage(p.bannerImage)}") center/cover` : BANNERS[p.banner] || BANNERS.aurora;
  const portrait = el('div', '', 'studio-portrait frame-' + p.frame);
  renderPortrait(portrait, p);
  card.append(portrait);
  const name = el('h2', get().profile.name, 'name-effect-' + p.nameEffect); card.append(name, el('p', 'LEVEL ' + levelOf(get().xp) + ' · ' + (get().profile.name === 'Guest' ? 'LOCAL PLAYER' : 'PLAYER PROFILE'), 'profile-meta'));
  if (p.bio) card.append(el('p', p.bio, 'profile-bio'));
  const stats = el('div', '', 'studio-stats'); for (const [label, value] of [['Coins', fmt(get().wallet)], ['Net worth', fmt(netWorth())], ['Local chess games', get().chessHistory.length], ['Cosmetics', get().cosmetics.owned.length]]) { const stat = el('div'); stat.append(el('strong', String(value)), el('small', label)); stats.append(stat); } card.append(stats);
  const equippedList = el('div', '', 'equipped-list'); for (const product of PRODUCTS.filter(v => !v.contents && equipped(v))) equippedList.append(el('span', product.name)); card.append(el('h3', 'Equipped'), equippedList);
  if (p.inventoryVisible) { const inventory = el('div', '', 'equipped-list'); for (const id of get().cosmetics.owned) inventory.append(el('span', PRODUCTS.find(v => v.id === id)?.name || id)); card.append(el('h3', 'Cosmetic inventory'), inventory); }
  parent.append(card); return card;
}
function renderStudio() {
  if (!draft) draft = structuredClone(get().presentation);
  const tabs = studio.querySelector('#studio-tabs'); tabs.replaceChildren();
  for (const key of ['appearance', 'inventory', 'achievements', 'history']) btn(key.toUpperCase(), () => { studioTab = key; renderStudio(); }, tabs, studioTab === key);
  const body = studio.querySelector('#studio-body'); body.replaceChildren();
  if (studioTab === 'appearance') {
    const columns = el('div', '', 'studio-columns'); body.append(columns); const preview = el('div', '', 'studio-preview'); previewProfile(preview); columns.append(preview);
    const controls = el('div', '', 'studio-controls'); columns.append(controls);
    const refresh = () => { preview.replaceChildren(); previewProfile(preview); preview.querySelector('h2').textContent = controls.querySelector('input[aria-label="Display name"]')?.value || get().profile.name; };
    const field = (title, values, key) => { controls.append(el('h3', title)); const row = el('div', '', 'studio-choices'); controls.append(row); for (const value of values) { const b = btn(value.toUpperCase(), () => { draft[key] = value; row.querySelectorAll('button').forEach(n => n.classList.toggle('selected', n === b)); refresh(); }, row, draft[key] === value); if (key === 'banner') b.style.background = BANNERS[value]; } };
    field('Banner', Object.keys(BANNERS), 'banner');
    field('Avatar frame', ['none', 'gold', 'silver', 'neon', 'ice', 'rainbow'], 'frame');
    field('Name effect', ['normal', 'gold', 'glow', 'rainbow'], 'nameEffect');
    field('Particles', ['none', 'stars', 'petals', 'snow'], 'particles');
    controls.append(el('h3', 'Accent color')); const colors = el('div', '', 'studio-choices'); controls.append(colors);
    for (const color of ['#8b7bfa', '#36c9dc', '#e25c82', '#d9a14c', '#54b991', '#5288d8']) { const b = btn('', () => { draft.accent = color; refresh(); }, colors); b.classList.add('accent-swatch'); b.style.background = color; b.setAttribute('aria-label', 'Accent ' + color); }
    controls.append(el('h3', 'Display name & bio')); const name = document.createElement('input'); name.value = get().profile.name; name.maxLength = 20; name.setAttribute('aria-label', 'Display name'); name.oninput = refresh; controls.append(name);
    const bio = document.createElement('textarea'); bio.value = draft.bio; bio.maxLength = 80; bio.setAttribute('aria-label', 'Bio'); bio.oninput = () => { draft.bio = bio.value; refresh(); }; controls.append(bio);
    const visible = document.createElement('input'); visible.type = 'checkbox'; visible.checked = draft.inventoryVisible; visible.onchange = () => { draft.inventoryVisible = visible.checked; refresh(); }; const label = el('label', '', 'inventory-check'); label.append(visible, document.createTextNode(' Show cosmetic inventory in my profile preview')); controls.append(label);
    const note = el('p', '', 'studio-note'); controls.append(note);
    for (const [text, key] of [['Upload portrait', 'portraitImage'], ['Upload banner', 'bannerImage']]) {
      const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.hidden = true; controls.append(file);
      btn(text, () => file.click(), controls);
      file.onchange = async () => { const f = file.files[0]; if (!f) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) { note.textContent = 'Choose a PNG, JPEG or WebP under 5 MB.'; return; }
        try { const bitmap = await createImageBitmap(f); const c = document.createElement('canvas'); c.width = key === 'portraitImage' ? 160 : 600; c.height = key === 'portraitImage' ? 160 : 250; const scale = Math.max(c.width / bitmap.width, c.height / bitmap.height); const sw = c.width / scale, sh = c.height / scale; c.getContext('2d').drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, c.width, c.height); bitmap.close(); draft[key] = c.toDataURL('image/webp', .75); if (key === 'bannerImage') draft.banner = 'upload'; note.textContent = 'Image resized for your profile. Saved only when you press Save.'; refresh(); } catch { note.textContent = 'That image could not be decoded.'; }
      };
    }
    btn('RESET IMAGES', () => { delete draft.portraitImage; delete draft.bannerImage; if (draft.banner === 'upload') draft.banner = 'aurora'; refresh(); }, controls);
    btn('SAVE PROFILE', () => { update(s => { s.presentation = structuredClone(draft); s.profile.name = name.value.trim().slice(0, 20) || 'Guest'; }); refresh(); note.textContent = 'Profile saved.'; sfx.select(); }, controls);
    btn('OPEN WARDROBE', () => openCatalog('clothing'), controls);
  } else if (studioTab === 'inventory') { body.append(el('h2', 'Your slot inventory'), el('p', 'Open your bag for equipment slots, stacked resources, stored furniture and a saved nine-slot hotbar.')); btn('OPEN INVENTORY', openInventory, body); btn('CHESS BOUTIQUE', () => openCatalog(), body); btn('CLOTHING', () => openCatalog('clothing'), body); btn('GYM OUTFITS', () => openCatalog('gym'), body); }
  else if (studioTab === 'achievements') { body.append(el('h2', 'Town milestones'), el('p', 'Local progression only. No invented online ratings or tournament ranks.')); const grid = el('div', '', 'achievement-grid'); body.append(grid); for (const [name, desc, unlocked, tier] of [['First Outfit', 'Own any avatar outfit.', get().cosmetics.owned.some(id => id.startsWith('outfit:')), 'COMMON'], ['Collector', 'Own five cosmetics.', get().cosmetics.owned.length >= 5, 'RARE'], ['Homeowner', 'Own a property.', Object.keys(get().assets).length > 0, 'RARE'], ['Level Ten', 'Reach level ten.', levelOf(get().xp) >= 10, 'EPIC'], ['First Checkmate', 'Finish a local chess game by checkmate.', get().chessHistory.some(g => g.kind === 'checkmate'), 'COMMON']]) { const card = el('article', '', 'achievement' + (unlocked ? ' unlocked' : '')); card.append(el('small', tier), el('h3', name), el('p', desc), el('strong', unlocked ? 'UNLOCKED' : 'LOCKED')); grid.append(card); } }
  else { body.append(el('h2', 'Recent local chess games'), el('p', 'Bot and pass-and-play results are local, not rated online matches.')); if (!get().chessHistory.length) body.append(el('p', 'No completed games yet. Finish a bot or local match to start your history.')); for (const game of get().chessHistory) { const row = el('article', '', 'history-row'); row.append(el('strong', game.mode === 'cpu' ? 'Bot game' : 'Pass & play'), el('span', game.kind + ' · ' + (game.winner ? game.winner === 'w' ? 'White wins' : 'Black wins' : 'Draw')), el('small', new Date(game.t).toLocaleString())); body.append(row); } }
}
function applyCosmetics() {
  applyBoard();
  const style = get().cosmetics.equipped.pieces;
  for (const img of document.querySelectorAll('img[data-piece]:not([data-preview-piece])')) { img.src = style === 'pixel' ? pieceSprite(img.dataset.piece, img.dataset.side) : smoothSprite(img.dataset.piece, img.dataset.side, style); img.style.imageRendering = style === 'pixel' ? 'pixelated' : 'auto'; img.dataset.pieceStyle = style; }
  const p = get().presentation; const chip = document.querySelector('#profile-chip'); chip.style.setProperty('--profile-accent', p.accent); chip.className = chip.className.replace(/\bframe-\S+/g, '').trim(); chip.classList.add('frame-' + p.frame);
  const name = document.querySelector('#chip-name'); name.className = 'name-effect-' + p.nameEffect;
}
subscribe(applyCosmetics); applyCosmetics();
window.addEventListener('hashchange', () => { if (location.hash === '#studio') { draft = structuredClone(get().presentation); renderStudio(); } });
if (location.hash === '#studio') { draft = structuredClone(get().presentation); renderStudio(); }
export function playFinisher() { const finish = get().cosmetics.equipped.finish; if (finish === 'none') return; const fx = el('div', 'CHECKMATE', 'game-finisher finish-' + finish); document.body.append(fx); setTimeout(() => fx.remove(), 1800); }
