// Gambit Town: a side-view walkable pixel world. One rAF loop, paused when off-screen.
import { movementBoost } from './casino-lounge.js';
import { get, RESIDENTS } from './state.js';
import { drawCharacter, characterFor } from './character.js';
import { sfx } from './audio.js';
import { net, trackPresence } from './online.js';
import { drawPropertyExterior } from './interiors.js';
import { adminSettings, onAdminSettings } from './admin-settings.js';

const LOGICAL_H = 540;
const GROUND = 468;
const WORLD_W = 4760;
const GRAVITY = 1500;
const WALK_SPEED = 210;
const JUMP_V = -560;
const DAY_LENGTH = 160; // seconds per full day/night cycle

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- theme sky palettes: [dayTop, dayBottom, nightTop, nightBottom] ----
const SKIES = {
  starry: ['#2a1650', '#4a2a7a', '#0c0620', '#1c1136'],
  sakura: ['#7a4a6e', '#e8a0b4', '#241019', '#4a2438'],
  sea: ['#0a3a5c', '#1a6a8a', '#03101e', '#0a2438'],
  day: ['#79b6dc', '#d7e8de', '#79b6dc', '#d7e8de'],
};

const BUILDINGS = [
  { x: 180, w: 270, h: 210, kind: 'chess', label: 'CHESS HUB', target: 'play' },
  { x: 540, w: 350, h: 280, kind: 'casino', label: 'CASINO', target: 'casino' },
  { x: 980, w: 250, h: 190, kind: 'store', label: 'GENERAL STORE', target: 'economy', focus: 'shop-card' },
  { x: 1320, w: 250, h: 200, kind: 'property', label: 'PROPERTY OFFICE', target: 'economy', focus: 'assets-card' },
  { x: 1660, w: 290, h: 230, kind: 'leaders', label: 'LEADERBOARD HALL', target: 'economy', focus: 'leader-card' },
  { x: 2050, w: 230, h: 0, kind: 'lot', label: 'EMPTY LOT', target: 'economy', focus: 'assets-card' },
  { x: 2370, w: 230, h: 0, kind: 'lot', label: 'EMPTY LOT', target: 'economy', focus: 'assets-card' },
  { x: 2720, w: 280, h: 220, kind: 'training', label: 'TRAINING HALL', target: 'interior' },
  { x: 3100, w: 260, h: 215, kind: 'boutique', label: 'CHESS BOUTIQUE', target: 'interior' },
  { x: 3460, w: 260, h: 195, kind: 'clothing', label: 'THREAD & PIXEL', target: 'world' },
  { x: 3820, w: 280, h: 220, kind: 'gym', label: 'GAMBIT GYM', target: 'world' },
  { x: 4180, w: 230, h: 0, kind: 'lot', label: 'EMPTY LOT', target: 'economy', focus: 'assets-card' },
  { x: 4480, w: 230, h: 0, kind: 'lot', label: 'EMPTY LOT', target: 'economy', focus: 'assets-card' },
];
for (const b of BUILDINGS) b.doorX = b.x + b.w / 2;
BUILDINGS.filter(b => b.kind === 'lot').forEach((b, i) => { b.assetSlot = i; });

const CRATES = [
  { x: 930, y: GROUND - 42, w: 44, h: 42 },
  { x: 1252, y: GROUND - 42, w: 44, h: 42 },
  { x: 1296, y: GROUND - 84, w: 44, h: 42 },
  { x: 2310, y: GROUND - 42, w: 44, h: 42 },
];

const NPC_LINES = [
  'nice day for a gambit', 'the wheel loves me', 'just one more spin…',
  'my koi is worth 5000', 'e4 is always the answer', 'rent day is the best day',
  'saw a meteor last night', 'fishing is rigged, i swear', 'gg last night',
];

let canvas, ctx, dpr = 1, scale = 1, viewW = 0;
let active = false, raf = 0, last = 0;
let theme = 'starry';
let camX = 0;
let doorHandler = () => {};
let currentDoor = null;
let stepTimer = 0;
let elapsed = 0;

const keys = { left: false, right: false, jump: false };
let moveTarget = null;

const player = {
  x: 420, y: GROUND, vx: 0, vy: 0, onGround: true, facing: 1,
  frame: 0, animT: 0, blinkT: 0,
};

const npcSeeds = RESIDENTS.slice(0, 5).map((r, i) => ({
  uid: 'resident-' + i, walking: true, name: r.name,
  cfg: characterFor(r.name),
  x: 300 + i * 480, y: GROUND, vx: 0, facing: 1,
  state: 'idle', timer: 1 + i, targetX: 0,
  frame: 0, animT: 0, bubble: '', bubbleT: 0, lineT: 6 + i * 4,
}));

let npcs = structuredClone(npcSeeds), baseTheme = theme;
onAdminSettings(() => {
  const config = adminSettings(); theme = config.world.sky === 'original' ? baseTheme : config.world.sky;
  const extras = Object.entries(config.npcs).filter(([id]) => !['Maple', 'Rowan'].includes(id) && !npcSeeds.some(n => n.uid === id)).map(([uid, n]) => ({ ...structuredClone(npcSeeds[0]), uid, name: n.name, cfg: n.character, x: n.x }));
  npcs = [...structuredClone(npcSeeds), ...extras].filter(n => !config.npcs[n.uid]?.deleted).map(n => { const o = config.npcs[n.uid]; return o ? { ...n, name: o.name, cfg: o.character, x: o.x, walking: o.walking, dialogue: o.dialogue } : n; });
});
window.addEventListener('admin-teleport', () => { const x = adminSettings().world.spawnX; if (Number.isFinite(x)) { player.x = Math.max(24, Math.min(WORLD_W - 24, x)); player.y = GROUND; player.vx = player.vy = 0; moveTarget = null; } });

