/**
 * Extract War Thunder Wiki tech-tree HTML into the local tree_data shape.
 */

require("module-alias/register");
const cheerio = require("cheerio");

function cleanText(value) {
  return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractIcon(style = "") {
  const match = style.match(/url\((?:'|")?(.*?)(?:'|")?\)/);
  return match ? match[1] : "";
}

function extractClassName($el) {
  if ($el.hasClass("wt-tree_item--prem") || $el.hasClass("wt-tree_group--prem")) return "prem";
  if ($el.hasClass("wt-tree_item--squad") || $el.hasClass("wt-tree_group--squad")) return "squad";
  return "";
}

function parse_single_item($item) {
  const data_unit_id = $item.attr("data-unit-id") || "";
  const required_unit_id = $item.attr("data-unit-req") || "";
  const title = cleanText($item.find(".wt-tree_item-text span").first().text());
  const icon_style = $item.find(".wt-tree_item-icon").first().attr("style") || "";

  return {
    type: "single",
    title,
    vehicle_icon: extractIcon(icon_style),
    br: null,
    rp: -1,
    sp: 0,
    data_unit_id,
    required_unit_id,
    selected: false,
    class_name: extractClassName($item),
    details: false,
  };
}

function parse_multiple_item($group, $, inheritedClassName = "") {
  const data_unit_id = $group.attr("data-unit-id") || "";
  const required_unit_id = $group.attr("data-unit-req") || "";
  const title = cleanText($group.find(".wt-tree_group-folder .wt-tree_item-text span").first().text());
  const icon_style = $group.find(".wt-tree_group-folder .wt-tree_item-icon").first().attr("style") || "";
  const class_name = extractClassName($group) || inheritedClassName;

  const items = [];
  $group.find(".wt-tree_group-items .wt-tree_item").each((_, el) => {
    const item = parse_single_item($(el));
    if (!item.class_name) item.class_name = class_name;
    items.push(item);
  });

  return {
    type: "multiple",
    title,
    vehicle_icon: extractIcon(icon_style),
    selected: false,
    br: "",
    data_unit_id,
    required_unit_id,
    class_name,
    items,
    details: false,
  };
}

function parse_column($td, $, inheritedClassName = "") {
  const column = [];
  $td.children(".wt-tree_item, .wt-tree_group").each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("wt-tree_item")) {
      const item = parse_single_item($el);
      if (!item.class_name) item.class_name = inheritedClassName;
      column.push(item);
    } else if ($el.hasClass("wt-tree_group")) {
      column.push(parse_multiple_item($el, $, inheritedClassName));
    }
  });
  return column;
}

function parse_table($table, $, inheritedClassName = "") {
  const columns = [];
  $table.find("tr").each((_, tr) => {
    $(tr)
      .find("td")
      .each((colIndex, td) => {
        if (!columns[colIndex]) columns[colIndex] = [];
        columns[colIndex].push(...parse_column($(td), $, inheritedClassName));
      });
  });
  return columns;
}

function extract_rank_tb(html, t_c, type = "ground") {
  if (!html) {
    console.error("extract_rank_tb: missing HTML input");
    return [];
  }

  const $ = cheerio.load(html);
  const tree_data = [];

  const headers = $("div.wt-tree_r-header.wt-tree_row");
  const ranks = $("div.wt-tree_rank.wt-tree_row");

  headers.each((index, header) => {
    const rank_label = cleanText($(header).find("div.wt-tree_r-header_label span").first().text());
    const $rank_div = $(ranks[index]);
    if (!rank_label || !$rank_div.length) return;

    const $tables = $rank_div.find("table.wt-tree_rank-instance");
    const $left_table = $tables.first();
    const $right_table = $tables.length > 1 ? $tables.last() : null;

    tree_data.push({
      rank: rank_label,
      researchable_vehicles: $left_table.length ? parse_table($left_table, $, "") : [],
      premium_vehicles: $right_table ? parse_table($right_table, $, "prem") : [],
      selected: [],
      unlock_quantity: 0,
    });
  });

  console.log(`${t_c}-${type} tree_data parsed, ${tree_data.length} ranks`);
  return tree_data;
}

module.exports = { extract_rank_tb };
