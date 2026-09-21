import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { PresenceStore, DAILY_WRITE_LIMIT, MAX_VISITORS, validVisitor } from "../src/presence.mjs";

function database(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  const storage = {
    sql: { exec(query, ...bindings) {
      const statement = db.prepare(query);
      const rows = statement.columns().length ? statement.all(...bindings) : (statement.run(...bindings), []);
      return { toArray: () => rows };
    } },
    transactionSync(fn) {
      db.exec("BEGIN");
      try { const result = fn(); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
  return { storage, db, store: new PresenceStore(storage) };
}
const start = Date.UTC(2026, 8, 21, 12);

test("multiple visitors share the same count, duplicate tabs do not add a visitor", t => {
  const { store, db } = database(t);
  const a = randomUUID(), b = randomUUID();
  assert.equal(store.heartbeat(a, start).body.online, 1);
  assert.equal(store.heartbeat(b, start).body.online, 2);
  assert.equal(store.heartbeat(a, start + 1000).body.online, 2);
  const state = JSON.parse(db.prepare("SELECT payload FROM presence").get().payload);
  assert.equal(state.writes, 2);
  assert.equal(state.visitors.length, 2);
  assert.equal(store.heartbeat(a, start + 30000).body.online, 2);
});

test("inactive visits expire exactly at 90 seconds, continued visits remain", t => {
  const { store } = database(t);
  const a = randomUUID(), b = randomUUID();
  store.heartbeat(a, start);
  store.heartbeat(b, start);
  assert.equal(store.heartbeat(b, start + 60000).body.online, 2);
  assert.equal(store.heartbeat(b, start + 89999).body.online, 2);
  assert.equal(store.heartbeat(b, start + 90000).body.online, 1);
  assert.equal(store.heartbeat(randomUUID(), start + 200000).body.online, 1);
});

test("reconstructing the service reads the durable state", t => {
  const { store, storage } = database(t);
  const a = randomUUID();
  store.heartbeat(a, start);
  const restarted = new PresenceStore(storage);
  assert.equal(restarted.heartbeat(randomUUID(), start + 30000).body.online, 2);
  assert.equal(restarted.heartbeat(a, start + 31000).body.online, 2);
});

test("the daily write guard resets at UTC midnight without an alarm", t => {
  const { store, db } = database(t);
  const a = randomUUID();
  store.heartbeat(a, start);
  const state = JSON.parse(db.prepare("SELECT payload FROM presence").get().payload);
  state.writes = DAILY_WRITE_LIMIT;
  db.prepare("UPDATE presence SET payload = ?").run(JSON.stringify(state));
  assert.equal(store.heartbeat(randomUUID(), start).status, 503);
  assert.equal(store.heartbeat(a, start + 30000).body.error, "daily_budget_reached");
  const nextDay = Date.UTC(2026, 8, 22);
  assert.equal(store.heartbeat(randomUUID(), nextDay).body.online, 1);
  assert.equal(JSON.parse(db.prepare("SELECT payload FROM presence").get().payload).writes, 1);
});

test("bounded capacity rejects new entries without evicting active visitors", t => {
  const { store, db } = database(t);
  const visitors = Array.from({ length: MAX_VISITORS }, () => [randomUUID(), start]);
  db.prepare("INSERT INTO presence VALUES (1, ?)").run(JSON.stringify({ day: Math.floor(start / 86400000), writes: 1, visitors }));
  assert.equal(store.heartbeat(randomUUID(), start).body.error, "capacity_reached");
  assert.equal(store.heartbeat(visitors[0][0], start + 30000).body.online, MAX_VISITORS);
  assert.equal(store.heartbeat(randomUUID(), start + 90000).body.online, 2);
});

test("invalid identifiers cannot create database entries", t => {
  const { store, db } = database(t);
  for (const id of [null, {}, "", "__proto__", "hello", "' OR 1=1", "x".repeat(500)]) {
    assert.equal(validVisitor(id), false);
    assert.equal(store.heartbeat(id, start).status, 400);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM presence").get().n, 0);
});

test("failed updates roll back and do not report a successful heartbeat", t => {
  const { storage, store } = database(t);
  const a = randomUUID();
  store.heartbeat(a, start);
  const exec = storage.sql.exec;
  storage.sql.exec = (query, ...args) => {
    if (query.startsWith("INSERT")) throw Error("storage unavailable");
    return exec(query, ...args);
  };
  assert.throws(() => store.heartbeat(randomUUID(), start), /storage unavailable/);
  storage.sql.exec = exec;
  assert.equal(store.heartbeat(a, start + 1000).body.online, 1);
});
