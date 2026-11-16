// Probe: does Broadcast flow both directions between staggered clients?
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

const mk = async (email, label, delay) => {
  await new Promise((r) => setTimeout(r, delay));
  const c = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: 'TestPass123!' });
  const ch = c.channel('town-probe', { config: { broadcast: { self: false } } });
  let received = 0;
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => { received++; if (received < 4) console.log(label, 'got', payload.from, payload.i); });
  ch.subscribe(async (s) => {
    console.log(label, 'subscribed', s);
    if (s !== 'SUBSCRIBED') return;
    for (let i = 0; i < 20; i++) {
      await ch.send({ type: 'broadcast', event: 'pos', payload: { from: label, i } });
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log(label, 'total received', received);
  });
};
await mk('walker@pixelgambit.dev', 'A', 0);
await mk('tester@pixelgambit.dev', 'B', 1500);
setTimeout(() => process.exit(0), 12000);