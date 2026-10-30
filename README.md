# Surprise Inventor

Jackson's weekly autonomous surprise. Each week one bounded AI run invents and builds a small, original, self-contained web thing (a toy, a tool, a simulation, a visualization, an experiment). It goes into a static gallery, and the run hands back a 2–3 sentence reveal with a link.

- **Weekly procedure:** [RUNBOOK.md](RUNBOOK.md). This is the contract a weekly run follows.
- **Taste and rules:** [PREFERENCES.md](PREFERENCES.md). It has a hand-written part plus an auto-learned part.
- **Private idea backlog:** `/home/box/shared/inventor/backlog.json`, kept outside this repo with mode 600. It never lands in the repo or the gallery. `validate.js` checks for leaks.

## Layout
```
data/config.json         rotation window, similarity threshold, banned themes, PG-13 screen, baseUrl
data/history.json        every invention: date, title, category, tags, link, rating, feedback, reveal
data/feedback.json       Jackson's reactions (append-only)
data/reveals/*.md        the reveal text sent for each invention
gallery/                 the static site (GitHub Pages-ready: relative links, .nojekyll, no external requests)
  index.html             generated: lists ONLY revealed inventions
  inventions/YYYY-MM-DD-slug/   one self-contained folder per invention (index.html, meta.json, test.js, shots/)
workshop/                drafts in progress (git-ignored; never published)
templates/invention/     scaffold for new inventions
lib/common.js            paths, history/backlog IO, similarity + avoid-repeating check, preferences
lib/static.js            tiny 127.0.0.1-only static server (tests + preview)
scripts/                 pick, new, check, add-to-history, feedback, build-gallery, validate, preview, test-foundation
```

## Scripts
| Command | What it does |
|---|---|
| `node scripts/pick.js [--date D] [--claim] [--json] [--explain]` | Chooses this week's idea using category rotation, the similarity check against history, banned themes and learned preferences. Output is deterministic per date and prints only the chosen idea. `--claim` reserves it. |
| `node scripts/new.js --id <ideaId> [--title T] [--date D]` | Scaffolds `workshop/D-slug/` from the template. |
| `node scripts/check.js <folder> [--browser chromium\|webkit]` | Runs the static rules (self-contained, no external URLs, no secrets or contact mechanisms, PG-13, banned themes, size). Then runs headless browser checks at 1280×800 and 390×844 with touch: no overflow, no JS errors, no external requests, the folder's own `test.js`. Writes screenshots and `check.json`. |
| `node scripts/add-to-history.js <folder> --reveal "…" [--reveal-at ISO] [--force]` | Requires a passing check that is newer than the last edit, a 2–3 sentence reveal and a passing avoid-repeating check. Then it moves the folder to the gallery, updates history and the backlog, saves the reveal and rebuilds the index. |
| `node scripts/feedback.js <id> --rating 1-5 --note "…" [--like a,b] [--dislike c]` | Records a reaction. Updates history and the learned section of PREFERENCES.md. |
| `node scripts/build-gallery.js` | Regenerates `gallery/index.html` (revealed entries only). |
| `node scripts/validate.js` | Checks project integrity: no spoilers in the repo, backlog health, history schema, gallery/history consistency, rotation. |
| `node scripts/preview.js` | Serves the gallery at http://localhost:4173/ (127.0.0.1 only). |
| `npm test` | Runs the foundation unit/integration tests in a temp sandbox with a fake backlog. |

Setup on a fresh box: run `npm install`. If the browsers are missing, also run `npx playwright-core install chromium webkit` (free download from Playwright's CDN).

## Publishing (not done; needs Jackson's OK)
`gallery/` is a plain static site with relative links. It can be served by GitHub Pages from a `gh-pages` branch or a `/docs` copy, or by Cloudflare Pages. After publishing, set `baseUrl` in `data/config.json` so reveal links point to the public site.
