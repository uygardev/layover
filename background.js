'use strict';

const DEFAULTS = Object.freeze({
  enabled: true,
  width: 1100,
  height: 780,
  barPos: 'top-center',
  effects: true,
  linkShortcut: 'primary+alt',
  neverMini: ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com'],
  autoCloseHours: 6,
  debug: false,
});
const AUTO_CLOSE_OPTIONS = [0, 1, 6, 12, 24];
const ALARM = 'layover-autoclose';
const POSITIONS = ['top-center', 'top-right', 'bottom-center', 'bottom-right'];
const SHORTCUTS = ['primary+alt', 'alt+shift', 'shift', 'alt', 'off'];
const STARTUP_GRACE_MS = 8000;
const CANDIDATE_TTL_MS = 15000;
const MENU_ID = 'layover-add-to-tabs';
const LINK_MENU_ID = 'layover-open-link';
const SEARCH_MENU_ID = 'layover-search';
const BAR_ID = 'layover-bar';
const MIN_W = 400, MIN_H = 300, MAX_W = 4000, MAX_H = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = (key) => chrome.i18n.getMessage(key);

let settingsCache = null;
async function getSettings() {
  if (!settingsCache) settingsCache = sanitize(await chrome.storage.local.get(DEFAULTS));
  return settingsCache;
}
function sanitize(s) {
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  return {
    enabled: s.enabled !== false,
    width: num(s.width, MIN_W, MAX_W, DEFAULTS.width),
    height: num(s.height, MIN_H, MAX_H, DEFAULTS.height),
    barPos: POSITIONS.includes(s.barPos) ? s.barPos : DEFAULTS.barPos,
    effects: s.effects !== false,
    linkShortcut: SHORTCUTS.includes(s.linkShortcut) ? s.linkShortcut : DEFAULTS.linkShortcut,
    neverMini: Array.isArray(s.neverMini) ? s.neverMini.map(cleanHost).filter(Boolean).slice(0, 200) : [...DEFAULTS.neverMini],
    autoCloseHours: AUTO_CLOSE_OPTIONS.includes(+s.autoCloseHours) ? +s.autoCloseHours : DEFAULTS.autoCloseHours,
    debug: s.debug === true,
  };
}
function cleanHost(v) {
  let h = String(v || '').trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^\*\./, '').replace(/^www\./, '').replace(/:\d+$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : '';
}
function isNeverMini(url, list) {
  const host = hostOf(url).replace(/:\d+$/, '').replace(/^www\./, '');
  return !!host && list.some((d) => host === d || host.endsWith('.' + d));
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settingsCache = null;
  if (changes.debug && changes.debug.newValue !== true) chrome.storage.local.remove('log');
});

let miniCache = null;
async function getMini() {
  if (!miniCache) {
    const { mini = {} } = await chrome.storage.session.get('mini');
    miniCache = mini;
  }
  return miniCache;
}
async function isMini(windowId) {
  return windowId != null && !!(await getMini())[windowId];
}
async function setMini(windowId, on) {
  const mini = await getMini();
  if (on) mini[windowId] = Date.now(); else delete mini[windowId];
  await chrome.storage.session.set({ mini });
}

async function debugLog(entry) {
  if (!(await getSettings()).debug) return;
  const { log = [] } = await chrome.storage.local.get('log');
  log.unshift({ t: Date.now(), ...entry });
  await chrome.storage.local.set({ log: log.slice(0, 30) });
}
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(null);
  const fill = {};
  for (const [k, v] of Object.entries(DEFAULTS)) if (!(k in cur)) fill[k] = v;
  await chrome.storage.local.remove(['fxDebug'].filter((k) => k in cur));
  if (Object.keys(fill).length) await chrome.storage.local.set(fill);
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: LINK_MENU_ID,
    title: t('menuOpenLink'),
    contexts: ['link'],
    targetUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  chrome.contextMenus.create({
    id: SEARCH_MENU_ID,
    title: t('menuSearch'),
    contexts: ['selection'],
  });
  const open = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }).catch(() => []);
  for (const tab of open) {
    chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  miniCache = {};
  chrome.storage.session.set({ startupAt: Date.now(), mini: {} });
  setAddToTabsMenu(false);
  ensureAlarm();
});
chrome.runtime.onInstalled.addListener(() => ensureAlarm());