// ---- particles ----
let particles = [];
function seedParticles() {
  particles = [];
  const n = reduced ? 18 : 60;
  for (let i = 0; i < n; i++) {
    particles.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * GROUND,
      s: 0.5 + Math.random() * 1.6,
      p: Math.random() * Math.PI * 2,
      v: 14 + Math.random() * 26,
    });
  }
}

let meteor = null;

export function setDoorHandler(fn) { doorHandler = fn; }
export function setTheme(t) { if (SKIES[t]) { baseTheme = t; theme = adminSettings().world.sky === 'original' ? t : adminSettings().world.sky; } }

export function setActive(on) {
  if (on === active) return;
  active = on;
  if (on) {
    resize();
    last = performance.now();
    raf = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(raf);
    keys.left = keys.right = keys.jump = false;
    moveTarget = null;
    hideDoorPrompt();
    trackPresence({ view: 'away' }, true);
  }
}

export function startWorld(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  seedParticles();
  bindInput();
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (active) { last = performance.now(); raf = requestAnimationFrame(loop); }
  });
}

function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  scale = rect.height / LOGICAL_H;
  viewW = rect.width / scale;
}

// ---- input ----
function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { keys.left = true; moveTarget = null; e.preventDefault(); }
    if (k === 'd' || k === 'arrowright') { keys.right = true; moveTarget = null; e.preventDefault(); }
    if (k === 'w' || k === 'arrowup' || k === ' ') { keys.jump = true; e.preventDefault(); }
    if (k === 'e' && currentDoor) enterDoor();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') keys.left = false;
    if (k === 'd' || k === 'arrowright') keys.right = false;
    if (k === 'w' || k === 'arrowup' || k === ' ') keys.jump = false;
  });

  // tap-to-move on the canvas
  canvas.addEventListener('pointerdown', (e) => {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const lx = (e.clientX - rect.left) / scale + camX;
    moveTarget = Math.max(30, Math.min(WORLD_W - 30, lx));
  });

  // touch buttons
  bindHold('tc-left', (v) => { keys.left = v; if (v) moveTarget = null; });
  bindHold('tc-right', (v) => { keys.right = v; if (v) moveTarget = null; });
  bindHold('tc-jump', (v) => { keys.jump = v; });
  document.getElementById('door-prompt').addEventListener('click', enterDoor);
}

function bindHold(id, set) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); });
  el.addEventListener('pointerup', () => set(false));
  el.addEventListener('pointercancel', () => set(false));
  el.addEventListener('pointerleave', () => set(false));
}

function enterDoor() {
  if (!currentDoor) return;
  sfx.door();
  const d = currentDoor;
  hideDoorPrompt();
  doorHandler(d.target, d.focus, d);
}

function showDoorPrompt(d) {
  const el = document.getElementById('door-prompt');
  const owned = d.kind === 'lot' && Object.keys(get().assets)[d.assetSlot];
  el.textContent = d.kind === 'lot' ? (owned ? 'ENTER YOUR PROPERTY ↗' : 'FOR SALE — VISIT PROPERTY OFFICE ↗') : ['clothing', 'gym'].includes(d.kind) ? `BROWSE ${d.label} · OUTDOOR COUNTER ↗` : `ENTER ${d.label} ↗`;
  el.hidden = false;
}
function hideDoorPrompt() {
  document.getElementById('door-prompt').hidden = true;
  currentDoor = null;
}

// ---- simulation ----
function loop(now) {
  if (!active) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  update(dt);
  render();
}

function nightFactor() {
  // 0 = day, 1 = night; starts mid-morning
  const fixed = adminSettings().world.night; if (fixed === 'day') return 0; if (fixed === 'night') return 1;
  return theme === 'day' ? 0 : 0.5 + 0.5 * Math.sin((elapsed / DAY_LENGTH) * Math.PI * 2 - Math.PI / 2);
}

