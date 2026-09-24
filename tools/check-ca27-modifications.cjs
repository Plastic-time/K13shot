const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {once} = require('node:events');
const express = require('express');
const {chromium} = require('playwright');
const {vehicleIds} = require('./update-ca27-modifications.cjs');

async function main() {
  const output = path.resolve('logs/ca27-check');
  fs.mkdirSync(output, {recursive: true});
  const app = express();
  app.use('/pages', express.static(path.resolve('docs')));
  app.use(require('../main'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome', headless: true});
    for (const mode of ['local', 'pages']) for (const id of vehicleIds) {
      const page = await browser.newPage({viewport: {width: 1440, height: 900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(id => {
        const key = `wt-research:modifications:${id}`;
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({selected: ['frc_mk2'], researched: []}));
      }, id);
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode === 'pages' ? 'pages/' : ''}`, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('.unit-tile') && window.ModificationWorkbench);
      await page.evaluate(id => ModificationWorkbench.open(id), id);
      await page.waitForFunction(() => document.getElementById('modificationDialog').open);
      const rack = page.locator('[data-mod-id="gloster_lbc"]');
      assert.equal(await page.locator('.modification-tile').count(), 14);
      assert.equal(await page.locator('[data-mod-id="frc_mk2"]').count(), 0);
      assert(await rack.evaluate(node => node.classList.contains('target')));
      assert.equal(await page.locator('#modificationRp').innerText(), '9,000');
      assert.equal(await page.locator('#modificationSl').innerText(), '14,000');
      assert((await rack.locator('img').getAttribute('src')).endsWith('/pilon_bomb.png'));
      await page.locator('[data-modification-action="calculate"]').click();
      assert(await page.locator('[data-mod-id="fmbc_mk2"]').evaluate(node => node.classList.contains('dependency')));
      await page.locator('[data-modification-action="all"]').click();
      assert.equal(await page.locator('#modificationRp').innerText(), '145,800');
      assert.equal(await page.locator('#modificationSl').innerText(), '226,000');
      await page.waitForFunction(() => [...document.querySelectorAll('.modification-tile img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({path: path.join(output, `${mode}-${id}.png`)});
      await page.evaluate(id => localStorage.setItem(`wt-research:modifications:${id}`, JSON.stringify({selected: [], researched: ['frc_mk2']})), id);
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('.unit-tile') && window.ModificationWorkbench);
      await page.evaluate(id => ModificationWorkbench.open(id), id);
      await page.waitForFunction(() => document.querySelector('[data-mod-id="gloster_lbc"]')?.classList.contains('researched'));
      assert.equal(await page.locator('#modificationRp').innerText(), '0');
      assert.equal(await page.locator('#modificationSl').innerText(), '0');
      assert.deepEqual(errors, []);
      await page.close();
      console.log(JSON.stringify({mode, id, oldSelectedAndResearchedPreserved: true, passed: true}));
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
