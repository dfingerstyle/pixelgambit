const KEY = 'pg-local-admin-settings';
const empty = () => ({ npcs: {}, world: { sky: 'original', night: 'cycle', tint: '#ffffff', tintStrength: 0 }, economy: { wageMin: 100, wageMax: 250, workSeconds: 60, fishSeconds: 30, growSeconds: 60, incomeMultiplier: 1, shopMultiplier: 1 } });
let permitted = false, settings = empty();
try { const saved = sessionStorage.getItem(KEY); if (saved) settings = JSON.parse(saved); } catch { settings = empty(); }
const listeners = new Set();
export function adminSettings() { return permitted ? settings : empty(); }
export function setAdminPermitted(on) { const next = on && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname); if (next === permitted) return; permitted = next; listeners.forEach(f => f()); }
export function writeAdminSettings(value) { if (!permitted) return false; settings = structuredClone(value); sessionStorage.setItem(KEY, JSON.stringify(settings)); listeners.forEach(f => f()); return true; }
export function onAdminSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function blankAdminSettings() { return empty(); }
