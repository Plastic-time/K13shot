const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {once} = require('node:events');
const express = require('express');
const {chromium} = require('playwright');

async function main() {
  const output = path.resolve('logs/ka29-check');
  fs.mkdirSync(output, {recursive: true});
  const app = express();
  app.use('/pages', express.static(path.resolve('docs')));
  app.use(require('../main'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome', headless: true});
    for (const mode of ['local', 'pages']) {
      const page = await browser.newPage({viewport: {width: 1440, height: 900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('wt-research:modifications:ka_29', JSON.stringify({selected: ['il_28sh_s24'], researched: []})));
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode === 'pages' ? 'pages/' : ''}`, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('.unit-tile') && window.ModificationWorkbench);
      await page.evaluate(() => ModificationWorkbench.open('ka_29'));
      await page.waitForFunction(() => document.getElementById('modificationDialog').open);
      assert.equal(await page.locator('.modification-tile').count(), 17);
      assert.equal(await page.locator('[data-mod-id="il_28sh_s24"]').count(), 0);
      assert.equal(await page.locator('#modificationRp').innerText(), '0');
      for (const [id, expectedRp, expectedSl] of [
        ['new_compressor_heli', '9,800', '14,000'],
        ['cd_98_main_rotor', '17,000', '25,000'],
        ['hp_105_jet', '15,000', '22,000'],
        ['new_heli_cover', '48,000', '71,000']
      ]) {
        await page.locator(`[data-mod-id="${id}"]`).click();
        assert.equal(await page.locator('#modificationRp').innerText(), expectedRp);
        assert.equal(await page.locator('#modificationSl').innerText(), expectedSl);
        await page.locator('[data-modification-action="clear"]').click();
      }
      await page.locator('[data-modification-action="all"]').click();
      assert.equal(await page.locator('#modificationRp').innerText(), '297,800');
      assert.equal(await page.locator('#modificationSl').innerText(), '436,000');
      await page.waitForFunction(() => [...document.querySelectorAll('.modification-tile img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({path: path.join(output, mode + '.png')});
      await page.locator('[data-modification-action="clear"]').click();
      await page.locator('[data-mod-id="mi_24_su_9M114"]').click();
      await page.locator('[data-modification-action="calculate"]').click();
      assert(await page.locator('[data-mod-id="yak_38_b8m1"]').evaluate(node => node.classList.contains('dependency')));
      assert.equal(await page.locator('[data-mod-id="il_28sh_s24"]').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(JSON.stringify({mode, mods: 17, rp: 297800, sl: 436000, singleTierCosts: true, staleSelectionIgnored: true, passed: true}));
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
