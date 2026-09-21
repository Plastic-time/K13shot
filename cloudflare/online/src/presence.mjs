export const INTERVAL_SECONDS = 30;
export const TIMEOUT_SECONDS = 90;
export const MAX_VISITORS = 512;
export const DAILY_WRITE_LIMIT = 80000;
const MIN_WRITE_INTERVAL = 15000;
const DAY_MS = 86400000;
export const validVisitor = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export class PresenceStore {
  constructor(storage) {
    this.storage = storage;
    storage.sql.exec("CREATE TABLE IF NOT EXISTS presence (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)");
  }

  heartbeat(visitorId, now = Date.now()) {
    if (!validVisitor(visitorId)) return { status: 400, body: { error: "invalid_visitor" } };
    // One synchronous transaction prevents concurrent heartbeats overwriting each other.
    return this.storage.transactionSync(() => {
      const row = this.storage.sql.exec("SELECT payload FROM presence WHERE id = 1").toArray()[0];
      const day = Math.floor(now / DAY_MS);
      const state = row ? JSON.parse(row.payload) : { day, writes: 0, visitors: [] };
      if (state.day !== day) { state.day = day; state.writes = 0; }
      const visitors = new Map(state.visitors.filter(([, lastSeen]) => now - lastSeen < TIMEOUT_SECONDS * 1000 && lastSeen <= now));
      const lastSeen = visitors.get(visitorId);
      const result = () => ({ status: 200, body: {
        online: visitors.size, intervalSeconds: INTERVAL_SECONDS, timeoutSeconds: TIMEOUT_SECONDS,
      } });
      if (lastSeen !== undefined && now - lastSeen < MIN_WRITE_INTERVAL) return result();
      if (state.writes >= DAILY_WRITE_LIMIT) {
        return { status: 503, retryAfter: Math.max(1, Math.ceil(((day + 1) * DAY_MS - now) / 1000)), body: { error: "daily_budget_reached" } };
      }
      if (!visitors.has(visitorId) && visitors.size >= MAX_VISITORS) {
        return { status: 503, retryAfter: 60, body: { error: "capacity_reached" } };
      }
      visitors.set(visitorId, now);
      state.visitors = [...visitors];
      state.writes += 1;
      // A single bounded row avoids scanning/writing a database row for every visitor.
      this.storage.sql.exec("INSERT INTO presence (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload", JSON.stringify(state));
      return result();
    });
  }
}