function update(dt) {
  // player horizontal intent
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (dir === 0 && moveTarget != null) {
    const d = moveTarget - player.x;
    if (Math.abs(d) < 6) moveTarget = null;
    else dir = Math.sign(d);
  }
  player.vx = dir * WALK_SPEED * movementBoost().speed;
  if (dir !== 0) player.facing = dir;

  // jump
  if (keys.jump && player.onGround) {
    player.vy = JUMP_V * movementBoost().jump;
    player.onGround = false;
    sfx.jump();
  }
  keys.jump = false; // edge-triggered

  // integrate
  const prevY = player.y;
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(24, Math.min(WORLD_W - 24, player.x));

  // ground + crate tops
  let floor = GROUND;
  for (const c of CRATES) {
    if (player.x > c.x - 8 && player.x < c.x + c.w + 8 && prevY <= c.y + 1 && player.y >= c.y) {
      floor = Math.min(floor, c.y);
    }
  }
  const wasAir = !player.onGround;
  if (player.y >= floor) {
    player.y = floor;
    player.vy = 0;
    player.onGround = true;
    if (wasAir) sfx.land();
  } else {
    player.onGround = false;
  }

  // walk animation + footsteps
  const moving = dir !== 0 && player.onGround;
  if (moving) {
    player.animT += dt;
    player.frame = Math.floor(player.animT * 9) % 4;
    stepTimer -= dt;
    if (stepTimer <= 0) { sfx.step(); stepTimer = 0.27; }
  } else {
    player.frame = 0;
  }
  player.blinkT += dt;

  // camera follow
  const targetCam = Math.max(0, Math.min(WORLD_W - viewW, player.x - viewW * 0.45));
  camX += (targetCam - camX) * Math.min(1, dt * 6);

  trackPresence({
    name: get().profile.name, character: get().character,
    x: Math.round(player.x), y: Math.round(player.y),
    facing: player.facing, frame: player.frame, view: 'world',
  });

  // door proximity
  let near = null;
  if (player.onGround) {
    for (const b of BUILDINGS) {
      if (Math.abs(player.x - b.doorX) < 48) { near = b; break; }
    }
  }
  if (near !== currentDoor) {
    currentDoor = near;
    if (near) showDoorPrompt(near); else hideDoorPrompt();
  }

  // NPCs
  for (const n of npcs) {
    n.timer -= dt;
    n.lineT -= dt;
    if (n.bubbleT > 0) n.bubbleT -= dt;
    if (n.lineT <= 0) {
      n.bubble = n.dialogue || NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)];
      n.bubbleT = 3.2;
      n.lineT = 14 + Math.random() * 14;
    }
    if (!n.walking) { n.state = 'idle'; n.vx = 0; continue; }
    if (n.state === 'idle') {
      n.vx = 0;
      if (n.timer <= 0) {
        n.state = 'walk';
        n.targetX = Math.max(120, Math.min(WORLD_W - 120, n.x + (Math.random() - 0.5) * 700));
      }
    } else {
      const d = n.targetX - n.x;
      if (Math.abs(d) < 8) {
        n.state = 'idle';
        n.timer = 2 + Math.random() * 5;
        n.vx = 0;
      } else {
        n.vx = Math.sign(d) * 70;
        n.facing = Math.sign(d);
        n.x += n.vx * dt;
        n.animT += dt;
        n.frame = Math.floor(n.animT * 7) % 4;
      }
    }
  }

  // particles drift
  for (const p of particles) {
    p.p += dt;
    if (theme === 'sakura') {
      p.y += p.v * dt;
      p.x += Math.sin(p.p * 1.6) * 22 * dt;
      if (p.y > GROUND) { p.y = -12; p.x = camX + Math.random() * viewW; }
    } else if (theme === 'sea') {
      p.y -= p.v * dt;
      p.x += Math.sin(p.p * 2) * 10 * dt;
      if (p.y < -12) { p.y = GROUND; p.x = camX + Math.random() * viewW; }
    }
  }
  // occasional meteor in starry sky
  if (theme === 'starry' && !reduced) {
    if (!meteor && Math.random() < dt * 0.12) {
      meteor = { x: camX + Math.random() * viewW, y: 30 + Math.random() * 90, vx: 320, vy: 130, life: 0.9 };
    }
    if (meteor) {
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.life -= dt;
      if (meteor.life <= 0) meteor = null;
    }
  }
}

// ---- rendering ----
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function render() {
  const nf = nightFactor();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  const [dt_, db, nt, nb] = SKIES[theme];
  const top = lerpColor(dt_, nt, nf);
  const bot = lerpColor(db, nb, nf);

  // sky
  const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, LOGICAL_H);

  drawSkyDetails(nf);

  // far skyline (parallax)
  ctx.save();
  ctx.translate(-camX * 0.22, 0);
  drawSkyline(nf);
  ctx.restore();

  // mid trees/hills
  ctx.save();
  ctx.translate(-camX * 0.55, 0);
  drawMidLayer(nf);
  ctx.restore();

  // world layer
  ctx.save();
  ctx.translate(-camX, 0);
  drawGround(nf);
  for (const b of BUILDINGS) drawBuilding(b, nf);
  drawCrates(nf);
  drawLamps(nf);
  for (const n of npcs) drawNpc(n, nf);
  for (const id of remoteSmooth.keys()) if (!net.peers.some((p) => p.id === id)) remoteSmooth.delete(id);
  for (const p of net.peers) if (p.view === 'world') drawRemote(p);
  drawPlayer(nf);
  ctx.restore();

  const lighting = adminSettings().world; if (lighting.tintStrength > 0) { ctx.save(); ctx.globalAlpha = lighting.tintStrength; ctx.fillStyle = lighting.tint; ctx.fillRect(0, 0, viewW, LOGICAL_H); ctx.restore(); }

  // foreground vignette
  const vg = ctx.createLinearGradient(0, LOGICAL_H - 90, 0, LOGICAL_H);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, LOGICAL_H - 90, viewW, 90);
}

