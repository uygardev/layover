'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const LISTING = path.join(ROOT, 'store', 'store-listing.md');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const zipName = `layover-${manifest.version}.zip`;
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'layover-pkg-'));

try {
  for (const f of fs.readdirSync(ROOT)) {
    if (/\.(js|json|html|css)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile()) fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
  }
  for (const d of ['_locales', 'icons']) fs.cpSync(path.join(ROOT, d), path.join(stage, d), { recursive: true });

  const read = (f) => fs.readFileSync(path.join(stage, f), 'utf8');
  const needed = new Set([
    manifest.background.service_worker,
    manifest.options_page,
    ...manifest.content_scripts.flatMap((c) => c.js || []),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon || {}),
    ...[...read(manifest.background.service_worker).matchAll(/importScripts\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2])),
    ...[...read(manifest.options_page).matchAll(/(?:src|href)="([^":]+)"/g)].map((m) => m[1]),
    ...[...read(manifest.background.service_worker).matchAll(/files:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])),
  ]);
  const missing = [...needed].filter((f) => !fs.existsSync(path.join(stage, f)));
  if (missing.length) throw new Error('referenced but not in the package: ' + missing.join(', '));
  const en = JSON.parse(read('_locales/en/messages.json'));
  for (const lang of fs.readdirSync(path.join(stage, '_locales'))) {
    const keys = Object.keys(JSON.parse(read(`_locales/${lang}/messages.json`)));
    const gaps = Object.keys(en).filter((k) => !keys.includes(k));
    if (gaps.length) throw new Error(`_locales/${lang} is missing: ${gaps.join(', ')}`);
  }
  const used = new Set([...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]));
  const unknown = [...used].filter((k) => !en[k]);
  if (unknown.length) throw new Error('manifest uses undefined messages: ' + unknown.join(', '));

  let count = 0, bytes = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { count++; bytes += fs.statSync(p).size; } } };
  walk(stage);

  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, zipName);
  fs.rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-X', '-D', '-q', out, '.'], { cwd: stage });

  const kb = Math.round(bytes / 1024);
  let listing = fs.readFileSync(LISTING, 'utf8');
  listing = listing
    .replace(/^# Chrome Web Store listing: Layover .*$/m, `# Chrome Web Store listing: Layover ${manifest.version}`)
    .replace(/^- File: `layover-.*$/m, `- File: \`${zipName}\` (${count} files, about ${kb} KB uncompressed)`);
  fs.writeFileSync(LISTING, listing);

  console.log(`${path.relative(ROOT, out)}: ${count} files, ${kb} KB uncompressed, ${Math.round(fs.statSync(out).size / 1024)} KB zipped`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
