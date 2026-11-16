// The shared economy: work, farm, fish, assets, shop, leaderboards.
import { get, update, adjust, addXp, addItem, removeItem, itemCount, levelOf, xpForNext, netWorth, pendingIncome, collectIncome, assetRate, upgradeCost, ASSETS, ITEMS, MAX_ASSET_LEVEL, RESIDENTS, casinoProfit, fmt } from './state.js';
import { sfx } from './audio.js';
import { cryptoInt, toast } from './casino.js';
import { net, onNet } from './online.js';

const $ = (id) => document.getElementById(id);
import { adminSettings, onAdminSettings } from './admin-settings.js';
import { shopPrice } from './state.js';
const growMs = () => adminSettings().economy.growSeconds * 1000;

// ---------- stats strip ----------
function renderStats() {
  const s = get();
  const lvl = levelOf(s.xp);
  $('eco-wallet').textContent = fmt(s.wallet) + ' ◉';
  $('eco-worth').textContent = fmt(netWorth()) + ' ◉';
  $('eco-level').textContent = String(lvl);
  $('eco-xp').textContent = `${fmt(s.xp)} / ${fmt(xpForNext(lvl))}`;
  let rate = 0;
  for (const [id, a] of Object.entries(s.assets)) rate += assetRate(id, a.level);
  $('eco-rate').textContent = fmt(rate) + ' ◉';
}

// ---------- work ----------
function renderWork() {
  const left = get().cooldowns.work - Date.now();
  const btn = $('work-btn');
  btn.disabled = left > 0;
  $('work-note').textContent = left > 0 ? `Next shift in ${Math.ceil(left / 1000)}s` : 'Ready when you are.';
}
$('work-btn').addEventListener('click', () => {
  if (get().cooldowns.work > Date.now()) return;
  const rules = adminSettings().economy;
  const pay = rules.wageMin + cryptoInt(rules.wageMax - rules.wageMin + 1);
  adjust(pay, 'Work shift');
  addXp(5);
  update((s) => { s.cooldowns.work = Date.now() + adminSettings().economy.workSeconds * 1000; });
  sfx.cash();
  toast(`Shift complete: +${pay} coins, +5 XP`, 'win');
  renderWork();
});

// ---------- farm ----------
function renderFarm() {
  const s = get();
  const plots = $('plots');
  plots.replaceChildren();
  const hasShovel = itemCount('shovel') > 0;
  const seeds = itemCount('carrot_seed');
  s.plots.forEach((plantedAt, i) => {
    const plot = document.createElement('button');
    plot.className = 'plot';
    if (!plantedAt) {
      plot.classList.add('empty');
      plot.innerHTML = '<span>＋</span><small>PLANT</small>';
      plot.disabled = !hasShovel || seeds === 0;
    } else {
      const left = plantedAt + growMs() - Date.now();
      if (left <= 0) {
        plot.classList.add('ready');
        plot.innerHTML = '<span>🥕</span><small>HARVEST</small>';
      } else {
        plot.classList.add('growing');
        plot.innerHTML = `<span>🌱</span><small>${Math.ceil(left / 1000)}s</small>`;
        plot.disabled = true;
      }
    }
    plot.addEventListener('click', () => {
      if (!plantedAt) {
        if (!removeItem('carrot_seed')) return;
        update((st) => { st.plots[i] = Date.now(); });
        sfx.plant();
      } else if (plantedAt + growMs() <= Date.now()) {
        update((st) => { st.plots[i] = null; });
        addItem('carrot');
        addXp(10);
        sfx.harvest();
        toast('Harvested a carrot! +10 XP', 'win');
      }
      renderFarm();
    });
    plots.appendChild(plot);
  });
  $('farm-note').textContent = !hasShovel ? 'Buy a shovel in the shop to start farming.' : seeds === 0 ? 'Buy carrot seeds in the shop.' : `${seeds} seed${seeds === 1 ? '' : 's'} ready to plant.`;
}

