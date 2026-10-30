// Interaction test for The Pixel Reef, run by scripts/check.js at desktop and 390px.
module.exports = async ({ page, assert, viewport }) => {
  const st = () => page.evaluate(() => window.reef.stats());
  await page.waitForFunction(() => window.reef && window.reef.stats().tick > 3, null, { timeout: 5000 });
  const s0 = await st();
  assert.ok(s0.bub > 0, `vents are puffing bubbles (${s0.bub})`);
  assert.ok(s0.fish > 0 && s0.kelp > 0, `reef seeded with fish and kelp (${s0.fish} fish, ${s0.kelp} kelp)`);
  if (viewport.width < 600) assert.equal(s0.cols, 34, 'narrow grid on phones');

  // Pause stops time
  await page.click('#play');
  const t1 = (await st()).tick; await page.waitForTimeout(500);
  assert.equal((await st()).tick, t1, 'pause freezes the simulation');

  // Step advances exactly one generation
  await page.click('#step');
  assert.equal((await st()).tick, t1 + 1, 'step advances one tick');

  // Paint food onto the tank (food tool is the default)
  const box = await page.locator('#tank').boundingBox();
  assert.ok(box.width <= viewport.width, 'tank fits the viewport width');
  const foodBefore = (await st()).food;
  for (const fx of [0.3, 0.5, 0.7]) await page.mouse.click(box.x + box.width * fx, box.y + box.height * 0.25);
  assert.ok((await st()).food > foodBefore, 'tapping the tank drops food');

  // Fish tool adds a fish
  await page.click('[data-tool="fish"]');
  assert.equal(await page.getAttribute('[data-tool="fish"]', 'aria-pressed'), 'true', 'fish tool selected');
  const fishBefore = (await st()).fish;
  await page.mouse.click(box.x + box.width * 0.12, box.y + box.height * 0.12);
  assert.ok((await st()).fish >= fishBefore + 1, 'fish tool adds a fish');

  // Edit a rule live through its slider
  await page.locator('#rule-ventRate').fill('0');
  assert.equal(await page.evaluate(() => window.reef.rules.ventRate), 0, 'slider rewrites the vent rule');
  assert.ok((await page.locator('#rules .rule').first().textContent()).includes('%'), 'rule text renders');
  await page.locator('#rule-nibble').uncheck();
  assert.equal(await page.evaluate(() => window.reef.rules.nibble), false, 'checkbox toggles a rule');

  // Glitch scrambles rules
  const before = await page.evaluate(() => JSON.stringify(window.reef.rules));
  await page.click('#glitch');
  assert.notEqual(await page.evaluate(() => JSON.stringify(window.reef.rules)), before, 'glitch changes the rules');

  // Reset restores defaults
  await page.click('#reset');
  assert.equal(await page.evaluate(() => window.reef.rules.ventRate), 14, 'reset restores default rules');

  // Sound toggle is opt-in
  await page.click('#sound');
  assert.equal(await page.getAttribute('#sound', 'aria-pressed'), 'true', 'sound toggles on after a tap');
  await page.click('#sound');

  // Resume and let it run fast for a bit: the ecosystem must stay alive and error-free
  await page.click('#play'); await page.click('#speed'); await page.click('#speed');
  await page.waitForTimeout(2500);
  const s2 = await st();
  assert.ok(s2.tick > t1 + 40, `simulation runs (${s2.tick} ticks)`);
  assert.ok(s2.fish + s2.egg > 0 && s2.kelp > 0, 'ecosystem still alive');
  // Restore 1x speed so the screenshot shows a calm reef
  await page.click('#speed');
};
