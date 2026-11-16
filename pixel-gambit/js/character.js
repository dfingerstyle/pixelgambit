// Procedural pixel character: one renderer used by the world, NPCs and the editor.
// Logical sprite is 16x24 pixels; callers choose the scale.

export const HAIR_STYLES = ['short', 'long', 'mohawk', 'bun', 'none'];
export const CHARACTER_SLOTS = { jacket: ['none', 'charcoal', 'navy', 'ivory'], neckwear: ['none', 'red', 'gold', 'blue', 'bow'], eyewear: ['none', 'round', 'dark'], headwear: ['none', 'fedora'] };
export function normalizeCharacter(value) {
  if (!value || !['skin', 'hair', 'shirt', 'pants'].every(k => typeof value[k] === 'string' && /^#[a-f0-9]{6}$/i.test(value[k])) || !HAIR_STYLES.includes(value.hairStyle)) return null;
  const result = Object.fromEntries(['skin', 'hair', 'shirt', 'pants', 'hairStyle'].map(k => [k, value[k]]));
  for (const [slot, values] of Object.entries(CHARACTER_SLOTS)) result[slot] = values.includes(value[slot]) ? value[slot] : 'none';
  return result;
}

export const PALETTES = {
  skin: ['#f6d3b3', '#f2c9a0', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'],
  hair: ['#2b2118', '#3a2a20', '#6b4a2f', '#a8743a', '#d9b380', '#e8e4df', '#b84a6e', '#5a6fd8', '#4fae7a'],
  shirt: ['#7fa650', '#4fae7a', '#3b82c4', '#5a6fd8', '#a855f7', '#e05a8a', '#e0a23a', '#d84a4a', '#e8e4df', '#3a3f4a'],
  pants: ['#3b4252', '#2b3a4a', '#4a3b52', '#5c4a32', '#2f4a3a', '#6e2f3a', '#8a8f98', '#22262e'],
};

export const DEFAULT_CHARACTER = {
  skin: '#f2c9a0',
  hair: '#3a2a20',
  hairStyle: 'short',
  shirt: '#7fa650',
  pants: '#3b4252',
};

export function randomCharacter() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    skin: pick(PALETTES.skin),
    hair: pick(PALETTES.hair),
    hairStyle: pick(HAIR_STYLES),
    shirt: pick(PALETTES.shirt),
    pants: pick(PALETTES.pants),
  };
}

// Deterministic character for a named NPC so residents look consistent.
export function characterFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const pick = (a, salt) => a[(h + salt * 7) % a.length];
  return {
    skin: pick(PALETTES.skin, 1),
    hair: pick(PALETTES.hair, 2),
    hairStyle: HAIR_STYLES[(h + 3) % HAIR_STYLES.length],
    shirt: pick(PALETTES.shirt, 4),
    pants: pick(PALETTES.pants, 5),
  };
}

const SHOES = '#26262e';
const EYES = '#26221f';