// ---------- fishing ----------
const catchLog = [];
function renderFish() {
  const left = get().cooldowns.fish - Date.now();
  $('fish-btn').disabled = left > 0 || itemCount('fishing_rod') === 0;
  $('fish-note').textContent = itemCount('fishing_rod') === 0
    ? 'Buy a fishing rod in the shop.'
    : left > 0 ? `Line recovers in ${Math.ceil(left / 1000)}s` : 'The water looks promising.';
  const log = $('catch-log');
  log.replaceChildren();
  for (const c of catchLog.slice(0, 4)) {
    const div = document.createElement('div');
    div.className = 'catch ' + c.rarity;
    div.textContent = `${ITEMS[c.id].icon} ${ITEMS[c.id].name}`;
    log.appendChild(div);
  }
}
$('fish-btn').addEventListener('click', () => {
  if (get().cooldowns.fish > Date.now() || itemCount('fishing_rod') === 0) return;
  update((s) => { s.cooldowns.fish = Date.now() + adminSettings().economy.fishSeconds * 1000; });
  sfx.splash();
  const roll = cryptoInt(100);
  const [id, rarity] = roll < 60 ? ['minnow', 'common'] : roll < 95 ? ['bass', 'uncommon'] : ['golden_koi', 'legendary'];
  addItem(id);
  addXp(5);
  catchLog.unshift({ id, rarity });
  if (rarity === 'legendary') { sfx.bigWin(); toast('🐡 GOLDEN KOI! Worth 5,000 coins!', 'win'); }
  else toast(`Caught a ${ITEMS[id].name}! +5 XP`, 'win');
  renderFish();
});

