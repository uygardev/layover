'use strict';
const { spawn, execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 9333;
const ROOT = path.resolve(__dirname, '..');
const WORK = path.join(os.tmpdir(), 'layover-test');
const PROFILE = path.join(WORK, 'profile');
const EXT = path.join(WORK, 'ext');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : [];
  for (const d of dirs) {
    const mac = path.join(base, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    const macX = mac.replace('chrome-mac-arm64', 'chrome-mac-x64');
    const linux = path.join(base, d, 'chrome-linux64', 'chrome');
    for (const p of [mac, macX, linux]) if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome for Testing not found. Install with: npx @puppeteer/browsers install chrome@stable  (or set CHROME=/path/to/binary)');
}
const CHROME = findChrome();

function syncExtension() {
  fs.rmSync(EXT, { recursive: true, force: true });
  fs.mkdirSync(EXT, { recursive: true });
  for (const f of fs.readdirSync(ROOT)) if (/\.(js|json|html|css)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile()) fs.copyFileSync(path.join(ROOT, f), path.join(EXT, f));
  fs.cpSync(path.join(ROOT, '_locales'), path.join(EXT, '_locales'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'icons'), path.join(EXT, 'icons'), { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  m.version = m.version + '.' + (Math.floor(Date.now() / 1000) % 60000);
  fs.writeFileSync(path.join(EXT, 'manifest.json'), JSON.stringify(m));
}

function launch(args = []) {
  const p = spawn(CHROME, [
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, `--load-extension=${EXT}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync', '--use-mock-keychain', '--password-store=basic', '--autoplay-policy=no-user-gesture-required',
    ...args,
  ], { stdio: 'ignore', detached: true });
  p.unref();
}
function sendUrl(url) {
  execFileSync(CHROME, [`--user-data-dir=${PROFILE}`, url], { stdio: 'ignore' });
}
function killChrome() {
  for (const pattern of [`remote-debugging-port=${PORT}`, PROFILE, CHROME]) {
    try { execSync(`pkill -f ${JSON.stringify(pattern)}`); } catch {}
  }
}
async function quit() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const ws = new WebSocket((await r.json()).webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } catch {}
  for (let i = 0; i < 40; i++) {
    try { execSync(`pgrep -f ${JSON.stringify(PROFILE)}`, { stdio: 'ignore' }); } catch { return; }
    await sleep(250);
  }
  killChrome();
  await sleep(1000);
}
async function json(p) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return await r.json(); } catch { await sleep(200); }
  }
  throw new Error('chrome not reachable');
}

class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      const p = d.id && this.pending.get(d.id);
      if (!p) return;
      this.pending.delete(d.id);
      d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result);
    };
  }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    return new Session(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  call(code) { return this.eval(`(async () => { try { return await (${code}); } catch (e) { return 'ERR ' + e.message; } })()`); }
  close() { this.ws.close(); }
}

async function wake() {
  try {
    const v = await json('/json/version');
    const b = await Session.open(v.webSocketDebuggerUrl);
    const t = await b.send('Target.createTarget', { url: 'about:blank' });
    await sleep(800);
    await b.send('Target.closeTarget', { targetId: t.targetId });
    b.close();
  } catch {}
}
async function worker() {
  for (let i = 0; i < 60; i++) {
    const t = (await json('/json')).find((x) => x.type === 'service_worker' && x.url.endsWith('/background.js'));
    if (t) { const s = await Session.open(t.webSocketDebuggerUrl); s.extId = new URL(t.url).host; return s; }
    if (i % 10 === 5) await wake();
    await sleep(200);
  }
  throw new Error('service worker not found');
}
async function page(match) {
  for (let i = 0; i < 50; i++) {
    const t = (await json('/json')).find((x) => x.type === 'page' && match(x));
    if (t) return Session.open(t.webSocketDebuggerUrl);
    await sleep(200);
  }
  throw new Error('page not found');
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '\n      ' + detail}`);
}

module.exports = { CHROME, PROFILE, EXT, sleep, syncExtension, launch, sendUrl, killChrome, quit, json, Session, worker, page, check, results };
