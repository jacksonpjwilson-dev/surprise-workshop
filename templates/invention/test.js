// Optional interaction smoke test run by scripts/check.js at both viewports.
// `page` is a Playwright page already loaded; `viewport` is {name, width, height}. Throw (or use assert) to fail.
module.exports = async ({ page, assert, viewport }) => {
  assert.ok((await page.title()).length > 0, 'page has a title');
};
