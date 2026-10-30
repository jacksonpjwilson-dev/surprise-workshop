#!/usr/bin/env node
'use strict';
// Regenerate gallery/index.html from history: ONLY inventions whose reveal time has passed.
// Usage: node scripts/build-gallery.js
const fs = require('fs'), path = require('path');
const { P, history, revealed, config } = require('../lib/common');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = revealed(history()).sort((a, b) => (a.date < b.date ? 1 : -1));
const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
const cards = list.map((i, n) => {
  const thumb = fs.existsSync(path.join(P.inventions, i.id, 'shots', 'desktop.png')) ? `inventions/${esc(i.id)}/shots/desktop.png` : '';
  const stars = i.rating ? `<span class="stars" title="Jackson's rating">${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</span>` : '';
  return `<a class="card" href="inventions/${esc(i.id)}/">${thumb ? `<img src="${thumb}" alt="" loading="lazy" width="640" height="400">` : '<div class="noimg"></div>'}
  <div class="body"><div class="row"><span class="no">#${list.length - n}</span><span class="cat">${esc(i.category)}</span>${stars}</div><h2>${esc(i.title)}</h2><p>${esc(i.blurb)}</p><time datetime="${esc(i.date)}">${fmt(i.date)}</time></div></a>`;
}).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Surprise Workshop</title><meta name="description" content="One original invention every week.">
<meta name="robots" content="noindex">
<style>
:root{color-scheme:dark;--bg:#0e0d12;--card:#18161f;--line:#2c2836;--fg:#eee9df;--muted:#a59f95;--accent:#e2b65b}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,#2a2035,transparent 50%),var(--bg);color:var(--fg);font:16px/1.5 Georgia,'Iowan Old Style',serif;min-height:100vh}
header{max-width:1100px;margin:0 auto;padding:40px 18px 10px}h1{margin:0;font-size:clamp(1.8rem,6vw,3rem);letter-spacing:.01em}
header p{color:var(--muted);margin:.3em 0 0;font-style:italic}
main{max-width:1100px;margin:0 auto;padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}
.card:hover,.card:focus-visible{transform:translateY(-3px);border-color:var(--accent)}
.card img,.noimg{width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;display:block;background:#000}
.body{padding:14px 16px 16px}.row{display:flex;gap:8px;align-items:center;font:12px system-ui,sans-serif;color:var(--muted)}
.no{color:var(--accent);font-weight:700}.cat{border:1px solid var(--line);border-radius:99px;padding:1px 8px}.stars{margin-left:auto;color:var(--accent)}
h2{margin:.35em 0 .2em;font-size:1.25rem}.body p{margin:0 0 .6em;color:#d6d0c4;font-size:.95rem}time{font:12px system-ui,sans-serif;color:var(--muted)}
.empty{grid-column:1/-1;color:var(--muted);font-style:italic}footer{max-width:1100px;margin:0 auto;padding:10px 18px 40px;color:var(--muted);font:12px system-ui,sans-serif}
</style></head><body>
<header><h1>The Surprise Workshop</h1><p>One original invention, every week. ${list.length} so far.</p></header>
<main>
${cards || '<p class="empty">Nothing revealed yet. Check back next week.</p>'}
</main>
<footer>Every invention is a self-contained page with no trackers and no external requests.</footer>
</body></html>
`;
fs.mkdirSync(P.gallery, { recursive: true });
fs.writeFileSync(path.join(P.gallery, 'index.html'), html);
fs.writeFileSync(path.join(P.gallery, '.nojekyll'), '');
console.log(`Gallery index rebuilt: ${list.length} revealed invention(s).`);
