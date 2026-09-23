(() => {
  "use strict";
  const t = (source, params = {}) => window.WTI18n?.t(source, params)
    ?? source.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
  const badge = document.getElementById("onlineCount");
  const endpoint = document.currentScript?.dataset.endpoint;
  if (!badge) return;
  const KEY = "k13shot:online:v1";
  const LOCK = "k13shot:online-heartbeat:v1";
  const INTERVAL = 30000;
  const MAX_AGE = 90000;
  const IDLE_ID_AGE = 1800000;
  const validId = id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  const messages = {
    connecting: "\u5f53\u524d\u5728\u7ebf\uff1a\u8fde\u63a5\u4e2d",
    unavailable: "\u5f53\u524d\u5728\u7ebf\uff1a\u6682\u4e0d\u53ef\u7528",
    paused: "\u5f53\u524d\u5728\u7ebf\uff1a\u6682\u505c\u66f4\u65b0",
  };
  let timer;
  let controller;
  let busy = false;
  let stopped = false;
  let storageWorks = true;
  let owner;
  let lastStatus = "connecting", lastCount;
  function show(status, count) {
    lastStatus = status;
    lastCount = count;
    const text = status === "online" ? t("\u5f53\u524d\u5728\u7ebf\uff1a{count} \u4eba", { count }) : t(messages[status]);
    badge.dataset.state = status;
    if (badge.textContent !== text) badge.textContent = text;
  }
  document.addEventListener("wt-language-change", () => show(lastStatus, lastCount));
  function read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    let state;
    try { state = JSON.parse(raw); } catch { return {}; }
    if (!state || typeof state !== "object" || Array.isArray(state)) return {};
    const now = Date.now();
    if (!Number.isFinite(state.lastActiveAt) || state.lastActiveAt > now) return {};
    return {
      id: validId(state.id) && now - state.lastActiveAt < IDLE_ID_AGE ? state.id : undefined,
      lastActiveAt: state.lastActiveAt,
      nextAt: Number.isFinite(state.nextAt) && state.nextAt <= now + 86400000 ? state.nextAt : 0,
      resultAt: Number.isFinite(state.resultAt) && state.resultAt <= now ? state.resultAt : 0,
      count: Number.isInteger(state.count) && state.count >= 0 && state.count <= 512 ? state.count : undefined,
      failures: Number.isInteger(state.failures) ? Math.min(10, Math.max(0, state.failures)) : 0,
      error: state.error === true,
      owner: validId(state.owner) ? state.owner : undefined,
      leaseUntil: Number.isFinite(state.leaseUntil) && state.leaseUntil <= now + 15000 ? state.leaseUntil : 0,
    };
  }
  function write(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  function render(state) {
    if (document.hidden) return show("paused");
    if (!navigator.onLine || !storageWorks || state.error) return show("unavailable");
    if (state.count !== undefined && Date.now() - state.resultAt < MAX_AGE) return show("online", state.count);
    show(state.resultAt ? "unavailable" : "connecting");
  }
  function failStorage() {
    storageWorks = false;
    controller?.abort();
    clearTimeout(timer);
    show("unavailable");
  }
  async function heartbeat() {
    let state = read();
    render(state);
    if (document.hidden || stopped || !navigator.onLine || Date.now() < state.nextAt) return;
    state = { ...state, id: state.id || crypto.randomUUID(), lastActiveAt: Date.now(), nextAt: Date.now() + INTERVAL };
    write(state);
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 8000);
    let retryAfter = 0;
    try {
      const response = await fetch(endpoint, {
        method: "POST", mode: "cors", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ visitorId: state.id }), signal: controller.signal,
      });
      const retry = Number(response.headers.get("Retry-After"));
      if (Number.isFinite(retry) && retry > 0) retryAfter = Math.min(86400000, retry * 1000);
      if (!response.ok) throw Error("Counter unavailable");
      const result = await response.json();
      if (!Number.isInteger(result.online) || result.online < 0 || result.online > 512) throw Error("Invalid count");
      state = { ...state, count: result.online, resultAt: Date.now(), error: false, failures: 0 };
      write(state);
      render(state);
    } catch {
      if (document.hidden || stopped) return;
      state.failures = Math.min(10, (state.failures || 0) + 1);
      state.error = true;
      state.nextAt = Date.now() + Math.max(retryAfter, Math.min(300000, INTERVAL * 2 ** (state.failures - 1)));
      write(state);
      render(state);
    } finally {
      clearTimeout(timeout);
      controller = undefined;
    }
  }
  async function withLease() {
    const state = read();
    if (state.leaseUntil > Date.now() && state.owner !== owner) return render(state);
    write({ ...state, lastActiveAt: state.lastActiveAt || Date.now(), owner, leaseUntil: Date.now() + 10000 });
    // A recheck lets simultaneous tabs settle on one owner without blocking scrolling.
    await new Promise(resolve => setTimeout(resolve, 80));
    if (read().owner !== owner) return;
    try { await heartbeat(); }
    finally {
      const latest = read();
      if (latest.owner === owner) write({ ...latest, leaseUntil: 0 });
    }
  }
  async function tick() {
    if (busy || stopped || document.hidden || !storageWorks) return;
    clearTimeout(timer);
    busy = true;
    try {
      render(read());
      if (navigator.onLine) {
        if (navigator.locks?.request) {
          await navigator.locks.request(LOCK, { ifAvailable: true }, async lock => { if (lock) await heartbeat(); });
        } else {
          await withLease();
        }
      }
    } catch { failStorage(); }
    finally {
      busy = false;
      if (!stopped && !document.hidden && storageWorks) timer = setTimeout(tick, 5000);
    }
  }
  try {
    if (!endpoint || new URL(endpoint).protocol !== "https:" || location.origin !== "https://plastic-time.github.io") {
      show("unavailable");
      return;
    }
    owner = crypto.randomUUID();
    const probe = KEY + ":probe:" + owner;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    window.addEventListener("storage", event => {
      if (event.key === KEY && storageWorks) {
        try { render(read()); } catch { failStorage(); }
      }
    });
    document.addEventListener("visibilitychange", () => {
      clearTimeout(timer);
      if (document.hidden) { controller?.abort(); show("paused"); }
      else void tick();
    });
    window.addEventListener("pagehide", () => { stopped = true; clearTimeout(timer); controller?.abort(); });
    window.addEventListener("pageshow", () => { stopped = false; void tick(); });
    window.addEventListener("online", () => { void tick(); });
    window.addEventListener("offline", () => { controller?.abort(); show("unavailable"); });
    if (document.hidden) show("paused");
    else void tick();
  } catch { failStorage(); }
})();
