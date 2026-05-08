require("module-alias/register");
const fs = require("fs");
const path = require("path");
const { vehicle_type, country_code } = require("@/dict/country_code");
const { fetchTreeHTML } = require("./1-extract_tree_div");
const { extract_rank_tb } = require("./2-extract_rank_tb");
const { request_details } = require("./3-request_details");

const DEFAULT_LIMIT = Number(process.env.WT_WIKI_LIMIT || 5);

async function get_tree_data(t_c, type) {
  const html = await fetchTreeHTML(t_c, type);
  return extract_rank_tb(html, t_c, type);
}

function collectSingleItems(tree_data) {
  const singles = [];
  const seen = new Set();

  for (const rank of tree_data) {
    const cols = [...(rank.researchable_vehicles || []), ...(rank.premium_vehicles || [])];
    for (const col of cols) {
      for (const item of col) {
        if (item.type === "single" && !seen.has(item.data_unit_id)) {
          seen.add(item.data_unit_id);
          singles.push(item);
        } else if (item.type === "multiple" && Array.isArray(item.items)) {
          for (const subItem of item.items) {
            if (subItem.type === "single" && !seen.has(subItem.data_unit_id)) {
              seen.add(subItem.data_unit_id);
              singles.push(subItem);
            }
          }
        }
      }
    }
  }

  return singles;
}

function processMultipleItems(tree_data) {
  for (const rank of tree_data) {
    const cols = [...(rank.researchable_vehicles || []), ...(rank.premium_vehicles || [])];
    for (const col of cols) {
      for (const item of col) {
        if (item.type !== "multiple" || !Array.isArray(item.items)) continue;

        const brs = item.items.map((sub) => parseFloat(sub.br)).filter((b) => !Number.isNaN(b));
        if (brs.length > 0) {
          const min = Math.min(...brs);
          const max = Math.max(...brs);
          item.br = min === max ? `${min.toFixed(1)}` : `${min.toFixed(1)}-${max.toFixed(1)}`;
        }
        item.rp = item.items.reduce((sum, sub) => sum + parseNumber(sub.rp), 0);
        item.sp = item.items.reduce((sum, sub) => sum + parseNumber(sub.sp), 0);
        item.details = true;
      }
    }
  }
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

async function asyncQueue(items, handler, limit = DEFAULT_LIMIT, showProgress = true) {
  const results = [];
  let index = 0;
  let active = 0;
  let completed = 0;
  const total = items.length;
  const startTime = Date.now();

  const printProgress = () => {
    if (!showProgress || total === 0) return;
    const percent = ((completed / total) * 100).toFixed(1);
    const barLength = 30;
    const filledLength = Math.round((barLength * completed) / total);
    const bar = "#".repeat(filledLength) + "-".repeat(barLength - filledLength);
    process.stdout.write(`\rProgress [${bar}] ${percent}% (${completed}/${total})`);
  };

  return new Promise((resolve) => {
    const next = () => {
      if (index >= total && active === 0) {
        const time = ((Date.now() - startTime) / 1000).toFixed(1);
        if (showProgress) console.log(`\nCompleted ${total} items in ${time}s`);
        return resolve(results);
      }

      while (active < limit && index < total) {
        const current = index++;
        active++;
        handler(items[current])
          .then((res) => results.push(res))
          .catch((err) => console.error(`Failed item: ${err.message || err}`))
          .finally(() => {
            active--;
            completed++;
            printProgress();
            next();
          });
      }
    };
    next();
  });
}

async function retry(fn, args, attempts = 3, retryDelay = 700) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(...args);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  throw lastError;
}

function getOutputPath(t_c, type) {
  const dir = path.join(__dirname, "..", "database", t_c);
  return {
    dir,
    file: path.join(dir, `${t_c}_${type}.json`),
  };
}

async function updateTree(t_c, type, options = {}) {
  const tree_data = await get_tree_data(t_c, type);
  const singleItems = collectSingleItems(tree_data);
  const limit = Number(options.limit || DEFAULT_LIMIT);

  console.log(`Found ${singleItems.length} unit detail pages for ${t_c}-${type}`);

  await asyncQueue(
    singleItems,
    async (item) => {
      const res = await retry(request_details, [item.data_unit_id], options.attempts || 3);
      Object.assign(item, res, { details: true });
    },
    limit,
    options.showProgress !== false
  );

  processMultipleItems(tree_data);

  const { dir, file } = getOutputPath(t_c, type);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(tree_data, null, 2), "utf-8");
  console.log(`Wrote ${file}`);

  return tree_data;
}

async function updateMany(countries = country_code, types = vehicle_type, options = {}) {
  const totalStart = Date.now();

  for (const t_c of countries) {
    for (const type of types) {
      const taskStart = Date.now();
      console.log(`\nUpdating ${t_c}-${type}`);
      await updateTree(t_c, type, options);
      const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
      console.log(`Finished ${t_c}-${type} in ${elapsed}s`);
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000 / 60).toFixed(2);
  console.log(`\nAll requested trees updated in ${totalElapsed} minutes`);
}

function parseCliArgs(argv) {
  const [countryArg, typeArg] = argv;
  const countries = countryArg && countryArg !== "all" ? countryArg.split(",") : country_code;
  const types = typeArg && typeArg !== "all" ? typeArg.split(",") : vehicle_type;

  const invalidCountries = countries.filter((country) => !country_code.includes(country));
  const invalidTypes = types.filter((type) => !vehicle_type.includes(type));
  if (invalidCountries.length || invalidTypes.length) {
    throw new Error(
      `Invalid arguments. Countries: ${invalidCountries.join(", ") || "ok"}; types: ${invalidTypes.join(", ") || "ok"}`
    );
  }

  return { countries, types };
}

if (require.main === module) {
  const { countries, types } = parseCliArgs(process.argv.slice(2));
  updateMany(countries, types).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  updateTree,
  updateMany,
  collectSingleItems,
  processMultipleItems,
};
