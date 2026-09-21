import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from "miniflare";

await mkdir(".wrangler/test", { recursive: true });
const persist = await mkdtemp(resolve(".wrangler/test/runtime-"));
const options = convertV4MiniflareOptions({
  name: "k13shot-online",
  modules: true,
  scriptPath: resolve("dist/worker.js"),
  compatibilityDate: "2026-09-21",
  bindings: { ALLOWED_ORIGIN: "https://plastic-time.github.io" },
  durableObjects: { ONLINE: { className: "OnlinePresence", useSQLite: true } },
  ratelimits: {
    IP_LIMITER: { namespace_id: "131301", simple: { limit: 120, period: 60 } },
    VISITOR_LIMITER: { namespace_id: "131302", simple: { limit: 6, period: 60 } },
  },
  resourcePersistencePath: persist,
  unsafeInspectDurableObjects: true,
  cf: false,
  telemetry: { enabled: false },
  log: new Log(LogLevel.ERROR),
});
let runtime;
try {
  runtime = new Miniflare(options);
  await runtime.ready;
  const send = id => runtime.dispatchFetch("https://counter.example/heartbeat", {
    method: "POST", headers: {
      Origin: "https://plastic-time.github.io", "Content-Type": "text/plain", "CF-Connecting-IP": "192.0.2.1",
    }, body: JSON.stringify({ visitorId: id }),
  });
  const ids = Array.from({ length: 30 }, () => randomUUID());
  const concurrent = await Promise.all(ids.map(send));
  for (const response of concurrent) assert.equal(response.status, 200, await response.clone().text());
  const counts = await Promise.all(concurrent.map(async response => (await response.json()).online));
  assert.deepEqual(counts.sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1));
  const duplicates = await Promise.all(ids.slice(0, 5).flatMap(id => [send(id), send(id)]));
  for (const response of duplicates) assert.equal((await response.json()).online, 30);
  await runtime.unsafeEvictDurableObject("k13shot-online", "OnlinePresence", { name: "k13shot-global-v1" });
  assert.equal((await (await send(ids[0])).json()).online, 30);
  await runtime.dispose();
  runtime = new Miniflare(options);
  await runtime.ready;
  assert.equal((await (await send(ids[0])).json()).online, 30);
  const storage = await runtime.unsafeGetDurableObjectStorage("k13shot-online", "OnlinePresence", { name: "k13shot-global-v1" });
  const [row] = await storage.exec("SELECT payload FROM presence WHERE id = 1");
  const state = JSON.parse(row.payload);
  assert.equal(state.visitors.length, 30);
  assert.equal(state.writes, 30);
  // Simulate elapsed time in test storage, without adding any production clock/debug API.
  state.visitors = state.visitors.map(([id]) => [id, Date.now() - 91000]);
  await storage.exec("UPDATE presence SET payload = ? WHERE id = 1", JSON.stringify(state));
  assert.equal((await (await send(randomUUID())).json()).online, 1);
  const foreign = await runtime.dispatchFetch("https://counter.example/heartbeat", {
    method: "POST", headers: { Origin: "https://example.com", "Content-Type": "text/plain" }, body: JSON.stringify({ visitorId: randomUUID() }),
  });
  assert.equal(foreign.status, 403);
  console.log(JSON.stringify({ runtime: "workerd", concurrentVisitors: 30, duplicateTabs: true, eviction: true, restartPersistence: true, expiration: true, originRejected: true, passed: true }));
} finally {
  if (runtime) await runtime.dispose();
}
