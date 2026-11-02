'use strict';
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const L = require('./cdp.js');
const { sleep, check, results } = L;

const wins = (sw) => sw.eval(`chrome.windows.getAll({ populate: true })`);
const popups = async (sw) => (await wins(sw)).filter((w) => w.type === 'popup');
const urlOf = (t) => t.url || t.pendingUrl || '';
const layout = (all) => JSON.stringify(all.map((w) => [w.type, w.incognito ? 'incognito' : '', w.state, w.tabs.map(urlOf)]));
const settle = (sw, ms = 1500) => sleep(ms);

function prefs(fn) {
  const p = L.PROFILE + '/Default/Preferences';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(j);
  fs.writeFileSync(p, JSON.stringify(j));
}
async function restart(args = []) {
  await L.quit();
  L.launch(args);
  await L.json('/json/version');
  await sleep(2500);
  return L.worker();
}
async function closePopups(sw) {
  for (const p of await popups(sw)) await sw.call(`chrome.windows.remove(${p.id})`);
  await sleep(300);
}
async function clickLink(pg, modifiers) {
  const r = await pg.eval(`(() => { const a = document.querySelector('a'); const b = a.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, href: a.href }; })()`);
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, modifiers });
  await pg.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1, modifiers });
  await sleep(150);
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1, modifiers });
  return r.href;
}
async function barNodes(pg) {
  const { root } = await pg.send('DOM.getDocument', { depth: -1, pierce: true });
  const attr = (n, k) => { const a = n.attributes || []; const i = a.indexOf(k); return i >= 0 && i % 2 === 0 ? a[i + 1] : null; };
  let host = null;
  const walk = (n, fn) => { fn(n); for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c, fn); };
  walk(root, (n) => { if (attr(n, 'id') === 'layover-bar') host = n; });
  if (!host) return null;
  const out = { bar: null, buttons: [] };
  walk(host, (n) => {
    if (n.nodeName === 'DIV' && (attr(n, 'class') || '').split(' ').includes('bar')) out.bar = attr(n, 'class');
    if (n.nodeName === 'BUTTON') out.buttons.push({ cls: attr(n, 'class'), label: attr(n, 'aria-label') });
  });
  return out;
}
function wav() {
  const rate = 8000, n = rate * 2, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / rate * 440 * 2 * Math.PI) * 12000), 44 + i * 2);
  return 'data:audio/wav;base64,' + buf.toString('base64');
}
const clipboard = {
  read() { try { return process.platform === 'darwin' ? execSync('pbpaste', { encoding: 'utf8' }) : null; } catch { return null; } },
  write(s) { try { if (process.platform === 'darwin' && s != null) execSync('pbcopy', { input: s }); } catch {} },
};

