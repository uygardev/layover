'use strict';
const $ = (id) => document.getElementById(id);
const t = (k) => chrome.i18n.getMessage(k) || k;
const { DEFAULTS, AUTO_CLOSE_OPTIONS, MIN_W, MIN_H, MAX_W, MAX_H, cleanHost } = LAYOVER;

const isMac = /Mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
const KEY = isMac ? { primary: '⌘', alt: '⌥', shift: '⇧', join: '' } : { primary: 'Ctrl', alt: 'Alt', shift: 'Shift', join: '+' };
const keys = (...k) => k.map((x) => KEY[x]).join(KEY.join);
const LINK_OPTIONS = [
  { v: 'primary+alt', label: isMac ? keys('alt', 'primary') : keys('primary', 'alt'), hint: 'hintPrimaryAlt' },
  { v: 'alt+shift', label: keys('alt', 'shift'), hint: 'hintAltShift' },
  { v: 'shift', label: keys('shift'), hint: 'hintShift' },
  { v: 'alt', label: keys('alt'), hint: 'hintAlt' },
  { v: 'off', label: null, hint: 'hintOff' },
];
const fill = (s) => s.replace('{primary}', KEY.primary).replace('{alt}', KEY.alt).replace('{shift}', KEY.shift);
const linkLabel = (o) => (o.label ? `${o.label} ${t('optClick')}` : t('optOff'));

for (const o of LINK_OPTIONS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.v = o.v;
  b.textContent = linkLabel(o);
  $('linkShortcut').appendChild(b);
}

for (const h of AUTO_CLOSE_OPTIONS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.v = String(h);
  b.textContent = h ? t('optHours').replace('{n}', h) : t('optNever');
  $('autoClose').appendChild(b);
}

document.documentElement.lang = chrome.i18n.getUILanguage();
document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
document.title = t('optTitle');
$('siteInput').placeholder = t('optSitesPlaceholder');
$('kbdCloseWin').textContent = isMac ? '⌘W' : 'Ctrl+W';
for (const id of ['width', 'height']) {
  $(id).min = id === 'width' ? MIN_W : MIN_H;
  $(id).max = id === 'width' ? MAX_W : MAX_H;
}

let toastTimer;
function saved() {
  const el = $('toast');
  el.textContent = t('optSaved');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
}
const save = (obj) => chrome.storage.local.set(obj).then(saved);

async function render() {
  const s = await chrome.storage.local.get({ ...DEFAULTS, log: [] });
  $('enabled').checked = s.enabled;
  $('effects').checked = s.effects;
  $('barCompact').checked = s.barCompact;
  $('debug').checked = s.debug;
  if (document.activeElement !== $('width')) $('width').value = s.width;
  if (document.activeElement !== $('height')) $('height').value = s.height;
  for (const b of $('barPos').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === s.barPos));
  const cur = LINK_OPTIONS.find((o) => o.v === s.linkShortcut) || LINK_OPTIONS[0];
  for (const b of $('linkShortcut').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === cur.v));
  $('linkHint').textContent = fill(t(cur.hint)) + (cur.v === 'off' ? '' : ' ' + t('hintAlso'));
  for (const b of $('autoClose').querySelectorAll('button')) b.setAttribute('aria-checked', String(+b.dataset.v === +s.autoCloseHours));
  for (const g of document.querySelectorAll('[role=radiogroup]')) syncTabStops(g);

  const sites = $('sites');
  sites.replaceChildren();
  const list = Array.isArray(s.neverMini) ? s.neverMini : [];
  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = t('optSitesEmpty');
    sites.appendChild(empty);
  }
  for (const host of list) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.append(document.createTextNode(host));
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = t('optSitesRemove');
    x.setAttribute('aria-label', `${t('optSitesRemove')} ${host}`);
    x.addEventListener('click', () => save({ neverMini: list.filter((h) => h !== host) }));
    chip.appendChild(x);
    sites.appendChild(chip);
  }

  const tbody = $('log');
  tbody.replaceChildren();
  if (s.debug) {
    if (!s.log.length) {
      const td = document.createElement('td');
      td.textContent = t('optLogEmpty');
      tbody.appendChild(document.createElement('tr')).appendChild(td);
    }
    for (const e of s.log) {
      const tr = document.createElement('tr');
      for (const v of [new Date(e.t).toLocaleTimeString(), e.host, e.transition, e.action]) {
        const td = document.createElement('td');
        td.textContent = String(v ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }
}

function syncTabStops(group) {
  const buttons = [...group.querySelectorAll('[role=radio]')];
  const on = buttons.find((b) => b.getAttribute('aria-checked') === 'true') || buttons[0];
  for (const b of buttons) b.tabIndex = b === on ? 0 : -1;
}

for (const group of document.querySelectorAll('[role=radiogroup]')) {
  group.addEventListener('keydown', (e) => {
    const buttons = [...group.querySelectorAll('[role=radio]')];
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const b = buttons[(next + buttons.length) % buttons.length];
    b.focus();
    b.click();
  });
}

async function renderShortcut() {
  const cmds = await chrome.commands.getAll();
  const key = (name) => (cmds.find((x) => x.name === name) || {}).shortcut || '';
  $('kbdAdd').textContent = key('open-in-main') || '—';
  $('kbdCopy').textContent = key('copy-link') || '—';
  $('kbdClose').textContent = key('close-mini');
  $('kbdClose').hidden = !key('close-mini');
}

$('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
$('effects').addEventListener('change', (e) => save({ effects: e.target.checked }));
$('barCompact').addEventListener('change', (e) => save({ barCompact: e.target.checked }));
$('debug').addEventListener('change', (e) => save({ debug: e.target.checked }));
$('linkShortcut').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (v) save({ linkShortcut: v });
});
$('autoClose').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (v != null) save({ autoCloseHours: +v });
});
$('siteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const host = cleanHost($('siteInput').value);
  $('siteErr').hidden = !!host;
  if (!host) return;
  const { neverMini = DEFAULTS.neverMini } = await chrome.storage.local.get('neverMini');
  if (!neverMini.includes(host)) await save({ neverMini: [...neverMini, host] });
  $('siteInput').value = '';
});
$('siteInput').addEventListener('input', () => { $('siteErr').hidden = true; });
$('barPos').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (v) save({ barPos: v });
});
const clampSave = (key, lo, hi) => (e) => {
  const v = Math.round(+e.target.value);
  if (!Number.isFinite(v)) return render();
  save({ [key]: Math.min(hi, Math.max(lo, v)) });
};
$('width').addEventListener('change', clampSave('width', MIN_W, MAX_W));
$('height').addEventListener('change', clampSave('height', MIN_H, MAX_H));
$('shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
$('try').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'layover-try', url: 'https://example.com/' }));

chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderShortcut(); });
render();
renderShortcut();
