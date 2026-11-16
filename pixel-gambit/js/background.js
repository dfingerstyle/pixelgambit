// Animated canvas sky: stars / petals / bubbles per theme. One rAF loop.
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, raf = 0, theme = 'starry';
let stars = [], petals = [], bubbles = [], meteors = [];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed();
  if (reduced) draw(0);
}

function rnd(a, b) { return a + Math.random() * (b - a); }

function seed() {
  stars = Array.from({ length: Math.min(160, W / 8) }, () => ({
    x: rnd(0, W), y: rnd(0, H), s: Math.random() < 0.85 ? 2 : 3,
    p: rnd(0, Math.PI * 2), v: rnd(0.4, 1.4),
  }));
  petals = Array.from({ length: 34 }, () => ({
    x: rnd(0, W), y: rnd(-H, H), s: rnd(4, 9), vy: rnd(0.35, 0.9),
    sway: rnd(0.4, 1.2), p: rnd(0, Math.PI * 2), rot: rnd(0, Math.PI * 2), vr: rnd(-0.02, 0.02),
  }));
  bubbles = Array.from({ length: 30 }, () => ({
    x: rnd(0, W), y: rnd(0, H), r: rnd(2, 7), vy: rnd(0.3, 0.9), p: rnd(0, Math.PI * 2),
  }));
  meteors = [];
}

function drawStarry(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1c1136');
  g.addColorStop(1, '#120a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.v + s.p));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e9e2ff';
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
  }
  ctx.globalAlpha = 1;
  if (!reduced && Math.random() < 0.006 && meteors.length < 2) {
    meteors.push({ x: rnd(W * 0.3, W), y: rnd(0, H * 0.3), vx: -rnd(4, 7), vy: rnd(2, 3.4), life: 1 });
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx; m.y += m.vy; m.life -= 0.014;
    if (m.life <= 0) { meteors.splice(i, 1); continue; }
    const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 9, m.y - m.vy * 9);
    grad.addColorStop(0, `rgba(255,240,255,${0.9 * m.life})`);
    grad.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 9, m.y - m.vy * 9);
    ctx.stroke();
  }
}

function drawSakura(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#331724');
  g.addColorStop(1, '#241019');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,214,228,0.10)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.2, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,228,238,0.16)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.2, 62, 0, Math.PI * 2);
  ctx.fill();
  for (const p of petals) {
    p.y += p.vy;
    p.x += Math.sin(t * 0.001 * p.sway + p.p) * 0.5;
    p.rot += p.vr;
    if (p.y > H + 12) { p.y = -12; p.x = rnd(0, W); }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = 'rgba(255,159,190,0.75)';
    ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
    ctx.fillStyle = 'rgba(255,200,220,0.5)';
    ctx.fillRect(-p.s / 2, -p.s / 3, p.s / 2, p.s * 0.33);
    ctx.restore();
  }
}

function drawSea(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d3049');
  g.addColorStop(1, '#06182b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const x = W * (0.15 + i * 0.22) + Math.sin(t * 0.0003 + i) * 30;
    const ray = ctx.createLinearGradient(x, 0, x + 90, H);
    ray.addColorStop(0, 'rgba(120,220,255,0.10)');
    ray.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 46, 0);
    ctx.lineTo(x + 150, H);
    ctx.lineTo(x + 30, H);
    ctx.closePath();
    ctx.fill();
  }
  for (const b of bubbles) {
    b.y -= b.vy;
    b.x += Math.sin(t * 0.001 + b.p) * 0.3;
    if (b.y < -12) { b.y = H + 12; b.x = rnd(0, W); }
    ctx.strokeStyle = 'rgba(150,225,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,245,255,0.35)';
    ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 2, 2);
  }
}

function drawDay(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#79b6dc'); g.addColorStop(1, '#d7e8de');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(W * .8, H * .18, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff88';
  for (let i = 0; i < 6; i++) {
    const x = ((i * W / 5 + t * .008) % (W + 180)) - 120, y = 70 + (i % 3) * 65;
    ctx.fillRect(x, y, 100, 18); ctx.fillRect(x + 20, y - 14, 55, 16);
  }
}

function draw(t) {
  if (theme === 'day') drawDay(t);
  else if (theme === 'sakura') drawSakura(t);
  else if (theme === 'sea') drawSea(t);
  else drawStarry(t);
}

function loop(t) {
  draw(t);
  raf = requestAnimationFrame(loop);
}

export function setSkyTheme(next) {
  theme = next;
  if (reduced) draw(0);
}

export function startSky(initial) {
  theme = initial;
  resize();
  window.addEventListener('resize', resize);
  if (!reduced) {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  }
}