function ensureAlarm() {
  chrome.alarms.get(ALARM).then((a) => { if (!a) chrome.alarms.create(ALARM, { periodInMinutes: 10 }); }).catch(() => {});
}
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const { autoCloseHours } = await getSettings();
  const mini = await getMini();
  const now = Date.now();
  for (const [id, lastUsed] of Object.entries(mini)) {
    const w = await chrome.windows.get(+id).catch(() => null);
    if (!w) { await setMini(+id, false); continue; }
    if (w.focused) { await setMini(+id, true); continue; }
    if (autoCloseHours > 0 && now - lastUsed > autoCloseHours * 3600e3) {
      const [tab] = await chrome.tabs.query({ windowId: +id }).catch(() => []);
      if (tab && tab.audible) { await setMini(+id, true); continue; }
      debugLog({ host: '', transition: 'auto-close', action: `closed after ${autoCloseHours} h` });
      await chrome.windows.remove(+id).catch(() => {});
    }
  }
});

let menuQueue = Promise.resolve();
function setAddToTabsMenu(on) {
  menuQueue = menuQueue.then(() => new Promise((done) => {
    const finish = () => { void chrome.runtime.lastError; done(); };
    if (on) {
      chrome.contextMenus.create(
        { id: MENU_ID, title: t('menuOpenInMain'), contexts: ['page', 'image', 'video'] }, finish);
    } else {
      chrome.contextMenus.remove(MENU_ID, finish);
    }
  }));
  return menuQueue;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  if (await isMini(tab.windowId)) return moveToMain(tab.windowId);
  await openMini({ tabId: tab.id }, tab.windowId, await getSettings());
});

const candidates = new Map();

chrome.tabs.onCreated.addListener((tab) => {
  const now = Date.now();
  for (const [id, c] of candidates) if (now - c.at > CANDIDATE_TTL_MS) candidates.delete(id);
  candidates.set(tab.id, { at: now, windowId: tab.windowId });
});
chrome.tabs.onRemoved.addListener((tabId) => { candidates.delete(tabId); fadePending.delete(tabId); });
chrome.tabs.onReplaced.addListener((added, removed) => {
  const c = candidates.get(removed);
  if (c) { candidates.delete(removed); candidates.set(added, c); }
});

chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const cand = candidates.get(d.tabId);
  if (!cand) return;
  candidates.delete(d.tabId);
  if (Date.now() - cand.at > CANDIDATE_TTL_MS) return;
  const win = await chrome.windows.get(cand.windowId).catch(() => null);
  if (!win || win.type !== 'normal') return;

  const settings = await getSettings();
  const { startupAt = 0 } = await chrome.storage.session.get('startupAt');
  const external = d.transitionType === 'start_page' || d.transitionType === 'auto_toplevel';
  const web = /^https?:/i.test(d.url);
  const inGrace = Date.now() - startupAt < STARTUP_GRACE_MS;
  const blocked = external && web && isNeverMini(d.url, settings.neverMini);
  const go = settings.enabled && external && web && !inGrace && !blocked;

  debugLog({ host: hostOf(d.url), transition: d.transitionType,
    action: go ? 'mini' : (inGrace ? 'skip:startup' : (blocked ? 'skip:site rule' : 'skip')) });
  if (go) await openMini({ tabId: d.tabId }, cand.windowId, settings);
});

async function openMini(source, sourceWindowId, settings) {
  const { width, height } = settings;
  const geo = { type: 'popup', focused: true, width, height };
  let src = await chrome.windows.get(sourceWindowId).catch(() => null);
  if (src && src.incognito) geo.incognito = true;
  if (src && src.type !== 'normal') src = (await mainWindowFor(src)) || src;
  if (src) {
    geo.left = Math.max(0, Math.round(src.left + (src.width - width) / 2));
    geo.top = Math.max(0, Math.round(src.top + (src.height - height) / 2));
    const last = await lastMiniBounds();
    if (last) {
      const left = last.left + DECK_STEP, top = last.top + DECK_STEP;
      const fits = left + width <= src.left + src.width + DECK_STEP * 4 && top + height <= src.top + src.height + DECK_STEP * 4;
      if (fits) { geo.left = left; geo.top = top; }
    }
  }
  const win = await chrome.windows.create({ ...source, ...geo }).catch(() => null);
  if (!win) return;
  await setMini(win.id, true);
  setAddToTabsMenu(true);
  const tabId = source.tabId ?? (win.tabs && win.tabs[0] && win.tabs[0].id);
  if (tabId != null && settings.effects) fadePending.add(tabId);
  if (tabId != null) injectBar(tabId);
  return tabId;
}

const isWebUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

async function searchInMini(text, sourceWindowId) {
  const tabId = await openMini({ url: 'about:blank' }, sourceWindowId, await getSettings());
  if (tabId == null) return;
  await chrome.search.query({ text, tabId }).catch(async () => {
    await chrome.tabs.update(tabId, { url: 'https://www.google.com/search?q=' + encodeURIComponent(text) }).catch(() => {});
  });
}

const DECK_STEP = 28;
async function lastMiniBounds() {
  const mini = await getMini();
  let best = null;
  for (const id of Object.keys(mini)) {
    const w = await chrome.windows.get(+id).catch(() => null);
    if (!w || w.state !== 'normal') continue;
    if (!best || w.left + w.top > best.left + best.top) best = w;
  }
  return best;
}

async function closeMini(windowId) {
  const settings = await getSettings();
  if (settings.effects) {
    const w = await chrome.windows.get(windowId).catch(() => null);
    const [tab] = await chrome.tabs.query({ windowId }).catch(() => []);
    if (tab) chrome.scripting.executeScript({ target: { tabId: tab.id }, func: layoverFade, args: [1, 0, FADE_OUT_MS] }).catch(() => {});
    if (w && w.state === 'normal') await slide(windowId, w.top, w.top + 28, FADE_OUT_MS);
    else await sleep(FADE_OUT_MS);
  }
  await chrome.windows.remove(windowId).catch(() => {});
}

