const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../docs/online-count.js'), 'utf8');
const KEY = 'k13shot:online:v1';

function harness() {
  let now = Date.UTC(2026, 8, 21, 12), sequence = 0;
  const timers = new Map(), tabs = [], requests = [], visitors = new Map();
  let mode = 'ok';
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  const group = () => ({ values: new Map(), locked: false, tabs: [] });
  function open(storage = group(), options = {}) {
    const events = { window: new Map(), document: new Map() };
    const badge = { dataset: {}, textContent: '' };
    const tab = { storage, badge, hidden: Boolean(options.hidden), closed: false, online: true, errors: [], requests: 0 };
    tab.emit = (target, type, event = {}) => {
      for (const fn of events[target].get(type) || []) { try { fn(event); } catch (e) { tab.errors.push(e); } }
    };
    const listen = target => (type, fn) => {
      const handlers = events[target].get(type) || [];
      handlers.push(fn); events[target].set(type, handlers);
    };
    const setTimer = (fn, delay = 0) => {
      const id = ++sequence; timers.set(id, { fn, at: now + delay, tab }); return id;
    };
    const localStorage = {
      getItem: key => { if (options.blockStorage) throw Error('Storage denied'); return storage.values.get(key) || null; },
      setItem: (key, value) => {
        if (options.blockStorage) throw Error('Storage denied');
        const oldValue = storage.values.get(key); storage.values.set(key, value);
        if (oldValue !== value) queueMicrotask(() => {
          for (const other of storage.tabs) if (other !== tab && !other.closed) other.emit('window', 'storage', { key });
        });
      },
      removeItem: key => storage.values.delete(key),
    };
    const navigator = {
      get onLine() { return tab.online; },
      locks: options.noLocks ? undefined : { request: async (_key, _options, callback) => {
        if (storage.locked) return callback(null);
        storage.locked = true;
        try { return await callback({}); } finally { storage.locked = false; }
      } },
    };
    const document = {
      get hidden() { return tab.hidden; },
      getElementById: () => badge,
      currentScript: { dataset: { endpoint: options.noEndpoint ? '' : 'https://counter.example/heartbeat' } },
      addEventListener: listen('document'),
    };
    const context = vm.createContext({
      document, navigator, window: { addEventListener: listen('window') }, localStorage,
      location: { origin: options.origin || 'https://plastic-time.github.io' },
      crypto: { randomUUID }, Date: class extends Date { static now() { return now; } },
      URL, AbortController, setTimeout: setTimer, clearTimeout: id => timers.delete(id),
      fetch: async (url, init) => {
        tab.requests++;
        requests.push({ url, init, at: now });
        assert.equal(init.headers['Content-Type'], 'text/plain;charset=UTF-8');
        assert.equal(init.credentials, 'omit');
        assert.equal(init.referrerPolicy, 'no-referrer');
        const payload = JSON.parse(init.body);
        assert.deepEqual(Object.keys(payload), ['visitorId']);
        if (mode === 'hang') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('Aborted')), { once: true }));
        if (mode === 'offline') throw Error('Network unavailable');
        if (mode === 'quota') return new Response('{}', { status: 503, headers: { 'Retry-After': '3600' } });
        if (mode === 'invalid') return new Response('{"online":"<script>"}');
        for (const [id, seen] of visitors) if (now - seen >= 90000) visitors.delete(id);
        visitors.set(payload.visitorId, now);
        return new Response(JSON.stringify({ online: visitors.size, intervalSeconds: 30, timeoutSeconds: 90 }));
      },
    });
    storage.tabs.push(tab); tabs.push(tab);
    vm.runInContext(source, context);
    tab.setVisible = value => { tab.hidden = !value; tab.emit('document', 'visibilitychange'); };
    tab.close = () => {
      tab.closed = true; tab.emit('window', 'pagehide');
      for (const [id, timer] of timers) if (timer.tab === tab) timers.delete(id);
    };
    return tab;
  }
  async function advance(ms) {
    const target = now + ms;
    await settle();
    while (true) {
      const next = [...timers].filter(([, t]) => !t.tab.closed && t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]);
      try { const result = next[1].fn(); if (result?.catch) result.catch(e => next[1].tab.errors.push(e)); }
      catch (e) { next[1].tab.errors.push(e); }
      await settle();
    }
    now = target; await settle();
    for (const tab of tabs) assert.equal(tab.errors.length, 0, 'Unhandled client exception');
  }
  return { open, group, advance, requests, mode: value => { mode = value; } };
}