function drawSkyDetails(nf) {
  if (theme === 'day') {
    ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(viewW - 110, 80, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff88';
    for (let i = 0; i < 5; i++) { const x = ((i * 250 + elapsed * 5 - camX * .1) % (viewW + 300) + viewW + 300) % (viewW + 300) - 100; ctx.fillRect(x, 75 + i % 2 * 40, 100, 16); ctx.fillRect(x + 20, 63 + i % 2 * 40, 54, 15); }
  } else if (theme === 'starry') {
    for (const p of particles) {
      const sx = p.x - camX * 0.1;
      if (sx < -10 || sx > viewW + 10) continue;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(p.p * 1.4));
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * tw})`;
      ctx.fillRect(sx, p.y * 0.55, p.s, p.s);
    }
    if (meteor) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(meteor.x - camX * 0.1, meteor.y);
      ctx.lineTo(meteor.x - camX * 0.1 - 46, meteor.y - 19);
      ctx.stroke();
    }
    // moon
    ctx.fillStyle = 'rgba(240,235,255,0.9)';
    ctx.beginPath(); ctx.arc(viewW - 110, 84, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lerpColor(SKIES.starry[0], SKIES.starry[2], nf);
    ctx.beginPath(); ctx.arc(viewW - 120, 78, 22, 0, Math.PI * 2); ctx.fill();
  } else if (theme === 'sakura') {
    // sun/moon disc
    const disc = nf > 0.5 ? 'rgba(240,230,255,0.85)' : 'rgba(255,236,200,0.9)';
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(viewW - 130, 92, 30, 0, Math.PI * 2); ctx.fill();
    for (const p of particles) {
      const sx = p.x - camX * 0.35;
      if (sx < -10 || sx > viewW + 10) continue;
      ctx.fillStyle = `rgba(255,${170 + Math.floor(40 * Math.sin(p.p))},200,0.8)`;
      ctx.save();
      ctx.translate(sx, p.y);
      ctx.rotate(Math.sin(p.p * 1.6) * 0.9);
      ctx.fillRect(-p.s * 1.6, -p.s, p.s * 3.2, p.s * 2);
      ctx.restore();
    }
  } else {
    // sea: light rays + bubbles
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(elapsed * 0.6);
    for (let i = 0; i < 5; i++) {
      const rx = ((i * 260 + elapsed * 12) % (viewW + 300)) - 150;
      ctx.fillStyle = '#bfeaff';
      ctx.beginPath();
      ctx.moveTo(rx, 0); ctx.lineTo(rx + 60, 0);
      ctx.lineTo(rx + 160, GROUND); ctx.lineTo(rx + 40, GROUND);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const p of particles) {
      const sx = p.x - camX * 0.3;
      if (sx < -10 || sx > viewW + 10) continue;
      ctx.strokeStyle = 'rgba(190,235,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, p.y, p.s * 1.8, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawSkyline(nf) {
  const c = lerpColor(theme === 'day' ? '#88aab7' : '#3a3450', '#141024', nf);
  ctx.fillStyle = c;
  for (let i = 0; i < Math.ceil(WORLD_W / 160); i++) {
    const bx = i * 160;
    const bh = 90 + ((i * 53) % 120);
    ctx.fillRect(bx, GROUND - bh - 40, 110, bh + 40);
    // lit windows at night
    if (nf > 0.35) {
      ctx.fillStyle = `rgba(255,210,120,${(nf - 0.35) * 0.8})`;
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 3; wx++) {
          if ((i + wx + wy) % 3 === 0) ctx.fillRect(bx + 16 + wx * 30, GROUND - bh - 24 + wy * 34, 10, 12);
        }
      }
      ctx.fillStyle = c;
    }
  }
}

function drawMidLayer(nf) {
  // rolling hills
  ctx.fillStyle = lerpColor('#4a5a3a', '#1a2416', nf);
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= WORLD_W + 200; x += 60) {
    ctx.lineTo(x, GROUND - 46 - Math.sin(x * 0.011) * 26);
  }
  ctx.lineTo(WORLD_W + 200, GROUND);
  ctx.closePath(); ctx.fill();

  // theme trees
  for (let i = 0; i < Math.ceil(WORLD_W / 220); i++) {
    const tx = 120 + i * 220;
    const ty = GROUND - 40;
    ctx.fillStyle = lerpColor('#5c4632', '#241a12', nf);
    ctx.fillRect(tx - 5, ty - 60, 10, 60);
    if (theme === 'sakura') {
      ctx.fillStyle = lerpColor('#e890b0', '#6e3a52', nf);
      ctx.beginPath(); ctx.arc(tx, ty - 78, 34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx - 24, ty - 62, 22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 24, ty - 62, 22, 0, Math.PI * 2); ctx.fill();
    } else if (theme === 'sea') {
      ctx.fillStyle = lerpColor('#2a8a6a', '#0e3a2e', nf);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(tx + (k - 1) * 12, ty - 60 - k * 8, 8, 34, (k - 1) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = lerpColor('#2a4a3a', '#0e1e16', nf);
      ctx.beginPath();
      ctx.moveTo(tx, ty - 118); ctx.lineTo(tx - 30, ty - 52); ctx.lineTo(tx + 30, ty - 52);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx, ty - 92); ctx.lineTo(tx - 24, ty - 40); ctx.lineTo(tx + 24, ty - 40);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawGround(nf) {
  // sidewalk
  ctx.fillStyle = lerpColor('#6a6478', '#2a2636', nf);
  ctx.fillRect(0, GROUND, WORLD_W, 26);
  ctx.fillStyle = lerpColor('#7a7488', '#343044', nf);
  for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, GROUND, 62, 4);
  // road
  ctx.fillStyle = lerpColor('#46425a', '#1c1a28', nf);
  ctx.fillRect(0, GROUND + 26, WORLD_W, LOGICAL_H - GROUND - 26);
  ctx.fillStyle = `rgba(255,220,130,${0.25 + nf * 0.3})`;
  for (let x = 20; x < WORLD_W; x += 90) ctx.fillRect(x, GROUND + 52, 40, 4);
}

function windowGlow(nf, x, y, w, h, lit) {
  ctx.fillStyle = '#292b31'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#d2bf9b'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = lit && nf > 0.3 ? `rgba(255,214,130,${0.5 + nf * 0.5})` : lerpColor('#9ab8d8', '#2a3448', nf);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ffffff28'; ctx.beginPath(); ctx.moveTo(x + 4, y + h - 8); ctx.lineTo(x + w - 8, y + 4); ctx.lineTo(x + w - 18, y + 4); ctx.lineTo(x + 4, y + h - 18); ctx.fill();
  ctx.fillStyle = '#e3d0ac'; ctx.fillRect(x + w / 2 - 2, y, 3, h); ctx.fillRect(x, y + h / 3, w, 3);
  ctx.fillStyle = '#00000038'; ctx.fillRect(x - 4, y + h + 4, w + 11, 4);
  ctx.fillStyle = '#d2bf9b'; ctx.fillRect(x - 5, y + h + 1, w + 10, 4);
}

function signText(text, x, y, size, color, glow) {
  ctx.font = `${size}px "Pixelify Sans", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function masonry(x, y, w, h, material = 'brick') {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const rowH = material === 'stone' ? 20 : 11, blockW = material === 'stone' ? 43 : 28;
  for (let row = 0, yy = y; yy < y + h; yy += rowH, row++) {
    for (let col = -1, xx = x - (row % 2) * blockW / 2; xx < x + w; xx += blockW, col++) {
      const v = (row * 7 + col * 13 + 100) % 5;
      ctx.fillStyle = ['#ffffff0e', '#00000012', '#ffffff18', '#00000008', '#ffffff06'][v]; ctx.fillRect(xx + 1, yy + 1, blockW - 2, rowH - 2);
      ctx.fillStyle = '#00000024'; ctx.fillRect(xx, yy + rowH - 2, blockW, 2); ctx.fillRect(xx + blockW - 1, yy, 1, rowH);
      ctx.fillStyle = '#ffffff16'; ctx.fillRect(xx + 2, yy + 1, blockW - 4, 1);
    }
  }
  ctx.restore();
}

function drawBuilding(b, nf) {
  const { x, w, h, kind } = b;
  if (kind === 'lot') {
    const id = Object.keys(get().assets)[b.assetSlot];
    if (id) { ctx.save(); const s = w / 590; ctx.translate(x - 155 * s, GROUND - 450 * s); ctx.scale(s, s); drawPropertyExterior(ctx, id); ctx.restore(); }
    else drawLot(b, nf);
    return;
  }
  const top = GROUND - h;
  ctx.fillStyle = '#00000024'; ctx.beginPath(); ctx.moveTo(x + 12, GROUND); ctx.lineTo(x + w + 45, GROUND + 14); ctx.lineTo(x + w + 24, GROUND - 16); ctx.lineTo(x + w, top + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#34343a'; ctx.fillRect(x + w, top + 18, 18, h - 18);
  masonry(x + w, top + 18, 18, h - 18, 'stone');

  if (['training', 'boutique', 'clothing', 'gym'].includes(kind)) {
    const colors = { training: ['#becdd4', '#426b86', '#d4c799'], boutique: ['#e1d8c8', '#493b61', '#c7a15e'], clothing: ['#e7c8be', '#a55b77', '#efddcb'], gym: ['#65767d', '#d39a48', '#cad2ce'] }[kind];
    ctx.fillStyle = lerpColor(colors[0], '#30313d', nf); ctx.fillRect(x, top, w, h);
    masonry(x, top, w, h, kind === 'boutique' ? 'stone' : 'brick');
    ctx.fillStyle = '#00000012';
    for (let row = 0, y = top + 76; y < GROUND - 12; y += 15, row++) {
      ctx.fillRect(x + 5, y, w - 10, 1);
      for (let bx = x + 5 + (row % 2) * 24; bx < x + w - 5; bx += 48) ctx.fillRect(bx, y, 1, 15);
    }
    ctx.fillStyle = colors[2]; ctx.fillRect(x + 5, top + 6, 6, h - 18); ctx.fillRect(x + w - 11, top + 6, 6, h - 18);
    ctx.fillStyle = '#ffffff18'; ctx.fillRect(x - 7, top - 13, w + 14, 4);
    ctx.fillStyle = colors[1]; ctx.fillRect(x - 7, top - 9, w + 14, 16); ctx.fillRect(x + 12, top + 18, w - 24, 37);
    signText(adminSettings().world.signs?.[kind] || b.label, x + w / 2, top + 37, 16, '#fff0d5');
    ctx.fillStyle = colors[2]; ctx.fillRect(x, top + 65, w, 5); ctx.fillRect(x, GROUND - 12, w, 12);
    for (const wx of [x + 22, x + w - 96]) {
      ctx.fillStyle = colors[2]; ctx.fillRect(wx - 3, top + 79, 80, 78);
      windowGlow(nf, wx, top + 82, 74, 72, true);
      ctx.fillStyle = '#ffffff30'; ctx.fillRect(wx + 4, top + 87, 5, 55); ctx.fillRect(wx + 12, top + 87, 3, 24);
      ctx.fillStyle = colors[2]; ctx.fillRect(wx - 4, top + 156, 82, 7);
      if (kind === 'training') { ctx.fillStyle = '#233446'; ctx.fillRect(wx + 12, top + 103, 45, 28); ctx.fillStyle = '#7ec6cd'; ctx.fillRect(wx + 16, top + 107, 37, 18); ctx.fillStyle = colors[2]; ctx.fillRect(wx + 27, top + 132, 16, 5); }
      if (kind === 'boutique') { for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) { ctx.fillStyle = (r + col) % 2 ? '#483d4b' : '#e6cf9f'; ctx.fillRect(wx + 15 + col * 11, top + 95 + r * 11, 11, 11); } }
      if (kind === 'clothing') { ctx.strokeStyle = '#ece0ce'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + 9, top + 99); ctx.lineTo(wx + 66, top + 99); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#ba6e91', '#689980', '#677fba'][i]; ctx.fillRect(wx + 13 + i * 18, top + 103, 13, 29); ctx.fillRect(wx + 9 + i * 18, top + 104, 20, 8); } }
      if (kind === 'gym') { ctx.fillStyle = '#273442'; ctx.fillRect(wx + 14, top + 116, 43, 7); ctx.fillRect(wx + 9, top + 103, 10, 31); ctx.fillRect(wx + 53, top + 103, 10, 31); }
    }
    door(b, colors[1], colors[2]);
    if (['clothing', 'gym'].includes(kind)) { ctx.fillStyle = colors[1]; ctx.fillRect(b.doorX - 40, GROUND - 72, 80, 22); signText('SHOP HERE', b.doorX, GROUND - 61, 10, '#fff0d5'); }
  } else if (kind === 'casino') {
    ctx.fillStyle = lerpColor('#3a2450', '#1c1030', nf);
    ctx.fillRect(x, top, w, h);
    masonry(x, top, w, h);
    // gold trim + roof
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x - 6, top - 10, w + 12, 12);
    ctx.fillRect(x, top, 6, h); ctx.fillRect(x + w - 6, top, 6, h);
    // marquee sign
    ctx.fillStyle = '#120a20';
    ctx.fillRect(x + 30, top + 18, w - 60, 46);
    const flick = 0.75 + 0.25 * Math.sin(elapsed * 6);
    signText(adminSettings().world.signs?.casino || 'CASINO', x + w / 2, top + 42, 30, `rgba(255,90,160,${flick})`, '#ff4fa3');
    // marquee bulbs
    for (let i = 0; i < 12; i++) {
      const on = (Math.floor(elapsed * 4) + i) % 2 === 0;
      ctx.fillStyle = on ? '#ffd878' : '#6a5426';
      ctx.fillRect(x + 36 + i * ((w - 78) / 11), top + 68, 6, 6);
    }
    // windows
    for (let i = 0; i < 4; i++) windowGlow(nf, x + 30 + i * ((w - 90) / 3), top + 96, 40, 52, true);
    // door
    door(b, '#2a1640', '#c9a24a');
    // neon spill at night
    if (nf > 0.3) {
      ctx.fillStyle = `rgba(255,79,163,${(nf - 0.3) * 0.16})`;
      ctx.fillRect(x - 20, GROUND - 4, w + 40, 10);
    }
  } else if (kind === 'chess') {
    ctx.fillStyle = lerpColor('#e8e4d8', '#8a8678', nf);
    ctx.fillRect(x, top + 40, w, h - 40);
    masonry(x, top + 40, w, h - 40, 'stone');
    ctx.fillStyle = '#5e2537'; ctx.fillRect(x - 14, top + 42, w + 28, 9);
    // pavilion roof
    ctx.fillStyle = lerpColor('#963c4f', '#4d2635', nf);
    ctx.beginPath();
    ctx.moveTo(x - 14, top + 44); ctx.lineTo(x + w / 2, top - 16); ctx.lineTo(x + w + 14, top + 44);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = '#e8a17c50'; ctx.lineWidth = 1;
    for (let yy = top - 6; yy < top + 44; yy += 8) { ctx.beginPath(); ctx.moveTo(x - 14, yy); ctx.lineTo(x + w + 14, yy); ctx.stroke(); }
    for (let xx = x - 14; xx < x + w + 14; xx += 19) { ctx.beginPath(); ctx.moveTo(xx, top - 16); ctx.lineTo(xx + 25, top + 44); ctx.stroke(); } ctx.restore();
    // columns
    ctx.fillStyle = lerpColor('#c8c4b4', '#6a6658', nf);
    ctx.fillRect(x + 16, top + 52, 14, h - 60);
    ctx.fillRect(x + w - 30, top + 52, 14, h - 60);
    // banner
    ctx.fillStyle = '#862f44';
    ctx.fillRect(x + w / 2 - 26, top + 56, 52, 64);
    signText('♟', x + w / 2, top + 90, 34, '#e8e4d8');
    signText(adminSettings().world.signs?.chess || 'TOURNAMENT HALL', x + w / 2, top + 140, 15, lerpColor('#592a38', '#e9d4ac', nf));
    door(b, '#4a3a28', '#8a7a5a');
  } else if (kind === 'store') {
    ctx.fillStyle = lerpColor('#c8b89a', '#6e6250', nf);
    ctx.fillRect(x, top, w, h);
    masonry(x, top, w, h);
    ctx.fillStyle = '#586346'; ctx.fillRect(x - 6, top - 8, w + 12, 10);
    ctx.fillStyle = '#dfcba7'; ctx.fillRect(x - 6, top + 2, w + 12, 4);
    // striped awning
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#d84a4a' : '#e8e4d8';
      ctx.fillRect(x + i * (w / 8), top + 34, w / 8, 26);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, top + 56, w, 6);
    signText(adminSettings().world.signs?.store || 'GENERAL STORE', x + w / 2, top + 18, 16, lerpColor('#4a3a28', '#e8d8b8', nf));
    windowGlow(nf, x + 22, top + 76, 52, 60, true);
    windowGlow(nf, x + w - 74, top + 76, 52, 60, true);
    door(b, '#5a4632', '#8a7a5a');
  } else if (kind === 'property') {
    ctx.fillStyle = lerpColor('#4a6a8a', '#24364a', nf);
    ctx.fillRect(x, top, w, h);
    masonry(x, top, w, h, 'stone');
    ctx.fillStyle = '#d4c4a1'; ctx.fillRect(x - 5, top - 5, w + 10, 6); ctx.fillRect(x + 6, top + 16, 7, h - 26); ctx.fillRect(x + w - 13, top + 16, 7, h - 26);
    ctx.fillStyle = lerpColor('#3a5a7a', '#1c2c3e', nf);
    ctx.fillRect(x, top, w, 14);
    signText(adminSettings().world.signs?.property || 'PROPERTY OFFICE', x + w / 2, top + 34, 15, '#cfe4f8');
    // blueprint board
    ctx.fillStyle = '#1c3a5c';
    ctx.fillRect(x + 20, top + 56, 70, 84);
    ctx.strokeStyle = '#7ab8e8'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 30, top + 66, 50, 40);
    ctx.beginPath(); ctx.moveTo(x + 30, top + 116); ctx.lineTo(x + 80, top + 116); ctx.stroke();
    windowGlow(nf, x + w - 78, top + 60, 56, 64, true);
    door(b, '#2a3c50', '#7ab8e8');
  } else if (kind === 'leaders') {
    ctx.fillStyle = lerpColor('#8a7a4a', '#4a4028', nf);
    ctx.fillRect(x, top + 30, w, h - 30);
    masonry(x, top + 30, w, h - 30, 'stone');
    ctx.fillStyle = '#d3bd7e'; for (const col of [x + 8, x + w - 20]) { ctx.fillRect(col, top + 36, 12, h - 42); ctx.fillRect(col - 3, top + 34, 18, 5); }
    // podium roof
    ctx.fillStyle = lerpColor('#c9a24a', '#6e5626', nf);
    ctx.fillRect(x - 8, top + 18, w + 16, 16);
    ctx.fillRect(x + 20, top + 4, w - 40, 16);
    signText(adminSettings().world.signs?.leaders || 'LEADERBOARD HALL', x + w / 2, top + 56, 15, lerpColor('#3a3018', '#f0d898', nf));
    signText('🏆', x + w / 2, top + 96, 34, '#ffd878', nf > 0.3 ? '#c9a24a' : null);
    windowGlow(nf, x + 24, top + 120, 44, 56, true);
    windowGlow(nf, x + w - 68, top + 120, 44, 56, true);
    door(b, '#4a3c20', '#c9a24a');
  }
  ctx.fillStyle = '#00000020'; ctx.fillRect(x + 5, GROUND - 5, w - 10, 5);
  for (const px of [x + 5, x + w - 23]) {
    ctx.fillStyle = '#83614a'; ctx.fillRect(px, GROUND - 18, 18, 16);
    ctx.fillStyle = '#719569'; ctx.fillRect(px - 3, GROUND - 29, 24, 13);
    ctx.fillStyle = '#9bab70'; ctx.fillRect(px + 4, GROUND - 33, 12, 8);
  }
}

