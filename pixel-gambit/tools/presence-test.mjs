// Server-side test client: walks around town as a second player over broadcast.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({ email: 'walker@pixelgambit.dev', password: 'TestPass123!' });
if (error) { console.error('signin failed', error.message); process.exit(1); }
console.log('signed in as', data.user.email);

const channel = client.channel('town', { config: { broadcast: { self: false } } });
let seen = 0;
channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
  seen++;
  if (seen < 3) console.log('saw peer', payload.name, 'at', payload.x);
});
channel.on('broadcast', { event: 'hello' }, () => {
  channel.httpSend('pos', payloadFor(0)).catch(() => {});
});
const x0 = Number(process.argv[2] || 760);
const payloadFor = (i) => ({
  uid: data.user.id, name: 'Walker', view: 'world',
  character: { skin: '#e0b080', hair: '#20242c', hairStyle: 'mohawk', shirt: '#c4574e', pants: '#2b303c' },
  x: x0 + Math.round(Math.sin(i / 4) * 40), y: 468, facing: i % 8 < 4 ? 1 : -1, frame: i % 4,
  t: Date.now(),
});
channel.subscribe(async (status) => {
  console.log('channel', status);
  if (status !== 'SUBSCRIBED') return;
  channel.send({ type: 'broadcast', event: 'hello', payload: { uid: data.user.id } });
  for (let i = 0; i < 60; i++) {
    await channel.httpSend('pos', payloadFor(i));
    await new Promise((r) => setTimeout(r, 400));
  }
  await channel.httpSend('bye', { uid: data.user.id });
  console.log('presence test done, peer messages seen:', seen);
  await client.removeChannel(channel);
  process.exit(0);
});