async function externalLinks(sw) {
  console.log('\n— links from other apps');
  const main = (await wins(sw)).find((w) => w.type === 'normal');
  L.sendUrl('https://example.com/');
  await settle(sw, 2500);
  let all = await wins(sw);
  const pop = all.find((w) => w.type === 'popup');
  const log = await sw.eval(`chrome.storage.local.get('log').then((r) => r.log || [])`);
  check('link from another app opens in a mini window', !!pop && urlOf(pop.tabs[0]).startsWith('https://example.com'), layout(all));
  check('navigation is recognised as start_page', log.some((e) => e.action === 'mini' && e.transition === 'start_page'), JSON.stringify(log[0]));
  check('mini window uses the configured size', pop && pop.width === 1100 && pop.height === 780, pop && `${pop.width}x${pop.height}`);
  check('main window is untouched', all.find((w) => w.id === main.id).tabs.length === main.tabs.length, layout(all));
  check('mini window is registered', await sw.eval(`isMini(${pop.id})`));

  const pg = await L.page((x) => x.url.startsWith('https://example.com'));
  await sleep(600);
  const host = await pg.eval(`(() => { const h = document.getElementById('layover-bar'); const c = h && getComputedStyle(h); return c && { pos: c.position, z: c.zIndex, display: c.display, shadow: h.shadowRoot }; })()`);
  check('bar is injected in a closed shadow root', host && host.pos === 'fixed' && host.z === '2147483647' && host.shadow === null, JSON.stringify(host));
  await pg.eval(`(() => { const s = document.createElement('style'); s.textContent = '#layover-bar,div[id^=layover]{display:none!important;opacity:0!important;visibility:hidden!important;top:-500px!important}'; document.head.appendChild(s); })()`);
  const hidden = await pg.eval(`(() => { const c = getComputedStyle(document.getElementById('layover-bar')); return { display: c.display, opacity: c.opacity, visibility: c.visibility, top: c.top }; })()`);
  check('page CSS cannot hide the bar', hidden.display === 'block' && hidden.opacity === '1' && hidden.visibility === 'visible' && hidden.top === '10px', JSON.stringify(hidden));

  let nodes = await barNodes(pg);
  check('bar has back, copy, add and close buttons', nodes && nodes.buttons.length === 4, JSON.stringify(nodes));
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 550, y: 500 });
  await sleep(3200);
  nodes = await barNodes(pg);
  check('compact bar shrinks after a few seconds', nodes && /\bidle\b/.test(nodes.bar), JSON.stringify(nodes && nodes.bar));
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 550, y: 26 });
  await sleep(300);
  nodes = await barNodes(pg);
  check('pointing at the bar expands it', nodes && !/\bidle\b/.test(nodes.bar), JSON.stringify(nodes && nodes.bar));
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 550, y: 500 });

  await pg.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const saved = clipboard.read();
  const copied = await sw.eval(`copyLink(${pop.id})`);
  const now = clipboard.read();
  clipboard.write(saved);
  check('copy-link shortcut copies the page address', copied === true && (now === null || now === 'https://example.com/'), `result=${copied} clipboard=${JSON.stringify(now)}`);
  nodes = await barNodes(pg);
  check('copy-link shortcut shows the copied state on the bar', nodes && nodes.buttons.some((b) => /\bdone\b/.test(b.cls || '')) && !/\bidle\b/.test(nodes.bar), JSON.stringify(nodes));

  await sw.eval(`moveToMain(${pop.id})`);
  await settle(sw);
  all = await wins(sw);
  check('add to tabs: mini window is gone', !all.some((w) => w.type === 'popup'), layout(all));
  check('add to tabs: page is a tab in the main window', all.find((w) => w.id === main.id).tabs.some((t) => urlOf(t).startsWith('https://example.com')), layout(all));
  check('add to tabs: bar removed', (await pg.eval(`!!document.getElementById('layover-bar')`)) === false);
  check('add to tabs: registry cleared', (await sw.eval(`getMini()`))[pop.id] === undefined);
  pg.close();

  L.sendUrl('https://example.org/');
  await settle(sw, 2500);
  let p2 = (await popups(sw))[0];
  await sw.eval(`runCommand('close-mini', { windowId: ${p2.id} })`);
  await settle(sw, 800);
  check('close shortcut closes the mini window', !(await popups(sw)).length, layout(await wins(sw)));
  return main;
}

