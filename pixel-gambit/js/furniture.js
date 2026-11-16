import { get } from './state.js';
import { drawCasinoArchitecture, drawCasinoFixture } from './casino-art.js';

export const ROOM_THEMES = {
  training: { wall: '#d5e0e2', floor: '#778c91', wood: '#3e5261', accent: '#4d93a1', trim: '#bed3c7', textile: '#6b8ba2', bg: '#172c35' },
  boutique: { wall: '#e2d8cc', floor: '#817168', wood: '#47394b', accent: '#897099', trim: '#d2b882', textile: '#725572', bg: '#252030' },
  hall: { wall: '#ddd0b3', floor: '#68503e', wood: '#493026', accent: '#962e40', trim: '#c6a45e', textile: '#7e2639', bg: '#211b25' },
  casino: { wall: '#302837', floor: '#30262d', wood: '#35252a', accent: '#ac344a', trim: '#d1ad62', textile: '#872745', bg: '#17131d' },
  store: { wall: '#ded5b6', floor: '#9b7951', wood: '#715135', accent: '#65856b', trim: '#c9a26a', textile: '#a87343', bg: '#202c28' },
  office: { wall: '#d9dee0', floor: '#727b82', wood: '#394b60', accent: '#3f6b8a', trim: '#bdab79', textile: '#48637c', bg: '#182633' },
  flat: { wall: '#ece0c8', floor: '#b08c65', wood: '#805b43', accent: '#869776', trim: '#d6b98a', textile: '#bc7965', bg: '#292b2a' },
  townhouse: { wall: '#d9dce7', floor: '#74615a', wood: '#544337', accent: '#817597', trim: '#c9b48b', textile: '#717c9b', bg: '#242331' },
  cafe: { wall: '#e7cdb5', floor: '#a57856', wood: '#734730', accent: '#b9674d', trim: '#e1bb7c', textile: '#668878', bg: '#302522' },
  garage: { wall: '#aab4b7', floor: '#626d72', wood: '#384951', accent: '#d8a84b', trim: '#afbac0', textile: '#496d7b', bg: '#202a30' },
  rig: { wall: '#344b53', floor: '#283a43', wood: '#182930', accent: '#58c4b3', trim: '#829b9c', textile: '#3d7281', bg: '#122028' },
  rack: { wall: '#39465e', floor: '#2b3549', wood: '#1d2636', accent: '#8b9fe7', trim: '#8b9bb8', textile: '#4d679b', bg: '#141c2b' },
};
export const FURNITURE = {
  bed: { name: 'Bed', w: 130, h: 95 }, sofa: { name: 'Sofa', w: 145, h: 60 }, table: { name: 'Table', w: 110, h: 65 },
  chair: { name: 'Chair', w: 32, h: 35 }, plant: { name: 'Plant', w: 36, h: 36 }, shelf: { name: 'Bookshelf', w: 92, h: 62 },
  counter: { name: 'Counter', w: 220, h: 62 }, rack: { name: 'Server rack', w: 60, h: 85 }, desk: { name: 'Desk', w: 125, h: 62 },
  cabinet: { name: 'Cabinet', w: 95, h: 55 }, chess: { name: 'Chess table', w: 155, h: 90 }, rug: { name: 'Rug', w: 195, h: 115, solid: false },
};
const item = (type, x, y, extra = {}) => ({ ...FURNITURE[type], type, x, y, kind: 'furniture', label: FURNITURE[type].name, ...extra });
export function roomFurniture(room) {
  const id = room.replace('home:', '');
  if (room.startsWith('home:') && get().propertyRooms[id]) return get().propertyRooms[id].placed;
  if (id === 'casino') return [
    item('counter', 180, 200, { w: 540, h: 55, kind: 'bar', label: 'Talk to Luna · drinks' }),
    ...[230, 320, 410, 500, 590, 680].map(x => item('chair', x, 275, { kind: 'casino-stool', w: 28, h: 25 })),
    item('table', 110, 340, { w: 210, h: 85, kind: 'casino-game', game: 'roulette', label: 'Play roulette' }),
    item('table', 370, 350, { kind: 'casino-game', game: 'coinflip', label: 'Coin toss' }),
    item('table', 520, 340, { kind: 'casino-game', game: 'dice', label: 'Play dice' }),
    ...[685, 760].map(x => item('table', x, 320, { w: 48, h: 78, kind: 'casino-game', game: 'slots', label: 'Play slots' })),
    item('table', 535, 435, { w: 100, h: 35, kind: 'casino-game', game: 'table', label: 'Local table · not multiplayer' }),
    item('plant', 105, 440), item('plant', 780, 440),
  ];
  if (id === 'hall') return [
    item('shelf', 100, 116), item('cabinet', 704, 116), item('plant', 76, 383), item('plant', 784, 383),
    ...[[130, 230], [555, 230], [360, 365]].flatMap(([x, y], index) => [item('chair', x - 40, y + 24), item('chair', x + 163, y + 24), item('chess', x, y, { kind: 'match', index, label: index === 2 ? 'Sit & play' : `Table ${index + 1} · spectate` })]),
  ];
  if (id === 'training') return [
    ...[[140, 170], [365, 170], [590, 170], [365, 335]].flatMap(([x, y], i) => [item('desk', x, y, { kind: 'computer', label: i === 3 ? 'Puzzles & bot practice' : `Training station ${i + 1}` }), item('chair', x + 46, y + 72)]),
    item('plant', 100, 375), item('plant', 770, 375), item('shelf', 690, 330),
  ];
  if (id === 'boutique') return [item('counter', 340, 220, { kind: 'boutique', label: 'Browse chess cosmetics' }), item('shelf', 110, 145), item('shelf', 695, 145), item('table', 130, 330), item('table', 655, 330), item('plant', 770, 405), item('rug', 335, 325)];
  if (id === 'store' || id === 'office') return [
    item('shelf', 108, 138), item('shelf', 108, 235), item('shelf', 690, 138), item(id === 'store' ? 'shelf' : 'sofa', 660, 260),
    item('plant', 765, 385), item('plant', 95, 385), item('counter', 340, 210, { kind: 'shop', label: id === 'store' ? 'Talk to Maple' : 'Talk to Rowan' }),
  ];
  if (['rig', 'rack'].includes(id)) return [item('rack', 130, 140), item('rack', 210, 140), item('rack', 290, 140), item('rack', 610, 140), item('rack', 690, 140), item('desk', 370, 340), item('cabinet', 690, 350)];
  if (id === 'garage') return [item('counter', 125, 145), item('shelf', 690, 140), item('desk', 575, 300), item('cabinet', 130, 340), item('table', 370, 250)];
  if (id === 'cafe') return [item('counter', 120, 135), item('shelf', 690, 130), ...[180, 410, 640].flatMap(x => [item('table', x, 305), item('chair', x + 36, 265), item('chair', x + 36, 380)]), item('plant', 780, 405)];
  return [item('rug', 525, 190), item('bed', 130, 140), item('cabinet', 280, 145), item('sofa', 570, 150), item('table', 580, 270), item('shelf', 710, 365), item('desk', 130, 340), item('chair', 172, 410), item('plant', 770, 130), item('plant', 360, 150)];
}
export function themeFor(room) { const base = ROOM_THEMES[room.replace('home:', '')] || ROOM_THEMES.flat; const style = room.startsWith('home:') ? get().propertyRooms[room.slice(5)]?.colors : null; return style ? { ...base, ...style } : base; }
function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function drawFurnishing(c, o, theme, camera, project, time = 0) {
  if (camera === 'top' && o.rotation) {
    const base = FURNITURE[o.type]; c.save(); c.translate(o.x + o.w / 2, o.y + o.h / 2); c.rotate(o.rotation * Math.PI / 2); drawFurnishing(c, { ...o, x: -base.w / 2, y: -base.h / 2, w: base.w, h: base.h, rotation: 0 }, theme, camera, (x, y) => ({ x, y }), time); c.restore(); return;
  }
  const p = project(o.x, o.y), x = p.x, y = p.y;
  const w = o.w, h = camera === 'side' ? Math.max(20, o.h * .3) : o.h * (camera === 'three' ? .78 : 1);
  const lift = camera === 'top' ? 0 : ['shelf', 'rack', 'cabinet'].includes(o.type) ? 62 : o.type === 'plant' ? 35 : 20;
  const top = y - lift;
  if (['bar', 'casino-game', 'casino-stool'].includes(o.kind)) { drawCasinoFixture(c, o, camera, project, time); return; }
  if (o.type === 'rug') {
    rect(c, x, y, w, h, theme.textile); rect(c, x + 5, y + 5, w - 10, h - 10, theme.trim); rect(c, x + 9, y + 9, w - 18, h - 18, theme.textile);
    for (let i = 16; i < w - 10; i += 18) { rect(c, x + i, y + 16, 5, 5, theme.trim); rect(c, x + i, y + h - 21, 5, 5, theme.trim); } return;
  }
  rect(c, x + 5, y + 8, w, h, '#00000035');
  if (lift) { rect(c, x + 3, top + h, w - 6, lift, theme.wood); rect(c, x + 8, y + h - 4, 7, 10, '#231e23'); rect(c, x + w - 15, y + h - 4, 7, 10, '#231e23'); }
  rect(c, x, top, w, h, theme.wood); rect(c, x + 3, top + 3, w - 6, h - 6, '#a07852');
  if (['table', 'chess', 'desk', 'counter'].includes(o.type)) {
    for (let i = 10; i < h; i += 9) rect(c, x + 5, top + i, w - 10, 1, '#704d36');
    rect(c, x + 3, top + h - 4, w - 6, 3, theme.trim);
    if (o.type === 'desk') { rect(c, x + 35, top + 7, 47, 26, '#202c36'); rect(c, x + 39, top + 11, 39, 17, theme.accent); rect(c, x + 46, top + 37, 28, 5, '#d0d7ce'); }
    if (o.type === 'counter') { rect(c, x + 25, top + 9, 32, 22, '#344344'); rect(c, x + 28, top + 12, 26, 9, '#9bb59b'); rect(c, x + 95, top + 12, 35, 23, '#ede2bc'); for (let i = 0; i < 3; i++) rect(c, x + 160 + i * 13, top + 12, 8, 15, ['#9c4944', '#64926c', '#d5b362'][i]); }
  }
  if (o.type === 'sofa' || o.type === 'chair') {
    rect(c, x + 3, top + 3, w - 6, h - 6, theme.textile); rect(c, x + 5, top + 3, w - 10, 10, theme.accent);
    rect(c, x + 3, top + 7, 9, h - 10, theme.accent); rect(c, x + w - 12, top + 7, 9, h - 10, theme.accent);
    if (o.type === 'sofa') { for (let i = 0; i < 3; i++) rect(c, x + 17 + i * 38, top + 18, 34, h - 24, theme.textile); rect(c, x + 21, top + 20, 18, 18, theme.trim); }
  }
  if (o.type === 'bed') { rect(c, x + 5, top + 5, w - 10, h - 10, '#eee2ca'); rect(c, x + 9, top + 35, w - 18, h - 40, theme.textile); rect(c, x + 14, top + 12, 43, 19, '#fff0d7'); rect(c, x + 72, top + 12, 43, 19, '#fff0d7'); rect(c, x + 9, top + 38, w - 18, 5, theme.accent); }
  if (o.type === 'cabinet') { const face = h + lift; for (let i = 0; i < 3; i++) { rect(c, x + 5, top + 5 + i * (face - 10) / 3, w - 10, (face - 10) / 3 - 3, '#946d4d'); rect(c, x + w / 2 - 6, top + 12 + i * (face - 10) / 3, 12, 3, theme.trim); } }
  if (o.type === 'shelf') {
    const face = h + lift;
    rect(c, x + 5, top + 5, w - 10, face - 10, '#362f2d');
    for (let row = 0; row < 3; row++) { for (let i = 0; i < 8; i++) rect(c, x + 9 + i * 9, top + 8 + row * (face - 10) / 3, 6, Math.max(6, (face - 10) / 3 - 4), ['#a75450', '#819475', '#c6a45e', '#66849b'][i % 4]); rect(c, x + 5, top + 6 + (row + 1) * (face - 10) / 3, w - 10, 3, theme.trim); }
  }
  if (o.type === 'rack') { rect(c, x + 3, top + 3, w - 6, h - 6, '#182730'); for (let i = 0; i < 6; i++) { const yy = top + 7 + i * (h - 10) / 6; rect(c, x + 7, yy, w - 14, 7, '#435563'); rect(c, x + 10, yy + 2, 3, 3, Math.sin(time / 700 + i) > 0 ? theme.accent : '#8bc19b'); rect(c, x + 19, yy + 2, w - 30, 1, '#1b2931'); } }
  if (o.type === 'plant') { rect(c, x, top, w, h, theme.floor); rect(c, x + 11, top + h - 13, 16, 16, '#ba7f55'); rect(c, x + 16, top + 7, 4, h - 13, '#56704a'); for (const [dx, dy] of [[3, 9], [17, 3], [20, 15], [7, 20]]) { rect(c, x + dx, top + dy, 13, 9, '#527d58'); rect(c, x + dx + 2, top + dy, 8, 3, '#88a56b'); } }
}
export function drawArchitecture(c, room, camera, project) {
  if (room === 'casino') { drawCasinoArchitecture(c, camera); return; }
  const t = themeFor(room), side = camera === 'side';
  rect(c, 0, 0, 900, 560, t.bg);
  rect(c, 65, 78, 770, 420, t.floor);
  c.save(); c.beginPath(); c.rect(65, 78, 770, 420); c.clip();
  for (let y = 78, row = 0; y < 498; y += 24, row++) {
    for (let x = 17 + (row % 2) * 48, col = 0; x < 835; x += 96, col++) {
      rect(c, x, y, 95, 23, ['#ffffff08', '#0000000c', '#deb37610', '#00000016'][(row * 3 + col) % 4]);
      rect(c, x, y, 1, 24, '#00000024'); rect(c, x + 6, y + 7, 28, 1, '#ffffff0b');
    }
    rect(c, 65, y, 770, 1, '#00000024');
  }
  c.restore();
  const wallH = side ? 350 : 45;
  rect(c, 65, 65, 770, wallH, t.wall);
  rect(c, 65, 65 + wallH - 14, 770, 14, t.wood); rect(c, 65, 65 + wallH - 16, 770, 3, t.trim);
  for (let x = 80; x < 835; x += 46) rect(c, x, 65 + wallH - 12, 2, 12, t.trim);
  rect(c, 65, 65, 770, 4, t.trim); rect(c, 65, 65, 8, 433, t.wood); rect(c, 827, 65, 8, 433, t.wood);
  for (const x of [215, 590]) {
    const yy = side ? 145 : 72, hh = side ? 130 : 29;
    rect(c, x - 8, yy - 5, 130, hh + 10, t.wood); rect(c, x, yy, 114, hh, '#83a6b4'); rect(c, x + 4, yy + 4, 48, hh - 8, '#b3d2d3');
    rect(c, x + 54, yy, 5, hh, t.trim); rect(c, x, yy + hh / 2, 114, 3, t.trim);
    rect(c, x - 17, yy - 5, 13, hh + 12, t.accent); rect(c, x + 119, yy - 5, 13, hh + 12, t.accent);
  }
  if (room === 'hall') {
    const p = project(330, 118); rect(c, p.x, p.y, 205, side ? 77 : 350 * (camera === 'three' ? .78 : 1), t.textile);
    for (const x of [334, 530]) rect(c, x, p.y + 4, 2, side ? 69 : 342 * (camera === 'three' ? .78 : 1), t.trim);
    const yy = side ? 145 : 76; rect(c, 395, yy, 110, side ? 100 : 24, t.accent);
    c.fillStyle = t.trim; c.textAlign = 'center'; c.font = 'bold 12px monospace'; c.fillText('GAMBIT HALL', 450, yy + (side ? 50 : 16));
    for (const x of [100, 775]) { const p = project(x, 305); const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 80); g.addColorStop(0, '#ffe4a02b'); g.addColorStop(1, '#ffe4a000'); c.fillStyle = g; c.fillRect(p.x - 80, p.y - 80, 160, 160); rect(c, p.x - 2, p.y - 28, 4, 30, t.trim); rect(c, p.x - 13, p.y - 33, 26, 9, '#f0cf83'); }
  }
  rect(c, 414, 479, 72, 19, t.wood); rect(c, 419, 483, 62, 3, t.trim);
}
