const ICON_PREFIX = "https://static.encyclopedia.warthunder.com/gui_skin/";

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

module.exports = { modificationIcon };