async function placement(sw, main) {
  console.log('\n— placement and size');
  await sw.eval(`chrome.windows.update(${main.id}, { state: 'normal', left: 0, top: 0, width: 1600, height: 1000 })`);
  await sleep(600);
  const t1 = await sw.eval(`(async () => openMini({ url: 'https://example.com/' }, ${main.id}, await getSettings()))()`);
  await settle(sw);
  let p = (await popups(sw))[0];
  const target = { left: p.left + 120, top: p.top + 60 };
  await sw.eval(`chrome.windows.update(${p.id}, { left: ${target.left}, top: ${target.top} })`);
  await sleep(900);
  let stored = await sw.eval(`chrome.storage.local.get(['width', 'height'])`);
  check('moving a mini window keeps the stored size', stored.width === 1100 && stored.height === 780, JSON.stringify(stored));
  await sw.eval(`chrome.windows.remove(${p.id})`);
  await sleep(400);
  await sw.eval(`(async () => openMini({ url: 'https://example.org/' }, ${main.id}, await getSettings()))()`);
  await settle(sw);
  p = (await popups(sw))[0];
  check('next mini window opens where the last one was moved', p.left === target.left && p.top === target.top, `got ${p.left},${p.top} want ${target.left},${target.top}`);
  await sw.eval(`(async () => openMini({ url: 'https://example.net/' }, ${main.id}, await getSettings()))()`);
  await settle(sw);
  const deck = (await popups(sw)).sort((a, b) => a.left - b.left);
  check('a second open mini window is stacked on the first', deck.length === 2 && deck[1].left - deck[0].left === 28 && deck[1].top - deck[0].top === 28, JSON.stringify(deck.map((w) => [w.left, w.top])));
  await closePopups(sw);
  await sw.eval(`chrome.storage.session.set({ lastPos: { left: 9000, top: 9000 } })`);
  await sw.eval(`(async () => openMini({ url: 'https://example.com/' }, ${main.id}, await getSettings()))()`);
  await settle(sw);
  p = (await popups(sw))[0];
  const m = await sw.eval(`chrome.windows.get(${main.id})`);
  const cx = Math.round(m.left + (m.width - 1100) / 2), cy = Math.round(m.top + (m.height - 780) / 2);
  check('a remembered position outside the main window is ignored', Math.abs(p.left - cx) <= 2 && Math.abs(p.top - cy) <= 40, `got ${p.left},${p.top} centre ${cx},${cy}`);
  await sw.eval(`chrome.windows.update(${p.id}, { width: 900, height: 700 })`);
  await sleep(900);
  stored = await sw.eval(`chrome.storage.local.get(['width', 'height'])`);
  check('resizing a mini window stores the new size', stored.width === 900 && stored.height === 700, JSON.stringify(stored));
  await sw.eval(`chrome.storage.local.set({ width: 1100, height: 780 })`);
  await closePopups(sw);
}

async function clicks(sw, main) {
  console.log('\n— clicks and site rules');
  await sw.eval(`chrome.tabs.create({ windowId: ${main.id}, url: 'https://example.com/', active: true })`);
  await sleep(2000);
  const pg = await L.page((x) => x.url === 'https://example.com/');
  const mod = process.platform === 'darwin' ? 1 | 4 : 1 | 2;
  const href = await clickLink(pg, mod);
  await settle(sw);
  let ps = await popups(sw);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  check('modifier + click opens the link in a mini window', ps.length === 1 && host(urlOf(ps[0].tabs[0])) === host(href), JSON.stringify(ps.map((p) => urlOf(p.tabs[0]))));
  check('modifier + click leaves the page where it was', (await pg.eval('location.href')) === 'https://example.com/');
  await clickLink(pg, 8);
  await settle(sw, 1200);
  check('shift + click is left to the browser', (await popups(sw)).length === 1);
  await closePopups(sw);
  for (const w of (await wins(sw)).filter((w) => w.type === 'normal' && w.id !== main.id)) await sw.call(`chrome.windows.remove(${w.id})`);
  pg.close();

  await sw.eval(`chrome.storage.local.set({ neverMini: ['zoom.us', 'example.org'] })`);
  await sleep(300);
  L.sendUrl('https://example.org/');
  await settle(sw, 2500);
  const all = await wins(sw);
  check('a never-mini site opens as a normal tab', !all.some((w) => w.type === 'popup') && all.some((w) => w.type === 'normal' && w.tabs.some((t) => urlOf(t).startsWith('https://example.org'))), layout(all));
  await sw.eval(`chrome.storage.local.set({ neverMini: ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com'] })`);
}

