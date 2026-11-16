// Player identity: name, pixel avatar, stats — plus optional cloud account.
import { get, update, subscribe, fmt } from './state.js';
import { renderPortrait, renderProfileCard } from './cosmetics.js';
import { pieceImg } from './sprites.js';
import { sfx } from './audio.js';
import { toast } from './casino.js';
import { net, onNet, signIn, signUp, signOut } from './online.js';

const modal = document.getElementById('profile-modal');
const chip = document.getElementById('profile-chip');
const nameInput = document.getElementById('profile-name');
const picker = document.getElementById('avatar-picker');
const AVATARS = ['K', 'Q', 'R', 'B', 'N', 'P'];
let chosenAvatar = get().profile.avatar;

function renderChip() {
  const s = get();
  document.getElementById('chip-name').textContent = s.profile.name;
  document.getElementById('chip-wallet').textContent = fmt(s.wallet) + ' ◉';
  const av = document.getElementById('chip-avatar');
  renderPortrait(av, s.presentation, 40);
  chip.classList.toggle('cloud', net.status === 'online');
  chip.title = net.status === 'online' ? 'Cloud synced · ' + net.email : 'Local profile';
}

function renderPicker() {
  picker.replaceChildren();
  for (const t of AVATARS) {
    const b = document.createElement('button');
    b.className = 'avatar-choice' + (t === chosenAvatar ? ' active' : '');
    b.setAttribute('aria-label', 'Avatar ' + t);
    b.appendChild(pieceImg(t, 'w'));
    b.addEventListener('click', () => { chosenAvatar = t; sfx.select(); renderPicker(); renderPreview(); });
    picker.appendChild(b);
  }
}

function renderPreview() {
  const summary = document.getElementById('profile-summary');
  summary.replaceChildren();
  const card = renderProfileCard(summary);
  card.querySelector('h2').textContent = nameInput.value.trim() || 'Guest';
}

chip.addEventListener('click', () => {
  sfx.click();
  nameInput.value = get().profile.name === 'Guest' ? '' : get().profile.name;
  chosenAvatar = get().profile.avatar;
  renderPicker();
  renderPreview();
  modal.hidden = false;
});
document.getElementById('profile-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('mousedown', (e) => { if (e.target === modal) modal.hidden = true; });
nameInput.addEventListener('input', renderPreview);
document.getElementById('profile-save').addEventListener('click', () => {
  const name = nameInput.value.trim().slice(0, 20) || 'Guest';
  update((s) => { s.profile.name = name; s.profile.avatar = chosenAvatar; });
  modal.hidden = true;
  sfx.win();
  toast(`Profile saved. Welcome, ${name}.`, 'win');
});

subscribe(() => { renderChip(); if (!modal.hidden) renderPreview(); });
renderChip();

// ---- cloud account ----
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-pass');
const authNote = document.getElementById('auth-note');
const DEFAULT_NOTE = authNote.textContent;

function renderAccount() {
  const status = document.getElementById('account-status');
  const form = document.getElementById('account-form');
  const signed = document.getElementById('account-signed');
  if (net.status === 'online') {
    status.textContent = 'SYNCED · ' + (net.email || 'cloud player');
    form.hidden = true;
    signed.hidden = false;
    authNote.textContent = net.error
      ? 'Sync problem: ' + net.error
      : 'Last sync ' + (net.syncedAt ? new Date(net.syncedAt).toLocaleTimeString() : 'just now') + '. Progress follows this account on any device.';
  } else {
    form.hidden = false;
    signed.hidden = true;
    status.textContent = net.status === 'connecting' ? 'CONNECTING…'
      : net.status === 'signed-out' ? 'SIGNED OUT · LOCAL SAVE'
      : 'LOCAL MODE';
    if (net.status === 'local' && net.error) authNote.textContent = net.error;
  }
  renderChip();
}

function authError(e) {
  sfx.error();
  authNote.textContent = (e?.message || 'Something went wrong.') + '';
}

document.getElementById('auth-signin').addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const pass = authPass.value;
  if (!email || !pass) { authNote.textContent = 'Enter your email and password first.'; sfx.error(); return; }
  authNote.textContent = 'Signing in…';
  try {
    await signIn(email, pass);
    sfx.win();
    toast('Signed in. Cloud save loaded.', 'win');
    authPass.value = '';
  } catch (e) { authError(e); }
});

document.getElementById('auth-signup').addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const pass = authPass.value;
  if (!email || pass.length < 6) { authNote.textContent = 'Enter an email and a password of at least 6 characters.'; sfx.error(); return; }
  authNote.textContent = 'Creating account…';
  try {
    const name = nameInput.value.trim() || email.split('@')[0];
    const data = await signUp(email, pass, name);
    if (data.session) {
      sfx.win();
      toast('Account created. Welcome to the cloud.', 'win');
    } else {
      sfx.select();
      authNote.textContent = 'Confirmation email sent to ' + email + '. Click the link in it, then sign in here.';
    }
    authPass.value = '';
  } catch (e) { authError(e); }
});

document.getElementById('auth-signout').addEventListener('click', async () => {
  await signOut();
  sfx.click();
  authNote.textContent = DEFAULT_NOTE;
  toast('Signed out. Your progress stays in this browser.', 'info');
});

onNet(renderAccount);
renderAccount();