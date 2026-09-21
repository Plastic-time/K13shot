const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
let active = 0, peak = 0, fail = false, empty = false, fetched = 0;
function mock(file, exports) {
  const id = require.resolve(`../src/${file}`);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
mock("1-extract_tree_div", { fetchTreeHTML: async () => { fetched++; return "fixture"; } });
mock("2-extract_rank_tb", { extract_rank_tb: () => empty ? [] : [{ researchable_vehicles: [
  Array.from({ length: 10 }, (_, i) => ({ type: "single", data_unit_id: `fixture_${i}` }))
] }] });
mock("3-request_details", { request_details: async (id, { signal }) => {
  signal.throwIfAborted();
  active++; peak = Math.max(peak, active);
  try {
    await new Promise(resolve => setTimeout(resolve, 8));
    signal.throwIfAborted();
    if (fail) throw new Error("Fixture failure");
    return { rp: 1, sp: 2 };
  } finally { active--; }
} });
const { updateTree, validateLimit } = require("../src/4-fill_tree_details");

test("update queue safety and atomic writes using memory-only fixtures", async t => {
  let writes = 0, renames = 0;
  const dir = path.resolve(__dirname, "../database/usa");
  const target = path.join(dir, "usa_ground.json");
  t.mock.method(fs, "mkdirSync", value => assert.equal(value, dir));
  t.mock.method(fs, "writeFileSync", (file, content, options) => {
    assert.ok(file.startsWith(target + ".") && file.endsWith(".tmp"));
    assert.equal(options.flag, "wx");
    assert.ok(JSON.parse(content)[0].researchable_vehicles[0].every(unit => unit.details));
    writes++;
  });
  t.mock.method(fs, "renameSync", (from, to) => { assert.equal(to, target); renames++; });
  t.mock.method(fs, "rmSync", () => {});
  t.mock.method(console, "log", () => {});

  for (const limit of [-1, 0, 9, NaN, Infinity, null, true, [], {}, "bad"]) {
    assert.throws(() => validateLimit(limit));
    await assert.rejects(updateTree("usa", "ground", { limit }), { statusCode: 400 });
  }
  assert.equal(fetched, 0);
  await assert.rejects(updateTree("../", "ground"), { statusCode: 400 });
  const pending = updateTree("usa", "ground", { limit: 2, showProgress: false });
  await assert.rejects(updateTree("usa", "ground"), { statusCode: 409 });
  await pending;
  assert.equal(peak, 2);
  assert.equal(writes, 1);
  assert.equal(renames, 1);
  fail = true;
  await assert.rejects(updateTree("usa", "ground", { attempts: 1, showProgress: false }));
  assert.equal(active, 0);
  assert.equal(writes, 1);
  fail = false;
  empty = true;
  await assert.rejects(updateTree("usa", "ground", { showProgress: false }));
  assert.equal(writes, 1);
  empty = false;
  await assert.rejects(updateTree("usa", "ground", { signal: AbortSignal.abort(), showProgress: false }));
  assert.equal(writes, 1);
  await updateTree("usa", "ground", { limit: 8, showProgress: false });
  assert.equal(renames, 2);
});
