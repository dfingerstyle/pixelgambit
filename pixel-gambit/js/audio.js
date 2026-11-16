// Synthesized pixel sound. One master switch silences everything.
let ctx = null;
let master = null;
let enabled = localStorage.getItem('pg-sound') !== 'off';

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function soundEnabled() { return enabled; }

export function setSound(on) {
  enabled = on;
  localStorage.setItem('pg-sound', on ? 'on' : 'off');
  if (on) { ensure(); syncAmbience(); } else stopAmbience();
}

function tone(freq, dur, { type = 'square', vol = 0.16, at = 0, slide = 0 } = {}) {
  if (!enabled || !ensure()) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock() { if (enabled) ensure(); },
  click() { tone(660, 0.05, { vol: 0.08 }); },
  select() { tone(520, 0.06, { vol: 0.09 }); },
  move() { tone(300, 0.09, { vol: 0.14 }); tone(440, 0.07, { vol: 0.1, at: 0.05 }); },
  capture() { tone(220, 0.12, { type: 'sawtooth', vol: 0.16 }); tone(140, 0.16, { vol: 0.14, at: 0.06 }); },
  check() { tone(880, 0.1, { vol: 0.14 }); tone(880, 0.12, { vol: 0.14, at: 0.14 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.14, at: i * 0.11 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.15, at: i * 0.12 })); },
  draw() { tone(440, 0.15, { type: 'triangle', vol: 0.13 }); tone(440, 0.2, { type: 'triangle', vol: 0.11, at: 0.18 }); },
  coinSpin() { tone(900, 0.5, { type: 'triangle', vol: 0.07, slide: 700 }); },
  coinWin() { [784, 988, 1319].forEach((f, i) => tone(f, 0.12, { vol: 0.14, at: i * 0.08 })); },
  coinLose() { tone(240, 0.25, { type: 'sawtooth', vol: 0.13, slide: -120 }); },
  theme() { tone(520, 0.08, { type: 'triangle', vol: 0.1 }); tone(780, 0.1, { type: 'triangle', vol: 0.1, at: 0.07 }); },
  chip() { tone(1200, 0.03, { vol: 0.1 }); tone(1800, 0.04, { vol: 0.07, at: 0.025 }); },
  tick() { tone(2000, 0.02, { vol: 0.05 }); },
  reelStop() { tone(330, 0.07, { vol: 0.13 }); tone(220, 0.09, { vol: 0.1, at: 0.04 }); },
  dice() { [0, 0.07, 0.15, 0.24].forEach((a, i) => tone(500 + i * 180, 0.04, { vol: 0.09, at: a })); },
  bigWin() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, { vol: 0.15, at: i * 0.09 })); },
  cash() { tone(1320, 0.07, { vol: 0.12 }); tone(1760, 0.12, { vol: 0.12, at: 0.07 }); },
  error() { tone(180, 0.15, { type: 'sawtooth', vol: 0.12 }); },
  plant() { tone(392, 0.08, { type: 'triangle', vol: 0.12 }); tone(523, 0.1, { type: 'triangle', vol: 0.1, at: 0.07 }); },
  harvest() { [440, 554, 659].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.12, at: i * 0.06 })); },
  splash() { tone(600, 0.2, { type: 'sine', vol: 0.12, slide: -350 }); },
  step() { tone(190 + Math.random() * 40, 0.035, { type: 'triangle', vol: 0.05 }); },
  jump() { tone(320, 0.09, { type: 'triangle', vol: 0.09, slide: 260 }); },
  land() { tone(150, 0.06, { type: 'triangle', vol: 0.08 }); },
  door() { tone(523, 0.09, { type: 'triangle', vol: 0.11 }); tone(784, 0.12, { type: 'triangle', vol: 0.11, at: 0.08 }); },
};

// ---- casino ambience: a low, warm room hum. Independent of SFX mute state. ----
let ambience = null;
let ambienceOn = localStorage.getItem('pg-ambience') === 'on';

export function ambienceEnabled() { return ambienceOn; }

export function setAmbience(on) {
  ambienceOn = on;
  localStorage.setItem('pg-ambience', on ? 'on' : 'off');
  if (on) startAmbience(); else stopAmbience();
}

function startAmbience() {
  if (!enabled || !ensure() || ambience) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  const oscs = [55, 82.5, 110, 165].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i < 2 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i < 2 ? 0.5 : 0.12;
    o.connect(g).connect(gain);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
  ambience = { gain, oscs, lfo };
}

function stopAmbience() {
  if (!ambience) return;
  const a = ambience;
  ambience = null;
  a.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => { a.oscs.forEach((o) => o.stop()); a.lfo.stop(); a.gain.disconnect(); }, 800);
}

export function syncAmbience() {
  if (ambienceOn && enabled) startAmbience(); else stopAmbience();
}