const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { chromium } = require('playwright');
const { checkVehicleUpdates } = require('./check-vehicle-updates.cjs');

async function main() {
  const artifacts = path.resolve('logs/vehicle-release-audit');
  fs.mkdirSync(artifacts, { recursive: true });
  const app = express();
  app.use('/pages', express.static(path.resolve('docs')));
  app.use(require('../main'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const mode of ['local', 'pages']) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 940 }, isMobile: width < 720, hasTouch: width < 720 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode === 'pages' ? 'pages/' : ''}`);
      await page.waitForFunction(() => document.querySelector('.unit-tile') && !document.querySelector('.country-trigger').disabled);
      await page.evaluate(() => document.fonts.ready);
      const cdp = await page.context().newCDPSession(page);
      await checkVehicleUpdates({ evaluate: expression => page.evaluate(expression), call: (method, args) => cdp.send(method, args), artifacts, suffix: `${mode}-${width}` });
      // Check every nation's complete tree, including hidden folder entries.
      for (const tree of await page.evaluate(() => Object.keys(WTVehicleUpdates.trees))) {
        const result = await page.evaluate(async tree => {
          [els.countrySelect.value, els.typeSelect.value] = tree.split('/');
          await loadTree();
          const expected = WTVehicleUpdates.trees[tree];
          return { missingUnits: expected.filter(id => !state.unitMap.has(id)),
            wrongBadges: [...document.querySelectorAll('.unit-tile')].filter(card =>
              !!card.querySelector('.unit-update-label') !== expected.includes(card.dataset.unitId)).map(card => card.dataset.unitId) };
        }, tree);
        assert.deepEqual(result, { missingUnits: [], wrongBadges: [] }, `${mode} ${tree}`);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(JSON.stringify({ mode, width, trees: 50, passed: true }));
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