// ---------- assets ----------
function renderAssets() {
  const s = get();
  const grid = $('assets-grid');
  grid.replaceChildren();
  for (const [id, def] of Object.entries(ASSETS)) {
    const owned = s.assets[id];
    const card = document.createElement('div');
    card.className = 'asset' + (owned ? ' owned' : '');
    const head = document.createElement('div');
    head.className = 'asset-head';
    head.innerHTML = `<span class="asset-icon">${def.icon}</span><div><strong>${def.name}</strong><small>${def.kind}${owned ? ' · LVL ' + owned.level : ''}</small></div>`;
    card.appendChild(head);
    const desc = document.createElement('p');
    desc.textContent = def.desc;
    card.appendChild(desc);
    const rate = document.createElement('p');
    rate.className = 'asset-rate';
    rate.textContent = owned ? `${fmt(assetRate(id, owned.level))} ◉ / hour` : `${fmt(def.rate)} ◉ / hour at level 1`;
    card.appendChild(rate);
    const btn = document.createElement('button');
    btn.className = 'btn btn-small';
    if (!owned) {
      btn.textContent = `BUY · ${fmt(shopPrice(def.cost))} ◉`;
      btn.disabled = s.wallet < shopPrice(def.cost);
      btn.addEventListener('click', () => {
        if (!adjust(-shopPrice(def.cost), `Bought ${def.name}`)) return;
        update((st) => { st.assets[id] = { level: 1 }; });
        sfx.cash();
        toast(`${def.name} is yours. It starts earning now.`, 'win');
        renderAssets();
      });
    } else if (owned.level < MAX_ASSET_LEVEL) {
      const cost = upgradeCost(id, owned.level);
      btn.textContent = `UPGRADE L${owned.level + 1} · ${fmt(cost)} ◉`;
      btn.disabled = s.wallet < cost;
      btn.addEventListener('click', () => {
        if (!adjust(-cost, `Upgraded ${def.name}`)) return;
        update((st) => { st.assets[id].level++; });
        addXp(8);
        sfx.cash();
        toast(`${def.name} upgraded to level ${owned.level + 1}.`, 'win');
        renderAssets();
      });
    } else {
      btn.textContent = 'MAX LEVEL';
      btn.disabled = true;
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}
$('collect-btn').addEventListener('click', () => {
  const amount = collectIncome();
  if (amount > 0) { sfx.cash(); toast(`Collected ${fmt(amount)} coins of passive income.`, 'win'); }
  else toast('Nothing to collect yet — assets earn over time.');
});

// ---------- shop & inventory ----------
function renderShop() {
  const s = get();
  const list = $('shop-list');
  list.replaceChildren();
  for (const [id, item] of Object.entries(ITEMS)) {
    if (!item.buy) continue;
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span>${item.icon} ${item.name}</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-small';
    btn.textContent = `${fmt(shopPrice(item.buy))} ◉`;
    btn.disabled = s.wallet < shopPrice(item.buy);
    btn.addEventListener('click', () => {
      if (!adjust(-shopPrice(item.buy), `Bought ${item.name}`)) return;
      addItem(id);
      sfx.chip();
      renderShop();
      renderFarm();
      renderFish();
    });
    row.appendChild(btn);
    list.appendChild(row);
  }
  const inv = $('inv-list');
  inv.replaceChildren();
  const entries = Object.entries(s.inventory).filter(([, q]) => q > 0);
  if (!entries.length) {
    inv.innerHTML = '<p class="eco-note">Empty. Buy tools, catch fish, grow carrots.</p>';
  }
  for (const [id, qty] of entries) {
    const item = ITEMS[id];
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span>${item.icon} ${item.name} ×${qty}</span>`;
    if (item.sell) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-small';
      btn.textContent = `SELL +${fmt(item.sell)} ◉`;
      btn.addEventListener('click', () => {
        if (!removeItem(id)) return;
        adjust(item.sell, `Sold ${item.name}`);
        sfx.cash();
        renderShop();
      });
      row.appendChild(btn);
    }
    inv.appendChild(row);
  }
}

// ---------- leaderboards ----------
let board = 'worth';
function renderLeaders() {
  const s = get();
  const youId = net.user?.id;
  const all = [
    ...net.board.map((p) => ({ ...p, you: p.id === youId })),
    ...RESIDENTS.map((r) => ({ ...r, sim: true })),
  ];
  if (!youId) {
    all.push({ name: s.profile.name + ' (you)', avatar: s.profile.avatar, worth: netWorth(), level: levelOf(s.xp), xp: s.xp, profit: casinoProfit(), you: true });
  } else if (!all.some((p) => p.you)) {
    all.push({ id: youId, name: s.profile.name + ' (you)', worth: netWorth(), level: levelOf(s.xp), xp: s.xp, profit: casinoProfit(), you: true, live: true });
  }
  const key = board === 'worth' ? 'worth' : board === 'level' ? 'level' : 'profit';
  all.sort((a, b) => b[key] - a[key]);
  const list = $('leader-list');
  list.replaceChildren();
  all.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = (p.you ? 'you ' : '') + (p.sim ? 'sim' : p.live ? 'live' : '');
    const val = key === 'profit' ? (p.profit >= 0 ? '+' : '−') + fmt(Math.abs(p.profit)) + ' ◉' : key === 'level' ? 'LVL ' + p.level : fmt(p.worth) + ' ◉';
    li.innerHTML = `<span class="rank">${i + 1}</span><span class="lname"></span><span class="lval">${val}</span>`;
    li.querySelector('.lname').textContent = p.name;
    list.appendChild(li);
  });
}
onNet(renderLeaders);
$('leader-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-board]');
  if (!b) return;
  sfx.click();
  board = b.dataset.board;
  for (const x of b.parentElement.children) x.classList.toggle('active', x === b);
  renderLeaders();
});

// ---------- tick ----------
function tick() {
  renderWork();
  renderFarm();
  renderFish();
  $('collect-amount').textContent = fmt(pendingIncome());
}
setInterval(tick, 1000);

import { subscribe } from './state.js';
subscribe(() => { renderStats(); renderAssets(); renderShop(); renderLeaders(); });
onAdminSettings(() => { renderStats(); renderAssets(); renderShop(); tick(); });
renderStats();
renderAssets();
renderShop();
renderLeaders();
tick();