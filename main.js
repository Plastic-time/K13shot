require("module-alias/register");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { fetchTreeHTML } = require("@/src/1-extract_tree_div");
const { extract_rank_tb } = require("@/src/2-extract_rank_tb");
const { vehicle_type, country_code } = require("@/dict/country_code");
const { request_details } = require("./src/3-request_details");
const { updateTree } = require("./src/4-fill_tree_details");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATABASE_DIR = path.join(__dirname, "database");
const PUBLIC_DIR = path.join(__dirname, "public");

const countryLabels = {
  usa: "美国",
  germany: "德国",
  ussr: "苏联",
  britain: "英国",
  japan: "日本",
  china: "中国",
  italy: "意大利",
  france: "法国",
  sweden: "瑞典",
  israel: "以色列",
};

const typeLabels = {
  ground: "陆战",
  aviation: "空战",
  helicopters: "直升机",
  ships: "远洋舰队",
  boats: "近岸舰队",
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

function validateTreeArgs(country, type) {
  if (!country_code.includes(country)) {
    return `Invalid country '${country}'. Supported: ${country_code.join(", ")}`;
  }
  if (!vehicle_type.includes(type)) {
    return `Invalid type '${type}'. Supported: ${vehicle_type.join(", ")}`;
  }
  return null;
}

function getTreeFile(country, type) {
  return path.join(DATABASE_DIR, country, `${country}_${type}.json`);
}

function readTree(country, type) {
  const file = getTreeFile(country, type);
  if (!fs.existsSync(file)) {
    const err = new Error(`Tree data not found: ${country}-${type}`);
    err.statusCode = 404;
    throw err;
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  return Array.isArray(raw) ? raw : raw.data || [];
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function flattenTree(tree) {
  const units = [];
  const groups = [];

  for (const rank of tree) {
    for (const section of ["researchable_vehicles", "premium_vehicles"]) {
      const sectionType = section === "premium_vehicles" ? "premium" : "researchable";
      const columns = rank[section] || [];

      columns.forEach((column, columnIndex) => {
        column.forEach((item, rowIndex) => {
          if (item.type === "multiple") {
            const group = {
              ...item,
              rank: rank.rank,
              section: sectionType,
              columnIndex,
              rowIndex,
            };
            groups.push(group);

            (item.items || []).forEach((subItem, subIndex) => {
              units.push({
                ...subItem,
                rank: rank.rank,
                section: sectionType,
                parent_group_id: item.data_unit_id,
                parent_group_title: item.title,
                parent_required_unit_id: item.required_unit_id || "",
                columnIndex,
                rowIndex: rowIndex + subIndex / 10,
              });
            });
          } else if (item.type === "single") {
            units.push({
              ...item,
              rank: rank.rank,
              section: sectionType,
              columnIndex,
              rowIndex,
            });
          }
        });
      });
    }
  }

  return { units, groups };
}

function buildUnitIndexes(tree) {
  const { units, groups } = flattenTree(tree);
  const unitMap = new Map(units.map((unit) => [unit.data_unit_id, unit]));
  const groupMap = new Map(groups.map((group) => [group.data_unit_id, group]));
  return { units, groups, unitMap, groupMap };
}

function getDependencyIds(unitId, indexes, options = {}, visited = new Set()) {
  if (!unitId || visited.has(unitId)) return [];
  visited.add(unitId);

  const { unitMap, groupMap } = indexes;
  const unit = unitMap.get(unitId);
  const group = groupMap.get(unitId);

  if (group) {
    const childIds = (group.items || []).map((item) => item.data_unit_id).filter(Boolean);
    const selectedChildIds = options.folderMode === "first" ? childIds.slice(0, 1) : childIds;
    const parentDeps = getDependencyIds(group.required_unit_id, indexes, options, visited);
    return [...parentDeps, ...selectedChildIds.flatMap((id) => getDependencyIds(id, indexes, options, visited)), ...selectedChildIds];
  }

  if (!unit) return [];

  const parentReq = unit.parent_required_unit_id && !unit.required_unit_id ? unit.parent_required_unit_id : "";
  const reqId = unit.required_unit_id || parentReq;
  return [...getDependencyIds(reqId, indexes, options, visited), unitId];
}

function calculatePlan(tree, body = {}) {
  const indexes = buildUnitIndexes(tree);
  const owned = new Set(body.ownedIds || []);
  const currentRp = parseNumber(body.currentRp);
  const targetIds = [...new Set([...(body.plannedIds || []), body.targetId].filter(Boolean))];
  const folderMode = body.folderMode === "first" ? "first" : "all";
  const dependencyMode = body.dependencyMode === "dependencies" ? "dependencies" : "selected";

  const orderedIds = [];
  const seen = new Set();
  for (const targetId of targetIds) {
    const ids = dependencyMode === "dependencies" ? getDependencyIds(targetId, indexes, { folderMode }) : [targetId];
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  const missing = orderedIds
    .filter((id) => !owned.has(id))
    .map((id) => indexes.unitMap.get(id))
    .filter(Boolean);

  const totalRp = missing.reduce((sum, unit) => sum + parseNumber(unit.rp), 0);
  const totalSp = missing.reduce((sum, unit) => sum + parseNumber(unit.sp), 0);

  return {
    total_rp: Math.max(totalRp - currentRp, 0),
    raw_total_rp: totalRp,
    total_sp: totalSp,
    current_rp: currentRp,
    missing,
  };
}

app.get("/api/meta", (req, res) => {
  res.json({
    success: true,
    countries: country_code.map((code) => ({ code, label: countryLabels[code] || code })),
    types: vehicle_type.map((code) => ({ code, label: typeLabels[code] || code })),
  });
});

app.get("/api/tree/:country/:type", (req, res) => {
  const country = req.params.country?.toLowerCase();
  const type = req.params.type?.toLowerCase();
  const error = validateTreeArgs(country, type);
  if (error) return res.status(400).json({ success: false, error });

  try {
    const data = readTree(country, type);
    res.json({ success: true, country, type, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

app.get("/api/tree/:country/:type/flat", (req, res) => {
  const country = req.params.country?.toLowerCase();
  const type = req.params.type?.toLowerCase();
  const error = validateTreeArgs(country, type);
  if (error) return res.status(400).json({ success: false, error });

  try {
    const data = readTree(country, type);
    const flat = flattenTree(data);
    res.json({ success: true, country, type, ...flat });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

app.post("/api/calculate/:country/:type", (req, res) => {
  const country = req.params.country?.toLowerCase();
  const type = req.params.type?.toLowerCase();
  const error = validateTreeArgs(country, type);
  if (error) return res.status(400).json({ success: false, error });

  try {
    const data = readTree(country, type);
    res.json({ success: true, ...calculatePlan(data, req.body) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

app.post("/api/update/:country/:type", async (req, res) => {
  const country = req.params.country?.toLowerCase();
  const type = req.params.type?.toLowerCase();
  const error = validateTreeArgs(country, type);
  if (error) return res.status(400).json({ success: false, error });

  try {
    const data = await updateTree(country, type, { limit: req.body?.limit });
    res.json({ success: true, country, type, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/wiki/:type", async (req, res) => {
  const type = req.params.type?.toLowerCase();
  const t_c = req.query.t_c?.toLowerCase();

  const error = validateTreeArgs(t_c, type);
  if (error) return res.status(400).json({ success: false, error });

  try {
    const html = await fetchTreeHTML(t_c, type);
    if (!html) return res.status(502).json({ success: false, error: "Failed to fetch Wiki HTML" });
    const data = extract_rank_tb(html, t_c, type);
    res.json({ success: true, country: t_c, type, cached: false, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/unit/:data_unit_id", async (req, res) => {
  const data_unit_id = req.params.data_unit_id?.toLowerCase();
  if (!data_unit_id) return res.status(400).json({ success: false, error: "Missing data_unit_id" });

  try {
    const data = await request_details(data_unit_id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Unit detail request failed" });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`War Thunder research calculator: http://localhost:${PORT}`);
  });
}

module.exports = app;
