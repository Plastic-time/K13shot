const els = {
  statusText: document.getElementById("statusText"),
  countrySelect: document.getElementById("countrySelect"),
  typeSelect: document.getElementById("typeSelect"),
  searchInput: document.getElementById("searchInput"),
  currentRpInput: document.getElementById("currentRpInput"),
  folderModeSelect: document.getElementById("folderModeSelect"),
  dependencyModeSelect: document.getElementById("dependencyModeSelect"),
  planModeButton: document.getElementById("planModeButton"),
  ownedModeButton: document.getElementById("ownedModeButton"),
  clearButton: document.getElementById("clearButton"),
  refreshDataButton: document.getElementById("refreshDataButton"),
  totalRp: document.getElementById("totalRp"),
  totalSp: document.getElementById("totalSp"),
  missingCount: document.getElementById("missingCount"),
  plannedCount: document.getElementById("plannedCount"),
  pathCount: document.getElementById("pathCount"),
  plannedList: document.getElementById("plannedList"),
  missingList: document.getElementById("missingList"),
  treeContainer: document.getElementById("treeContainer"),
};

const state = {
  meta: null,
  tree: [],
  units: [],
  groups: [],
  unitMap: new Map(),
  groupMap: new Map(),
  planned: new Set(),
  owned: new Set(),
  missing: [],
  mode: "plan",
  country: "usa",
  type: "ground",
  currentRp: 0,
  folderMode: "all",
  dependencyMode: "selected",
  search: "",
};

const zh = {
  countries: {
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
  },
  types: {
    ground: "陆战",
    aviation: "空战",
    helicopters: "直升机",
    ships: "远洋舰队",
    boats: "近岸舰队",
  },
  sections: {
    researchable: "可研发",
    premium: "金币 / 特殊",
  },
  roles: {
    "Light tank": "轻型坦克",
    "Medium tank": "中型坦克",
    "Heavy tank": "重型坦克",
    "Tank destroyer": "坦克歼击车",
    "SPAA": "防空车",
    "Fighter": "战斗机",
    "Strike aircraft": "攻击机",
    "Bomber": "轰炸机",
    "Interceptor": "截击机",
    "Jet fighter": "喷气战斗机",
    "Helicopter": "直升机",
    "Destroyer": "驱逐舰",
    "Light cruiser": "轻巡洋舰",
    "Heavy cruiser": "重巡洋舰",
    "Battleship": "战列舰",
    "Battlecruiser": "战列巡洋舰",
    "Motor torpedo boat": "鱼雷艇",
    "Motor gun boat": "炮艇",
  },
};

function setStatus(text) {
  els.statusText.textContent = text;
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.error || "Request failed");
  return data;
}

function storageKey() {
  return `wt-research:${state.country}:${state.type}`;
}

function cleanText(value) {
  return String(value || "").replace(/[\u00a0\u807d]/g, " ").replace(/\s+/g, " ").trim();
}

function translateCountry(code, fallback) {
  return zh.countries[code] || fallback || code;
}

function translateType(code, fallback) {
  return zh.types[code] || fallback || code;
}

function translateRole(role) {
  const cleanRole = cleanText(role);
  return zh.roles[cleanRole] || cleanRole;
}

function displayTitle(unit) {
  return cleanText(unit.title_zh || unit.zh_title || unit.cn_title || unit.title);
}

function displayRank(rank) {
  return `等级 ${cleanText(rank)}`;
}

function sectionLabel(section) {
  return zh.sections[section] || section;
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return Math.round(parseNumber(value)).toLocaleString("en-US");
}

function formatCost(value) {
  const number = parseNumber(value);
  return number ? formatNumber(number) : "0";
}

function loadSavedState() {
  const saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  state.planned = new Set(saved.planned || []);
  state.owned = new Set(saved.owned || []);
  state.currentRp = parseNumber(saved.currentRp);
  state.folderMode = saved.folderMode || "all";
  state.dependencyMode = saved.dependencyMode || "selected";
  els.currentRpInput.value = state.currentRp;
  els.folderModeSelect.value = state.folderMode;
  els.dependencyModeSelect.value = state.dependencyMode;
}

