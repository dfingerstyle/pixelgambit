import { get, update, ASSETS } from './state.js';
import { net } from './online.js';
import { openCatalog } from './cosmetics.js';
const panel = document.createElement('dialog'); panel.className = 'developer-console';
const title = document.createElement('h2'); title.textContent = 'GAMBIT CONSOLE';
const output = document.createElement('p'); output.setAttribute('role', 'status'); output.textContent = 'Commands: help, inventory, owner-test, close. Owner-test is local guest testing only, not a staff role.';
const form = document.createElement('form'); const input = document.createElement('input'); input.placeholder = 'Enter command'; input.setAttribute('aria-label', 'Console command'); input.autocomplete = 'off';
const submit = document.createElement('button'); submit.className = 'btn'; submit.textContent = 'RUN'; const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'CLOSE'; close.type = 'button'; close.onclick = () => panel.close();
form.append(input, submit); panel.append(title, output, form, close); document.body.append(panel);
form.onsubmit = e => {
  e.preventDefault(); const command = input.value.trim().toLowerCase(); input.value = '';
  if (command === 'close') panel.close();
  else if (command === 'inventory') { panel.close(); openCatalog('inventory'); }
  else if (command === 'owner-test') {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || net.user || !['local', 'signed-out'].includes(net.status)) { output.textContent = 'Denied: ownership grants require a local signed-out guest. Public staff roles cannot be granted here.'; return; }
    update(s => { for (const id of Object.keys(ASSETS)) s.assets[id] ||= { level: 1 }; });
    output.textContent = 'All properties granted to this local guest save. No online owner/admin role was granted.';
  } else output.textContent = command === 'help' ? 'help · inventory · owner-test (local guest only) · close' : 'Unknown command. Type help.';
};
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') { e.preventDefault(); if (panel.open) panel.close(); else { panel.showModal(); input.focus(); } }
});