test('separate browsers count separately; tabs share one ID and one heartbeat interval', async () => {
  const h = harness(), storage = h.group();
  const a = h.open(storage), b = h.open(storage);
  await h.advance(1);
  assert.equal(h.requests.length, 1);
  assert.equal(a.badge.textContent, '\u5f53\u524d\u5728\u7ebf\uff1a1 \u4eba');
  assert.equal(b.badge.textContent, a.badge.textContent);
  const c = h.open(); await h.advance(1);
  assert.equal(c.badge.textContent, '\u5f53\u524d\u5728\u7ebf\uff1a2 \u4eba');
  await h.advance(30000);
  assert.equal(h.requests.length, 4);
  assert.equal(a.badge.textContent, c.badge.textContent);
  assert.equal(b.badge.textContent, c.badge.textContent);
  assert.equal(new Set(h.requests.map(r => JSON.parse(r.init.body).visitorId)).size, 2);
});

test('closing one tab does not remove its active sibling; closed browsers expire', async () => {
  const h = harness(), storage = h.group();
  const a = h.open(storage), b = h.open(storage), c = h.open();
  await h.advance(1); a.close(); await h.advance(30000);
  assert.match(b.badge.textContent, /2 /);
  c.close(); await h.advance(100000);
  assert.match(b.badge.textContent, /1 /);
});

test('background tabs pause, visible siblings take over and returning tabs resume', async () => {
  const h = harness(), storage = h.group();
  const a = h.open(storage), b = h.open(storage);
  await h.advance(1); a.setVisible(false); await h.advance(30000);
  assert.equal(h.requests.length, 2);
  assert.equal(a.badge.dataset.state, 'paused');
  b.setVisible(false); await h.advance(100000);
  assert.equal(h.requests.length, 2);
  a.setVisible(true); await h.advance(1);
  assert.equal(h.requests.length, 3);
  assert.equal(a.badge.dataset.state, 'online');
});

test('network failures display unavailable and back off without reporting zero', async () => {
  const h = harness(); h.mode('offline'); const a = h.open();
  await h.advance(1); assert.equal(a.badge.dataset.state, 'unavailable');
  await h.advance(120000); assert.equal(h.requests.length, 3);
  assert(!a.badge.textContent.includes('0'));
  h.mode('ok'); await h.advance(90000); assert.equal(a.badge.dataset.state, 'online');
});

test('server retry-after survives reload and idle ID expiration', async () => {
  const h = harness(); h.mode('quota'); const storage = h.group(); const a = h.open(storage);
  await h.advance(1); a.close(); await h.advance(1900000);
  const b = h.open(storage); await h.advance(1000);
  assert.equal(h.requests.length, 1);
  assert.equal(b.badge.dataset.state, 'unavailable');
  h.mode('ok'); await h.advance(1800000); assert.equal(b.badge.dataset.state, 'online');
});

test('fallback lease de-duplicates simultaneous tabs without Web Locks', async () => {
  const h = harness(), storage = h.group();
  const a = h.open(storage, { noLocks: true }), b = h.open(storage, { noLocks: true });
  await h.advance(200); assert.equal(h.requests.length, 1);
  await h.advance(31000); assert.equal(h.requests.length, 2);
  assert.equal(a.badge.textContent, b.badge.textContent);
  assert.equal(new Set(h.requests.map(r => JSON.parse(r.init.body).visitorId)).size, 1);
});

test('blocked storage, local previews and unset configuration do not send requests', async () => {
  for (const options of [{ blockStorage: true }, { origin: 'http://localhost:3000' }, { noEndpoint: true }]) {
    const h = harness(); const a = h.open(h.group(), options); await h.advance(90000);
    assert.equal(h.requests.length, 0);
    assert.equal(a.badge.dataset.state, 'unavailable');
  }
});

test('invalid stored data recovers, but invalid server data is never rendered as HTML', async () => {
  const h = harness(), storage = h.group(); storage.values.set(KEY, '{broken'); h.mode('invalid');
  const a = h.open(storage); await h.advance(1);
  assert.equal(a.badge.dataset.state, 'unavailable');
  assert(!a.badge.textContent.includes('<script>'));
});

test('hung requests time out and release the shared tab lock', async () => {
  const h = harness(), storage = h.group(); h.mode('hang');
  const a = h.open(storage), b = h.open(storage); await h.advance(9000);
  assert.equal(a.badge.dataset.state, 'unavailable');
  assert.equal(b.badge.dataset.state, 'unavailable');
  assert.equal(storage.locked, false);
  h.mode('ok'); await h.advance(35000);
  assert.equal(b.badge.dataset.state, 'online');
});
