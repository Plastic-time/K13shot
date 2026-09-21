const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { modificationIcon } = require("./modification-icons.cjs");

const root = path.resolve(__dirname, "..");
const catalogPath = "database/modifications/catalog.json";
const catalog = JSON.parse(fs.readFileSync(path.join(root, "docs", catalogPath), "utf8"));
const pending = [];
const report = { vehicles: 0, modifications: 0, chunks: 0 };
for (const [key, meta] of Object.entries(catalog.chunks)) {
  if (!key.endsWith("_ground")) continue;
  const content = fs.readFileSync(path.join(root, "docs", meta.path));
  assert.equal(crypto.createHash("sha256").update(content).digest("hex"), meta.sha256);
  assert.deepEqual(content, fs.readFileSync(path.join(root, "public", meta.path)));
  const chunk = JSON.parse(content);
  let changed = 0;
  for (const vehicle of Object.values(chunk.v)) {
    const html = fs.readFileSync(path.join(root, "logs/wiki-refresh/units", `${vehicle.i}.html`), "utf8");
    const tables = html.match(/<table class="game-unit_mods-table">[\s\S]*?<\/table>/g) || [];
    const $ = cheerio.load(tables.join(""));
    const icons = new Map();
    $(".game-unit_mod").each((_, element) => {
      const button = $(element);
      icons.set(button.attr("data-mod-id"), modificationIcon(key, cheerio.load(button.attr("data-feature-popover") || "")));
    });
    let vehicleChanged = false;
    for (const mod of vehicle.m) {
      if (mod[6] !== "tank_ammo.png" || icons.get(mod[0]) !== "apdsfs_tank.png") continue;
      mod[6] = "apdsfs_tank.png";
      vehicleChanged = true;
      changed++;
    }
    if (vehicleChanged) report.vehicles++;
  }
  if (!changed) continue;
  // Prove every non-icon field is untouched before writing the regenerated JSON.
  const unchanged = JSON.parse(JSON.stringify(chunk));
  const original = JSON.parse(content);
  for (const [id, vehicle] of Object.entries(unchanged.v)) {
    vehicle.m.forEach((mod, index) => { mod[6] = original.v[id].m[index][6]; });
  }
  assert.deepEqual(unchanged, original);
  const updated = `${JSON.stringify(chunk)}\n`;
  meta.bytes = Buffer.byteLength(updated);
  meta.sha256 = crypto.createHash("sha256").update(updated).digest("hex");
  pending.push([meta.path, updated]);
  report.modifications += changed;
  report.chunks++;
}
if (pending.length) {
  pending.push([catalogPath, `${JSON.stringify(catalog)}\n`]);
  for (const directory of ["docs", "public"]) {
    for (const [file, content] of pending) fs.writeFileSync(path.join(root, directory, file), content);
  }
}
console.log(JSON.stringify(report));
