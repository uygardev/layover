'use strict';
const $ = (id) => document.getElementById(id);
const t = (k) => chrome.i18n.getMessage(k) || k;
const DEFAULTS = { enabled: true, width: 1100, height: 780, barPos: 'top-center', effects: true, linkShortcut: 'primary+alt',
  neverMini: ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com'], autoCloseHours: 6, debug: false };
const AUTO_CLOSE = [0, 1, 6, 12, 24];
function cleanHost(v) {
  let h = String(v || '').trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^\*\./, '').replace(/^www\./, '').replace(/:\d+$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : '';
}

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

for (const h of AUTO_CLOSE) {
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
$('kbdClose').textContent = isMac ? '⌘W' : 'Ctrl+W';

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
  $('debug').checked = s.debug;
  if (document.activeElement !== $('width')) $('width').value = s.width;
  if (document.activeElement !== $('height')) $('height').value = s.height;
  for (const b of $('barPos').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === s.barPos));
  const cur = LINK_OPTIONS.find((o) => o.v === s.linkShortcut) || LINK_OPTIONS[0];
  for (const b of $('linkShortcut').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === cur.v));
  $('linkHint').textContent = fill(t(cur.hint)) + (cur.v === 'off' ? '' : ' ' + t('hintAlso'));
  for (const b of $('autoClose').querySelectorAll('button')) b.setAttribute('aria-checked', String(+b.dataset.v === +s.autoCloseHours));

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

async function renderShortcut() {
  const cmds = await chrome.commands.getAll();
  const c = cmds.find((x) => x.name === 'open-in-main');
  $('kbdAdd').textContent = (c && c.shortcut) || '—';
}

$('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
$('effects').addEventListener('change', (e) => save({ effects: e.target.checked }));
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
$('width').addEventListener('change', clampSave('width', 400, 4000));
$('height').addEventListener('change', clampSave('height', 300, 3000));
$('shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
$('try').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'layover-try', url: 'https://example.com/' }));

chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderShortcut(); });
render();
renderShortcut();
