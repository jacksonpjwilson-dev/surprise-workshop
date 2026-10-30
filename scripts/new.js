#!/usr/bin/env node
'use strict';
// Scaffold a new invention folder in workshop/ (git-ignored until it is revealed).
// Usage: node scripts/new.js --id <ideaId> [--title "Final Title"] [--date YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { P, backlog, today, slugify, args, writeJSON, die } = require('../lib/common');
const a = args();
if (!a.id) die('Usage: node scripts/new.js --id <ideaId> [--title "Final Title"] [--date YYYY-MM-DD]');
const idea = backlog().ideas.find(i => i.id === a.id); if (!idea) die(`No backlog idea with id ${a.id}`);
const date = a.date || today(), title = a.title || idea.title;
const folder = `${date}-${slugify(title)}`, dir = path.join(P.workshop, folder);
if (fs.existsSync(dir) || fs.existsSync(path.join(P.inventions, folder))) die(`${folder} already exists`);
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(P.template)) fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(P.template, f), 'utf8').replaceAll('{{TITLE}}', title));
writeJSON(path.join(dir, 'meta.json'), { id: folder, title, date, category: idea.category, tags: idea.tags, ideaId: idea.id, blurb: '', controls: '', status: 'draft' });
console.log(`Created ${path.relative(P.root, dir)}/ (index.html, meta.json, test.js). Fill in meta.json "blurb" before checking.`);
