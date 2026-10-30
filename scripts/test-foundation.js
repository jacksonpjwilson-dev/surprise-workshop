#!/usr/bin/env node
'use strict';
// Unit/integration tests for the foundation scripts. Everything runs in a temp copy with a FAKE backlog,
// so the real backlog, history and gallery are never touched. Usage: npm test
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), assert = require('assert');
const REPO = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const T = (name, fn) => { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')); } };

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inventor-test-'));
  for (const d of ['scripts', 'lib', 'templates']) fs.cpSync(path.join(REPO, d), path.join(root, d), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'));
  fs.copyFileSync(path.join(REPO, 'data', 'config.json'), path.join(root, 'data', 'config.json'));
  fs.writeFileSync(path.join(root, 'data', 'history.json'), '{"inventions":[]}');
  fs.writeFileSync(path.join(root, 'data', 'feedback.json'), '{"entries":[]}');
  fs.writeFileSync(path.join(root, 'PREFERENCES.md'), '# Prefs\n\nhand-written\n\n<!-- AUTO:START -->\nold\n<!-- AUTO:END -->\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'workshop/\n');
  const cats = ['alpha', 'beta', 'gamma', 'delta'];
  const ideas = [];
  for (let n = 0; n < 12; n++) ideas.push({ id: `idea-${n}`, title: `Zorb Gadget ${'ABCDEFGHIJKL'[n]}${n}`, category: cats[n % 4], tags: [`t${n}`, `u${n}`, `v${n}`], pitch: `Fake pitch number ${n} for testing only.`, effort: 'm', status: 'new' });
  const backlogFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inventor-backlog-')), 'backlog.json'); // outside the repo, like the real one
  fs.writeFileSync(backlogFile, JSON.stringify({ categories: cats, ideas }, null, 2), { mode: 0o600 });
  const env = { ...process.env, INVENTOR_ROOT: root, INVENTOR_BACKLOG: backlogFile };
  const run = (script, args = [], ok = true) => {
    const r = cp.spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { env, cwd: root, encoding: 'utf8' });
    if (ok && r.status !== 0) throw new Error(`${script} ${args.join(' ')} exited ${r.status}: ${r.stderr || r.stdout}`);
    return r;
  };
  const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  const lib = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(root)) delete require.cache[k]; process.env.INVENTOR_ROOT = root; process.env.INVENTOR_BACKLOG = backlogFile; return require(path.join(root, 'lib', 'common.js')); };
  const fakeCheck = (dir, when = Date.now() + 2000) => fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ passed: true, checkedAt: new Date(when).toISOString() }));
  return { root, backlogFile, env, run, read, lib, fakeCheck };
}
// Build a scaffolded, "checked" invention for an idea and add it to history.
function ship(sb, ideaId, date, extra = []) {
  sb.run('new.js', ['--id', ideaId, '--date', date]);
  const dir = path.join(sb.root, 'workshop', fs.readdirSync(path.join(sb.root, 'workshop')).find(f => f.startsWith(date)));
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'))); m.blurb = 'A test blurb.'; fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(m));
  sb.fakeCheck(dir);
  return sb.run('add-to-history.js', [dir, '--reveal', 'First sentence here. Second sentence here.', ...extra], false);
}

console.log('Surprise Inventor foundation tests');
const sb = sandbox();
const L = sb.lib();