function door(b, fill, trim) {
  const dw = 36, dh = 56;
  const dx = b.doorX - dw / 2;
  ctx.fillStyle = '#121b22'; ctx.fillRect(dx - 5, GROUND - dh - 6, dw + 10, dh + 6);
  ctx.fillStyle = '#00000030'; ctx.fillRect(dx - 7, GROUND - dh - 9, dw + 19, 7);
  ctx.fillStyle = trim; ctx.fillRect(dx - 8, GROUND - dh - 12, dw + 16, 5);
  ctx.fillStyle = fill;
  ctx.fillRect(dx, GROUND - dh, dw, dh);
  for (let i = 1; i < 5; i++) { ctx.fillStyle = '#00000030'; ctx.fillRect(dx + i * 7, GROUND - dh + 3, 1, dh - 5); }
  ctx.fillStyle = '#b3c8c330'; ctx.fillRect(dx + 6, GROUND - dh + 6, dw - 12, 15);
  ctx.fillStyle = trim; ctx.fillRect(dx - 7, GROUND - 2, dw + 14, 3);
  ctx.strokeStyle = trim;
  ctx.lineWidth = 3;
  ctx.strokeRect(dx, GROUND - dh, dw, dh);
  ctx.fillStyle = trim;
  ctx.fillRect(dx + dw - 9, GROUND - dh / 2, 4, 4);
  // highlight when near
  if (currentDoor === b) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx - 4, GROUND - dh - 4, dw + 8, dh + 8);
  }
}