async function lifecycle(sw, main) {
  console.log('\n— auto-close and focus');
  await sw.eval(`chrome.windows.update(${main.id}, { state: 'normal', focused: true })`);
  const t1 = await sw.eval(`(async () => openMini({ url: 'https://example.com/' }, ${main.id}, await getSettings()))()`);
  const audio = 'data:text/html,<audio autoplay loop src="' + wav() + '"></audio>';
  const t2 = await sw.eval(`(async () => openMini({ url: ${JSON.stringify(audio)} }, ${main.id}, await getSettings()))()`);
  await sleep(2500);
  const quiet = await sw.eval(`chrome.tabs.get(${t1})`), loud = await sw.eval(`chrome.tabs.get(${t2})`);
  await sw.eval(`chrome.windows.update(${main.id}, { focused: true })`);
  await sleep(300);
  await sw.eval(`(async () => { const m = await getMini(); m[${quiet.windowId}] = m[${loud.windowId}] = Date.now() - 7 * 3600e3; await chrome.storage.session.set({ mini: m }); })()`);
  await sw.eval(`chrome.alarms.create('layover-autoclose', { delayInMinutes: 0.01 })`);
  await sleep(2500);
  const ids = (await popups(sw)).map((p) => p.id);
  check('an idle mini window closes by itself', !ids.includes(quiet.windowId), JSON.stringify(ids));
  check('a mini window playing sound stays open', loud.audible === true && ids.includes(loud.windowId), `audible=${loud.audible}`);
  await closePopups(sw);
  await sw.eval(`chrome.alarms.create('layover-autoclose', { periodInMinutes: 10 })`);

  await sw.eval(`chrome.windows.update(${main.id}, { state: 'minimized' })`);
  await sleep(1200);
  L.sendUrl('https://example.net/');
  await settle(sw, 3000);
  const all = await wins(sw);
  const p = all.find((w) => w.type === 'popup');
  check('link while the main window is minimized: mini window opens in front', p && p.focused, layout(all));
  check('link while the main window is minimized: main window stays minimized', all.find((w) => w.id === main.id).state === 'minimized', layout(all));
  await sw.eval(`chrome.windows.update(${main.id}, { state: 'normal', focused: true })`);
  await closePopups(sw);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/redirect')) { res.writeHead(302, { location: 'http://127.0.0.1:8765/fast' }); res.end(); return; }
      const delay = req.url.startsWith('/slow') ? 1200 : 0;
      setTimeout(() => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>layover test</title><p>ok</p>'); }, delay);
    });
    server.listen(8765, () => resolve(server));
  });
}

async function waitForPopup(sw, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const p = (await popups(sw))[0];
    if (p) return { popup: p, at: Date.now() - t0 };
    await sleep(25);
  }
  return { popup: null, at: ms };
}

