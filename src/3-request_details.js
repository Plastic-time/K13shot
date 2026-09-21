const axios = require("axios");
const cheerio = require("cheerio");

function cleanText(value) {
  return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getCardItemByTitle($, title) {
  const target = title.toLowerCase();
  let result = null;

  $(".game-unit_card-info_item").each((_, el) => {
    const $item = $(el);
    const itemTitle = cleanText($item.find(".game-unit_card-info_title").first().text()).toLowerCase();
    if (itemTitle === target) {
      result = $item;
      return false;
    }
    return undefined;
  });

  return result;
}

function getCardValueByTitle($, title) {
  const $item = getCardItemByTitle($, title);
  if (!$item) return null;

  const $value = $item.find(".game-unit_card-info_value").first().clone();
  $value.find("img, svg").remove();
  return cleanText($value.text()) || null;
}

function getBattleRating($, preferredMode = "RB") {
  const values = {};

  $(".game-unit_br-item").each((_, el) => {
    const $item = $(el);
    const mode = cleanText($item.find(".mode").text());
    const value = cleanText($item.find(".value").text());
    if (mode && value) values[mode] = value;
  });

  return values[preferredMode] || values.RB || values.AB || Object.values(values)[0] || null;
}

function normalizeCost(value) {
  const text = cleanText(value);
  if (!text) return null;
  if (/^free$/i.test(text)) return null;
  return text;
}

async function request_details(data_unit_id) {
  const url = `https://wiki.warthunder.com/unit/${data_unit_id}`;

  const { data: html } = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  const $ = cheerio.load(html);
  const $unit = $(".game-unit").first();
  const unitText = cleanText($unit.text()).toLowerCase();
  const isPremium =
    $unit.hasClass("game-unit--premium") ||
    unitText.includes("premium vehicle") ||
    getCardValueByTitle($, "Purchase")?.toLowerCase().includes("golden eagles");

  const result = {
    data_unit_id,
    br: getBattleRating($),
    rp: isPremium ? 0 : normalizeCost(getCardValueByTitle($, "Research")),
    sp: isPremium ? 0 : normalizeCost(getCardValueByTitle($, "Purchase")),
    main_role: getCardValueByTitle($, "Main role"),
    rank: getCardValueByTitle($, "Rank"),
    research_country: getCardValueByTitle($, "Research country"),
    is_premium: isPremium,
  };

  return result;
}

module.exports = { request_details };