// o: { frame 0-3, facing 1|-1, action 'idle'|'walk'|'jump', blink bool, bob px }
export function drawCharacter(ctx, cfg, dx, dy, s, o = {}) {
  const { frame = 0, facing = 1, action = 'idle', blink = false, bob = 0 } = o;
  ctx.save();
  ctx.translate(Math.round(dx), Math.round(dy + bob));
  ctx.scale(facing * s, s);
  if (facing < 0) ctx.translate(-16, 0);

  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // legs + shoes per animation frame
  let lLeg = { x: 5, y: 17, w: 3, h: 5 };
  let rLeg = { x: 8, y: 17, w: 3, h: 5 };
  let lShoe = { x: 4, y: 22, w: 4, h: 2 };
  let rShoe = { x: 8, y: 22, w: 4, h: 2 };
  if (action === 'walk') {
    if (frame === 1) {
      lLeg = { x: 6, y: 17, w: 3, h: 4 }; lShoe = { x: 6, y: 21, w: 4, h: 2 };
      rLeg = { x: 7, y: 17, w: 3, h: 5 }; rShoe = { x: 6, y: 22, w: 4, h: 2 };
    } else if (frame === 3) {
      rLeg = { x: 7, y: 17, w: 3, h: 4 }; rShoe = { x: 7, y: 21, w: 4, h: 2 };
      lLeg = { x: 6, y: 17, w: 3, h: 5 }; lShoe = { x: 5, y: 22, w: 4, h: 2 };
    }
  } else if (action === 'sit') {
    lLeg = { x: 5, y: 17, w: 5, h: 3 }; rLeg = { x: 9, y: 18, w: 3, h: 3 };
    lShoe = { x: 8, y: 20, w: 4, h: 2 }; rShoe = { x: 10, y: 21, w: 4, h: 2 };
  } else if (action === 'jump') {
    lLeg = { x: 5, y: 17, w: 3, h: 3 }; rLeg = { x: 8, y: 17, w: 3, h: 3 };
    lShoe = { x: 4, y: 20, w: 4, h: 2 }; rShoe = { x: 8, y: 20, w: 4, h: 2 };
  }
  r(lLeg.x, lLeg.y, lLeg.w, lLeg.h, cfg.pants);
  r(rLeg.x, rLeg.y, rLeg.w, rLeg.h, cfg.pants);
  r(lShoe.x, lShoe.y, lShoe.w, lShoe.h, SHOES);
  r(rShoe.x, rShoe.y, rShoe.w, rShoe.h, SHOES);

  // torso
  r(4, 10, 8, 7, cfg.shirt);
  r(4, 16, 8, 1, shade(cfg.shirt, -18));

  // arms (swing while walking, raised while jumping)
  let armL = { x: 3, y: 10, h: 5 };
  let armR = { x: 12, y: 10, h: 5 };
  if (action === 'walk') {
    if (frame === 1) { armL = { x: 3, y: 11, h: 4 }; armR = { x: 12, y: 9, h: 5 }; }
    if (frame === 3) { armL = { x: 3, y: 9, h: 5 }; armR = { x: 12, y: 11, h: 4 }; }
  } else if (action === 'jump') {
    armL = { x: 2, y: 8, h: 5 }; armR = { x: 13, y: 8, h: 5 };
  }
  r(armL.x, armL.y, 1, armL.h, shade(cfg.shirt, -10));
  r(armR.x, armR.y, 1, armR.h, shade(cfg.shirt, -10));
  r(armL.x, armL.y + armL.h, 1, 1, cfg.skin);
  r(armR.x, armR.y + armR.h, 1, 1, cfg.skin);

  const jacket = { charcoal: '#34343f', navy: '#273952', ivory: '#d6c9ae' }[cfg.jacket];
  if (jacket) {
    r(4, 10, 3, 7, jacket); r(9, 10, 3, 7, jacket); r(5, 11, 1, 3, shade(jacket, 25)); r(10, 11, 1, 3, shade(jacket, 25)); r(6, 10, 1, 2, '#e9e0ca'); r(9, 10, 1, 2, '#e9e0ca'); r(10, 13, 1, 1, '#dcc799'); r(armL.x, armL.y, 1, armL.h, jacket); r(armR.x, armR.y, 1, armR.h, jacket);
  }
  const tie = { red: '#ba4356', gold: '#d4a84a', blue: '#578bc0' }[cfg.neckwear];
  if (tie) { r(7, 10, 2, 1, '#eee1cb'); r(7, 11, 2, 1, tie); r(7, 12, 1, 4, tie); r(8, 15, 1, 1, shade(tie, -20)); }
  if (cfg.neckwear === 'bow') { r(6, 11, 1, 2, '#b63850'); r(9, 11, 1, 2, '#b63850'); r(7, 11, 2, 1, '#d66574'); }

  // head
  r(4, 2, 8, 8, cfg.skin);
  r(4, 9, 8, 1, shade(cfg.skin, -14));
  // ears
  r(3, 6, 1, 2, cfg.skin);
  r(12, 6, 1, 2, cfg.skin);

  // eyes (face right of center so flipping reads)
  if (blink) {
    r(6, 7, 2, 1, EYES);
    r(9, 7, 2, 1, EYES);
  } else {
    r(6, 6, 1, 2, EYES);
    r(9, 6, 1, 2, EYES);
  }
  // mouth
  r(7, 9, 2, 1, shade(cfg.skin, -30));

  // hair
  const hc = cfg.hair;
  switch (cfg.hairStyle) {
    case 'short':
      r(4, 0, 8, 3, hc); r(3, 2, 1, 3, hc); r(12, 2, 1, 3, hc);
      r(4, 3, 2, 1, hc); r(10, 3, 2, 1, hc);
      break;
    case 'long':
      r(4, 0, 8, 3, hc); r(3, 2, 1, 10, hc); r(12, 2, 1, 10, hc);
      r(4, 3, 1, 6, hc); r(11, 3, 1, 6, hc);
      break;
    case 'mohawk':
      r(7, 0, 2, 4, hc); r(6, 1, 4, 1, hc);
      break;
    case 'bun':
      r(4, 1, 8, 2, hc); r(3, 2, 1, 2, hc); r(12, 2, 1, 2, hc);
      r(9, 0, 4, 2, hc); r(10, 2, 2, 1, shade(hc, -20));
      break;
    default:
      break;
  }

  if (cfg.eyewear === 'round' || cfg.eyewear === 'dark') {
    r(5, 5, 3, 1, '#352c2e'); r(9, 5, 3, 1, '#352c2e'); r(5, 8, 3, 1, '#352c2e'); r(9, 8, 3, 1, '#352c2e'); r(5, 6, 1, 2, '#352c2e'); r(11, 6, 1, 2, '#352c2e'); r(8, 6, 1, 1, '#352c2e');
    if (cfg.eyewear === 'dark') { r(6, 6, 2, 2, '#263643'); r(9, 6, 2, 2, '#263643'); r(6, 6, 1, 1, '#a1bfc5'); }
  }
  if (cfg.headwear === 'fedora') { r(4, 0, 8, 3, '#423c38'); r(3, 3, 10, 1, '#29282b'); r(5, 2, 6, 1, '#ac8352'); r(5, 0, 6, 1, '#6d6254'); }
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `rgb(${r},${g},${b})`;
}

