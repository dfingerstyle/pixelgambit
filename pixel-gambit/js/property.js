import { get, update, subscribe, shopPrice } from './state.js';
import { FURNITURE, roomFurniture } from './furniture.js';

export const FURNITURE_PRICES = { bed: 900, sofa: 650, table: 300, chair: 120, plant: 100, shelf: 400, counter: 800, rack: 2400, desk: 550, cabinet: 350, chess: 700, rug: 250 };
export const ROOM_STYLES = { original: {}, woodland: { floor: '#90704d', wall: '#dfd4b8', textile: '#668878' }, midnight: { floor: '#3d4458', wall: '#858ba0', textile: '#71618a' }, rose: { floor: '#976e67', wall: '#ecd5ce', textile: '#ac667c' }, coastal: { floor: '#8bada4', wall: '#dce6dd', textile: '#547f9b' } };
const undoStacks = new Map();
export function ownsRoom(room) { return room.startsWith('home:') && Boolean(get().assets[room.slice(5)]); }
export function ensureRoom(room) {
  if (!ownsRoom(room)) return null;
  const id = room.slice(5);
  if (!get().propertyRooms[id]) update(s => { s.propertyRooms[id] = { placed: roomFurniture(room).map((o, i) => ({ ...o, uid: 'starter-' + i, rotation: 0 })), stored: {}, style: 'original' }; });
  return get().propertyRooms[id];
}
export function propertyRoom(room) { return get().propertyRooms[room.slice(5)]; }
function commit(room, fn, cost = 0) {
  if (!ownsRoom(room) || get().wallet < cost) return false;
  const before = structuredClone(ensureRoom(room));
  const stack = undoStacks.get(room) || []; stack.push({ before, refund: cost }); if (stack.length > 30) stack.shift(); undoStacks.set(room, stack);
  update(s => { s.wallet -= cost; fn(s.propertyRooms[room.slice(5)]); }); return true;
}
export function undoRoom(room) {
  if (!ownsRoom(room)) return false;
  const step = undoStacks.get(room)?.pop(); if (!step) return false;
  update(s => { s.propertyRooms[room.slice(5)] = step.before; s.wallet += step.refund; }); return true;
}
export function canUndoRoom(room) { return Boolean(undoStacks.get(room)?.length); }
export function buyFurniture(room, type) {
  if (!FURNITURE[type]) return false;
  return commit(room, r => { r.stored[type] = (r.stored[type] || 0) + 1; }, shopPrice(FURNITURE_PRICES[type]));
}
export function fits(room, candidate, ignoredUid) {
  if (candidate.x < 85 || candidate.y < 115 || candidate.x + candidate.w > 815 || candidate.y + candidate.h > 465) return false;
  if (candidate.solid === false) return true;
  return !propertyRoom(room).placed.some(o => o.uid !== ignoredUid && o.solid !== false && candidate.x < o.x + o.w && candidate.x + candidate.w > o.x && candidate.y < o.y + o.h && candidate.y + candidate.h > o.y);
}
export function placeFurniture(room, type, x, y) {
  const r = ensureRoom(room); if (!r || !FURNITURE[type] || !(r.stored[type] > 0)) return false;
  const o = { ...FURNITURE[type], type, kind: 'furniture', label: FURNITURE[type].name, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10, rotation: 0, uid: crypto.randomUUID() };
  if (!fits(room, o)) return false;
  return commit(room, r => { r.stored[type]--; r.placed.push(o); });
}
export function moveFurniture(room, uid, x, y) {
  if (!ownsRoom(room)) return false;
  const o = propertyRoom(room).placed.find(o => o.uid === uid); if (!o) return false;
  const next = { ...o, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 };
  if (!fits(room, next, uid)) return false;
  return commit(room, r => Object.assign(r.placed.find(o => o.uid === uid), next));
}
export function rotateFurniture(room, uid) {
  if (!ownsRoom(room)) return false;
  const o = propertyRoom(room).placed.find(o => o.uid === uid); if (!o) return false;
  const next = { ...o, w: o.h, h: o.w, rotation: ((o.rotation || 0) + 1) % 4 };
  if (!fits(room, next, uid)) return false;
  return commit(room, r => Object.assign(r.placed.find(o => o.uid === uid), next));
}
export function storeFurniture(room, uid) {
  if (!ownsRoom(room)) return false;
  const o = propertyRoom(room).placed.find(o => o.uid === uid); if (!o) return false;
  return commit(room, r => { r.stored[o.type] = (r.stored[o.type] || 0) + 1; r.placed = r.placed.filter(p => p.uid !== uid); });
}
export function paintRoom(room, surface, color) { return ['floor', 'wall'].includes(surface) && /^#[a-f0-9]{6}$/i.test(color) && commit(room, r => { r.colors = { ...r.colors, [surface]: color }; }); }
export function styleRoom(room, style) { return Object.hasOwn(ROOM_STYLES, style) && commit(room, r => { r.style = style; r.colors = ROOM_STYLES[style]; }); }
let world = get();
subscribe(s => { if (s !== world) { undoStacks.clear(); world = s; } });
