'use strict';
// Shared helpers for the Surprise Inventor scripts. Paths can be overridden with env vars (used by tests).
const fs = require('fs');
const path = require('path');

const ROOT = process.env.INVENTOR_ROOT || path.resolve(__dirname, '..');
const BACKLOG = process.env.INVENTOR_BACKLOG || '/home/box/shared/inventor/backlog.json';
const P = {
  root: ROOT,
  backlog: BACKLOG,
  config: path.join(ROOT, 'data', 'config.json'),
  history: path.join(ROOT, 'data', 'history.json'),
  feedback: path.join(ROOT, 'data', 'feedback.json'),
  reveals: path.join(ROOT, 'data', 'reveals'),
  prefs: path.join(ROOT, 'PREFERENCES.md'),
  workshop: path.join(ROOT, 'workshop'),
  gallery: path.join(ROOT, 'gallery'),
  inventions: path.join(ROOT, 'gallery', 'inventions'),
  template: path.join(ROOT, 'templates', 'invention'),
};

const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (fallback !== undefined && e.code === 'ENOENT') return fallback; throw new Error(`Cannot read ${f}: ${e.message}`); } };
const writeJSON = (f, v, mode) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n', mode ? { mode } : undefined); fs.renameSync(tmp, f); };

const config = () => ({
  rotationWindow: 3, similarityThreshold: 0.34, previewPort: 4173, baseUrl: '', maxBytes: 2_000_000,
  bannedThemes: ['escape room', 'escape-room', 'murder', 'mystery', 'whodunit', 'detective', 'quiz', 'trivia'],
  ...readJSON(P.config, {}),
});
const history = () => readJSON(P.history, { inventions: [] });
const feedback = () => readJSON(P.feedback, { entries: [] });
const backlog = () => readJSON(P.backlog);

// Local date in the box time zone (America/Toronto), YYYY-MM-DD.
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const STOP = new Set('a an the of to in on for and or your you my with as is it its that this how what far has have gone into from at by be are was'.split(' '));
const tokens = (title, tags = []) => {
  const t = new Set();
  for (const w of String(title).toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 2 && !STOP.has(w)) t.add(w.replace(/s$/, ''));
  for (const g of tags) t.add(String(g).toLowerCase().replace(/s$/, ''));
  return t;
};
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
const similarity = (x, y) => jaccard(tokens(x.title, x.tags), tokens(y.title, y.tags));

// Themes Jackson already has (or excluded): never build these.
const bannedHit = (item, cfg = config()) => {
  const hay = [item.title, item.pitch || '', ...(item.tags || [])].join(' ').toLowerCase();
  return cfg.bannedThemes.find(b => hay.includes(b)) || null;
};

const revealed = (h = history(), now = Date.now()) => h.inventions.filter(i => i.status === 'revealed' && i.revealedAt && Date.parse(i.revealedAt) <= now);

// The "avoid repeating" check. Returns a list of human-readable problems (empty = OK).
function avoidCheck(item, h = history(), cfg = config(), window = cfg.rotationWindow) {
  const problems = [];
  const past = [...h.inventions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = past.slice(0, window).map(i => i.category);
  if (window > 0 && recent.includes(item.category)) problems.push(`category "${item.category}" was used in the last ${window} inventions`);
  for (const p of past) {
    if (item.ideaId && p.ideaId === item.ideaId) problems.push(`idea already built as ${p.id}`);
    const s = similarity(item, p);
    if (s >= cfg.similarityThreshold) problems.push(`too similar to ${p.id} ("${p.title}"), similarity ${s.toFixed(2)}`);
  }
  const ban = bannedHit(item, cfg); if (ban) problems.push(`banned theme "${ban}"`);
  return problems;
}

// Preference weights learned from feedback (ratings 1-5, liked/disliked tags).
function preferences(fb = feedback(), h = history()) {
  const byCat = {}, tagScore = {};
  for (const e of fb.entries) {
    const inv = h.inventions.find(i => i.id === e.inventionId) || {};
    const cat = e.category || inv.category;
    if (cat && e.rating) (byCat[cat] = byCat[cat] || []).push(e.rating);
    if (e.rating) for (const t of inv.tags || []) tagScore[t] = (tagScore[t] || 0) + (e.rating - 3) * 0.25;
    for (const t of e.liked || []) tagScore[t] = (tagScore[t] || 0) + 1;
    for (const t of e.disliked || []) tagScore[t] = (tagScore[t] || 0) - 1;
  }
  const catAvg = Object.fromEntries(Object.entries(byCat).map(([c, r]) => [c, r.reduce((a, b) => a + b, 0) / r.length]));
  return { catAvg, tagScore };
}

// Small deterministic PRNG so a given date always picks the same idea (reproducible runs).
const seeded = seed => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; };

const args = (argv = process.argv.slice(2)) => {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) o[k] = true; else { o[k] = n; i++; } } else o._.push(a);
  }
  return o;
};
const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };

module.exports = { P, readJSON, writeJSON, config, history, feedback, backlog, today, slugify, tokens, similarity, bannedHit, revealed, avoidCheck, preferences, seeded, args, die };