// ---- settings editor ----
// Wires the character editor inside the settings modal. onChange(cfg) persists.
export function attachCharacterEditor(onChange) {
  const preview = document.getElementById('char-preview');
  const pctx = preview.getContext('2d');
  let cfg = { ...DEFAULT_CHARACTER };
  let raf = 0;

  function setConfig(next) {
    cfg = { ...cfg, ...next };
    buildSwatches();
    onChange(cfg);
  }

  function swatchRow(id, key) {
    const row = document.getElementById(id);
    row.replaceChildren();
    PALETTES[key].forEach((color) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (cfg[key] === color ? ' active' : '');
      b.style.background = color;
      b.setAttribute('aria-label', `${key} ${color}`);
      b.addEventListener('click', () => setConfig({ [key]: color }));
      row.appendChild(b);
    });
  }

  function buildSwatches() {
    swatchRow('char-skin', 'skin');
    swatchRow('char-hair', 'hair');
    swatchRow('char-shirt', 'shirt');
    swatchRow('char-pants', 'pants');
    document.querySelectorAll('#char-hairstyle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.style === cfg.hairStyle);
    });
  }

  document.querySelectorAll('#char-hairstyle button').forEach((b) => {
    b.addEventListener('click', () => setConfig({ hairStyle: b.dataset.style }));
  });
  document.getElementById('char-random').addEventListener('click', () => setConfig(randomCharacter()));

  // animated preview loop (idle + blink + occasional wave via walk frames)
  let t0 = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;
    const w = preview.width, h = preview.height;
    pctx.clearRect(0, 0, w, h);
    const s = Math.floor(Math.min(w / 20, h / 28));
    const bob = Math.round(Math.sin(t * 2.2));
    const blink = (t % 3.7) < 0.12;
    const action = (t % 6) > 4.6 ? 'walk' : 'idle';
    const frame = Math.floor(t * 8) % 4;
    drawCharacter(pctx, cfg, (w - 16 * s) / 2, (h - 24 * s) / 2 + 2, s, { action, frame, blink, bob, facing: 1 });
  }

  return {
    open(current) {
      cfg = { ...DEFAULT_CHARACTER, ...current };
      buildSwatches();
      cancelAnimationFrame(raf);
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    },
    close() { cancelAnimationFrame(raf); },
  };
}