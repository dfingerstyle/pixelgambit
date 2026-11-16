// Optional online layer: accounts, cloud saves, town presence, live standings.
// Without network/config the game stays fully playable in local mode.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { normalizeCharacter } from './character.js';
import { get, replaceWorld, subscribe, netWorth, levelOf, casinoProfit } from './state.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const SYNC_KEY = 'pg-cloud-at';

export const net = {
  status: 'local', // local | connecting | signed-out | online
  user: null,
  email: null,
  error: null,
  syncedAt: 0,
  board: [],
  peers: [],
};

const listeners = new Set();
export function onNet(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((f) => f(net)); }

let client = null;
let channel = null;
let pushTimer = null;
let boardTimer = null;
let applyingRemote = false;
let lastTrack = 0;

export function configured() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }

export async function init() {
  if (!configured()) { net.status = 'local'; emit(); return; }
  net.status = 'connecting';
  emit();
  try {
    const { createClient } = await import(CDN);
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    client = null;
    net.status = 'local';
    net.error = 'Cloud library unreachable — playing in local mode.';
    emit();
    return;
  }
  client.auth.onAuthStateChange((_event, session) => { setTimeout(() => handleSession(session), 0); });
  window.addEventListener('pagehide', () => {
    if (channel && net.user) channel.httpSend('bye', { uid: net.user.id }).catch(() => {});
  });
  const { data } = await client.auth.getSession();
  await handleSession(data.session);
}

async function handleSession(session) {
  const uid = session?.user?.id || null;
  if (uid && net.user?.id === uid && net.status === 'online') return;
  clearTimeout(pushTimer);
  const previous = net.user;
  if (previous && previous.id !== uid) {
    localStorage.setItem('pg-account-' + previous.id, JSON.stringify(get()));
    if (channel) { client.removeChannel(channel); channel = null; }
    clearInterval(aliveTimer);
    net.peers = [];
    lastPayload = null;
  }
  net.user = session?.user || null;
  net.email = session?.user?.email || null;
  net.error = null;
  if (!session) {
    if (channel && net.user) channel.httpSend('bye', { uid: net.user.id }).catch(() => {});
    net.peers = [];
    net.board = [];
    if (channel) { client.removeChannel(channel); channel = null; }
    clearInterval(aliveTimer);
    net.status = configured() ? 'signed-out' : 'local';
    emit();
    return;
  }
  net.status = 'online';
  emit();
  await pullSave();
  joinTown();
  refreshBoard();
}

// ---- cloud saves ----
async function pullSave() {
  const { data, error } = await client.from('saves')
    .select('world,updated_at').eq('user_id', net.user.id).maybeSingle();
  if (error) { net.error = error.message; emit(); return; }
  applyingRemote = true;
  const cached = localStorage.getItem('pg-account-' + net.user.id);
  replaceWorld(data?.world || (cached ? JSON.parse(cached) : {}));
  applyingRemote = false;
  await pushSave();
}

function schedulePush() {
  if (!net.user || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSave, 1200);
}

async function pushSave() {
  if (!net.user || !client) return;
  const s = get();
  const [p, sv] = await Promise.all([
    client.from('profiles').upsert({ id: net.user.id, name: s.profile.name, character: s.character, net_worth: netWorth(), level: levelOf(s.xp), xp: s.xp, profit: casinoProfit() }),
    client.from('saves').upsert({
      user_id: net.user.id, world: s,
      net_worth: netWorth(), level: levelOf(s.xp),
      updated_at: new Date().toISOString(),
    }),
  ]);
  net.error = p.error?.message || sv.error?.message || null;
  if (!net.error) {
    net.syncedAt = Date.now();
    localStorage.setItem(SYNC_KEY, String(Date.now()));
    refreshBoard();
  }
  emit();
}

subscribe(schedulePush);

// ---- auth ----
export async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password, name) {
  const { data, error } = await client.auth.signUp({
    email, password, options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await client.auth.signOut();
}

// ---- town presence (broadcast-based: reliable for late joiners) ----
let lastPayload = null;
let aliveTimer = null;

function sendPos(force = false) {
  if (!channel || !net.user || !lastPayload) return;
  const now = performance.now();
  if (!force && now - lastTrack < 120) return;
  lastTrack = now;
  channel.httpSend('pos', { ...lastPayload, t: Date.now() }).catch(() => {});
}

function joinTown() {
  if (channel || !net.user) return;
  channel = client.channel('town', { config: { broadcast: { self: false } } });
  channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
    if (!payload || typeof payload.uid !== 'string' || payload.uid === net.user?.id || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    const i = net.peers.findIndex((p) => p.id === payload.uid);
    if (i < 0 && net.peers.length >= 100) return;
    const peer = { name: String(payload.name || 'Player').slice(0, 20), view: typeof payload.view === 'string' ? payload.view.slice(0, 40) : 'away', x: Math.max(0, Math.min(4760, payload.x)), y: Math.max(0, Math.min(560, payload.y)), character: normalizeCharacter(payload.character), id: payload.uid, t: Date.now() };
    peer.frame = Math.max(0, Math.min(3, Number(payload.frame) || 0));
    peer.facing = payload.facing === -1 ? -1 : 1;
    if (i >= 0) net.peers[i] = peer; else net.peers.push(peer);
  });
  channel.on('broadcast', { event: 'hello' }, ({ payload }) => {
    if (payload?.uid !== net.user?.id) sendPos(true);
  });
  channel.on('broadcast', { event: 'bye' }, ({ payload }) => {
    net.peers = net.peers.filter((p) => p.id !== payload?.uid);
  });
  channel.subscribe((status) => {
    net.channelStatus = status;
    if (status === 'SUBSCRIBED') {
      channel.httpSend('hello', { uid: net.user.id }).catch(() => {});
      sendPos(true);
    }
  });
  clearInterval(aliveTimer);
  aliveTimer = setInterval(() => {
    sendPos(true);
    const cutoff = Date.now() - 6000;
    net.peers = net.peers.filter((p) => (p.t || 0) > cutoff);
  }, 2000);
}

export function trackPresence(payload, force = false) {
  if (!channel || !net.user) return;
  lastPayload = { view: payload.view ?? lastPayload?.view ?? 'away', x: payload.x ?? lastPayload?.x ?? 0, y: payload.y ?? lastPayload?.y ?? 0, frame: payload.frame ?? lastPayload?.frame ?? 0, facing: payload.facing ?? lastPayload?.facing ?? 1, name: get().profile.name, character: normalizeCharacter(get().character), uid: net.user.id };
  sendPos(force);
}

// ---- live standings ----
export async function refreshBoard() {
  if (!client) return;
  const { data, error } = await client.from('profiles')
    .select('id,name,net_worth,level,xp,profit')
    .order('net_worth', { ascending: false }).limit(25);
  if (error || !data) return;
  net.board = data.map((r) => ({
    id: r.id,
    name: r.name || 'Guest',
    worth: Number(r.net_worth),
    level: r.level,
    xp: r.xp,
    profit: r.profit,
    live: true,
  }));
  emit();
}

boardTimer = setInterval(() => { if (net.user) refreshBoard(); }, 60000);