function drawLot(b, nf) {
  const { x, w } = b;
  // fence
  ctx.fillStyle = lerpColor('#8a7a5a', '#4a4030', nf);
  for (let px = x; px < x + w; px += 22) ctx.fillRect(px, GROUND - 40, 6, 40);
  ctx.fillRect(x, GROUND - 34, w, 5);
  ctx.fillRect(x, GROUND - 16, w, 5);
  // sign
  ctx.fillStyle = lerpColor('#e8e4d8', '#9a9688', nf);
  ctx.fillRect(b.doorX - 52, GROUND - 96, 104, 44);
  ctx.strokeStyle = '#8a4a2a'; ctx.lineWidth = 3;
  ctx.strokeRect(b.doorX - 52, GROUND - 96, 104, 44);
  signText('FOR SALE', b.doorX, GROUND - 80, 15, '#c84a2a');
  signText('your lot?', b.doorX, GROUND - 64, 10, '#6a5a4a');
  ctx.fillStyle = lerpColor('#8a7a5a', '#4a4030', nf);
  ctx.fillRect(b.doorX - 3, GROUND - 52, 6, 52);
  // grass tufts
  ctx.fillStyle = lerpColor('#5a7a3a', '#2a3a1e', nf);
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 14 + i * 36, GROUND - 6, 4, 6);
}

