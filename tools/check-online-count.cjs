const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const artifacts = path.join(root, 'logs/online-count-check');
const site = 'https://plastic-time.github.io/warthunder-research-calculator/';
const endpoint = 'https://k13shot-online.k13shot-tools.workers.dev/heartbeat';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--disable-gpu', '--disable-features=SkiaGraphite,UseDComp,Vulkan', '--use-angle=swiftshader'] });
  const errors = [];
  async function context(width, backend) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await ctx.route(site + '**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname.slice('/warthunder-research-calculator/'.length));
      const file = path.resolve(docs, pathname || 'index.html');
      if (!file.startsWith(docs + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ path: file });
    });
    if (backend) await ctx.route(endpoint, backend);
    return ctx;
  }
  const loaded = page => page.waitForFunction(() => document.querySelectorAll('.unit-tile').length > 0);
  const online = page => page.waitForFunction(() => document.getElementById('onlineCount').dataset.state === 'online');
  const count = page => page.locator('#onlineCount').innerText();
  async function checkLayout(page, width) {
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const badge = document.getElementById('onlineCount');
      const r = badge.getBoundingClientRect();
      const tree = document.getElementById('treeContainer').getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar').getBoundingClientRect();
      const title = document.querySelector('.topbar h1').getBoundingClientRect();
      const actions = document.querySelector('.topbar-actions').getBoundingClientRect();
      const status = document.getElementById('statusText').getBoundingClientRect();
      const overlaps = b => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      return { fits: r.left >= 0 && r.right <= innerWidth && badge.scrollWidth <= badge.clientWidth + 1,
        notOverlapping: !overlaps(title) && !overlaps(actions), treeBelowToolbar: tree.top >= toolbar.bottom - 1,
        alignedWithVehicleCount: status.right <= r.left && Math.abs((status.top + status.bottom) - (r.top + r.bottom)) <= 2,
        treeHeight: tree.height, text: badge.textContent };
    });
    assert(layout.fits && layout.notOverlapping && layout.alignedWithVehicleCount && layout.treeBelowToolbar && layout.treeHeight > 430, JSON.stringify(layout));
    await page.screenshot({ path: path.join(artifacts, `online-${width}.png`) });
    return layout;
  }
  try {
    if (process.env.WT_ONLINE_LIVE === '1') {
      const a = await context(1440), b = await context(390);
      const first = await a.newPage();
      const requests = [];
      first.on('request', r => { if (r.url() === endpoint) requests.push(r.method()); });
      await first.goto(site, { waitUntil: 'domcontentloaded' }); await online(first); await loaded(first);
      const firstCount = await count(first);
      const second = await b.newPage();
      await second.goto(site, { waitUntil: 'domcontentloaded' }); await online(second); await loaded(second);
      const twoCount = await count(second);
      assert.equal(parseInt(twoCount.replace(/\D/g, ''), 10), parseInt(firstCount.replace(/\D/g, ''), 10) + 1);
      const duplicate = await b.newPage();
      let duplicateRequests = 0;
      duplicate.on('request', r => { if (r.url() === endpoint) duplicateRequests++; });
      await duplicate.goto(site, { waitUntil: 'domcontentloaded' }); await online(duplicate);
      assert.equal(await count(duplicate), twoCount);
      await delay(1500); assert.equal(duplicateRequests, 0);
      await duplicate.close();
      await checkLayout(first, 1440); await checkLayout(second, 390);
      await a.close();
      console.log(JSON.stringify({ phase: 'live-connected', firstCount, twoCount, duplicateDidNotReport: true }));
      await delay(125000);
      const remaining = await count(second);
      assert.equal(parseInt(remaining.replace(/\D/g, ''), 10), parseInt(twoCount.replace(/\D/g, ''), 10) - 1);
      assert(!requests.includes('OPTIONS'), 'Simple heartbeat must not require preflight');
      await b.close();
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ live: true, remaining, expiration: true, noPreflight: true, passed: true }));
      return;
    }

    const mockHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://plastic-time.github.io',
      'Access-Control-Expose-Headers': 'Retry-After', 'Cache-Control': 'no-store' };
    for (const width of [1440, 900, 390, 320]) {
      const ctx = await context(width, route => route.fulfill({ status: 200, headers: mockHeaders, body: '{"online":7}' }));
      const page = await ctx.newPage();
      await page.goto(site, { waitUntil: 'domcontentloaded' }); await loaded(page); await online(page);
      const layout = await checkLayout(page, width);
      if (width <= 720) await page.locator('#mobileMoreButton').click();
      await page.locator('#guideButton').click();
      assert(await page.locator('#usageGuideDialog').isVisible());
      console.log(JSON.stringify({ width, layout, guideWorks: true }));
      await ctx.close();
    }
    const failing = await context(390, route => route.fulfill({ status: 503, headers: { ...mockHeaders, 'Retry-After': '300' }, body: '{"error":"unavailable"}' }));
    const page = await failing.newPage();
    await page.goto(site, { waitUntil: 'domcontentloaded' }); await loaded(page);
    await page.waitForFunction(() => document.getElementById('onlineCount').dataset.state === 'unavailable');
    const before = await page.locator('#budgetCount').innerText();
    await page.locator('.unit-tile[data-unit-id]:not(.unlocked):not(.premium)').first().click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(previous => document.getElementById('budgetCount').textContent !== previous, before);
    await page.screenshot({ path: path.join(artifacts, 'counter-unavailable-calculator-working.png') });
    await failing.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ unavailableDoesNotBlockCalculator: true, passed: true }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
