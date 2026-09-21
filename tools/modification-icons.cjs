const ICON_PREFIX = "https://static.encyclopedia.warthunder.com/gui_skin/";
const cheerio = require("cheerio");
const gameArt = require("./game-ammunition-art.json");
const { ratios } = require("./ammunition-icon-ratios.json");
const clean = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
const key = value => clean(value).toLowerCase();
const roundKey = value => key(value).replace(/^[\d.]+\s*mm\s+/, "")
  .replace(/\s+(shell|shot)$/, "").replace(/[\s.\-]/g, "");

function assetName(source) {
  if (!source?.startsWith(ICON_PREFIX)) return null;
  const name = source.slice(ICON_PREFIX.length);
  return /^[a-z0-9_-]+\.png$/i.test(name) ? name : null;
}

function ammunitionArt(html, vehicleId) {
  const $ = cheerio.load(html);
  const rounds = [];
  $(".game-unit_weapon .game-unit_belt-list tbody tr").each((_, row) => {
    const button = $(row).find("td").first().find("button[data-feature-popover]").first();
    const icon = button.find(".game-unit_b-icon").first();
    const b = icon.find(".game-unit_b-icon_base img").map((_, img) => assetName($(img).attr("src"))).get();
    const d = icon.find(".game-unit_b-icon_decor img").map((_, img) => assetName($(img).attr("src"))).get();
    if (!b.length || b.length !== icon.find(".game-unit_b-icon_base img").length || d.length !== icon.find(".game-unit_b-icon_decor img").length) return;
    const weapon = button.closest(".game-unit_weapon");
    rounds.push({ n: clean(button.text()), w: clean(weapon.find(".game-unit_weapon-title").text()),
      role: weapon.closest(".tab-pane").attr("id") || "", filling: clean($(row).children("td").eq(1).text()), b, d });
  });
  const result = new Map();
  $(".game-unit_mod").each((_, node) => {
    const button = $(node);
    const popover = cheerio.load(button.attr("data-feature-popover") || "");
    const source = assetName(popover(".game-unit_popover-header img").first().attr("src"));
    if (source !== "tank_ammo.png" && source !== "ammo.png") return;
    const name = clean(popover(".game-unit_popover-header span").first().text());
    const description = clean(popover(".game-unit_popover-content > div").first().text());
    let candidates = rounds.filter(round => key(round.n) === key(name));
    if (!candidates.length) candidates = rounds.filter(round => roundKey(round.n) === roundKey(name));
    if (!candidates.length && /^omni-purpose\s+[\d.]+\s*mm ammunition belt$/i.test(name)) {
      const caliber = Number(name.match(/[\d.]+/)[0]);
      candidates = rounds.filter(round => round.n === "Universal" && Number(round.w.match(/([\d.]+)\s*mm/)?.[1]) === caliber);
    }
    if (!candidates.length && source === "tank_ammo.png") {
      const caliber = Number((button.attr("data-mod-id") || "").match(/^(\d+(?:_\d+)?)mm_/i)?.[1]?.replace("_", "."));
      const filling = description.match(/filled with ([A-Z0-9*/-]+) (?:shells|bullets)/)?.[1];
      const single = !filling && description.match(/([A-Z][A-Z0-9*-]*)\s+-\s+[A-Z]/)?.[1];
      if (caliber && (filling || single)) candidates = rounds.filter(round => {
        if (Number(round.w.match(/([\d.]+)\s*mm/)?.[1]) !== caliber) return false;
        const composition = round.filling.replace(/\s/g, "");
        return filling ? composition === filling : composition.split("/").every(type => type === single);
      });
    }
    let group = false;
    if (!candidates.length && source === "ammo.png") {
      const match = description.match(/Set of ([\d.]+) mm belts for (offensive|turret) weapons/i);
      if (match) {
        candidates = rounds.filter(round => {
          const caliber = round.w.match(/([\d.]+)\s*mm\b/i);
          return caliber && Number(caliber[1]) === Number(match[1]) && round.role.includes(match[2].toLowerCase());
        });
        group = true;
      }
    }
    const shellType = description.match(/([A-Z][A-Z0-9*-]*)\s+-\s+[A-Z]/)?.[1];
    if (candidates.length > 1 && shellType) {
      const sameType = candidates.filter(round => round.filling === shellType);
      if (sameType.length) candidates = sameType;
    }
    if (!candidates.length) return;
    const unique = [...new Map(candidates.map(round => [JSON.stringify([round.n, round.b, round.d]), round])).values()];
    // An exact name with different artwork is ambiguous; keep the original instead of guessing.
    if (!group && unique.length !== 1) return;
    const chosen = group ? unique.find(round => round.n === "Universal") || unique.find(round => round.n !== "Default") || unique[0] : unique[0];
    const art = { b: chosen.b, d: chosen.d, n: chosen.n, w: chosen.w,
      r: chosen.b.length > 1 ? ratios[chosen.b[0].replace(/\.png$/, "")] || ratios.default : 1 };
    if (group) art.v = unique.map(({ n, b, d }) => ({ n, b, d }));
    result.set(button.attr("data-mod-id"), art);
  });
  for (const [id, art] of Object.entries(gameArt.vehicles[vehicleId] || {})) {
    if (!result.has(id)) result.set(id, structuredClone(art));
  }
  return result;
}

function modificationIcon(chunk, popover) {
  const source = popover(".game-unit_popover-header img").first().attr("src") || "";
  const icon = source.startsWith(ICON_PREFIX) ? source.slice(ICON_PREFIX.length) : source;
  const description = popover(".game-unit_popover-content > div").first().text();
  // Wiki modification cards use a crate; ammunition details provide the shell icon.
  if (chunk.endsWith("_ground") && icon === "tank_ammo.png" && /\bAPFSDS\s*-/.test(description)) {
    return "apdsfs_tank.png";
  }
  return icon;
}

module.exports = { modificationIcon, ammunitionArt };
