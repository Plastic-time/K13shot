const assert = require("node:assert/strict");
const test = require("node:test");
const cheerio = require("cheerio");
const { modificationIcon, ammunitionArt } = require("./modification-icons.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function popover(description, icon = "tank_ammo.png") {
  return cheerio.load(`<div class="game-unit_popover-header"><img src="https://static.encyclopedia.warthunder.com/gui_skin/${icon}"></div><div class="game-unit_popover-content"><div>${description}</div></div>`);
}

test("Only confirmed ground APFSDS crates become shell icons", () => {
  for (const nation of ["usa", "germany", "ussr", "britain", "japan", "china", "italy", "france", "sweden", "israel"]) {
    assert.equal(modificationIcon(`${nation}_ground`, popover("Allows the use of shell M900.<br>APFSDS - Armor-Piercing Fin-Stabilized Discarding Sabot shot")), "apdsfs_tank.png");
  }
  for (const type of ["APDS", "HEATFS", "HE", "AP", "ATGM", ""]) {
    assert.equal(modificationIcon("usa_ground", popover(`${type} - Other ammunition`)), "tank_ammo.png");
  }
  assert.equal(modificationIcon("usa_aviation", popover("APFSDS - shell")), "tank_ammo.png");
  assert.equal(modificationIcon("usa_ground", popover("APFSDS - shell", "custom_shell.png")), "custom_shell.png");
  assert.equal(modificationIcon("usa_ground", cheerio.load("")), "");
});

test("M15 keeps all five caliber-specific belts distinct", () => {
  const vehicle = require("../docs/database/modifications/usa_ground.json").v.us_halftrack_m15;
  const art = id => vehicle.m.find(mod => mod[0] === id)[12];
  const api = art("12mm_usa_M2HB_API_ammo_pack");
  const ap = art("12mm_usa_M2HB_AP_ammo_pack");
  const apit = art("12mm_usa_M2HB_APIT_ammo_pack");
  const m54 = art("37mm_usa_m54_HE_ammo_pack");
  const m59 = art("37mm_usa_m59a1_AP_ammo_pack");
  assert.deepEqual(api.b, ["bullet_gun_red_blue_green.png", "bullet_gun_red_blue.png", "bullet_gun_red_blue_green.png"]);
  assert.deepEqual(ap.b, ["bullet_gun_red.png", "bullet_gun_red.png", "bullet_gun_red_blue_green.png"]);
  assert.deepEqual(apit.b, Array(4).fill("bullet_gun_red_blue_green.png"));
  assert.deepEqual(m54.b, Array(4).fill("bullet_cannon_blue_yellow_green.png"));
  assert.deepEqual(m59.b, Array(4).fill("bullet_cannon_red_green.png"));
  assert(api.w.includes("12.7 mm") && m54.w.includes("37 mm"));
});

test("Shells retain separate penetration and damage overlays", () => {
  const vehicle = require("../docs/database/modifications/usa_ground.json").v.us_m1a2_abrams;
  const dart = vehicle.m.find(mod => mod[0] === "120mm_M829A_APDS_FS_ammo_pack")[12];
  const heat = vehicle.m.find(mod => mod[0] === "120mm_DM_HEAT_FS_ammo_pack")[12];
  assert.deepEqual(dart.b, ["apdsfs_tank.png"]);
  assert.deepEqual(dart.d, ["damage.png", "armor_big.png"]);
  assert.deepEqual(heat.b, ["heat_fs_tank.png"]);
  assert.deepEqual(heat.d, ["damage_small.png", "armor_small.png"]);
});

test("Air and helicopter belt groups carry actual variants, not a single mislabeled shell", () => {
  for (const [chunk, vehicle, mod] of [["china_aviation", "j_16", "GSh_301_belt_pack"], ["usa_helicopters", "ah_1g", "ah_1g_xm35_belt_pack"]]) {
    const data = require(`../docs/database/modifications/${chunk}.json`).v[vehicle].m.find(row => row[0] === mod)[12];
    assert(data.v.length > 1);
    assert(data.b.length > 1 && data.d.length === 0);
    assert(new Set(data.v.map(variant => JSON.stringify(variant.b))).size > 1);
  }
});

test("Unmatched ammunition does not get an invented icon", () => {
  const $ = cheerio.load('<button class="game-unit_mod" data-mod-id="unknown"></button>');
  $("button").attr("data-feature-popover", popover("Unknown shell").html());
  assert.equal(ammunitionArt($.html()).size, 0);
});

test("Remaining crate artwork is not an unmatched cannon shell or belt", () => {
  const excluded = new Set(["lav_ad_hydra_70", "254mm_amraam_er_aam_ammo_pack", "bmp_1p_turret_improvement",
    "fv510_MILAN_2", "166mm_camm_er_aam_ammo_pack", "type_86_turret_improvement", "begleitpanzer_57_improvement_TOW"]);
  for (const item of require("./ammunition-icon-audit.json").unresolved) assert(excluded.has(item.mod), `${item.vehicle}: ${item.mod}`);
});

test("Original image bytes are verified and mirrored in both distributions", () => {
  const manifest = require("./ammunition-assets.json");
  const catalog = require("../docs/database/modifications/catalog.json");
  assert.equal(require("./game-ammunition-art.json").ref, catalog.sources.datamineCommit);
  const names = new Set(manifest.assets.map(asset => asset.file));
  for (const asset of manifest.assets) {
    const a = fs.readFileSync(path.join(__dirname, "../docs/images/ammunition", asset.file));
    const b = fs.readFileSync(path.join(__dirname, "../public/images/ammunition", asset.file));
    assert.deepEqual(a, b);
    assert.equal(crypto.createHash("sha256").update(a).digest("hex"), asset.sha256);
  }
  for (const meta of Object.values(catalog.chunks)) {
    for (const vehicle of Object.values(require(`../docs/${meta.path}`).v)) {
      for (const row of vehicle.m) if (row[12]) {
        const art = row[12];
        assert(art.r > 0 && art.r <= 1);
        for (const item of [art, ...(art.v || [])]) {
          assert(item.b.length > 0);
          for (const file of [...item.b, ...item.d]) assert(names.has(file), `${vehicle.i}: missing ${file}`);
        }
      }
    }
  }
});

test("Known steel darts use the shell icon in both distributions", () => {
  for (const distribution of ["docs", "public"]) {
    const catalog = require(`../${distribution}/database/modifications/catalog.json`);
    for (const [id, name] of [["cn_m1a2t", "KE-W A2"], ["us_m1128_wolfpack", "M900"]]) {
      const vehicle = require(`../${distribution}/${catalog.chunks[catalog.vehicles[id]].path}`).v[id];
      assert.equal(vehicle.m.find(mod => mod[5] === name)?.[6], "apdsfs_tank.png", `${id}: ${name}`);
    }
  }
});
