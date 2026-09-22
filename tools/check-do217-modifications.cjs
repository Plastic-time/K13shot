const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {once} = require('node:events');
const express = require('express');
const {chromium} = require('playwright');

async function main() {
  const output = path.resolve('logs/do217-check');
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
      await page.addInitScript(() => localStorage.setItem('wt-research:modifications:do_217j_2', JSON.stringify({selected: ['ju-88_4xSC250', 'flamm_250', 'ju-88_2xSC500', 'flamm_500', 'etc1000_1_mod'], researched: ['flamm_250']})));
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode === 'pages' ? 'pages/' : ''}`, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('.unit-tile') && window.ModificationWorkbench);
      await page.evaluate(() => ModificationWorkbench.open('do_217j_2'));
      await page.waitForFunction(() => document.getElementById('modificationDialog').open);
      assert.equal(await page.locator('.modification-tile').count(), 14);
      assert.equal(await page.locator('#modificationRp').innerText(), '0');
      assert.equal(await page.locator('#modificationSl').innerText(), '0');
      await page.locator('[data-mod-id="mg_belt_pack"]').click();
      assert.equal(await page.locator('#modificationRp').innerText(), '400');
      assert.equal(await page.locator('#modificationSl').innerText(), '300');
      await page.locator('[data-modification-action="all"]').click();
      assert.equal(await page.locator('#modificationRp').innerText(), '5,940');
      assert.equal(await page.locator('#modificationSl').innerText(), '4,480');
      await page.waitForFunction(() => [...document.querySelectorAll('.modification-tile img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({path: path.join(output, mode + '.png')});
      await page.locator('[data-modification-action="clear"]').click();
      await page.locator('[data-mod-id="mg131_turret_new_gun"]').click();
      await page.locator('[data-modification-action="calculate"]').click();
      assert(await page.locator('[data-mod-id="mg131_turret_belt_pack"]').evaluate(node => node.classList.contains('dependency')));
      assert.deepEqual(errors, []);
      await page.close();
      console.log(JSON.stringify({mode, mods: 14, rp: 5940, sl: 4480, staleBombSelectionsIgnored: true, passed: true}));
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
