const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'logs/tree-zoom-check');
  fs.mkdirSync(artifacts, { recursive: true });
  const app = express();
  app.use('/pages', express.static(path.join(root, 'docs')));
  app.use(require('../main'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const route of ['/', '/pages/']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
      await page.waitForSelector('.unit-tile');
      await page.waitForFunction(() => [...document.querySelectorAll('.unit-tile img')].slice(0, 6).every(img => img.complete && img.naturalWidth > 0));
      const session = await page.context().newCDPSession(page);
      const prefix = route === '/' ? 'desktop' : 'web';
      const plan = await page.evaluate(() => JSON.stringify({ planned: [...state.planned], owned: [...state.owned], result: state.planResult }));
      const headings = await page.locator('.tree-headings .band-title').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, border: parseFloat(style.borderLeftWidth) };
      }));
      assert.equal(headings.length, 2);
      for (const heading of headings) assert(heading.border >= 3 && heading.background !== 'rgba(0, 0, 0, 0)');

      async function check(label) {
        await page.waitForTimeout(150);
        const geometry = await page.evaluate(() => {
          const v = visualViewport;
          const tree = document.getElementById('treeContainer').getBoundingClientRect();
          const rect = id => {
            const r = document.getElementById(id).getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          };
          return {
            scale: v.scale, offset: [v.offsetLeft, v.offsetTop],
            left: Math.max(tree.left, v.offsetLeft), right: Math.min(tree.right, v.offsetLeft + v.width),
            top: Math.max(tree.top, v.offsetTop), bottom: Math.min(tree.bottom, v.offsetTop + v.height),
            h: rect('treeScrollBar'), v: rect('treeVerticalScrollBar'), corner: rect('treeScrollCorner'),
            hidden: document.getElementById('treeScrollBar').hidden,
          };
        });
        const near = (a, b) => assert(Math.abs(a - b) < 1, `${label}: ${a} != ${b}`);
        assert(!geometry.hidden, label);
        near(geometry.h.left, geometry.left);
        near(geometry.h.bottom, geometry.bottom);
        near(geometry.v.right, geometry.right);
        near(geometry.v.top, geometry.top);
        near(geometry.h.right, geometry.v.left);
        near(geometry.v.bottom, geometry.h.top);
        near(geometry.v.width * geometry.scale, 17);
        near(geometry.h.height * geometry.scale, 17);
        await page.screenshot({ path: path.join(artifacts, `${prefix}-${label}.png`) });
        console.log(JSON.stringify({ route, label, geometry }));
      }

      await check('normal');
      await page.evaluate(() => { const tree = document.getElementById('treeContainer'); tree.scrollLeft = tree.scrollWidth; });
      await check('premium');
      await page.evaluate(() => { document.getElementById('treeContainer').scrollLeft = 0; });
      for (const scale of [1.5, 2, 3]) {
        await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale });
        await page.waitForFunction(scale => Math.abs(visualViewport.scale - scale) < 0.01, scale);
        await check(`zoom-${scale}`);
        const point = await page.evaluate(() => ({ x: visualViewport.width / 2, y: visualViewport.height * 0.7 }));
        await session.send('Input.synthesizeScrollGesture', { ...point, xDistance: -40, yDistance: -80, gestureSourceType: 'touch' });
        await check(`pan-${scale}`);
      }
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      await check('restored');
      await page.locator('#treeVerticalScrollRange').focus();
      await page.keyboard.press('End');
      assert(await page.evaluate(() => document.getElementById('treeContainer').scrollTop > 100));
      await page.keyboard.press('Home');
      assert.equal(await page.evaluate(() => document.getElementById('treeContainer').scrollTop), 0);
      assert.equal(await page.evaluate(() => JSON.stringify({ planned: [...state.planned], owned: [...state.owned], result: state.planResult })), plan);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(JSON.stringify({ pinchZoom: true, categoryBands: true, planUnchanged: true, pass: true }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
