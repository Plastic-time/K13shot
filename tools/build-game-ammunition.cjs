const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const catalog = require("../docs/database/modifications/catalog.json");
const audit = require("./ammunition-icon-audit.json");
const ref = catalog.sources.datamineCommit;
const cache = path.join(root, "logs/ammunition-game", ref);
const base = `https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/${ref}/`;

async function readRemote(file) {
  assert(/^[a-z0-9_./-]+\.blkx$/i.test(file) && !file.includes(".."));
  const local = path.join(cache, file);
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local));
  const response = await fetch(base + file, { signal: AbortSignal.timeout(20000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Game source returned ${response.status}`);
  const data = await response.json();
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, JSON.stringify(data));
  return data;
}

function weaponPaths(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (typeof value.blk === "string" && /^gamedata\/weapons\/[^.]+\.blk$/i.test(value.blk)) {
    output.add(`aces.vromfs.bin_u/${value.blk.toLowerCase()}x`);
  }
  for (const child of Object.values(value)) if (typeof child === "object") weaponPaths(child, output);
  return output;
}

function presetPaths(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (typeof value.blk === "string" && /^gamedata\/.*\/weaponpresets\/[^.]+\.blk$/i.test(value.blk)) {
    output.add(`aces.vromfs.bin_u/${value.blk.toLowerCase()}x`);
  }
  for (const child of Object.values(value)) if (typeof child === "object") presetPaths(child, output);
  return output;
}

async function main() {
  const gui = await readRemote("aces.vromfs.bin_u/config/gui.blkx");
  const config = await readRemote("char.vromfs.bin_u/config/modifications.blkx");
  const modelNames = new Map();
  for (const folder of ["flightmodels", "units/tankmodels", "units/ships"]) {
    const models = path.join(root, "logs/datamine/aces.vromfs.bin_u/gamedata", folder);
    for (const file of fs.readdirSync(models)) modelNames.set(file.toLowerCase(), path.join(models, file));
  }
  const result = {};
  const targets = new Map(audit.unresolved.map(item => [`${item.vehicle}:${item.mod}`, item]));
  const publishedArt = new Map();
  for (const meta of Object.values(catalog.chunks)) {
    for (const vehicle of Object.values(require(path.join(root, "docs", meta.path)).v)) {
      for (const row of vehicle.m) if (row[12]?.source) {
        targets.set(`${vehicle.i}:${row[0]}`, { vehicle: vehicle.i, mod: row[0], name: row[5] });
        publishedArt.set(`${vehicle.i}:${row[0]}`, row[12]);
      }
    }
  }
  const previousFile = path.join(root, "tools/game-ammunition-art.json");
  if (fs.existsSync(previousFile)) {
    const previous = JSON.parse(fs.readFileSync(previousFile));
    assert.equal(previous.ref, ref, "Review supplemental artwork when changing data versions");
    for (const [vehicle, mods] of Object.entries(previous.vehicles)) {
      const chunk = require(path.join(root, "docs", catalog.chunks[catalog.vehicles[vehicle]].path));
      for (const mod of Object.keys(mods)) {
        const row = chunk.v[vehicle].m.find(item => item[0] === mod);
        if (row) targets.set(`${vehicle}:${mod}`, {vehicle, mod, name: row[5]});
      }
    }
  }
  const units = [...new Set([...targets.values()].filter(item => /_(belt|ammo)_pack$/.test(item.mod)).map(item => item.vehicle))];
  for (const id of units) {
    const filename = modelNames.get(`${id}.blkx`.toLowerCase());
    if (!filename) continue;
    const unit = JSON.parse(fs.readFileSync(filename));
    const mods = [...targets.values()].filter(item => item.vehicle === id && /_(belt|ammo)_pack$/.test(item.mod));
    const weaponFiles = weaponPaths(unit);
    const needsPreset = mods.some(mod => {
      const art = publishedArt.get(`${id}:${mod.mod}`);
      return art && [art, ...(art.v || [])].some(item => item.source && !weaponFiles.has(item.source));
    });
    if (needsPreset || audit.unresolved.some(item => item.vehicle === id && /_belt_pack$/.test(item.mod))) {
      for (const preset of presetPaths(unit)) {
        const data = await readRemote(preset);
        if (data) weaponPaths(data, weaponFiles);
      }
    }
    const weapons = [];
    for (const file of weaponFiles) {
      const weapon = await readRemote(file);
      if (weapon?.bullet) weapons.push({ file, weapon });
    }
    for (const mod of mods) {
      const effects = Object.entries(config.modifications).filter(([name, data]) =>
        data.reqModification === mod.mod && Object.hasOwn(unit.modifications || {}, name) && (data.effects?.additiveBulletMod || data.effects?.bulletMod));
      const candidates = [];
      for (const {file, weapon} of weapons) {
        if ((weapon.isBulletBelt === false && !(weapon.bulletsCartridge > 1)) || weapon.useSingleIconForBullet) continue;
        const variants = [];
        for (const [name, data] of effects) {
          const value = weapon[data.effects.additiveBulletMod || data.effects.bulletMod]?.bullet;
          if (!value) continue;
          const bullets = Array.isArray(value) ? value : [value];
          const icons = bullets.map(bullet => gui.bullet_icons[bullet.guiCustomIcon || bullet.bulletType]);
          if (!icons.length || icons.some(icon => !icon || !/^[a-z0-9_-]+$/i.test(icon))) continue;
          const ratio = gui.bullet_icon_aspect_ratio[icons[0]] || gui.bullet_icon_aspect_ratio.default;
          let limit = Math.min(4, Math.floor(1 / ratio));
          if (weapon.bulletsCartridge) limit = Math.min(limit, weapon.bulletsCartridge);
          const count = icons.length * Math.max(1, Math.floor(limit / icons.length));
          variants.push({ n: name, b: Array.from({length: count}, (_, i) => `${icons[i % icons.length]}.png`), d: [], r: ratio });
        }
        if (variants.length) candidates.push({ ...variants[0], w: path.basename(file, ".blkx"), v: variants, source: file });
      }
      const distinct = new Map(candidates.map(art => [JSON.stringify(art.v), art]));
      if (!distinct.size || (distinct.size !== 1 && !mod.mod.endsWith("_belt_pack"))) continue;
      result[id] ||= {};
      result[id][mod.mod] = [...distinct.values()][0];
      if (distinct.size > 1) {
        // One research pack can unlock multiple mounts; preserve each real weapon's variants.
        result[id][mod.mod].v = [...distinct.values()].flatMap(art => art.v.map(variant => ({ ...variant, w: art.w, source: art.source })));
      }
      if (mod.mod.endsWith("_ammo_pack")) {
        result[id][mod.mod].n = mod.name;
        delete result[id][mod.mod].v;
      }
    }
    console.log(`${id}: verified game weapon definitions`);
  }
  fs.writeFileSync(path.join(root, "tools/game-ammunition-art.json"), JSON.stringify({ ref, source: base, vehicles: result }, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "tools/ammunition-icon-ratios.json"), JSON.stringify({ ref, ratios: gui.bullet_icon_aspect_ratio }, null, 2) + "\n");
  console.log(JSON.stringify({ vehicles: Object.keys(result).length, mods: Object.values(result).reduce((sum, mods) => sum + Object.keys(mods).length, 0) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
