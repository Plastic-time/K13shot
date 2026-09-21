import { INTERVAL_SECONDS, TIMEOUT_SECONDS, validVisitor } from "./presence.mjs";

const MAX_BODY_BYTES = 256;
class BodyError extends Error {
  constructor(status) { super("Invalid heartbeat"); this.status = status; }
}

async function readVisitor(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) throw new BodyError(413);
  const type = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "text/plain" && type !== "application/json") throw new BodyError(415);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyError(413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(text); } catch { throw new BodyError(400); }
  if (!body || Object.keys(body).length !== 1 || !validVisitor(body.visitorId)) throw new BodyError(400);
  return body.visitorId;
}

export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = Boolean(env.ALLOWED_ORIGIN) && origin === env.ALLOWED_ORIGIN;
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin);
  const respond = (body, status = 200, extra = {}) => new Response(status === 204 ? null : JSON.stringify(body), {
    status, headers: new Headers([...headers, ...Object.entries(extra)]),
  });
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") {
    return respond({ ok: true, service: "k13shot-online", intervalSeconds: INTERVAL_SECONDS, timeoutSeconds: TIMEOUT_SECONDS });
  }
  if (path !== "/heartbeat") return respond({ error: "not_found" }, 404);
  if (!allowed) return respond({ error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") {
    const requested = (request.headers.get("Access-Control-Request-Headers") || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    if (request.headers.get("Access-Control-Request-Method") !== "POST" || requested.some(h => h !== "content-type")) {
      return respond({ error: "preflight_not_allowed" }, 403);
    }
    return respond(null, 204, { "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" });
  }
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405, { Allow: "POST, OPTIONS" });
  try {
    // Used only by the platform's transient limiter; never stored in the presence database.
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return respond({ error: "unavailable" }, 503, { "Retry-After": "60" });
    if (!(await env.IP_LIMITER.limit({ key: ip })).success) {
      return respond({ error: "rate_limited" }, 429, { "Retry-After": "60" });
    }
    const visitorId = await readVisitor(request);
    if (!(await env.VISITOR_LIMITER.limit({ key: visitorId })).success) {
      return respond({ error: "rate_limited" }, 429, { "Retry-After": "60" });
    }
    const result = await env.ONLINE.getByName("k13shot-global-v1").heartbeat(visitorId);
    return respond(result.body, result.status, result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {});
  } catch (error) {
    if (error instanceof BodyError) return respond({ error: "invalid_request" }, error.status);
    return respond({ error: "unavailable" }, 503, { "Retry-After": "60" });
  }
}