async function earlyPop(sw, main) {
  console.log('\n— pop out before the page loads');
  const server = await startServer();
  const inactive = () => sw.eval(`setActivity({ inactive: true, at: Date.now() })`);
  const lastLog = async () => (await sw.eval(`chrome.storage.local.get('log').then((r) => r.log || [])`))[0] || {};
  const reset = async () => {
    await sw.eval(`chrome.windows.update(${main.id}, { state: 'normal' })`);
    await closePopups(sw);
    for (const t of (await sw.eval(`chrome.tabs.query({ windowId: ${main.id} })`)).slice(1)) await sw.call(`chrome.tabs.remove(${t.id})`);
    await sleep(600);
  };
  try {
    await reset();
    await inactive();
    const t0 = Date.now();
    L.sendUrl('http://127.0.0.1:8765/slow-background');
    let r = await waitForPopup(sw, 3000);
    const opened = Date.now() - t0;
    check('Chrome in the background: mini window opens before the page has loaded', !!r.popup && opened < 1000, `${opened} ms after the link was sent, server answers after 1200 ms`);
    await sleep(2000);
    let all = await wins(sw);
    check('Chrome in the background: the page finishes loading in the mini window', all.some((w) => w.type === 'popup' && w.tabs.some((t) => urlOf(t).includes('/slow-background'))) && all.find((w) => w.id === main.id).tabs.length === 1, layout(all));
    check('Chrome in the background: the commit confirms the early pop-out', (await lastLog()).action === 'mini:confirmed', JSON.stringify(await lastLog()));
    const pg = await L.page((x) => x.url.includes('/slow-background'));
    check('the bar is added once the early-popped page loads', (await pg.eval(`!!document.getElementById('layover-bar')`)) === true);
    pg.close();

    await reset();
    await sw.eval(`chrome.windows.update(${main.id}, { state: 'minimized' })`);
    await sleep(1200);
    const t1 = Date.now();
    L.sendUrl('http://127.0.0.1:8765/slow-minimized');
    r = await waitForPopup(sw, 3000);
    const opened2 = Date.now() - t1;
    await sleep(2200);
    all = await wins(sw);
    check('main window minimized: mini window opens before the page has loaded', !!r.popup && opened2 < 1200, `${opened2} ms`);
    check('main window minimized: it is minimized again', all.find((w) => w.id === main.id).state === 'minimized', layout(all));

    await reset();
    await inactive();
    await sw.eval(`chrome.tabs.create({ windowId: ${main.id}, url: 'http://127.0.0.1:8765/slow-extension', active: true })`);
    r = await waitForPopup(sw, 1500);
    await sleep(2200);
    all = await wins(sw);
    check('a tab opened by another extension while Chrome is in the background is moved back', !!r.popup && !all.some((w) => w.type === 'popup') && all.find((w) => w.id === main.id).tabs.some((t) => urlOf(t).includes('/slow-extension')), layout(all));
    check('…and the log says it was undone', (await lastLog()).action === 'mini:undone', JSON.stringify(await lastLog()));

    await reset();
    await sw.eval(`chrome.storage.local.set({ neverMini: ['zoom.us', '127.0.0.1'] })`);
    await sleep(300);
    await inactive();
    L.sendUrl('http://localhost:8765/redirect');
    await sleep(2500);
    all = await wins(sw);
    check('a link that redirects to a never-mini site ends up as a normal tab', !all.some((w) => w.type === 'popup') && all.find((w) => w.id === main.id).tabs.some((t) => urlOf(t).startsWith('http://127.0.0.1:8765/fast')), layout(all));
    await sw.eval(`chrome.storage.local.set({ neverMini: ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com'] })`);

    await reset();
    await sw.eval(`setActivity({ inactive: false, at: 0 })`);
    L.sendUrl('http://127.0.0.1:8765/slow-active');
    await sleep(800);
    const before = (await popups(sw)).length;
    await sleep(1800);
    all = await wins(sw);
    check('Chrome in front: the link waits for the page and still opens in a mini window', before === 0 && all.some((w) => w.type === 'popup' && w.tabs.some((t) => urlOf(t).includes('/slow-active'))), `popups after 800 ms: ${before}; ${layout(all)}`);
    await reset();
  } finally {
    server.close();
  }
}