function drawCrates(nf) {
  for (const c of CRATES) {
    ctx.fillStyle = lerpColor('#a8845a', '#54402c', nf);
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = lerpColor('#7a5c3a', '#3a2c1c', nf);
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.beginPath();
    ctx.moveTo(c.x + 4, c.y + 4); ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
    ctx.moveTo(c.x + c.w - 4, c.y + 4); ctx.lineTo(c.x + 4, c.y + c.h - 4);
    ctx.stroke();
  }
}

function drawLamps(nf) {
  for (let lx = 140; lx < WORLD_W; lx += 380) {
    ctx.fillStyle = lerpColor('#3a3a44', '#1c1c24', nf);
    ctx.fillRect(lx - 3, GROUND - 118, 6, 118);
    ctx.fillRect(lx - 12, GROUND - 122, 24, 8);
    const on = nf > 0.3;
    ctx.fillStyle = on ? '#ffd878' : '#8a8a96';
    ctx.fillRect(lx - 8, GROUND - 116, 16, 10);
    if (on) {
      const g = ctx.createRadialGradient(lx, GROUND - 108, 4, lx, GROUND - 108, 70);
      g.addColorStop(0, `rgba(255,216,120,${0.22 * nf})`);
      g.addColorStop(1, 'rgba(255,216,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx, GROUND - 108, 70, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function shadow(x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, w, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(nf) {
  const cfg = get().character;
  const s = 3;
  const action = !player.onGround ? 'jump' : (player.vx !== 0 ? 'walk' : 'idle');
  const bob = action === 'idle' && !reduced ? Math.round(Math.sin(elapsed * 2.2)) : 0;
  const blink = (player.blinkT % 3.9) < 0.12;
  shadow(player.x, player.y, 20);
  drawCharacter(ctx, cfg, player.x - 8 * s, player.y - 24 * s, s, {
    frame: player.frame, facing: player.facing, action, blink, bob,
  });
  // name tag
  ctx.font = '11px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(get().profile.name || 'You', player.x, player.y - 24 * s - 10);
}

// Live players from Supabase presence, smoothed between 8Hz updates.
const remoteSmooth = new Map();
function drawRemote(p) {
  const s = 3;
  let r = remoteSmooth.get(p.id);
  if (!r) { r = { x: p.x, y: p.y }; remoteSmooth.set(p.id, r); }
  r.x += (p.x - r.x) * 0.25;
  r.y += (p.y - r.y) * 0.25;
  if (r.x < camX - 60 || r.x > camX + viewW + 60) return;
  const action = p.frame ? 'walk' : 'idle';
  shadow(r.x, r.y, 18);
  drawCharacter(ctx, p.character || characterFor(p.name || 'player'), r.x - 8 * s, r.y - 24 * s, s, {
    frame: p.frame || 0, facing: p.facing || 1, action,
  });
  ctx.font = '10px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9cc75e';
  ctx.fillText((p.name || 'Player') + ' ●', r.x, r.y - 24 * s - 8);
}

function drawNpc(n, nf) {
  const s = 3;
  const action = n.state === 'walk' ? 'walk' : 'idle';
  const bob = action === 'idle' && !reduced ? Math.round(Math.sin(elapsed * 2 + n.x)) : 0;
  shadow(n.x, n.y, 18);
  drawCharacter(ctx, n.cfg, n.x - 8 * s, n.y - 24 * s, s, { frame: n.frame, facing: n.facing, action, bob });
  ctx.font = '10px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(n.name, n.x, n.y - 24 * s - 8);
  if (n.bubbleT > 0 && n.bubble) {
    ctx.font = '12px "Pixelify Sans", monospace';
    const lines = ['']; for (const word of n.bubble.split(/\s+/)) { const i = lines.length - 1; if (ctx.measureText(lines[i] + ' ' + word).width > 230 && lines[i]) { if (lines.length === 3) { lines[2] += '…'; break; } lines.push(word); } else lines[i] += (lines[i] ? ' ' : '') + word; }
    const w = Math.min(250, Math.max(...lines.map(line => ctx.measureText(line).width)) + 18), h = 12 + lines.length * 14;
    const bx = n.x - w / 2, by = n.y - 24 * s - h - 16;
    ctx.fillStyle = '#202b2e'; ctx.fillRect(bx, by, w, h); ctx.strokeStyle = '#cfbd88'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, w, h);
    ctx.fillStyle = '#cfbd88'; ctx.fillRect(n.x - 3, by + h, 6, 5);
    ctx.fillStyle = '#efe9ff'; lines.forEach((line, i) => ctx.fillText(line, n.x, by + 12 + i * 14));
  }
}