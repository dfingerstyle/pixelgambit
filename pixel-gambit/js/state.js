// One shared world: wallet, XP, inventory, assets, history, profile.
// Persisted locally; every mutation flows through here.
import { adminSettings } from './admin-settings.js';
const KEY = 'pg-world-v1';
export const shopPrice = base => Math.round(base * adminSettings().economy.shopMultiplier);

export const ITEMS = {
  fishing_rod: { name: 'Fishing Rod', kind: 'tool', buy: 500, sell: null, icon: '🎣', desc: 'Needed to fish.' },
  shovel: { name: 'Shovel', kind: 'tool', buy: 500, sell: null, icon: '⛏', desc: 'Needed to farm.' },
  carrot_seed: { name: 'Carrot Seed', kind: 'seed', buy: 20, sell: null, icon: '🌱', desc: 'Grows into a carrot in 60s.' },
  minnow: { name: 'Minnow', kind: 'fish', buy: null, sell: 40, icon: '🐟', desc: 'Tiny but honest.' },
  bass: { name: 'Bass', kind: 'fish', buy: null, sell: 150, icon: '🐠', desc: 'A solid catch.' },
  golden_koi: { name: 'Golden Koi', kind: 'fish', buy: null, sell: 5000, icon: '🐡', desc: 'Basically a lottery ticket.' },
  carrot: { name: 'Carrot', kind: 'crop', buy: null, sell: 45, icon: '🥕', desc: 'Crunchy profit.' },
};

export const ASSETS = {
  flat: { name: 'Starter Flat', kind: 'Property', cost: 5000, rate: 60, icon: '🏠', desc: 'A cozy pixel flat. Rent trickles in.' },
  townhouse: { name: 'Townhouse', kind: 'Property', cost: 25000, rate: 340, icon: '🏘', desc: 'Three floors of tenants.' },
  cafe: { name: 'Corner Café', kind: 'Business', cost: 15000, rate: 200, icon: '☕', desc: 'Coffee, cake, coins.' },
  garage: { name: 'Repair Garage', kind: 'Business', cost: 45000, rate: 640, icon: '🔧', desc: 'Fixes pixel cars all night.' },
  rig: { name: 'Basic Mining Rig', kind: 'Mining', cost: 12000, rate: 150, icon: '⛏', desc: 'Fictional coin mining. No real crypto.' },
  rack: { name: 'Server Rack', kind: 'Mining', cost: 60000, rate: 820, icon: '🖥', desc: 'A humming wall of virtual hashes.' },
};
export const MAX_ASSET_LEVEL = 5;
export const upgradeCost = (id, level) => Math.round(ASSETS[id].cost * 0.8 * Math.pow(1.6, level));
export const assetRate = (id, level) => Math.round(ASSETS[id].rate * level * Math.pow(1.25, level - 1) * adminSettings().economy.incomeMultiplier);

const residents = [
  { name: 'PixelQueen', avatar: 'Q', worth: 482000, level: 21, xp: 21000, profit: 64200 },
  { name: 'RookStar', avatar: 'R', worth: 301500, level: 17, xp: 13800, profit: 41800 },
  { name: 'en_passant', avatar: 'P', worth: 233000, level: 15, xp: 10600, profit: -12400 },
  { name: 'KnightOwl', avatar: 'N', worth: 187400, level: 13, xp: 8100, profit: 22100 },
  { name: 'DeepSeaDan', avatar: 'B', worth: 142800, level: 11, xp: 5900, profit: 8300 },
  { name: 'SakuraSpin', avatar: 'K', worth: 96500, level: 9, xp: 3900, profit: -4600 },
  { name: 'CoinGoblin', avatar: 'P', worth: 61200, level: 7, xp: 2300, profit: 14900 },
  { name: 'StalemateSteve', avatar: 'N', worth: 28900, level: 5, xp: 1100, profit: -2100 },
];
export const RESIDENTS = residents; // simulated world residents, labelled in UI