async function settingsPage(sw) {
  console.log('\n— settings page');
  const tab = await sw.eval(`chrome.tabs.create({ url: chrome.runtime.getURL('options.html'), active: true })`);
  await sleep(1500);
  const pg = await L.page((x) => x.url.endsWith('/options.html'));
  const info = await pg.eval(`(() => ({
    empty: [...document.querySelectorAll('[data-i18n]')].filter((e) => !e.textContent.trim()).map((e) => e.dataset.i18n),
    shared: typeof LAYOVER === 'object',
    copyKey: document.getElementById('kbdCopy').textContent,
    compact: document.getElementById('barCompact').checked,
    tabStops: [...document.querySelectorAll('#barPos [role=radio]')].map((b) => b.tabIndex),
  }))()`);
  check('every label on the settings page has text', info.empty.length === 0 && info.shared, JSON.stringify(info));
  check('settings page shows the copy-link shortcut', info.copyKey && info.copyKey !== '—', info.copyKey);
  check('radio groups have one tab stop', JSON.stringify(info.tabStops) === '[0,-1,-1,-1]', JSON.stringify(info.tabStops));
  await pg.eval(`document.querySelector('#barPos [aria-checked=true]').focus()`);
  await pg.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await sleep(500);
  const pos = await sw.eval(`chrome.storage.local.get('barPos').then((r) => r.barPos)`);
  const focused = await pg.eval(`document.activeElement.dataset.v`);
  check('arrow keys move the selection in a radio group', pos === 'top-right' && focused === 'top-right', `${pos} / ${focused}`);
  await sw.eval(`chrome.storage.local.set({ barPos: 'top-center' })`);

  await pg.eval(`document.getElementById('barCompact').click()`);
  await sleep(400);
  const compact = await sw.eval(`chrome.storage.local.get('barCompact').then((r) => r.barCompact)`);
  check('compact switch saves the setting', compact === false, String(compact));
  const w = (await wins(sw)).find((x) => x.type === 'normal');
  await sw.eval(`(async () => openMini({ url: 'https://example.com/' }, ${w.id}, await getSettings()))()`);
  await sleep(4500);
  const bp = await L.page((x) => x.url === 'https://example.com/');
  const nodes = await barNodes(bp);
  check('with compact off the bar stays full', nodes && !/\bidle\b/.test(nodes.bar), JSON.stringify(nodes && nodes.bar));
  bp.close();
  await sw.eval(`chrome.storage.local.set({ barCompact: true })`);
  await closePopups(sw);
  await sw.call(`chrome.tabs.remove(${tab.id})`);
  pg.close();
}

async function startup() {
  console.log('\n— browser start');
  await L.quit();
  prefs((j) => { j.session = { ...(j.session || {}), restore_on_startup: 4, startup_urls: ['https://example.com/', 'https://example.org/'] }; });
  const t0 = Date.now();
  L.launch([]);
  await L.json('/json/version');
  await sleep(Math.max(0, 2500 - (Date.now() - t0)));
  L.sendUrl('https://example.net/');
  await sleep(3500);
  const sw = await L.worker();
  const all = await wins(sw);
  const { startupAt } = await sw.eval(`chrome.storage.session.get('startupAt')`);
  check('startup pages chosen in the browser settings open as normal tabs', !all.some((w) => w.type === 'popup' && w.tabs.some((t) => /example\.(com|org)/.test(urlOf(t)))), layout(all));
  check('a link arriving right after launch opens in a mini window', all.some((w) => w.type === 'popup' && w.tabs.some((t) => urlOf(t).startsWith('https://example.net'))), `${layout(all)} worker started ${startupAt - t0} ms after launch`);
  prefs((j) => { j.session = { ...(j.session || {}), restore_on_startup: 5 }; });
  sw.close();
}

