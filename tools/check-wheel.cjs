const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const express = require('express');

// Drive real browser input over Chrome's local debugging pipe, with no test dependency.
async function main() {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'logs', 'wheel-check');
  fs.mkdirSync(artifacts, { recursive: true });
  const app = express();
  app.use('/pages', express.static(path.join(root, 'docs')));
  app.use(require('../main'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${path.join(artifacts, `profile-${Date.now()}`)}`,
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
  let sequence = 0;
  let buffer = '';
  const pending = new Map();
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const entry = pending.get(message.id);
      if (entry) {
        pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
        else entry.resolve(message.result);
      }
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    await call('Page.enable');
    for (const width of [1440, 390]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const route of ['/pages/', '/']) {
        await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}${route}` });
        let ready = false;
        for (let i = 0; i < 100; i++) {
          ready = await evaluate('document.querySelectorAll(".unit-tile").length > 0');
          if (ready) break;
          await pause(100);
        }
        assert(ready, `Tree failed to load: ${route}`);
        if (route === '/pages/') {
          const smoke = await evaluate(`(async () => {
            const report = [];
            for (const entry of state.snapshot.files) {
              const parts = entry.path.split('/');
              const country = parts[1];
              const type = parts[2].slice(country.length + 1, -5);
              const result = await api('/api/tree/' + country + '/' + type);
              const count = result.data.flatMap(rank => [...rank.researchable_vehicles, ...rank.premium_vehicles].flat()).flatMap(item => item.items || [item]).length;
              if (count !== entry.units) throw new Error('Wrong count: ' + entry.path);
              report.push(count);
            }
            state.planned.clear();
            document.querySelector('[data-unit-id="us_m3_stuart"]').click();
            const selected = {rp: els.totalRp.textContent, sl: els.totalSp.textContent};
            els.dependencyModeSelect.value = 'dependencies';
            els.dependencyModeSelect.dispatchEvent(new Event('change'));
            const dependent = {rp: els.totalRp.textContent, sl: els.totalSp.textContent};
            els.clearButton.click();
            return {trees:report.length, units:report.reduce((a,b)=>a+b,0), selected, dependent};
          })()`);
          assert.equal(smoke.trees, 50);
          assert.equal(smoke.units, 3235);
          assert.deepEqual(smoke.selected, {rp:'2,900',sl:'700'});
          assert.deepEqual(smoke.dependent, smoke.selected);
          console.log(JSON.stringify({label:`pages-data-${width}`, ...smoke, pass:true}));
        }
        await pause(600);
        await evaluate('window.scrollTo(0, document.querySelector(".tree-container").getBoundingClientRect().top + scrollY)');
        await pause(150);
        const point = await evaluate(`(() => {
          const box = document.querySelector('.tree-container').getBoundingClientRect();
          return {x: Math.round(Math.max(0, box.left) + Math.min(box.width, innerWidth - Math.max(0, box.left)) / 2), y: 250};
        })()`);
        assert(await evaluate(`!!document.elementFromPoint(${point.x}, ${point.y}).closest('.tree-container')`), 'Pointer must be over tree');
        const position = () => evaluate('({ y: scrollY, x: document.querySelector(".tree-container").scrollLeft })');
        async function wheel(dx, dy) {
          await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
          await call('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX: dx, deltaY: dy });
          await pause(400);
        }
        // Reproduce the old regression in the same page before checking the fix.
        const oldStart = await position();
        if (width === 1440 && route === '/pages/') {
          await evaluate('document.querySelector(".tree-container").style.overscrollBehavior = "contain"');
          await pause(700);
          await wheel(0, 350);
          assert.equal((await position()).y, oldStart.y, 'Old CSS should reproduce blocked page scrolling');
        }
        const oldEnd = await position();
        await evaluate('document.querySelector(".tree-container").style.removeProperty("overscroll-behavior")');
        await call('Page.reload');
        await pause(1500);
        await evaluate('window.scrollTo(0, document.querySelector(".tree-container").getBoundingClientRect().top + scrollY)');
        await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
        await pause(700);
        await wheel(0, 350);
        const down = await position();
        assert(down.y > oldEnd.y + 100, 'Wheel down must move page');
        await wheel(0, -250);
        const up = await position();
        assert(up.y < down.y - 100, 'Wheel up must move page');
        await wheel(300, 0);
        const horizontal = await position();
        assert(horizontal.x > up.x + 100, 'Horizontal wheel must move tree');
        assert(Math.abs(horizontal.y - up.y) < 2, 'Horizontal wheel must not move page vertically');
        const screenshot = await call('Page.captureScreenshot', { format: 'png' });
        const label = `${route === '/' ? 'local' : 'pages'}-${width}`;
        fs.writeFileSync(path.join(artifacts, `${label}.png`), Buffer.from(screenshot.data, 'base64'));
        console.log(JSON.stringify({ label, blockedBefore: oldEnd.y - oldStart.y, down: down.y - oldEnd.y, up: up.y - down.y, horizontal: horizontal.x - up.x, pass: true }));
        if (route === '/pages/') {
          const extra = await evaluate(`(async () => {
            els.countrySelect.value = 'germany'; els.typeSelect.value = 'ground'; await loadTree();
            state.planned.clear();
            document.querySelector('[data-unit-id="germ_garford_putilov"]').click();
            const unknown = els.totalRp.textContent.includes('未知') && els.totalSp.textContent.includes('未知');
            const notFree = !state.initialUnlocked.has('germ_garford_putilov');
            window.scrollTo(0, 0);
            const noOverflow = [...document.querySelectorAll('.metric')].every(el => el.scrollWidth <= el.clientWidth + 1);
            els.clearButton.click();
            els.countrySelect.value = 'usa'; els.typeSelect.value = 'aviation'; await loadTree();
            const airBr = state.unitMap.get('f2a-1').br;
            return {unknown, notFree, noOverflow, airBr};
          })()`);
          assert.deepEqual(extra, {unknown:true,notFree:true,noOverflow:true,airBr:'2.0'});
          console.log(JSON.stringify({label:`pages-cases-${width}`, ...extra, pass:true}));
        }
      }
    }
  } finally {
    await send('Browser.close').catch(() => browser.kill());
    if (browser.exitCode === null) await Promise.race([once(browser, 'exit'), pause(3000)]);
    if (browser.exitCode === null) browser.kill();
    for (const entry of pending.values()) clearTimeout(entry.timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
