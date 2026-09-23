const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {once} = require('node:events');
const express = require('express');
const {chromium} = require('playwright');

async function main() {
  const output = path.resolve('logs/wiki-loading-check');
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
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      const held = [];
      await page.route('https://wiki.warthunder.com/**', route => {
        if (route.request().url().includes('/slow-image')) {
          held.push(route);
          return;
        }
        return route.fulfill({contentType: 'text/html', body: '<html><body><h1>Wiki loading test fixture</h1><img src="/slow-image"></body></html>'});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode === 'pages' ? 'pages/' : ''}`, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => window.WikiViewer && document.querySelector('[data-wiki-id]'));
      await page.clock.install();
      await page.evaluate(() => WikiViewer.open('us_m2a4', 'M2A4'));
      await page.waitForFunction(() => document.querySelector('#wikiDialog iframe'));
      await page.evaluate(() => {window.oldWikiFrame = document.querySelector('#wikiDialog iframe');});
      await page.locator('[data-wiki-reload]').click();
      await page.evaluate(() => {
        oldWikiFrame.dispatchEvent(new Event('load'));
        oldWikiFrame.dispatchEvent(new Event('error'));
      });
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'loading');
      await page.clock.runFor(8001);
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'slow');
      assert(!(await page.locator('.wiki-load-status').innerText()).includes('正在载入'));
      assert(await page.locator('.wiki-load-status a').isVisible());
      assert.equal(await page.locator('.wiki-load-status a').getAttribute('href'), 'https://wiki.warthunder.com/unit/us_m2a4');
      await page.screenshot({path: path.join(output, `${mode}-slow.png`)});
      await page.locator('[data-wiki-close]').click();
      await page.clock.runFor(16000);
      assert.equal(await page.locator('#wikiDialog iframe').count(), 0);
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'closed');
      assert(await page.locator('.wiki-load-status').isHidden());

      // A delayed load from the previous vehicle cannot finish a new request.
      await page.evaluate(() => WikiViewer.open('us_m3_stuart', 'M3'));
      await page.evaluate(() => oldWikiFrame.dispatchEvent(new Event('load')));
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'loading');
      await page.clock.runFor(8001);
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'slow');
      assert.equal(await page.locator('.wiki-load-status a').getAttribute('href'), 'https://wiki.warthunder.com/unit/us_m3_stuart');
      await page.evaluate(() => document.querySelector('#wikiDialog iframe').dispatchEvent(new Event('error')));
      assert.equal(await page.locator('#wikiDialog').getAttribute('data-load-state'), 'error');
      assert(await page.locator('.wiki-load-status a').isVisible());
      await page.locator('[data-wiki-close]').click();
      for (const route of held) await route.abort().catch(() => {});
      await page.unroute('https://wiki.warthunder.com/**');
      await page.route('https://wiki.warthunder.com/**', route => route.fulfill({contentType: 'text/html', body: '<html><body>Loaded fixture</body></html>'}));
      await page.evaluate(() => WikiViewer.open('us_m2a4', 'M2A4'));
      await page.waitForFunction(() => document.getElementById('wikiDialog').dataset.loadState === 'loaded');
      assert(await page.locator('.wiki-load-status').isHidden());
      await page.clock.runFor(16000);
      assert(await page.locator('.wiki-load-status').isHidden());
      await page.close();
      console.log(JSON.stringify({mode, boundedLoading: true, staleEventsIgnored: true, closeCancels: true, loadedClearsStatus: true, passed: true}));
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error.stack); process.exitCode = 1;});