async function incognito() {
  console.log('\n— private windows');
  let sw = await L.worker();
  const id = sw.extId;
  sw.close();
  const DEEP = `function deep(r, s) { const h = r.querySelector && r.querySelector(s); if (h) return h; for (const e of r.querySelectorAll ? r.querySelectorAll('*') : []) if (e.shadowRoot) { const x = deep(e.shadowRoot, s); if (x) return x; } return null; }`;
  const v = await L.json('/json/version');
  const b = await L.Session.open(v.webSocketDebuggerUrl);
  await b.send('Target.createTarget', { url: `chrome://extensions/?id=${id}` });
  b.close();
  await sleep(2000);
  const pg = await L.page((x) => x.url.startsWith('chrome://extensions'));
  let toggled = null;
  for (let i = 0; i < 20 && !toggled; i++) {
    toggled = await pg.eval(`(() => { ${DEEP} const row = deep(document, '#allow-incognito'); const t = row && deep(row.shadowRoot || row, 'cr-toggle'); if (!t) return null; if (!t.checked) t.click(); return String(t.checked); })()`);
    if (!toggled) await sleep(300);
  }
  check('allow-in-incognito switch turned on', toggled === 'true', String(toggled));
  await sleep(1500);
  pg.close();
  sw = await restart(['about:blank']);
  const main = (await wins(sw)).find((w) => w.type === 'normal' && !w.incognito);
  const priv = await sw.call(`chrome.windows.create({ incognito: true, url: ['https://example.com/', 'https://example.org/'], focused: true })`);
  check('extension can open private windows', priv && priv.incognito === true, JSON.stringify(priv));
  if (!priv || !priv.incognito) return;
  await sleep(1500);
  const [tab] = await sw.eval(`chrome.tabs.query({ windowId: ${priv.id} })`);
  await sw.eval(`(async () => openMini({ tabId: ${tab.id} }, ${priv.id}, await getSettings()))()`);
  await settle(sw);
  let all = await wins(sw);
  let pop = all.find((w) => w.type === 'popup');
  check('a private tab moves into a private mini window', pop && pop.incognito, layout(all));
  await sw.eval(`chrome.windows.update(${main.id}, { focused: true })`);
  await sleep(400);
  await sw.eval(`moveToMain(${pop.id})`);
  await settle(sw);
  all = await wins(sw);
  check('add to tabs puts a private page back in the private window', all.find((w) => w.tabs.some((t) => t.id === tab.id)).id === priv.id, layout(all));
  check('the normal window does not receive the private page', all.find((w) => w.id === main.id).tabs.length === main.tabs.length, layout(all));
  const t2 = await sw.eval(`(async () => openMini({ url: 'https://example.net/' }, ${priv.id}, await getSettings()))()`);
  await settle(sw);
  await sw.eval(`chrome.windows.remove(${priv.id})`);
  await sleep(500);
  pop = (await popups(sw))[0];
  check('a link from a private window opens in a private mini window', pop && pop.incognito, layout(await wins(sw)));
  await sw.eval(`moveToMain(${pop.id})`);
  await settle(sw);
  all = await wins(sw);
  const home = all.find((w) => w.tabs.some((t) => t.id === t2));
  check('with no private window left, add to tabs opens a new private window', home && home.type === 'normal' && home.incognito, layout(all));
  const t3 = await sw.eval(`(async () => openMini({ url: 'https://example.org/' }, ${main.id}, await getSettings()))()`);
  await settle(sw);
  await sw.eval(`chrome.windows.update(${home.id}, { focused: true })`);
  await sleep(400);
  await sw.eval(`moveToMain(${(await popups(sw))[0].id})`);
  await settle(sw);
  all = await wins(sw);
  check('a normal page goes to the normal window even when a private one is in front', all.find((w) => w.tabs.some((t) => t.id === t3)).id === main.id, layout(all));
  sw.close();
}

(async () => {
  const t0 = Date.now();
  console.log('Chrome:', L.CHROME);
  await L.quit();
  fs.rmSync(L.PROFILE, { recursive: true, force: true });
  L.syncExtension();
  L.launch(['about:blank']);
  await L.json('/json/version');
  await sleep(2500);
  let sw = await L.worker();
  await sw.eval(`chrome.storage.local.set({ debug: true })`);
  await sleep(1200);
  const main = await externalLinks(sw);
  await placement(sw, main);
  await clicks(sw, main);
  await lifecycle(sw, main);
  await earlyPop(sw, main);
  await settingsPage(sw);
  sw.close();
  await startup();
  await incognito();
  await L.quit();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed in ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const f of failed) console.log('  failed: ' + f.name);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); L.killChrome(); process.exit(1); });
