const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const planner = require("../docs/modification-planner.js");

const root = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "docs", "database", "modifications");
const publicRoot = path.join(root, "public", "database", "modifications");
const hash = content => crypto.createHash("sha256").update(content).digest("hex");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));

function normalize(raw) {
  return {
    vehicleId: raw.i,
    vehicleName: { zh: raw.n[0], en: raw.n[1] },
    vehicleIcon: raw.v,
    tierRequirements: { 1: raw.r[0], 2: raw.r[1], 3: raw.r[2] },
    totals: { rp: raw.t[0], sl: raw.t[1] },
    categories: raw.c.map((category, index) => ({
      id: String(index), name: { zh: category[0], en: category[1] }, columns: category[2],
    })),
    mods: raw.m.map(mod => ({
      id: mod[0], category: String(mod[1]), tier: mod[2], column: mod[3],
      name: { zh: mod[4], en: mod[5] }, icon: mod[6], rp: mod[7], sl: mod[8],
      ge: mod[9], requires: mod[10], order: mod[11],
    })),
  };
}

const docsCatalogPath = path.join(docsRoot, "catalog.json");
const publicCatalogPath = path.join(publicRoot, "catalog.json");
assert.deepEqual(fs.readFileSync(docsCatalogPath), fs.readFileSync(publicCatalogPath), "Catalog copies differ");
const catalog = readJson(docsCatalogPath);
assert.equal(catalog.schema, 2);
assert.deepEqual(catalog.stats, { treeUnits: 3235, vehicles: 3225, modifications: 52430, chunks: 44 });
assert.equal(Object.keys(catalog.vehicles).length, catalog.stats.vehicles);
assert.equal(Object.keys(catalog.chunks).length, catalog.stats.chunks);

const vehicles = new Map();
let modificationCount = 0;
for (const [chunkKey, meta] of Object.entries(catalog.chunks)) {
  const filename = `${chunkKey}.json`;
  const docsContent = fs.readFileSync(path.join(docsRoot, filename));
  const publicContent = fs.readFileSync(path.join(publicRoot, filename));
  assert.deepEqual(docsContent, publicContent, `${chunkKey}: docs/public copies differ`);
  assert.equal(docsContent.length, meta.bytes, `${chunkKey}: byte count differs`);
  assert.equal(hash(docsContent), meta.sha256, `${chunkKey}: SHA-256 differs`);
  const chunk = JSON.parse(docsContent);
  assert.equal(chunk.s, 2, `${chunkKey}: wrong schema`);
  assert.equal(chunk.k, chunkKey, `${chunkKey}: wrong key`);
  assert.equal(Object.keys(chunk.v).length, meta.vehicles, `${chunkKey}: wrong vehicle count`);

  let chunkModificationCount = 0;
  for (const [vehicleId, raw] of Object.entries(chunk.v)) {
    assert.equal(raw.i, vehicleId, `${vehicleId}: mismatched ID`);
    assert.equal(catalog.vehicles[vehicleId], chunkKey, `${vehicleId}: wrong catalog chunk`);
    const data = normalize(raw);
    const byId = new Map(data.mods.map(mod => [mod.id, mod]));
    assert(data.mods.length > 0, `${vehicleId}: empty modification tree`);
    assert.equal(byId.size, data.mods.length, `${vehicleId}: duplicate modification ID`);
    assert(data.vehicleName.zh && data.vehicleName.en, `${vehicleId}: missing vehicle name`);
    assert(data.categories.length > 0, `${vehicleId}: missing categories`);
    assert.deepEqual(data.totals, {
      rp: data.mods.reduce((sum, mod) => sum + mod.rp, 0),
      sl: data.mods.reduce((sum, mod) => sum + mod.sl, 0),
    }, `${vehicleId}: totals differ`);
    for (const value of Object.values(data.tierRequirements)) assert(Number.isInteger(value) && value >= 0, `${vehicleId}: invalid tier requirement`);
    for (const mod of data.mods) {
      const category = data.categories[Number(mod.category)];
      assert(category, `${vehicleId}/${mod.id}: unknown category`);
      assert(Number.isInteger(mod.tier) && mod.tier >= 1 && mod.tier <= 4, `${vehicleId}/${mod.id}: invalid tier`);
      assert(Number.isInteger(mod.column) && mod.column >= 0 && mod.column < category.columns, `${vehicleId}/${mod.id}: invalid column`);
      assert(mod.name.zh && mod.name.en, `${vehicleId}/${mod.id}: missing name`);
      assert(mod.icon, `${vehicleId}/${mod.id}: missing icon`);
      assert(Number.isFinite(mod.rp) && mod.rp >= 0 && Number.isFinite(mod.sl) && mod.sl >= 0, `${vehicleId}/${mod.id}: invalid cost`);
      for (const requirement of mod.requires) {
        assert(byId.has(requirement), `${vehicleId}/${mod.id}: unknown dependency ${requirement}`);
      }
    }
    vehicles.set(vehicleId, data);
    chunkModificationCount += data.mods.length;
  }
  assert.equal(chunkModificationCount, meta.modifications, `${chunkKey}: wrong modification count`);
  modificationCount += chunkModificationCount;
}

assert.equal(vehicles.size, catalog.stats.vehicles);
assert.equal(modificationCount, catalog.stats.modifications);

for (const vehicleId of ["us_m2a4", "j_16", "ah_1g", "us_destroyer_clemson_litchfield", "us_pt6"]) {
  const data = vehicles.get(vehicleId);
  assert(data, `${vehicleId}: representative vehicle missing`);
  const highestTier = Math.max(...data.mods.map(mod => mod.tier));
  const target = [...data.mods].reverse().find(mod => mod.tier === highestTier);
  const result = planner.plan(data, [target.id], []);
  assert(result.includedIds.includes(target.id), `${vehicleId}: planner omitted target`);
  assert(result.rp >= target.rp && result.sl >= target.sl, `${vehicleId}: planner budget is too low`);
}

const j16 = vehicles.get("j_16");
assert.equal(j16.mods.length, 25);
assert.deepEqual(j16.tierRequirements, { 1: 1, 2: 3, 3: 3 });
assert.deepEqual(j16.totals, { rp: 315000, sl: 482000 });
const pl12a = planner.plan(j16, ["cn_pl12a"], []);
assert.deepEqual({ rp: pl12a.rp, sl: pl12a.sl }, { rp: 110000, sl: 168000 });

const audit = readJson(path.join(root, "tools", "modifications-audit.json"));
assert.equal(catalog.stats.vehicles + audit.withoutTables, catalog.stats.treeUnits);
assert.deepEqual({
  missingWiki: audit.missingWiki,
  withoutTables: audit.withoutTables,
  missingGameConfig: audit.missingGameConfig,
  missingGameMods: audit.missingGameMods,
}, { missingWiki: 0, withoutTables: 10, missingGameConfig: 0, missingGameMods: 5 });
assert(audit.samples.withoutTables.every(id => !catalog.vehicles[id]), "No-table components must not expose a modification button");

console.log(JSON.stringify({
  version: catalog.version,
  vehicles: vehicles.size,
  modifications: modificationCount,
  chunks: catalog.stats.chunks,
  withoutTables: audit.withoutTables,
  wikiFallbackMods: audit.missingGameMods,
  pass: true,
}));
