const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ammunitionArt } = require("./modification-icons.cjs");

const root = path.resolve(__dirname, "..");
const catalogPath = "database/modifications/catalog.json";
const catalog = JSON.parse(fs.readFileSync(path.join(root, "docs", catalogPath), "utf8"));
const pending = [];
const assets = new Set();
const report = { vehicles: 0, shells: 0, belts: 0, beltGroups: 0, unresolved: [] };
for (const [key, meta] of Object.entries(catalog.chunks)) {
  const content = fs.readFileSync(path.join(root, "docs", meta.path));
  assert.equal(crypto.createHash("sha256").update(content).digest("hex"), meta.sha256);
  assert.deepEqual(content, fs.readFileSync(path.join(root, "public", meta.path)));
  const chunk = JSON.parse(content);
  for (const vehicle of Object.values(chunk.v)) {
    const ammoMods = vehicle.m.filter(mod => ["tank_ammo.png", "ammo.png", "apdsfs_tank.png"].includes(mod[6]));
    if (!ammoMods.length) continue;
    const html = fs.readFileSync(path.join(root, "logs/wiki-refresh/units", `${vehicle.i}.html`), "utf8");
    const art = ammunitionArt(html, vehicle.i);
    let changed = false;
    for (const mod of ammoMods) {
      if (!art.has(mod[0])) {
        mod.splice(12);
        report.unresolved.push({ vehicle: vehicle.i, mod: mod[0], name: mod[5] });
        continue;
      }
      mod[12] = art.get(mod[0]);
      for (const item of [mod[12], ...(mod[12].v || [])]) for (const file of [...item.b, ...item.d]) assets.add(file);
      report[mod[12].v ? "beltGroups" : mod[12].b.length > 1 ? "belts" : "shells"]++;
      changed = true;
    }
    if (changed) report.vehicles++;
  }
  const original = JSON.parse(content);
  const nonVisual = structuredClone(chunk);
  for (const [id, vehicle] of Object.entries(nonVisual.v)) vehicle.m.forEach((mod, i) => {
    mod.splice(12);
    if (original.v[id].m[i][12]) mod.push(original.v[id].m[i][12]);
  });
  assert.deepEqual(nonVisual, original, `${key}: non-visual data changed`);
  const updated = `${JSON.stringify(chunk)}\n`;
  if (updated === content.toString()) continue;
  meta.bytes = Buffer.byteLength(updated);
  meta.sha256 = crypto.createHash("sha256").update(updated).digest("hex");
  pending.push([meta.path, updated]);
  console.log(`${key}: artwork extracted`);
}
pending.push([catalogPath, `${JSON.stringify(catalog)}\n`]);
for (const directory of ["docs", "public"]) {
  for (const [file, content] of pending) fs.writeFileSync(path.join(root, directory, file), content);
}
fs.writeFileSync(path.join(root, "tools/ammunition-icon-audit.json"), JSON.stringify({ ...report, assets: [...assets].sort() }, null, 2) + "\n");
console.log(JSON.stringify({ ...report, unresolved: report.unresolved.length, assets: assets.size }));
