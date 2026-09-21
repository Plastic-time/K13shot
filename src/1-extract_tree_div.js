const axios = require("axios");
const cheerio = require("cheerio");
const beautify = require("js-beautify").html;
require("module-alias/register");

async function fetchTreeHTML(t_c, type = "ground") {
  const url = `https://wiki.warthunder.com/${type}?v=t&t_c=${t_c}`;
  console.log(`Requesting Wiki tree: ${url}`);

  try {
    const { data } = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const $ = cheerio.load(data);
    const $div = $(`div.unit-tree[data-tree-id="${t_c}"]`);

    if (!$div.length) {
      console.error(`Cannot find div.unit-tree[data-tree-id="${t_c}"]`);
      return null;
    }

    return beautify($.html($div), {
      indent_size: 2,
      preserve_newlines: true,
      max_preserve_newlines: 1,
      end_with_newline: true,
    });
  } catch (err) {
    console.error("Wiki tree request failed:", err.message);
    return null;
  }
}

module.exports = { fetchTreeHTML };