function saveState() {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      planned: [...state.planned],
      owned: [...state.owned],
      currentRp: state.currentRp,
      folderMode: state.folderMode,
      dependencyMode: state.dependencyMode,
    })
  );
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
            const group = { ...item, rank: rank.rank, section: sectionType, columnIndex, rowIndex };
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
            units.push({ ...item, rank: rank.rank, section: sectionType, columnIndex, rowIndex });
          }
        });
      });
    }
  }

  state.units = units;
  state.groups = groups;
  state.unitMap = new Map(units.map((unit) => [unit.data_unit_id, unit]));
  state.groupMap = new Map(groups.map((group) => [group.data_unit_id, group]));
}

function getDependencyIds(unitId, visited = new Set()) {
  if (!unitId || visited.has(unitId)) return [];
  visited.add(unitId);

  const unit = state.unitMap.get(unitId);
  const group = state.groupMap.get(unitId);

  if (group) {
    const childIds = (group.items || []).map((item) => item.data_unit_id).filter(Boolean);
    const selectedChildIds = state.folderMode === "first" ? childIds.slice(0, 1) : childIds;
    return [
      ...getDependencyIds(group.required_unit_id, visited),
      ...selectedChildIds.flatMap((id) => getDependencyIds(id, visited)),
      ...selectedChildIds,
    ];
  }

  if (!unit) return [];

  const parentReq = unit.parent_required_unit_id && !unit.required_unit_id ? unit.parent_required_unit_id : "";
  const reqId = unit.required_unit_id || parentReq;
  return [...getDependencyIds(reqId, visited), unitId];
}