const FADE_IN_MS = 180, FADE_OUT_MS = 150;
const fadePending = new Set();
function layoverFade(from, to, ms) {
  if (window.top !== window || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  document.documentElement.animate([{ opacity: from }, { opacity: to }],
    { duration: ms, easing: to > from ? 'cubic-bezier(.2,.8,.2,1)' : 'cubic-bezier(.4,0,1,1)', fill: to < from ? 'forwards' : 'none' });
  return true;
}

const sliding = new Set();
async function slide(windowId, fromTop, toTop, duration) {
  sliding.add(windowId);
  try {
    const t0 = Date.now();
    for (;;) {
      const frame = Date.now();
      const p = Math.min(1, (frame - t0) / duration);
      await chrome.windows.update(windowId, { top: Math.round(fromTop + (toTop - fromTop) * p * p * p) });
      if (p >= 1) break;
      await sleep(Math.max(0, 16 - (Date.now() - frame)));
    }
  } catch {} finally { sliding.delete(windowId); }
}

async function mainWindowFor(win) {
  const incognito = !!(win && win.incognito);
  const last = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (last && last.type === 'normal' && last.incognito === incognito) return last;
  const all = await chrome.windows.getAll({ windowTypes: ['normal'] }).catch(() => []);
  return all.find((w) => w.incognito === incognito) || null;
}

async function moveToMain(miniWindowId) {
  const [tab] = await chrome.tabs.query({ windowId: miniWindowId });
  if (!tab) return;
  await removeBar(tab.id);
  await setMini(miniWindowId, false);
  setAddToTabsMenu(false);
  const miniWin = await chrome.windows.get(miniWindowId).catch(() => null);
  const main = await mainWindowFor(miniWin);
  if (!main) {
    await chrome.windows.create({ tabId: tab.id, type: 'normal', focused: true }).catch(() => {});
    return;
  }
  try {
    await chrome.tabs.move(tab.id, { windowId: main.id, index: -1 });
  } catch {
    try {
      await chrome.windows.create({ tabId: tab.id, type: 'normal', focused: false });
      await chrome.tabs.move(tab.id, { windowId: main.id, index: -1 });
    } catch {
      if (tab.url) await chrome.tabs.create({ windowId: main.id, url: tab.url, active: true });
      await chrome.windows.remove(miniWindowId).catch(() => {});
    }
  }
  await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  await chrome.windows.update(main.id, { focused: true }).catch(() => {});
}

function layoverBar(barId, pos, text, effects) {
  if (window.top !== window || document.getElementById(barId)) return;
  const place = {
    'top-center': { top: '10px', left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: '10px', right: '12px' },
    'bottom-center': { bottom: '14px', left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '14px', right: '14px' },
  }[pos] || { top: '10px', left: '50%', transform: 'translateX(-50%)' };

  const host = document.createElement('div');
  host.id = barId;
  host.style.setProperty('all', 'initial');
  Object.assign(host.style, { position: 'fixed', zIndex: '2147483647', ...place });
  const root = host.attachShadow({ mode: 'closed' });

  const css = `
    .bar{display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;
      font:500 12.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;letter-spacing:-.01em;
      color:#1d1d1f;background:rgba(250,250,252,.78);
      -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);
      box-shadow:0 10px 30px rgba(0,0,0,.16),0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.14);
      opacity:.94;transition:opacity .15s ease}
    .bar:hover{opacity:1}
    .fx{animation:in .36s cubic-bezier(.2,.9,.25,1.2) .08s backwards}
    @keyframes in{from{opacity:0;transform:translateY(${pos.startsWith('bottom') ? '' : '-'}10px) scale(.94)}}
    button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;
      border-radius:999px;cursor:pointer;color:inherit;transition:background-color .12s ease,transform .08s ease;
      -webkit-user-select:none;user-select:none;white-space:nowrap}
    button:hover{background:rgba(0,0,0,.06)}
    button:active{transform:scale(.96)}
    button:focus-visible{outline:2px solid #0a84ff;outline-offset:1px}
    .primary{background:#0a84ff;color:#fff;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.25)}
    .primary:hover{background:#0077ed}
    .icon{width:28px;padding:0;justify-content:center;color:#6e6e73}
    .icon:hover{color:#1d1d1f}
    .icon:disabled{opacity:.35;cursor:default;background:none}
    .done{color:#30b94d!important}
    svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;flex:none}
    @media (prefers-color-scheme:dark){
      .bar{color:#f5f5f7;background:rgba(44,44,46,.78);
        box-shadow:0 10px 30px rgba(0,0,0,.5),0 1px 3px rgba(0,0,0,.4),0 0 0 .5px rgba(255,255,255,.16)}
      button:hover{background:rgba(255,255,255,.1)}
      .icon{color:#a1a1a6}.icon:hover{color:#f5f5f7}
      .primary{background:#0a84ff}.primary:hover{background:#409cff}}
    @media (prefers-reduced-motion:reduce){.fx{animation:none}button{transition:none}}`;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }

  const NS = 'http://www.w3.org/2000/svg';
  const icon = (paths) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  };
  const button = (cls, label, title, paths, showLabel) => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', label);
    b.appendChild(icon(paths));
    if (showLabel) b.appendChild(document.createTextNode(label));
    return b;
  };

  const bar = document.createElement('div');
  bar.className = effects ? 'bar fx' : 'bar';
  bar.setAttribute('role', 'toolbar');
  const COPY = ['M9 11a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'];
  const back = button('icon', text.back, text.back, ['M15 18l-6-6 6-6'], false);
  const copy = button('icon', text.copy, text.copy, COPY, false);
  const add = button('primary', text.add, text.addTitle,
    ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'], true);
  const close = button('icon', text.close, text.close, ['M18 6 6 18', 'M6 6l12 12'], false);
  bar.append(back, copy, add, close);
  root.appendChild(bar);

  const nav = window.navigation;
  const canGoBack = () => !!(nav && nav.canGoBack) || history.length > 1;
  const refreshBack = () => { back.disabled = !canGoBack(); };
  refreshBack();
  if (nav && nav.addEventListener) nav.addEventListener('currententrychange', refreshBack);
  back.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.isTrusted && canGoBack()) history.back();
  });

  const copyText = async (s) => {
    try { await navigator.clipboard.writeText(s); return true; } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      root.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  };
  let copyTimer;
  copy.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!e.isTrusted || !(await copyText(location.href))) return;
    copy.replaceChildren(icon(['M20 6 9 17l-5-5']));
    copy.classList.add('done'); copy.title = text.copied;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copy.replaceChildren(icon(COPY)); copy.classList.remove('done'); copy.title = text.copy; }, 1400);
  });

  const send = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.isTrusted) return;
    try { chrome.runtime.sendMessage({ type: 'layover', action }); } catch {}
  };
  add.addEventListener('click', send('main'));
  close.addEventListener('click', send('close'));


  document.documentElement.appendChild(host);

  let restores = 0;
  const obs = new MutationObserver(() => {
    if (host.isConnected) return;
    if (++restores > 10) { obs.disconnect(); return; }
    (document.documentElement || document).appendChild(host);
  });
  obs.observe(document, { childList: true, subtree: false });
  obs.observe(document.documentElement, { childList: true });
  window.__layoverCleanup = () => {
    obs.disconnect();
    if (nav && nav.removeEventListener) nav.removeEventListener('currententrychange', refreshBack);
    host.remove();
  };
}

