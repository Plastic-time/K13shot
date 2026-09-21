const assert = require("node:assert/strict");
const test = require("node:test");
const cheerio = require("cheerio");
const { modificationIcon } = require("./modification-icons.cjs");

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

test("Known steel darts use the shell icon in both distributions", () => {
  for (const distribution of ["docs", "public"]) {
    const catalog = require(`../${distribution}/database/modifications/catalog.json`);
    for (const [id, name] of [["cn_m1a2t", "KE-W A2"], ["us_m1128_wolfpack", "M900"]]) {
      const vehicle = require(`../${distribution}/${catalog.chunks[catalog.vehicles[id]].path}`).v[id];
      assert.equal(vehicle.m.find(mod => mod[5] === name)?.[6], "apdsfs_tank.png", `${id}: ${name}`);
    }
  }
});