function calculatePlan() {
  const orderedIds = [];
  const seen = new Set();

  for (const targetId of state.planned) {
    const ids = state.dependencyMode === "dependencies" ? getDependencyIds(targetId) : [targetId];
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  state.missing = orderedIds
    .filter((id) => !state.owned.has(id))
    .map((id) => state.unitMap.get(id))
    .filter(Boolean);

  renderSummary();
  renderTree();
}

function renderSummary() {
  const plannedUnits = [...state.planned].map((id) => state.unitMap.get(id)).filter(Boolean);
  const rawRp = state.missing.reduce((sum, unit) => sum + parseNumber(unit.rp), 0);
  const totalRp = Math.max(rawRp - state.currentRp, 0);
  const totalSp = state.missing.reduce((sum, unit) => sum + parseNumber(unit.sp), 0);

  els.totalRp.textContent = formatNumber(totalRp);
  els.totalSp.textContent = formatNumber(totalSp);
  els.missingCount.textContent = state.missing.length;
  els.plannedCount.textContent = plannedUnits.length;
  els.pathCount.textContent = state.missing.length;

  els.plannedList.innerHTML = plannedUnits.length
    ? plannedUnits.map((unit) => renderListItem(unit, true)).join("")
    : `<div class="empty-state">暂无计划</div>`;

  els.missingList.innerHTML = state.missing.length
    ? state.missing.map((unit) => renderListItem(unit, false)).join("")
    : `<div class="empty-state">路径已完成</div>`;
}

function renderListItem(unit, removable) {
  const removeButton = removable
    ? `<button class="mini-button" type="button" data-remove-plan="${escapeHtml(unit.data_unit_id)}">移除</button>`
    : `<span class="list-meta">${escapeHtml(displayRank(unit.rank || ""))}</span>`;
  const role = translateRole(unit.main_role);

  return `
    <div class="list-item">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <div>
        <div class="list-title">${escapeHtml(displayTitle(unit))}</div>
        <div class="list-meta">BR ${escapeHtml(unit.br || "-")} · RP ${formatCost(unit.rp)} · SL ${formatCost(unit.sp)}${role ? ` · ${escapeHtml(role)}` : ""}</div>
      </div>
      ${removeButton}
    </div>
  `;
}

function unitMatchesSearch(unit) {
  if (!state.search) return true;
  const haystack =
    `${displayTitle(unit)} ${unit.title || ""} ${unit.data_unit_id || ""} ${unit.parent_group_title || ""} ${translateRole(unit.main_role)}`.toLowerCase();
  return haystack.includes(state.search.toLowerCase());
}

function renderUnit(unit) {
  const id = unit.data_unit_id;
  const classes = ["unit-tile"];
  const className = cleanText(unit.class_name).toLowerCase();
  if (state.planned.has(id)) classes.push("planned");
  if (state.owned.has(id)) classes.push("owned");
  if (state.missing.some((missing) => missing.data_unit_id === id)) classes.push("missing");
  if (className) classes.push(className);
  if (unit.section === "premium" || className === "prem" || className === "premium") classes.push("premium");
  const role = translateRole(unit.main_role);

  return `
    <button class="${classes.join(" ")}" type="button" data-unit-id="${escapeHtml(id)}" title="${escapeHtml(id)}">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <span>
        <span class="unit-title">${escapeHtml(displayTitle(unit))}</span>
        <span class="unit-meta">
          <span class="pill">BR ${escapeHtml(unit.br || "-")}</span>
          <span class="pill rp">RP ${formatCost(unit.rp)}</span>
          <span class="pill sp">SL ${formatCost(unit.sp)}</span>
          ${role ? `<span class="pill role">${escapeHtml(role)}</span>` : ""}
        </span>
      </span>
    </button>
  `;
}

function renderGroup(group, context) {
  const matchingItems = (group.items || []).filter(unitMatchesSearch);
  const groupMatches = unitMatchesSearch(group);
  if (!groupMatches && matchingItems.length === 0) return "";
  const className = cleanText(group.class_name).toLowerCase();
  const classes = ["group-tile"];
  if (className) classes.push(className);
  if (context.section === "premium" || className === "prem" || className === "premium") classes.push("premium");

  const items = (groupMatches ? group.items || [] : matchingItems).map((item) =>
    renderUnit({
      ...item,
      rank: context.rank,
      section: context.section,
      parent_group_id: group.data_unit_id,
      parent_group_title: group.title,
      parent_required_unit_id: group.required_unit_id || "",
    })
  );

  return `
    <div class="${classes.join(" ")}">
      <div class="group-header">
        ${group.vehicle_icon ? `<img src="${escapeHtml(group.vehicle_icon)}" alt="">` : `<span></span>`}
        <span>${escapeHtml(displayTitle(group))}</span>
      </div>
      <div class="group-items">${items.join("")}</div>
    </div>
  `;
}

function renderColumn(column, context) {
  return `
    <div class="tree-column">
      ${column
        .map((item) => {
          if (item.type === "multiple") return renderGroup(item, context);
          return unitMatchesSearch(item)
            ? renderUnit({ ...item, rank: context.rank, section: context.section })
            : "";
        })
        .join("")}
    </div>
  `;
}

function renderBand(title, columns, context) {
  const visibleColumns = columns.map((column) =>
    column.filter((item) => {
      if (item.type === "multiple") {
        return unitMatchesSearch(item) || (item.items || []).some(unitMatchesSearch);
      }
      return unitMatchesSearch(item);
    })
  );

  if (!visibleColumns.some((column) => column.length > 0)) return "";

  const count = Math.max(columns.length, 1);
  const sectionClass = `${context.section}-band`;
  return `
    <div class="tree-band ${sectionClass}">
      <h3 class="band-title">${title}</h3>
      <div class="column-grid" style="grid-template-columns: repeat(${count}, 138px);">
        ${visibleColumns.map((column) => renderColumn(column, context)).join("")}
      </div>
    </div>
  `;
}

function resolveRequirementSources(reqId) {
  if (!reqId) return [];
  const group = state.groupMap.get(reqId);
  if (!group) return [reqId];

  const childIds = (group.items || []).map((item) => item.data_unit_id).filter(Boolean);
  const selectedChildIds = state.folderMode === "first" ? childIds.slice(0, 1) : childIds;
  return selectedChildIds.length ? selectedChildIds : [reqId];
}

function getImmediateRequirement(unit) {
  if (!unit) return "";
  if (unit.required_unit_id) return unit.required_unit_id;
  return unit.parent_required_unit_id || "";
}

function svgNumber(value) {
  return Number(value).toFixed(1);
}

function tilePoint(tile, canvasBox, edge) {
  const box = tile.getBoundingClientRect();
  const x = box.left + box.width / 2 - canvasBox.left;
  const y = edge === "top" ? box.top - canvasBox.top : box.bottom - canvasBox.top;
  return { x, y, box };
}

function renderOrthogonalConnector(from, to, canvasBox) {
  const fromBox = from.getBoundingClientRect();
  const toBox = to.getBoundingClientRect();
  const fromCenterY = fromBox.top + fromBox.height / 2;
  const toCenterY = toBox.top + toBox.height / 2;
  const fromAbove = fromCenterY <= toCenterY;
  const start = tilePoint(from, canvasBox, fromAbove ? "bottom" : "top");
  const end = tilePoint(to, canvasBox, fromAbove ? "top" : "bottom");
  const sameColumn = Math.abs(start.x - end.x) < 6;
  const gap = Math.abs(end.y - start.y);
  const minStub = 14;

  if (sameColumn) {
    return `M ${svgNumber(start.x)} ${svgNumber(start.y)} V ${svgNumber(end.y)}`;
  }

  const direction = fromAbove ? 1 : -1;
  const railY =
    gap > minStub * 3
      ? start.y + (end.y - start.y) / 2
      : (fromAbove ? Math.max(fromBox.bottom, toBox.bottom) - canvasBox.top + 18 : Math.min(fromBox.top, toBox.top) - canvasBox.top - 18);

  return [
    `M ${svgNumber(start.x)} ${svgNumber(start.y)}`,
    `v ${svgNumber(minStub * direction)}`,
    `V ${svgNumber(railY)}`,
    `H ${svgNumber(end.x)}`,
    `V ${svgNumber(end.y - minStub * direction)}`,
    `v ${svgNumber(minStub * direction)}`,
  ].join(" ");
}

function renderTreeConnections() {
  const svg = els.treeContainer.querySelector(".tree-links");
  const canvas = els.treeContainer.querySelector(".tree-canvas");
  if (!svg || !canvas) return;

  svg.innerHTML = "";
  svg.setAttribute("width", canvas.scrollWidth);
  svg.setAttribute("height", canvas.scrollHeight);
  svg.setAttribute("viewBox", `0 0 ${canvas.scrollWidth} ${canvas.scrollHeight}`);

  const canvasBox = canvas.getBoundingClientRect();
  const visibleTiles = new Map(
    [...canvas.querySelectorAll(".unit-tile[data-unit-id]")].map((tile) => [tile.dataset.unitId, tile])
  );
  const segments = [];

  for (const [id, to] of visibleTiles.entries()) {
    const unit = state.unitMap.get(id);
    const reqId = getImmediateRequirement(unit);
    for (const sourceId of resolveRequirementSources(reqId)) {
      const from = visibleTiles.get(sourceId);
      if (!from || !to) continue;

      segments.push(`<path d="${renderOrthogonalConnector(from, to, canvasBox)}" />`);
    }
  }

  svg.innerHTML = segments.join("");
}

function renderTree() {
  if (!state.tree.length) {
    els.treeContainer.innerHTML = `<div class="loading">没有本地数据</div>`;
    return;
  }

  const html = state.tree
    .map((rank) => {
      const researchable = renderBand(sectionLabel("researchable"), rank.researchable_vehicles || [], {
        rank: rank.rank,
        section: "researchable",
      });
      const premium = renderBand(sectionLabel("premium"), rank.premium_vehicles || [], {
        rank: rank.rank,
        section: "premium",
      });
      if (!researchable && !premium) return "";
      return `
        <article class="rank-block">
          <div class="rank-rail">
            <span>${escapeHtml(displayRank(rank.rank))}</span>
          </div>
          <div class="rank-field">
            ${researchable}
            ${premium}
          </div>
        </article>
      `;
    })
    .join("");

  els.treeContainer.innerHTML = html
    ? `<div class="tree-canvas"><svg class="tree-links" aria-hidden="true"></svg><div class="tree-content">${html}</div></div>`
    : `<div class="loading">没有匹配项</div>`;
  window.requestAnimationFrame(renderTreeConnections);
}

function setMode(mode) {
  state.mode = mode;
  els.planModeButton.classList.toggle("active", mode === "plan");
  els.ownedModeButton.classList.toggle("active", mode === "owned");
}

async function loadMeta() {
  state.meta = await api("/api/meta");
  els.countrySelect.innerHTML = state.meta.countries
    .map((country) => `<option value="${country.code}">${escapeHtml(translateCountry(country.code, country.label))}</option>`)
    .join("");
  els.typeSelect.innerHTML = state.meta.types
    .map((type) => `<option value="${type.code}">${escapeHtml(translateType(type.code, type.label))}</option>`)
    .join("");
  els.countrySelect.value = state.country;
  els.typeSelect.value = state.type;
}

async function loadTree() {
  state.country = els.countrySelect.value;
  state.type = els.typeSelect.value;
  setStatus("正在读取本地数据库");
  els.treeContainer.innerHTML = `<div class="loading">正在载入科技树</div>`;

  loadSavedState();

  try {
    const result = await api(`/api/tree/${state.country}/${state.type}`);
    state.tree = result.data || [];
    flattenTree(state.tree);
    setStatus(`${translateCountry(state.country)} · ${translateType(state.type)} · ${state.units.length} 个载具`);
    calculatePlan();
  } catch (err) {
    state.tree = [];
    state.units = [];
    state.groups = [];
    state.unitMap = new Map();
    state.groupMap = new Map();
    state.missing = [];
    setStatus(err.message);
    renderSummary();
    renderTree();
  }
}

function toggleUnit(id) {
  if (state.mode === "owned") {
    if (state.owned.has(id)) state.owned.delete(id);
    else state.owned.add(id);
    state.planned.delete(id);
  } else {
    if (state.planned.has(id)) state.planned.delete(id);
    else state.planned.add(id);
  }
  saveState();
  calculatePlan();
}

async function refreshCurrentTree() {
  setStatus("正在从官方 Wiki 更新当前树");
  els.refreshDataButton.disabled = true;
  try {
    const result = await api(`/api/update/${state.country}/${state.type}`, {
      method: "POST",
      body: JSON.stringify({ limit: 4 }),
    });
    state.tree = result.data || [];
    flattenTree(state.tree);
    setStatus(`已更新 ${translateCountry(state.country)} · ${translateType(state.type)}`);
    calculatePlan();
  } catch (err) {
    setStatus(err.message);
  } finally {
    els.refreshDataButton.disabled = false;
  }
}

function wireEvents() {
  els.countrySelect.addEventListener("change", loadTree);
  els.typeSelect.addEventListener("change", loadTree);

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim();
    renderTree();
  });

  els.currentRpInput.addEventListener("input", () => {
    state.currentRp = parseNumber(els.currentRpInput.value);
    saveState();
    calculatePlan();
  });

  els.folderModeSelect.addEventListener("change", () => {
    state.folderMode = els.folderModeSelect.value;
    saveState();
    calculatePlan();
  });

  els.dependencyModeSelect.addEventListener("change", () => {
    state.dependencyMode = els.dependencyModeSelect.value;
    saveState();
    calculatePlan();
  });

  els.planModeButton.addEventListener("click", () => setMode("plan"));
  els.ownedModeButton.addEventListener("click", () => setMode("owned"));

  els.clearButton.addEventListener("click", () => {
    state.planned.clear();
    saveState();
    calculatePlan();
  });

  els.refreshDataButton.addEventListener("click", refreshCurrentTree);

  window.addEventListener("resize", renderTreeConnections);

  els.treeContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unit-id]");
    if (!button) return;
    toggleUnit(button.dataset.unitId);
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-plan]");
    if (!button) return;
    state.planned.delete(button.dataset.removePlan);
    saveState();
    calculatePlan();
  });
}

async function init() {
  try {
    wireEvents();
    setMode("plan");
    await loadMeta();
    await loadTree();
  } catch (err) {
    setStatus(err.message);
  }
}

init();
