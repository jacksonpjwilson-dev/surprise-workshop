#!/usr/bin/env node
'use strict';
// Integrity checks for the whole project. Run before every commit.
// Usage: node scripts/validate.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { P, config, history, backlog, revealed, bannedHit, readJSON } = require('../lib/common');
let bad = 0; const ok = (n, p, d = '') => { console.log(`  ${p ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); if (!p) bad++; };
const cfg = config(), h = history();

// backlog
let b = null; try { b = backlog(); } catch (e) { ok('backlog readable at ' + P.backlog, false, e.message); }
if (b) {
  ok('backlog lives outside the repo', !path.resolve(P.backlog).startsWith(path.resolve(P.root) + path.sep));
  const mode = fs.statSync(P.backlog).mode & 0o777; ok('backlog file is private (mode 600)', mode === 0o600, mode.toString(8));
  const ids = b.ideas.map(i => i.id); ok('backlog ids unique', new Set(ids).size === ids.length);
  ok('every idea has a known category, tags and pitch', b.ideas.every(i => b.categories.includes(i.category) && i.tags?.length >= 3 && i.pitch));
  const open = b.ideas.filter(i => i.status === 'new' || i.status === 'claimed');
  ok('at least 8 unbuilt ideas remain (top up when low)', open.length >= 8, `${open.length} unbuilt`);
  const banned = b.ideas.filter(i => bannedHit(i, cfg)); ok('no backlog idea overlaps escape room / murder mystery / quiz / trivia', !banned.length, banned.map(i => i.id).join(', '));
  ok('backlog covers at least 6 categories', new Set(b.ideas.map(i => i.category)).size >= 6);
  // spoiler guard: no unbuilt idea title or pitch may appear in any file of the repo
  let files = [];
  try { files = cp.execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: P.root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { }
  files = files.filter(f => !f.startsWith('node_modules/') && /\.(html|js|css|json|md|txt|svg)$/.test(f));
  const leaks = [];
  for (const f of files) { const s = fs.readFileSync(path.join(P.root, f), 'utf8').toLowerCase(); for (const i of open) if (s.includes(i.title.toLowerCase()) || s.includes(i.pitch.toLowerCase().slice(0, 40))) leaks.push(`${f}:${i.id}`); }
  ok('no unbuilt backlog idea appears in any repo file (no spoilers)', !leaks.length, leaks.slice(0, 5).join(', '));
  ok('no backlog copy inside the repo', !files.some(f => /backlog/i.test(path.basename(f)) && f.endsWith('.json')));
}
// history + gallery
ok('history entries have required fields', h.inventions.every(i => ['id', 'date', 'title', 'category', 'tags', 'link', 'status'].every(k => i[k] !== undefined) && 'rating' in i && 'feedback' in i));
const cats = [...h.inventions].sort((x, y) => (x.date < y.date ? -1 : 1)).map(i => i.category);
ok('no two consecutive inventions share a category', cats.every((c, n) => n === 0 || c !== cats[n - 1]), cats.join(' → '));
const folders = fs.existsSync(P.inventions) ? fs.readdirSync(P.inventions).filter(f => fs.statSync(path.join(P.inventions, f)).isDirectory()) : [];
const rev = new Set(revealed(h).map(i => i.id)), all = new Set(h.inventions.map(i => i.id));
ok('every gallery folder is recorded in history', folders.every(f => all.has(f)), folders.filter(f => !all.has(f)).join(', '));
ok('every gallery folder passed check.js', folders.every(f => readJSON(path.join(P.inventions, f, 'check.json'), {}).passed));
const idx = fs.existsSync(path.join(P.gallery, 'index.html')) ? fs.readFileSync(path.join(P.gallery, 'index.html'), 'utf8') : '';
const linked = [...idx.matchAll(/href="inventions\/([^/"]+)\//g)].map(m => m[1]);
ok('gallery index links only revealed inventions, and all of them', linked.every(l => rev.has(l)) && [...rev].every(r => linked.includes(r)), `${linked.length} linked / ${rev.size} revealed`);
ok('gallery index makes no external requests', !/(src|href)=["']https?:/i.test(idx));
ok('workshop/ is git-ignored (drafts never committed)', fs.readFileSync(path.join(P.root, '.gitignore'), 'utf8').split('\n').includes('workshop/'));
console.log(bad ? `\nVALIDATE FAILED: ${bad}` : '\nVALIDATE PASSED'); process.exit(bad ? 1 : 0);