function layoverRemoveBar(barId) {
  if (typeof window.__layoverCleanup === 'function') { window.__layoverCleanup(); window.__layoverCleanup = null; }
  const el = document.getElementById(barId);
  if (el) el.remove();
}

async function injectBar(tabId) {
  const s = await getSettings();
  const text = { add: t('barAdd'), addTitle: t('barAddTitle'), close: t('barClose'),
    back: t('barBack'), copy: t('barCopy'), copied: t('barCopied') };
  chrome.scripting.executeScript({ target: { tabId }, func: layoverBar, args: [BAR_ID, s.barPos, text, s.effects] })
    .then(() => {
      if (!fadePending.has(tabId)) return;
      fadePending.delete(tabId);
      chrome.scripting.executeScript({ target: { tabId }, func: layoverFade, args: [0, 1, FADE_IN_MS] }).catch(() => {});
    })
    .catch(() => {});
}
function removeBar(tabId) {
  return chrome.scripting.executeScript({ target: { tabId }, func: layoverRemoveBar, args: [BAR_ID] }).catch(() => {});
}

chrome.webNavigation.onDOMContentLoaded.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const tab = await chrome.tabs.get(d.tabId).catch(() => null);
  if (tab && (await isMini(tab.windowId))) injectBar(d.tabId);
});

const lastOpen = new Map();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object') return;
  (async () => {
    if (msg.type === 'layover-open' && sender.tab && isWebUrl(msg.url)) {
      const now = Date.now();
      if (now - (lastOpen.get(sender.tab.id) || 0) < 600) return;
      lastOpen.set(sender.tab.id, now);
      if (lastOpen.size > 200) lastOpen.clear();
      await openMini({ url: msg.url }, sender.tab.windowId, await getSettings());
      return;
    }
    if (msg.type === 'layover' && sender.tab) {
      const winId = sender.tab.windowId;
      if (!(await isMini(winId))) return;
      if (msg.action === 'close') await closeMini(winId);
      else if (msg.action === 'main') await moveToMain(winId);
      return;
    }
    if (msg.type === 'layover-try' && (sender.url || '').startsWith(chrome.runtime.getURL('')) && isWebUrl(msg.url)) {
      const from = sender.tab ? sender.tab.windowId : (await chrome.windows.getLastFocused().catch(() => ({}))).id;
      await openMini({ url: msg.url }, from, await getSettings());
    }
  })();
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'open-in-main') return;
  const winId = tab ? tab.windowId : (await chrome.windows.getLastFocused().catch(() => ({}))).id;
  if (await isMini(winId)) await moveToMain(winId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === SEARCH_MENU_ID) {
    const q = String(info.selectionText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!q) return;
    const from = tab ? tab.windowId : (await chrome.windows.getLastFocused().catch(() => ({}))).id;
    await searchInMini(q, from);
    return;
  }
  if (info.menuItemId === LINK_MENU_ID) {
    if (!isWebUrl(info.linkUrl)) return;
    const from = tab ? tab.windowId : (await chrome.windows.getLastFocused().catch(() => ({}))).id;
    await openMini({ url: info.linkUrl }, from, await getSettings());
    return;
  }
  if (info.menuItemId === MENU_ID && tab && (await isMini(tab.windowId))) await moveToMain(tab.windowId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const mini = await isMini(windowId);
  setAddToTabsMenu(mini);
  if (mini) setMini(windowId, true);
});

let saveTimer = null;
chrome.windows.onBoundsChanged.addListener(async (win) => {
  if (sliding.has(win.id) || !(await isMini(win.id))) return;
  const w = await chrome.windows.get(win.id).catch(() => null);
  if (!w) return;
  if (w.state === 'maximized' || w.state === 'fullscreen') return moveToMain(win.id);
  if (w.state !== 'normal') return;
  const next = {
    width: Math.min(MAX_W, Math.max(MIN_W, w.width)),
    height: Math.min(MAX_H, Math.max(MIN_H, w.height)),
  };
  const cur = await getSettings();
  if (next.width === cur.width && next.height === cur.height) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { chrome.storage.local.set(next); }, 400);
});

chrome.windows.onRemoved.addListener((windowId) => { setMini(windowId, false); });
