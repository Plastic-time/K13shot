import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { handleRequest } from "../src/handler.mjs";

const origin = "https://plastic-time.github.io";
function fixture() {
  let calls = 0;
  const env = {
    ALLOWED_ORIGIN: origin,
    IP_LIMITER: { limit: async () => ({ success: true }) },
    VISITOR_LIMITER: { limit: async () => ({ success: true }) },
    ONLINE: { getByName(name) {
      assert.equal(name, "k13shot-global-v1");
      return { heartbeat: async () => { calls++; return { status: 200, body: { online: 2, intervalSeconds: 30, timeoutSeconds: 90 } }; } };
    } },
  };
  return { env, calls: () => calls };
}
function request(body = JSON.stringify({ visitorId: randomUUID() }), extra = {}) {
  return new Request("https://counter.example/heartbeat", {
    method: "POST", body,
    headers: { Origin: origin, "Content-Type": "text/plain", "CF-Connecting-IP": "192.0.2.1", ...extra },
  });
}

test("simple POST returns the count and exact CORS origin, never credentials or caching", async () => {
  const { env, calls } = fixture();
  const response = await handleRequest(request(), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).online, 2);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Retry-After");
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(calls(), 1);
});

test("foreign, suffix-spoofed and missing origins cannot call storage", async () => {
  const { env, calls } = fixture();
  for (const value of ["null", "https://example.com", origin + ".example.com", ""]) {
    const response = await handleRequest(request(undefined, { Origin: value }), env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  const missing = request(); missing.headers.delete("Origin");
  assert.equal((await handleRequest(missing, env)).status, 403);
  assert.equal(calls(), 0);
});

test("preflight only allows POST with content-type and does not touch storage", async () => {
  const { env, calls } = fixture();
  const options = (method, headers) => new Request("https://counter.example/heartbeat", { method: "OPTIONS", headers: {
    Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers,
  } });
  assert.equal((await handleRequest(options("POST", "content-type"), env)).status, 204);
  assert.equal((await handleRequest(options("DELETE", "content-type"), env)).status, 403);
  assert.equal((await handleRequest(options("POST", "authorization"), env)).status, 403);
  assert.equal(calls(), 0);
});

test("bad payloads, unknown fields, oversized streams and unsupported media types are rejected", async () => {
  const { env, calls } = fixture();
  for (const body of ["bad json", "null", "[]", "{}", JSON.stringify({ visitorId: randomUUID(), extra: true })]) {
    assert.equal((await handleRequest(request(body), env)).status, 400);
  }
  assert.equal((await handleRequest(request("x".repeat(257)), env)).status, 413);
  assert.equal((await handleRequest(request(undefined, { "Content-Length": "9999" }), env)).status, 413);
  assert.equal((await handleRequest(request(undefined, { "Content-Type": "text/html" }), env)).status, 415);
  assert.equal(calls(), 0);
});

test("network and visitor throttles both reject before hitting shared storage", async () => {
  for (const binding of ["IP_LIMITER", "VISITOR_LIMITER"]) {
    const { env, calls } = fixture();
    env[binding].limit = async () => ({ success: false });
    const response = await handleRequest(request(), env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(calls(), 0);
  }
});

test("unavailable bindings/storage return a CORS-readable generic error, not internals", async () => {
  const { env } = fixture();
  env.ONLINE.getByName = () => { throw Error("private internal exception"); };
  const response = await handleRequest(request(), env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(await response.json(), { error: "unavailable" });
  delete env.IP_LIMITER;
  assert.equal((await handleRequest(request(), env)).status, 503);
});

test("missing platform IP fails closed, health and unknown routes never touch storage", async () => {
  const { env, calls } = fixture();
  const missing = request(); missing.headers.delete("CF-Connecting-IP");
  assert.equal((await handleRequest(missing, env)).status, 503);
  const health = await handleRequest(new Request("https://counter.example/health"), env);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "k13shot-online");
  assert.equal((await handleRequest(new Request("https://counter.example/"), env)).status, 404);
  assert.equal((await handleRequest(new Request("https://counter.example/heartbeat", { headers: { Origin: origin } }), env)).status, 405);
  assert.equal(calls(), 0);
});

test("daily budget errors preserve retry timing without exposing stored visitors", async () => {
  const { env } = fixture();
  env.ONLINE.getByName = () => ({ heartbeat: async () => ({ status: 503, retryAfter: 3600, body: { error: "daily_budget_reached" } }) });
  const response = await handleRequest(request(), env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "3600");
  assert.deepEqual(await response.json(), { error: "daily_budget_reached" });
});
