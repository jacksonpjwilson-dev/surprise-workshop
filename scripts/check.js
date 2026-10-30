#!/usr/bin/env node
'use strict';
// Test one invention folder: static rules + headless Chromium at 1280x800 and 390x844.
// Usage: node scripts/check.js <workshop/YYYY-MM-DD-slug | gallery/inventions/...> [--browser chromium|webkit]
// Writes <folder>/check.json and screenshots to <folder>/shots/. Exit code 1 on any failure.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { P, config, readJSON, writeJSON, bannedHit, args, die } = require('../lib/common');
const { serve } = require('../lib/static');

const a = args();
if (!a._[0]) die('Usage: node scripts/check.js <invention folder>');
const dir = path.resolve(a._[0]);
if (!fs.existsSync(path.join(dir, 'index.html'))) die(`${dir} has no index.html`);
const cfg = config();
const results = []; let failed = 0;
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'shots' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);

(async () => {
  console.log(`Checking ${path.relative(P.root, dir) || dir}`);
  // ---------- static checks ----------
  let meta = {};
  try { meta = readJSON(path.join(dir, 'meta.json')); } catch (e) { ok('meta.json is valid JSON', false, e.message); }
  const need = ['id', 'title', 'date', 'category', 'tags', 'blurb'];
  const missing = need.filter(k => !meta[k] || (Array.isArray(meta[k]) && !meta[k].length));
  ok('meta.json has id, title, date, category, tags, blurb', !missing.length, missing.length ? 'missing: ' + missing.join(', ') : '');
  ok('folder name is YYYY-MM-DD-slug and matches meta.id', /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(path.basename(dir)) && meta.id === path.basename(dir));

  const files = walk(dir);
  const bytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  ok(`self-contained size under ${(cfg.maxBytes / 1e6).toFixed(1)} MB`, bytes <= cfg.maxBytes, `${(bytes / 1024).toFixed(1)} KB in ${files.length} files`);

  const text = files.filter(f => /\.(html|js|css|json|svg|txt|md)$/.test(f) && !f.endsWith('check.json'));
  const all = text.map(f => [f, fs.readFileSync(f, 'utf8')]);
  const ext = [];
  for (const [f, s] of all) {
    if (path.basename(f) === 'test.js') continue;
    for (const m of s.matchAll(/(?:src|href|action)\s*=\s*["']?\s*(https?:)?\/\/[^"'\s>]+|url\(\s*["']?(?:https?:)?\/\/[^)"']+|(?:fetch|import|importScripts|new\s+(?:WebSocket|EventSource|Worker))\s*\(\s*["'`](?:https?|wss?):\/\/[^"'`]+|@import\s+["']?(?:https?:)?\/\//gi)) ext.push(`${path.basename(f)}: ${m[0].slice(0, 80)}`);
  }
  ok('no external resources or network calls in the source (no CDNs, APIs, fonts, trackers)', !ext.length, ext.slice(0, 5).join(' | '));
  const secrets = all.filter(([, s]) => /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|api[_-]?key\s*[:=]\s*["'][^"']{12,})/i.test(s)).map(([f]) => path.basename(f));
  ok('no API keys or secrets', !secrets.length, secrets.join(', '));
  const contact = all.filter(([f, s]) => path.basename(f) !== 'test.js' && /(mailto:|tel:|sms:|navigator\.sendBeacon|<form[^>]+action=)/i.test(s)).map(([f]) => path.basename(f));
  ok('no contact/sending mechanisms (mailto, tel, sms, beacons, form posts)', !contact.length, contact.join(', '));
  const words = cfg.pg13Blocklist || [];
  const rude = [];
  for (const [f, s] of all) for (const w of words) if (new RegExp(`\\b${w}\\b`, 'i').test(s)) rude.push(`${path.basename(f)}:${w}`);
  ok('PG-13 word screen', !rude.length, rude.join(', '));
  const ban = bannedHit({ title: meta.title || '', pitch: meta.blurb || '', tags: meta.tags || [] }, cfg);
  ok('not an excluded theme (escape room, murder mystery, quiz, trivia)', !ban, ban || '');

  // ---------- browser checks ----------
  const pw = require('playwright-core');
  const engine = a.browser || 'chromium';
  const srv = await serve(dir);
  const origin = `http://127.0.0.1:${srv.port}`;
  const br = await pw[engine].launch();
  console.log(`  (headless ${engine} ${br.version()})`);
  fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
  let testFn = null;
  if (fs.existsSync(path.join(dir, 'test.js'))) { delete require.cache[path.join(dir, 'test.js')]; testFn = require(path.join(dir, 'test.js')); }
  const views = [
    { name: 'desktop', viewport: { width: 1280, height: 800 }, opts: {} },
    { name: 'mobile-390', viewport: { width: 390, height: 844 }, opts: { isMobile: engine !== 'firefox', hasTouch: true, deviceScaleFactor: 2 } },
  ];
  for (const v of views) {
    const ctx = await br.newContext({ viewport: v.viewport, ...v.opts });
    const page = await ctx.newPage();
    const errors = [], blocked = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else { blocked.push(u); r.abort(); } });
    const resp = await page.goto(origin + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(`[${v.name}] page loads (HTTP ${resp.status()})`, resp.ok());
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth, title: document.title,
      text: document.body.innerText.trim().length,
      canvas: [...document.querySelectorAll('canvas,svg')].some(c => c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 100),
      vp: !!document.querySelector('meta[name=viewport]'),
    }));
    ok(`[${v.name}] has a title, content and a viewport meta tag`, m.title && (m.text > 20 || m.canvas) && m.vp, `title="${m.title}"`);
    ok(`[${v.name}] no horizontal overflow (${m.sw}px ≤ ${m.iw}px)`, m.sw <= m.iw + 1);
    // first-impression screenshot, taken before test.js interacts with the page
    await page.screenshot({ path: path.join(dir, 'shots', `${v.name}${engine === 'chromium' ? '' : '-' + engine}.png`) });
    if (testFn) {
      try { await testFn({ page, assert, viewport: { name: v.name, ...v.viewport } }); ok(`[${v.name}] invention test.js interactions`, true); }
      catch (e) { ok(`[${v.name}] invention test.js interactions`, false, String(e.message || e).split('\n')[0]); }
    }
    ok(`[${v.name}] no external requests attempted`, !blocked.length, blocked.slice(0, 3).join(', '));
    ok(`[${v.name}] no JavaScript errors`, !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await br.close(); await srv.close();
  const report = { folder: path.basename(dir), browser: engine, checkedAt: new Date().toISOString(), passed: failed === 0, failed, results };
  writeJSON(path.join(dir, engine === 'chromium' ? 'check.json' : `check-${engine}.json`), report);
  console.log(failed ? `\nCHECK FAILED: ${failed} problem(s)` : `\nCHECK PASSED: ${results.length} checks. Screenshots in ${path.relative(P.root, path.join(dir, 'shots'))}/`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
