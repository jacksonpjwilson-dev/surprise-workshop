#!/usr/bin/env node
'use strict';
// Pick this week's idea from the private backlog by category rotation + similarity + learned preferences.
// Usage: node scripts/pick.js [--date YYYY-MM-DD] [--claim] [--json] [--explain]
// Prints ONLY the chosen idea (never the rest of the backlog). --claim marks it "claimed" in the backlog.
const { P, backlog, history, config, avoidCheck, preferences, seeded, today, args, writeJSON, die } = require('../lib/common');

const a = args();
const date = a.date || today();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die('--date must be YYYY-MM-DD');
const cfg = config(), h = history(), b = backlog(), prefs = preferences();

// An idea already claimed (an unfinished earlier run) is resumed first.
const claimed = b.ideas.find(i => i.status === 'claimed');
let choice = claimed, relaxed = null;
const excluded = { rotation: 0, similarity: 0, banned: 0, used: 0 };
if (!choice) {
  const open = b.ideas.filter(i => i.status === 'new');
  if (!open.length) die('Backlog is empty: add ideas to ' + P.backlog);
  let pool = [];
  for (const w of [cfg.rotationWindow, 1, 0]) {          // relax rotation only if nothing fits
    pool = open.filter(i => {
      const pr = avoidCheck(i, h, cfg, w);
      if (!pr.length) return true;
      if (w === cfg.rotationWindow) for (const p of pr) { if (p.startsWith('category')) excluded.rotation++; else if (p.startsWith('too similar')) excluded.similarity++; else if (p.startsWith('banned')) excluded.banned++; else excluded.used++; }
      return false;
    });
    if (pool.length) { if (w !== cfg.rotationWindow) relaxed = w; break; }
  }
  if (!pool.length) die('No backlog idea passes the similarity/banned checks. Add fresh ideas to the backlog.');
  const rnd = seeded(date);
  const scored = pool.map(i => {
    let s = 1 + rnd() * 0.8;                                           // variety
    const avg = prefs.catAvg[i.category]; if (avg) s += (avg - 3) * 0.4;  // categories he rates higher
    for (const t of i.tags) s += (prefs.tagScore[t] || 0) * 0.3;          // tags he liked / disliked
    return { i, s };
  }).sort((x, y) => y.s - x.s);
  choice = scored[0].i;
}

if (a.claim && choice.status !== 'claimed') {
  choice.status = 'claimed'; choice.claimedAt = new Date().toISOString(); choice.claimedFor = date;
  writeJSON(P.backlog, b, 0o600);
}
const out = { date, idea: { id: choice.id, title: choice.title, category: choice.category, tags: choice.tags, pitch: choice.pitch, effort: choice.effort }, resumed: !!claimed, rotationRelaxedTo: relaxed, claimed: !!a.claim || choice.status === 'claimed' };
if (a.explain) out.excludedCounts = excluded;
if (a.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`Picked for ${date}: ${choice.title} [${choice.category}] (${choice.id})${claimed ? ' (resuming claimed idea)' : ''}`);
  console.log(`Pitch: ${choice.pitch}`);
  if (relaxed !== null) console.log(`Note: category rotation relaxed to the last ${relaxed}.`);
  if (a.explain) console.log('Excluded (counts only):', excluded);
  console.log(a.claim ? 'Claimed in backlog.' : 'Not claimed (add --claim to reserve it).');
}
