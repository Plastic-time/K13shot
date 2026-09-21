const { randomBytes, timingSafeEqual } = require("node:crypto");

const isLoopback = address => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);

function createSecurity(env = process.env) {
  const host = env.WT_HOST || "127.0.0.1";
  if (!["127.0.0.1", "::1", "0.0.0.0"].includes(host)) throw new Error("Invalid WT_HOST");
  const local = isLoopback(host);
  const originValue = env.WT_PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL;
  let publicOrigin;
  if (!local) {
    const url = new URL(originValue || "");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.origin !== originValue) {
      throw new Error("WT_PUBLIC_ORIGIN must be a canonical HTTP(S) origin");
    }
    publicOrigin = url;
  }
  const configuredToken = env.WT_ADMIN_TOKEN || "";
  if (configuredToken && Buffer.byteLength(configuredToken) < 32) throw new Error("WT_ADMIN_TOKEN must contain at least 32 bytes");
  const token = local ? randomBytes(32).toString("hex") : configuredToken;
  const updatesEnabled = local || (env.WT_ENABLE_UPDATES === "1" && !!configuredToken);
  let activeUpdate = false;
  let nextUpdate = 0;
  let activeNetwork = 0;
  let networkWindow = 0;
  let networkCount = 0;
  const deny = (res, status, error) => res.status(status).json({ success: false, error });

  function guard(req, res, next) {
    res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" });
    const port = req.socket.localPort;
    const hosts = local ? [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`] : [publicOrigin.host];
    if (local && (port === 80 || port === 443)) hosts.push("127.0.0.1", "localhost", "[::1]");
    if (!hosts.includes(req.headers.host?.toLowerCase()) || (local && !isLoopback(req.socket.remoteAddress))) {
      return deny(res, 403, "Request host is not allowed");
    }
    const origin = req.get("origin");
    const origins = local ? hosts.map(value => `http://${value}`) : [publicOrigin.origin];
    if ((origin && !origins.includes(origin)) || req.get("sec-fetch-site") === "cross-site") {
      return deny(res, 403, "Cross-site requests are not allowed");
    }
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  }

  function session(req, res) {
    if (!local) return deny(res, 403, "Remote updates require an administrator token");
    res.json({ success: true, token });
  }

  function authorizeUpdate(req, res, next) {
    if (!updatesEnabled) return deny(res, 403, "Updates are disabled on this server");
    const supplied = Buffer.from(req.get("x-wt-update-token") || "");
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return deny(res, 403, "Update authorization required");
    }
    if (!req.is("application/json")) return deny(res, 415, "Expected application/json");
    next();
  }

  function beginUpdate() {
    if (activeUpdate || Date.now() < nextUpdate) return false;
    activeUpdate = true;
    nextUpdate = Date.now() + 60000;
    return true;
  }

  function networkLimit(req, res, next) {
    const now = Date.now();
    if (now >= networkWindow) { networkWindow = now + 60000; networkCount = 0; }
    if (activeNetwork >= 2 || networkCount >= 20) {
      res.set("Retry-After", "60");
      return deny(res, 429, "Too many upstream requests; try again later");
    }
    networkCount++;
    activeNetwork++;
    // Release only after upstream work finishes, even if the client disconnects.
    res.locals.releaseNetwork = () => { activeNetwork--; };
    next();
  }

  return { host, guard, session, authorizeUpdate, beginUpdate, networkLimit,
    endUpdate: () => { activeUpdate = false; } };
}

function safeError(res, error) {
  const status = error.type === "entity.too.large" ? 413
    : error.type === "entity.parse.failed" ? 400
    : [400, 404, 409, 429, 504].includes(error.statusCode) ? error.statusCode : 500;
  const messages = { 400: "Invalid request", 404: "Requested data was not found", 409: "An update is already running",
    413: "Request body is too large", 429: "Too many requests; try again later", 504: "Update timed out" };
  return res.status(status).json({ success: false, error: messages[status] || "Request failed; please try again later" });
}

module.exports = { createSecurity, safeError };