T('similarity: identical title+tags = 1, unrelated = 0, stopwords and plurals ignored', () => {
  assert.equal(L.similarity({ title: 'Tide Clock', tags: ['ocean'] }, { title: 'Tide Clock', tags: ['ocean'] }), 1);
  assert.equal(L.similarity({ title: 'Tide Clock', tags: ['ocean'] }, { title: 'Moth Radio', tags: ['night'] }), 0);
  assert.equal(L.similarity({ title: 'The Clocks', tags: [] }, { title: 'Clock', tags: [] }), 1);
});
T('avoidCheck: flags category inside the rotation window, similar titles, rebuilt ideas and banned themes', () => {
  const h = { inventions: [{ id: 'x', date: '2026-01-01', title: 'Lunar Garden', category: 'alpha', tags: ['moon', 'plants'], ideaId: 'i1' }] };
  const cfg = L.config();
  assert.ok(L.avoidCheck({ title: 'Other', category: 'alpha', tags: [] }, h, cfg).some(p => p.startsWith('category')));
  assert.deepEqual(L.avoidCheck({ title: 'Other', category: 'beta', tags: [] }, h, cfg), []);
  assert.ok(L.avoidCheck({ title: 'Lunar Gardens', category: 'beta', tags: ['moon'] }, h, cfg).some(p => p.startsWith('too similar')));
  assert.ok(L.avoidCheck({ title: 'X', category: 'beta', tags: [], ideaId: 'i1' }, h, cfg).some(p => p.includes('already built')));
  assert.ok(L.avoidCheck({ title: 'Space Quiz Night', category: 'beta', tags: [] }, h, cfg).some(p => p.startsWith('banned')));
});
T('pick.js is deterministic for a date and prints only one idea', () => {
  const a = sb.run('pick.js', ['--date', '2026-11-06', '--json']).stdout, b = sb.run('pick.js', ['--date', '2026-11-06', '--json']).stdout;
  assert.equal(JSON.parse(a).idea.id, JSON.parse(b).idea.id);
  const text = sb.run('pick.js', ['--date', '2026-11-06']).stdout;
  assert.equal((text.match(/Zorb Gadget/g) || []).length, 1, 'only the chosen title appears');
});
T('pick.js --claim reserves the idea and a later run resumes it', () => {
  const first = JSON.parse(sb.run('pick.js', ['--date', '2026-11-06', '--claim', '--json']).stdout).idea.id;
  const again = JSON.parse(sb.run('pick.js', ['--date', '2026-12-25', '--json']).stdout);
  assert.equal(again.idea.id, first); assert.equal(again.resumed, true);
  const bl = JSON.parse(fs.readFileSync(sb.backlogFile)); assert.equal(bl.ideas.find(i => i.id === first).status, 'claimed');
  assert.equal(fs.statSync(sb.backlogFile).mode & 0o777, 0o600, 'backlog stays mode 600');
});
T('add-to-history refuses a folder that has no passing check', () => {
  sb.run('new.js', ['--id', 'idea-1', '--date', '2026-11-06']);
  const dir = path.join(sb.root, 'workshop', fs.readdirSync(path.join(sb.root, 'workshop'))[0]);
  const r = sb.run('add-to-history.js', [dir, '--reveal', 'One. Two.'], false);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /check/);
});
T('add-to-history refuses when files changed after the check (stale check)', () => {
  const dir = path.join(sb.root, 'workshop', fs.readdirSync(path.join(sb.root, 'workshop'))[0]);
  sb.fakeCheck(dir, Date.now() - 60000);
  const r = sb.run('add-to-history.js', [dir, '--reveal', 'One here. Two here.'], false);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /changed after/);
  fs.rmSync(path.join(sb.root, 'workshop'), { recursive: true });
});
T('add-to-history enforces a 2–3 sentence reveal', () => {
  sb.run('new.js', ['--id', 'idea-1', '--date', '2026-11-06']);
  const dir = path.join(sb.root, 'workshop', fs.readdirSync(path.join(sb.root, 'workshop'))[0]); sb.fakeCheck(dir);
  assert.notEqual(sb.run('add-to-history.js', [dir, '--reveal', 'Just one sentence.'], false).status, 0);
  assert.notEqual(sb.run('add-to-history.js', [dir, '--reveal', 'A. B. C. D.'], false).status, 0);
  fs.rmSync(path.join(sb.root, 'workshop'), { recursive: true });
});
T('a full cycle records history, marks the idea built, writes the reveal and lists it in the gallery', () => {
  const r = ship(sb, 'idea-1', '2026-11-06'); assert.equal(r.status, 0, r.stderr);
  const h = sb.read('data/history.json'); assert.equal(h.inventions.length, 1);
  const e = h.inventions[0];
  for (const k of ['date', 'title', 'category', 'tags', 'link', 'rating', 'feedback']) assert.ok(k in e, 'history has ' + k);
  assert.match(e.link, /inventions\/2026-11-06-/);
  assert.equal(JSON.parse(fs.readFileSync(sb.backlogFile)).ideas.find(i => i.id === 'idea-1').status, 'built');
  assert.ok(fs.existsSync(path.join(sb.root, 'gallery', 'inventions', e.id, 'index.html')));
  assert.ok(fs.existsSync(path.join(sb.root, 'data', 'reveals', e.id + '.md')));
  assert.ok(fs.readFileSync(path.join(sb.root, 'gallery', 'index.html'), 'utf8').includes(`inventions/${e.id}/`));
  assert.ok(!fs.existsSync(path.join(sb.root, 'workshop', e.id)), 'draft moved out of workshop');
});
T('rotation: the next pick avoids the category just used', () => {
  const used = sb.read('data/history.json').inventions[0].category;
  // release the earlier claim so selection runs fresh
  const bl = JSON.parse(fs.readFileSync(sb.backlogFile)); bl.ideas.forEach(i => { if (i.status === 'claimed') i.status = 'new'; }); fs.writeFileSync(sb.backlogFile, JSON.stringify(bl), { mode: 0o600 });
  for (const d of ['2026-11-13', '2026-11-20', '2026-11-27', '2027-01-08']) assert.notEqual(JSON.parse(sb.run('pick.js', ['--date', d, '--json']).stdout).idea.category, used);
});
T('add-to-history blocks a same-category invention next week (unless --force)', () => {
  const r = ship(sb, 'idea-5', '2026-11-13'); // idea-5 is the same category as idea-1
  assert.notEqual(r.status, 0); assert.match(r.stderr, /Avoid-repeating/);
  fs.rmSync(path.join(sb.root, 'workshop'), { recursive: true });
});
T('rotation relaxes when every remaining idea is in a recent category', () => {
  const sb2 = sandbox(); const bl = JSON.parse(fs.readFileSync(sb2.backlogFile));
  bl.ideas.forEach(i => { if (i.category !== 'alpha') i.status = 'retired'; }); fs.writeFileSync(sb2.backlogFile, JSON.stringify(bl), { mode: 0o600 });
  fs.writeFileSync(path.join(sb2.root, 'data', 'history.json'), JSON.stringify({ inventions: [{ id: 'old', date: '2026-01-01', title: 'Nothing Alike', category: 'alpha', tags: ['q'], link: '', status: 'revealed', rating: null, feedback: null }] }));
  const out = JSON.parse(sb2.run('pick.js', ['--date', '2026-11-06', '--json']).stdout);
  assert.equal(out.idea.category, 'alpha'); assert.equal(out.rotationRelaxedTo, 0);
});
T('gallery lists only inventions already revealed (future reveal times stay hidden)', () => {
  const r = ship(sb, 'idea-2', '2026-11-20', ['--reveal-at', '2099-01-01T00:00:00Z']); assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(path.join(sb.root, 'gallery', 'index.html'), 'utf8');
  const h = sb.read('data/history.json');
  assert.ok(html.includes(`inventions/${h.inventions[0].id}/`));
  assert.ok(!html.includes(`inventions/${h.inventions[1].id}/`), 'scheduled reveal not listed yet');
});
T('feedback.js stores the rating, updates history and rewrites only the AUTO block of PREFERENCES.md', () => {
  const id = sb.read('data/history.json').inventions[0].id;
  sb.run('feedback.js', [id, '--rating', '5', '--note', 'Loved the colours', '--like', 'shiny']);
  const h = sb.read('data/history.json').inventions[0]; assert.equal(h.rating, 5); assert.equal(h.feedback, 'Loved the colours');
  assert.equal(sb.read('data/feedback.json').entries.length, 1);
  const md = fs.readFileSync(path.join(sb.root, 'PREFERENCES.md'), 'utf8');
  assert.ok(md.includes('hand-written'), 'human section kept'); assert.ok(md.includes('Loved the colours')); assert.ok(md.includes('shiny')); assert.ok(!md.includes('\nold\n'));
  assert.notEqual(sb.run('feedback.js', [id, '--rating', '9'], false).status, 0, 'rating range enforced');
});
T('preferences boost categories and tags he rated highly', () => {
  const L2 = sb.lib(); const p = L2.preferences();
  const cat = sb.read('data/history.json').inventions[0].category;
  assert.equal(p.catAvg[cat], 5); assert.ok(p.tagScore.shiny > 0);
});
T('validate.js spoiler guard: clean repo passes, a leaked unbuilt idea title fails', () => {
  cp.execFileSync('git', ['init', '-q'], { cwd: sb.root });
  const line = out => out.split('\n').find(l => l.includes('no unbuilt backlog idea appears'));
  assert.match(line(sb.run('validate.js', [], false).stdout), /✓/);
  fs.writeFileSync(path.join(sb.root, 'NOTES.md'), 'Next up: Zorb Gadget ' + 'L' + '11'); // title built at runtime so this file itself doesn't trip the guard
  assert.match(line(sb.run('validate.js', [], false).stdout), /✗/);
  fs.rmSync(path.join(sb.root, 'NOTES.md'));
});
T('validate.js checks that the gallery index links only revealed inventions', () => {
  const out = sb.run('validate.js', [], false).stdout;
  assert.match(out.split('\n').find(l => l.includes('gallery index links only revealed')), /✓/);
  assert.match(out.split('\n').find(l => l.includes('every gallery folder is recorded')), /✓/);
});
fs.rmSync(sb.root, { recursive: true, force: true }); fs.rmSync(path.dirname(sb.backlogFile), { recursive: true, force: true });
console.log(`\n${fail ? 'TESTS FAILED' : 'ALL TESTS PASSED'}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
