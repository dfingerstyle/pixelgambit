import { get, update, replaceWorld, ITEMS, ASSETS, RESIDENTS, fmt } from './state.js';
import { characterFor, drawCharacter, normalizeCharacter, HAIR_STYLES, CHARACTER_SLOTS } from './character.js';
import { adminSettings, writeAdminSettings, blankAdminSettings } from './admin-settings.js';

const NPC_DEFAULTS = Object.fromEntries([...RESIDENTS.slice(0, 5).map((r, i) => ['resident-' + i, { name: r.name, x: 300 + i * 480, character: characterFor(r.name), dialogue: 'Nice day for a gambit.', walking: true }]), ...['Maple', 'Rowan'].map(name => [name, { name, x: 450, character: characterFor(name), dialogue: name === 'Maple' ? 'Welcome, traveler! Fresh seeds, trusty tools, and a fair price for your catch. What can I help you find?' : 'A place to call your own? Let’s find something that suits you.', walking: false }])]);
let tab = 'NPC STUDIO', selectedNpc = 'Maple', message = '', drafts = null;
const history = [], undo = [];
let baseline = null;
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
function button(parent, text, fn) { const b = node('button', text, 'btn'); b.type = 'button'; b.onclick = fn; parent.append(b); return b; }
function field(parent, label, value, type = 'text', min, max) { const l = node('label', label); const input = document.createElement('input'); input.type = type; input.value = value; if (min !== undefined) input.min = min; if (max !== undefined) input.max = max; if (type === 'number') { input.required = true; input.step = 'any'; } if (type === 'text') input.maxLength = max || 80; l.append(input); parent.append(l); return input; }
function select(parent, label, value, options) { const l = node('label', label); const s = document.createElement('select'); for (const [id, name] of options) { const o = node('option', name); o.value = id; s.append(o); } s.value = value; l.append(s); parent.append(l); return s; }
function snapshot() { return { world: structuredClone(get()), settings: structuredClone(adminSettings()) }; }
export function renderAdminBook(parent, allowed, back, products) {
  if (!allowed()) return;
  if (!drafts) drafts = structuredClone(adminSettings());
  parent.replaceChildren(); parent.classList.add('admin-book-content');
  const title = node('h2', 'The Crimson Grimoire'); title.id = 'catalog-title'; parent.append(title, node('p', 'LOCAL GUEST SANDBOX · NOT A MULTIPLAYER STAFF ROLE', 'kicker'), node('p', 'Rules stay in this browser tab, not cloud saves; grants change the guest save. Undo/history last until reload. Undo and baseline restore replace the whole save, including progress made since that snapshot.'));
  const nav = node('nav', '', 'cosmetic-tabs'); parent.append(nav);
  const refresh = () => renderAdminBook(parent, allowed, back, products);
  for (const key of ['NPC STUDIO', 'WORLD EDITOR', 'ECONOMY LAB', 'HISTORY']) { const b = button(nav, key, () => { tab = key; refresh(); }); b.classList.toggle('selected', key === tab); }
  const status = node('p', message, 'admin-status'); status.setAttribute('role', 'status'); parent.append(status);
  const reason = field(parent, 'Reason for this change', '', 'text', undefined, 120); reason.placeholder = 'e.g. Testing a new merchant outfit';
  const apply = (label, fn) => {
    if (!allowed()) return;
    if (!reason.value.trim()) { status.textContent = 'Enter a reason before applying a change.'; reason.focus(); return; }
    if (!baseline) baseline = snapshot();
    undo.push(snapshot()); if (undo.length > 10) undo.shift();
    fn(); history.unshift({ at: Date.now(), label, reason: reason.value.trim() }); history.splice(50); message = label + ' applied locally.'; drafts = structuredClone(adminSettings()); refresh();
  };
  const columns = node('div', '', 'admin-columns'); parent.append(columns); const controls = node('section', '', 'admin-controls'), preview = node('section', '', 'admin-preview'); columns.append(controls, preview);
  if (tab === 'NPC STUDIO') {
    const options = Object.entries({ ...NPC_DEFAULTS, ...drafts.npcs }).map(([id, n]) => [id, n.name + (n.deleted ? ' [DELETED]' : '')]);
    const picker = select(controls, 'NPC', selectedNpc, options); picker.onchange = () => { selectedNpc = picker.value; refresh(); };
    button(controls, 'CREATE NPC DRAFT', () => { if (Object.keys(drafts.npcs).length >= 40) { message = 'Local NPC limit reached (40).'; refresh(); return; } selectedNpc = crypto.randomUUID(); drafts.npcs[selectedNpc] = { name: 'New NPC', x: 420, character: characterFor('New NPC'), dialogue: 'Hello, traveler!', walking: false }; refresh(); });
    const original = drafts.npcs[selectedNpc] || NPC_DEFAULTS[selectedNpc]; if (!original) { selectedNpc = 'Maple'; refresh(); return; }
    const npc = structuredClone(original); const name = field(controls, 'Display name', npc.name, 'text', undefined, 20); name.required = true;
    const x = field(controls, 'Town X position (residents/custom NPCs)', npc.x, 'number', 24, 4736); x.step = '1'; x.disabled = ['Maple', 'Rowan'].includes(selectedNpc);
    const speechLabel = node('label', 'Dialogue'); const speech = document.createElement('textarea'); speech.value = npc.dialogue; speech.maxLength = 280; speechLabel.append(speech); controls.append(speechLabel);
    const walking = select(controls, 'Movement', npc.walking ? 'walk' : 'idle', [['idle', 'Stay in place'], ['walk', 'Wander']]); walking.disabled = ['Maple', 'Rowan'].includes(selectedNpc);
    const colors = {}; for (const key of ['skin', 'hair', 'shirt', 'pants']) colors[key] = field(controls, key.toUpperCase(), npc.character[key], 'color');
    const choices = {}; choices.hairStyle = select(controls, 'Hair style', npc.character.hairStyle, HAIR_STYLES.map(v => [v, v])); for (const [slot, values] of Object.entries(CHARACTER_SLOTS)) choices[slot] = select(controls, slot.toUpperCase(), npc.character[slot] || 'none', values.map(v => [v, v]));
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 250; preview.append(node('h3', 'UNSAVED NPC PREVIEW'), canvas); const dialogue = node('p', '', 'admin-dialogue'); preview.append(dialogue);
    const readNpc = () => ({ ...npc, name: name.value.trim(), x: Number(x.value), dialogue: speech.value, walking: walking.value === 'walk', character: normalizeCharacter({ ...Object.fromEntries(Object.entries(colors).map(([k, input]) => [k, input.value])), ...Object.fromEntries(Object.entries(choices).map(([k, input]) => [k, input.value])) }) });
    const draw = () => { const n = readNpc(), c = canvas.getContext('2d'); c.fillStyle = '#27392e'; c.fillRect(0, 0, 240, 250); drawCharacter(c, n.character, 72, 30, 6); dialogue.textContent = n.name + ': ' + n.dialogue; drafts.npcs[selectedNpc] = n; };
    controls.addEventListener('input', draw); controls.addEventListener('change', draw); draw();
    button(controls, 'APPLY NPC', () => { if (!name.reportValidity() || !x.reportValidity()) return; apply('NPC ' + readNpc().name, () => { const value = structuredClone(adminSettings()); value.npcs[selectedNpc] = readNpc(); writeAdminSettings(value); }); });
    button(controls, npc.deleted ? 'RESTORE NPC' : 'DELETE NPC (REVERSIBLE)', () => apply((npc.deleted ? 'Restore ' : 'Delete ') + npc.name, () => { const value = structuredClone(adminSettings()); value.npcs[selectedNpc] = { ...readNpc(), deleted: !npc.deleted }; writeAdminSettings(value); }));
    preview.append(node('p', 'Merchants retain their storefront functions when hidden. Dialogue is plain text; scripts are never executed.'));
  } else if (tab === 'WORLD EDITOR') {
    const world = drafts.world;
    const sky = select(controls, 'Sky theme', world.sky, ['original', 'day', 'starry', 'sakura', 'sea'].map(v => [v, v]));
    const night = select(controls, 'Day/night', world.night, [['cycle', 'Normal cycle'], ['day', 'Always day'], ['night', 'Always night']]);
    const tint = field(controls, 'World light tint', world.tint, 'color'); const strength = field(controls, 'Tint strength (0–0.35)', world.tintStrength, 'number', 0, .35); strength.step = '.01';
    const spawn = field(controls, 'Test spawn X', world.spawnX ?? 420, 'number', 24, 4736); spawn.step = '1';
    const building = select(controls, 'Building sign', 'store', ['chess', 'casino', 'store', 'property', 'leaders', 'training', 'boutique', 'clothing', 'gym'].map(v => [v, v]));
    const sign = field(controls, 'Custom sign (blank keeps original)', world.signs?.store || '', 'text', undefined, 24); building.onchange = () => { sign.value = world.signs?.[building.value] || ''; };
    const swatch = node('div', '', 'admin-world-swatch'); const text = node('p'); preview.append(node('h3', 'UNSAVED WORLD PREVIEW'), swatch, text);
    const draw = () => { swatch.style.background = `linear-gradient(${tint.value},#26352c)`; text.textContent = 'Sky: ' + sky.value + ' · ' + night.value + ' · spawn ' + spawn.value + ' · ' + building.value + ' sign: ' + (sign.value || 'original'); }; controls.addEventListener('input', draw); draw();
    button(controls, 'APPLY WORLD SETTINGS', () => { if (![strength, spawn].every(i => i.reportValidity())) return; apply('World settings', () => { const value = structuredClone(adminSettings()); value.world = { ...value.world, sky: sky.value, night: night.value, tint: tint.value, tintStrength: Number(strength.value), spawnX: Number(spawn.value), signs: { ...value.world.signs, [building.value]: sign.value.trim() } }; writeAdminSettings(value); }); });
    button(controls, 'TELEPORT TO SAVED SPAWN', () => { if (allowed()) window.dispatchEvent(new CustomEvent('admin-teleport', { detail: { x: adminSettings().world.spawnX ?? 420 } })); });
  } else if (tab === 'ECONOMY LAB') {
    preview.append(node('h3', 'ECONOMY TEST DESK'), node('p', fmt(get().wallet) + ' coins · ' + get().cosmetics.owned.length + ' cosmetics · ' + Object.keys(get().assets).length + ' assets'));
    const amount = field(controls, 'Coins amount', 10000, 'number', 0, 100000000); amount.step = '1';
    for (const action of ['SET', 'ADD', 'REMOVE']) button(controls, action + ' COINS', () => { if (!amount.reportValidity()) return; const value = Number(amount.value); if (action === 'REMOVE' && value > get().wallet) { status.textContent = 'Cannot remove more coins than this wallet contains.'; return; } apply(action + ' ' + fmt(value) + ' coins', () => update(s => { const before = s.wallet; s.wallet = action === 'SET' ? value : s.wallet + (action === 'ADD' ? value : -value); s.ledger.unshift({ t: Date.now(), amount: s.wallet - before, reason: 'LOCAL ADMIN: ' + reason.value.trim() }); s.ledger = s.ledger.slice(0, 120); })); });
    const inputs = {}; for (const [key, label, min, max] of [['wageMin', 'Minimum shift pay', 0, 100000], ['wageMax', 'Maximum shift pay', 0, 100000], ['workSeconds', 'Work cooldown (seconds)', 0, 86400], ['fishSeconds', 'Fishing cooldown (seconds)', 0, 86400], ['growSeconds', 'Crop growth (seconds)', 0, 86400], ['incomeMultiplier', 'Rent/rack income multiplier', 0, 100], ['shopMultiplier', 'Purchase price multiplier', .1, 10]]) inputs[key] = field(controls, label, drafts.economy[key], 'number', min, max);
    button(controls, 'APPLY ECONOMY RULES', () => { if (!Object.values(inputs).every(i => i.reportValidity())) return; const rules = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, Number(input.value)])); if (!Number.isInteger(rules.wageMin) || !Number.isInteger(rules.wageMax) || rules.wageMin > rules.wageMax) { status.textContent = 'Wages must be whole coins and minimum must not exceed maximum.'; return; } apply('Economy rules', () => { const value = structuredClone(adminSettings()); value.economy = rules; writeAdminSettings(value); }); });
    const item = select(controls, 'Grant item', 'carrot_seed', Object.entries(ITEMS).map(([id, i]) => [id, i.name])); const qty = field(controls, 'Quantity', 10, 'number', 1, 10000); qty.step = '1';
    button(controls, 'GRANT ITEMS', () => { if (qty.reportValidity()) apply('Grant ' + ITEMS[item.value].name, () => update(s => { s.inventory[item.value] = (s.inventory[item.value] || 0) + Number(qty.value); })); });
    button(controls, 'REMOVE ITEMS', () => { if (!qty.reportValidity()) return; if ((get().inventory[item.value] || 0) < Number(qty.value)) { status.textContent = 'Not enough items to remove that quantity.'; return; } apply('Remove ' + ITEMS[item.value].name, () => update(s => { s.inventory[item.value] -= Number(qty.value); if (!s.inventory[item.value]) delete s.inventory[item.value]; })); });
    const asset = select(controls, 'Grant property/equipment', 'flat', Object.entries(ASSETS).map(([id, a]) => [id, a.name])); button(controls, 'GRANT ASSET', () => { if (get().assets[asset.value]) { status.textContent = 'Already owned; existing upgrades are unchanged.'; return; } apply('Grant ' + ASSETS[asset.value].name, () => update(s => { s.assets[asset.value] = { level: 1 }; })); });
    button(controls, 'UNLOCK ALL COSMETICS', () => apply('Grant cosmetic collection', () => update(s => { s.cosmetics.owned = products.filter(p => !p.contents).map(p => p.id); })));
    button(controls, 'RESET ACTIVITY COOLDOWNS', () => apply('Reset cooldowns', () => update(s => { s.cooldowns.work = 0; s.cooldowns.fish = 0; })));
    const probability = field(preview, 'Simulation win probability (%)', 50, 'number', 0, 100); const result = node('p', 'Simulation only. Live casino outcomes are unchanged.'); preview.append(result);
    button(preview, 'SIMULATE 10,000 TRIALS', () => { if (!allowed() || !probability.reportValidity()) return; let wins = 0; for (let i = 0; i < 10000; i++) if (Math.random() * 100 < Number(probability.value)) wins++; result.textContent = wins + ' / 10,000 wins. Preview only: no bets, payouts or casino probabilities were modified.'; });
  } else {
    columns.replaceChildren(); const list = node('section', '', 'admin-history'); columns.append(list); list.append(node('h3', 'LOCAL SESSION HISTORY · NOT A SERVER AUDIT LOG'));
    for (const entry of history) list.append(node('p', new Date(entry.at).toLocaleTimeString() + ' · ' + entry.label + ' · ' + entry.reason));
    if (!history.length) list.append(node('p', 'No applied changes in this session.'));
  }
  const footer = node('div', '', 'admin-footer'); parent.append(footer);
  button(footer, 'DISCARD UNSAVED DRAFTS', () => { drafts = structuredClone(adminSettings()); message = 'Drafts discarded.'; refresh(); });
  button(footer, 'UNDO LAST APPLIED CHANGE', () => { if (!allowed()) return; const step = undo.pop(); if (!step) return; replaceWorld(step.world); writeAdminSettings(step.settings); history.unshift({ at: Date.now(), label: 'Undo', reason: 'Reverted last applied snapshot' }); drafts = null; message = 'Last change reversed, including subsequent local progress.'; refresh(); }).disabled = !undo.length;
  button(footer, 'RESTORE PRE-ADMIN BASELINE', () => { if (!allowed() || !baseline) return; replaceWorld(baseline.world); writeAdminSettings(baseline.settings); undo.length = 0; baseline = null; drafts = null; message = 'Pre-admin baseline restored.'; history.unshift({ at: Date.now(), label: 'Restore baseline', reason: 'Reset all test changes' }); refresh(); }).disabled = !baseline;
  button(footer, 'RESET LOCAL RULES TO DEFAULTS', () => apply('Default NPC/world/economy rules', () => writeAdminSettings(blankAdminSettings())));
  button(footer, 'BACK TO INVENTORY', () => { parent.classList.remove('admin-book-content'); back(); });
}
export function resetAdminBookSession() { drafts = null; baseline = null; undo.length = 0; history.length = 0; message = ''; }