function defaults() {
  return {
    profile: { name: 'Guest', avatar: 'N' },
    character: { skin: '#f2c9a0', hair: '#3a2a20', hairStyle: 'short', shirt: '#7fa650', pants: '#3b4252' },
    wallet: 1000,
    xp: 0,
    inventory: {},
    assets: {},
    propertyRooms: {},
    quickbar: Array(9).fill(null),
    lastCollect: Date.now(),
    cooldowns: { work: 0, fish: 0 },
    plots: [null, null, null, null],
    casino: { bets: 0, wins: 0, wagered: 0, returned: 0, history: [] },
    ledger: [{ t: Date.now(), amount: 1000, reason: 'Welcome grant' }],
    board: { preset: 'classic', light: null, dark: null },
    cosmetics: { owned: [], equipped: { board: 'classic', pieces: 'classic', finish: 'none' } },
    presentation: { banner: 'aurora', frame: 'none', nameEffect: 'normal', particles: 'none', accent: '#8b7bfa', bio: '', inventoryVisible: true },
    chessHistory: [],
    seats: [{ name: 'You', balance: 1000, main: true }],
    tableChat: [],
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch { /* corrupted save falls through to defaults */ }
  return defaults();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full/blocked */ }
}

export function get() { return state; }

export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Adopt a cloud save wholesale (login on a newer device).
export function replaceWorld(w) {
  state = { ...defaults(), ...w };
  save();
  listeners.forEach((l) => l(state));
}

export function levelOf(xp) { return 1 + Math.floor(Math.sqrt(xp / 50)); }
export function xpForNext(level) { return 50 * level * level; }

export function addXp(n) {
  update((s) => { s.xp += n; });
}

// Adjust wallet; returns false when funds are insufficient. Records a ledger entry.
export function adjust(amount, reason) {
  if (state.wallet + amount < 0) return false;
  update((s) => {
    s.wallet += amount;
    s.ledger.unshift({ t: Date.now(), amount, reason });
    if (s.ledger.length > 120) s.ledger.length = 120;
  });
  return true;
}

export function recordBet(game, stake, payout, detail) {
  update((s) => {
    s.casino.bets++;
    if (payout > stake) s.casino.wins++;
    s.casino.wagered += stake;
    s.casino.returned += payout;
    s.casino.history.unshift({ t: Date.now(), game, stake, payout, detail });
    if (s.casino.history.length > 60) s.casino.history.length = 60;
    s.xp += 1;
  });
}

export function casinoProfit() { return state.casino.returned - state.casino.wagered; }

export function netWorth() {
  let worth = state.wallet;
  for (const [id, qty] of Object.entries(state.inventory)) {
    const item = ITEMS[id];
    if (item?.sell) worth += item.sell * qty;
  }
  for (const [id, a] of Object.entries(state.assets)) {
    worth += ASSETS[id].cost;
    for (let l = 1; l < a.level; l++) worth += upgradeCost(id, l);
  }
  return worth;
}

export function addItem(id, qty = 1) {
  update((s) => { s.inventory[id] = (s.inventory[id] || 0) + qty; });
}
export function removeItem(id, qty = 1) {
  if ((state.inventory[id] || 0) < qty) return false;
  update((s) => {
    s.inventory[id] -= qty;
    if (s.inventory[id] <= 0) delete s.inventory[id];
  });
  return true;
}
export function itemCount(id) { return state.inventory[id] || 0; }

// Passive income: capped at 24h of production per collection.
export function pendingIncome(now = Date.now()) {
  const hours = Math.min(24, Math.max(0, now - state.lastCollect) / 3600000);
  let total = 0;
  for (const [id, a] of Object.entries(state.assets)) total += assetRate(id, a.level) * hours;
  return Math.floor(total);
}

export function collectIncome() {
  const amount = pendingIncome();
  if (amount <= 0) return 0;
  update((s) => { s.lastCollect = Date.now(); });
  adjust(amount, 'Passive income collected');
  addXp(3);
  return amount;
}

export function fmt(n) { return Number(n).toLocaleString('en-US'); }

export function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}