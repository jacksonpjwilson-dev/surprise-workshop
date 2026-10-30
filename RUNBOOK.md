# Weekly Surprise Inventor runbook

This is the exact procedure for the weekly run. **One bounded AI run per week, 3 hours maximum.** Scripts handle selection, testing, bookkeeping and the gallery. The AI does only the creative part: designing and building one invention, then writing the reveal.

Project: `/workspace/projects/surprise-inventor` (local git, **no remote, never push**).
Private backlog: `/home/box/shared/inventor/backlog.json` (outside the repo, mode 600). **Never** copy its contents into the repo, a page, a reveal or a report. Never mention ideas that haven't been built yet.

## Hard rules (from Jackson)
1. Content stays PG-13.
2. Preview only. No public deploys, no new GitHub repos, no pushes. Jackson must approve publishing first.
3. Never contact anyone. The only outgoing message is the reveal to Jackson, sent by the parent agent or routine through its normal channel.
4. Never spend money. Use no paid APIs, accounts, assets or hosting. An invention must be a static, self-contained page with no network calls at all.
5. Don't make an escape room, murder mystery, quiz or trivia game, or anything close to them.
6. If a step fails twice, stop. Report what happened instead of improvising around the rule.

## Procedure
0. **Prepare.**
   - `cd /workspace/projects/surprise-inventor && git status` should be clean.
   - Run `npm run validate`. It must pass.
   - Read `PREFERENCES.md`.
   - Note any new feedback from Jackson since last week and record it first:
     `node scripts/feedback.js <inventionId> --rating N --note "…" [--like tags] [--dislike tags]`
1. **Pick.** Run `node scripts/pick.js --claim`.
   - The script applies category rotation (no category from the last 3 inventions), a similarity check against history (title and tags, Jaccard ≥ 0.34 is rejected), the banned-themes check and learned preferences. The choice is fixed for a given date, so reruns pick the same idea.
   - If an earlier run left an idea "claimed", the script resumes that idea.
   - Use the pick as a starting point. You have full creative freedom over the final title and design, as long as it stays in the same category and spirit.
2. **Scaffold.** Run `node scripts/new.js --id <ideaId> [--title "Final Title"]`.
   - This creates `workshop/YYYY-MM-DD-slug/` (git-ignored, so drafts never reach the repo).
3. **Build** in that folder:
   - Inline HTML/CSS/JS in `index.html`. Extra local files are allowed: own SVG/PNG, generated audio, small JS modules.
   - No CDNs, web fonts, APIs, trackers, forms, `mailto:` links or storage of anything beyond `localStorage`.
   - Mobile first: it must work at 390px wide with touch, and on a desktop with a mouse.
   - Audio starts only after a user tap and has a mute toggle. Respect `prefers-reduced-motion` where practical.
   - Include a short "how to play/use" line, and a `← Gallery` link to `../../`.
   - Fill in `meta.json`: `blurb` (one sentence for the gallery card) and `controls`.
   - Write `test.js` with real interaction checks (click/tap things, assert something changed). Leave no `console.error` behind.
   - Keep the total under 2 MB.
4. **Test.** Run `node scripts/check.js workshop/<folder>` until it passes.
   - The check covers:
     - static rules: self-contained, no external URLs, no secrets, no contact mechanisms, a PG-13 word screen, no banned themes, the size budget, valid meta
     - headless Chromium at 1280×800 and at 390×844 with touch: loads, has content, no horizontal overflow, `test.js` passes, no external requests (they are blocked and counted), no JS errors
   - Screenshots go to `shots/desktop.png` and `shots/mobile-390.png`.
   - **Look at both screenshots yourself** and fix anything ugly, cut off or broken. Then re-run the check.
   - Optional: `node scripts/check.js workshop/<folder> --browser webkit` for the Safari engine.
5. **Add to history and the gallery.** Run:
   `node scripts/add-to-history.js workshop/<folder> --reveal "<2–3 sentences>"`
   - The script refuses if `check.json` is missing, failed or older than your last edit. It also refuses if the reveal isn't 2–3 sentences, or if the avoid-repeating check fails.
   - It moves the folder into `gallery/inventions/`, appends to `data/history.json`, marks the backlog idea as built, saves `data/reveals/<folder>.md` and rebuilds `gallery/index.html`. The index only shows revealed inventions.
6. **Validate and commit.**
   - Run `npm run validate && npm test`.
   - Then run `git add -A && git -c user.name="Grok Bot" -c user.email="grokbot@localhost" commit -m "Invention: <title>"`.
   - **Never `git push`.** There is no remote, and none may be added without Jackson's approval.
7. **Reveal.** Hand back the reveal text from step 5 (2–3 sentences plus the link) as the run's final output. The parent agent or routine sends it to Jackson. Include:
   - the local path
   - the screenshot path (`gallery/inventions/<folder>/shots/mobile-390.png`)
   - the check result line
   Don't mention the backlog or what's coming next.

## Reveal style
- 2–3 sentences, playful, no spoilers of how it works beyond a hook. End with what to try first.
- Link: `http://localhost:4173/inventions/<folder>/`. To view it, run `npm run preview` on the box, or open `gallery/inventions/<folder>/index.html` directly. Once the gallery is published (with Jackson's approval), set `baseUrl` in `data/config.json` and links will point to the public site.

## Housekeeping
- To fix an invention after it's in the gallery: edit it in `gallery/inventions/<folder>/`, re-run `node scripts/check.js gallery/inventions/<folder>`, then run `node scripts/build-gallery.js` and `npm run validate`, then commit.
- Setup on a fresh or restored box: run `npm install`. If browsers are missing, run `npx playwright-core install chromium` (add `webkit` and `sudo npx playwright-core install-deps webkit` for the optional Safari pass).
- When `validate` warns that fewer than 8 unbuilt ideas remain, add fresh, original ideas to the backlog. Give each an id, title, category from the list, 3+ tags, a pitch, an effort level and `"status": "new"`. Spread them across categories, and don't add banned themes.
- If Jackson reacts to a reveal, record it with `scripts/feedback.js`. Add any lasting taste notes to the hand-written section of `PREFERENCES.md`.
- If a run fails part-way, the idea stays "claimed" and next week's `pick.js` resumes it. A half-built draft in `workshop/` can be continued or deleted.
