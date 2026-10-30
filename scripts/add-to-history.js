#!/usr/bin/env node
'use strict';
// Move a tested invention from workshop/ into the gallery, record it in history, mark the backlog idea built,
// save the reveal text and rebuild the gallery index.
// Usage: node scripts/add-to-history.js workshop/<YYYY-MM-DD-slug> --reveal "2-3 sentences" [--reveal-at ISO] [--force]
const fs = require('fs'), path = require('path');
const { P, config, history, backlog, readJSON, writeJSON, avoidCheck, args, die } = require('../lib/common');
const a = args();
const src = a._[0] && path.resolve(a._[0]);
if (!src || !fs.existsSync(src)) die('Usage: node scripts/add-to-history.js workshop/<folder> --reveal "..." [--reveal-at ISO] [--force]');
const folder = path.basename(src), dest = path.join(P.inventions, folder);
if (fs.existsSync(dest)) die(`${folder} is already in the gallery`);
const meta = readJSON(path.join(src, 'meta.json'));
const cfg = config(), h = history();

// 1. must have passed check.js after the last edit
const chk = readJSON(path.join(src, 'check.json'), null);
if (!chk || !chk.passed) die('No passing check.json: run `node scripts/check.js ' + path.relative(process.cwd(), src) + '` first');
const newest = (function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((m, e) => { const f = path.join(d, e.name); if (e.isDirectory()) return e.name === 'shots' ? m : Math.max(m, walk(f)); return /^check(-\w+)?\.json$/.test(e.name) ? m : Math.max(m, fs.statSync(f).mtimeMs); }, 0); })(src);
if (Date.parse(chk.checkedAt) < newest - 1000) die('Files changed after the last check: re-run check.js');

// 2. reveal text: 2-3 sentences, short, no spoilers of other backlog ideas
const reveal = String(a.reveal || '').trim();
const sentences = (reveal.match(/[.!?…](\s|$)/g) || []).length;
if (sentences < 2 || sentences > 3 || reveal.length > 600) die(`--reveal must be 2-3 sentences and ≤ 600 characters (got ${sentences} sentences, ${reveal.length} chars)`);
const b = backlog();
const spoil = b.ideas.filter(i => i.id !== meta.ideaId && i.status !== 'built' && reveal.toLowerCase().includes(i.title.toLowerCase()));
if (spoil.length) die('Reveal mentions another unbuilt backlog idea; remove it');

// 3. avoid repeating
const problems = avoidCheck(meta, h, cfg);
if (problems.length && !a.force) die('Avoid-repeating check failed:\n  - ' + problems.join('\n  - ') + '\n(use --force only if Jackson asked for a repeat)');

// 4. move into the gallery and record
fs.mkdirSync(P.inventions, { recursive: true });
fs.renameSync(src, dest);
meta.status = 'revealed'; writeJSON(path.join(dest, 'meta.json'), meta);
const rel = `inventions/${folder}/`;
const link = cfg.baseUrl ? cfg.baseUrl.replace(/\/?$/, '/') + rel : `http://localhost:${cfg.previewPort}/${rel}`;
const revealAt = a['reveal-at'] ? new Date(a['reveal-at']).toISOString() : new Date().toISOString();
const entry = {
  id: folder, date: meta.date, title: meta.title, category: meta.category, tags: meta.tags, ideaId: meta.ideaId || null,
  blurb: meta.blurb, link, path: dest, screenshot: path.join(dest, 'shots', 'mobile-390.png'),
  status: 'revealed', revealedAt: revealAt, reveal, rating: null, feedback: null,
};
h.inventions.push(entry); h.inventions.sort((x, y) => (x.date < y.date ? -1 : 1));
writeJSON(P.history, h);
const idea = b.ideas.find(i => i.id === meta.ideaId);
if (idea) { idea.status = 'built'; idea.builtAt = new Date().toISOString(); idea.inventionId = folder; writeJSON(P.backlog, b, 0o600); }
fs.mkdirSync(P.reveals, { recursive: true });
const msg = `${reveal}\n\n${link}`;
fs.writeFileSync(path.join(P.reveals, `${folder}.md`), `# Reveal: ${meta.title} (${meta.date})\n\n${msg}\n`);
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-gallery.js')], { stdio: 'inherit', env: process.env });
console.log(`\nAdded ${folder} to history and gallery.\n\n--- REVEAL (send this to Jackson) ---\n${msg}\n-------------------------------------`);
