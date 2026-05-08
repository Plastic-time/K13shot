const els = {
  statusText: document.getElementById("statusText"),
  countrySelect: document.getElementById("countrySelect"),
  typeSelect: document.getElementById("typeSelect"),
  searchInput: document.getElementById("searchInput"),
  currentRpInput: document.getElementById("currentRpInput"),
  folderModeSelect: document.getElementById("folderModeSelect"),
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
  search: "",
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

function loadSavedState() {
  const saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  state.planned = new Set(saved.planned || []);
  state.owned = new Set(saved.owned || []);
  state.currentRp = parseNumber(saved.currentRp);
  state.folderMode = saved.folderMode || "all";
  els.currentRpInput.value = state.currentRp;
  els.folderModeSelect.value = state.folderMode;
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify({
    planned: [...state.planned],
    owned: [...state.owned],
    currentRp: state.currentRp,
    folderMode: state.folderMode,
  }));
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
            groups.push({ ...item, rank: rank.rank, section: sectionType, columnIndex, rowIndex });
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
    const selected = state.folderMode === "first" ? childIds.slice(0, 1) : childIds;
    return [
      ...getDependencyIds(group.required_unit_id, visited),
      ...selected.flatMap((id) => getDependencyIds(id, visited)),
      ...selected,
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
    for (const id of getDependencyIds(targetId)) {
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
    : `<span class="list-meta">${escapeHtml(unit.rank || "")}</span>`;

  return `
    <div class="list-item">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <div>
        <div class="list-title">${escapeHtml(unit.title)}</div>
        <div class="list-meta">BR ${escapeHtml(unit.br || "-")} · RP ${formatNumber(unit.rp)} · SL ${formatNumber(unit.sp)}</div>
      </div>
      ${removeButton}
    </div>`;
}

function unitMatchesSearch(unit) {
  if (!state.search) return true;
  const haystack = `${unit.title || ""} ${unit.data_unit_id || ""} ${unit.parent_group_title || ""}`.toLowerCase();
  return haystack.includes(state.search.toLowerCase());
}

function renderUnit(unit) {
  const id = unit.data_unit_id;
  const classes = ["unit-tile"];
  if (state.planned.has(id)) classes.push("planned");
  if (state.owned.has(id)) classes.push("owned");
  if (state.missing.some((missing) => missing.data_unit_id === id)) classes.push("missing");
  if (unit.section === "premium" || unit.class_name === "prem" || unit.class_name === "squad") classes.push("premium");

  return `
    <button class="${classes.join(" ")}" type="button" data-unit-id="${escapeHtml(id)}" title="${escapeHtml(id)}">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <span>
        <span class="unit-title">${escapeHtml(unit.title)}</span>
        <span class="unit-meta">
          <span class="pill">BR ${escapeHtml(unit.br || "-")}</span>
          <span class="pill rp">RP ${formatNumber(unit.rp)}</span>
          <span class="pill sp">SL ${formatNumber(unit.sp)}</span>
        </span>
      </span>
    </button>`;
}

function renderGroup(group, context) {
  const matchingItems = (group.items || []).filter(unitMatchesSearch);
  const groupMatches = unitMatchesSearch(group);
  if (!groupMatches && matchingItems.length === 0) return "";

  const items = (groupMatches ? group.items || [] : matchingItems).map((item) => renderUnit({
    ...item,
    rank: context.rank,
    section: context.section,
    parent_group_id: group.data_unit_id,
    parent_group_title: group.title,
    parent_required_unit_id: group.required_unit_id || "",
  }));

  return `
    <div class="group-tile">
      <div class="group-header">
        ${group.vehicle_icon ? `<img src="${escapeHtml(group.vehicle_icon)}" alt="">` : `<span></span>`}
        <span>${escapeHtml(group.title)}</span>
      </div>
      <div class="group-items">${items.join("")}</div>
    </div>`;
}

function renderColumn(column, context) {
  return `<div class="tree-column">${column.map((item) => {
    if (item.type === "multiple") return renderGroup(item, context);
    return unitMatchesSearch(item) ? renderUnit({ ...item, rank: context.rank, section: context.section }) : "";
  }).join("")}</div>`;
}

function renderBand(title, columns, context) {
  const visibleColumns = columns
    .map((column) => column.filter((item) => item.type === "multiple" ? unitMatchesSearch(item) || (item.items || []).some(unitMatchesSearch) : unitMatchesSearch(item)))
    .filter((column) => column.length > 0);

  if (!visibleColumns.length) return "";
  const count = Math.min(Math.max(visibleColumns.length, 1), 8);
  return `
    <div class="tree-band">
      <h3 class="band-title">${title}</h3>
      <div class="column-grid" style="grid-template-columns: repeat(${count}, minmax(148px, 1fr));">
        ${visibleColumns.map((column) => renderColumn(column, context)).join("")}
      </div>
    </div>`;
}

function renderTree() {
  if (!state.tree.length) {
    els.treeContainer.innerHTML = `<div class="loading">没有本地数据，请点击“更新当前树”</div>`;
    return;
  }

  const html = state.tree.map((rank) => {
    const researchable = renderBand("Researchable", rank.researchable_vehicles || [], { rank: rank.rank, section: "researchable" });
    const premium = renderBand("Premium", rank.premium_vehicles || [], { rank: rank.rank, section: "premium" });
    if (!researchable && !premium) return "";
    return `<article class="rank-block"><h2 class="rank-title">Rank ${escapeHtml(rank.rank)}</h2>${researchable}${premium}</article>`;
  }).join("");

  els.treeContainer.innerHTML = html || `<div class="loading">没有匹配项</div>`;
}

function setMode(mode) {
  state.mode = mode;
  els.planModeButton.classList.toggle("active", mode === "plan");
  els.ownedModeButton.classList.toggle("active", mode === "owned");
}

async function loadMeta() {
  const meta = await api("/api/meta");
  els.countrySelect.innerHTML = meta.countries.map((country) => `<option value="${country.code}">${escapeHtml(country.label)}</option>`).join("");
  els.typeSelect.innerHTML = meta.types.map((type) => `<option value="${type.code}">${escapeHtml(type.label)}</option>`).join("");
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
    setStatus(`${state.country.toUpperCase()} · ${state.type} · ${state.units.length} 个载具`);
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
    setStatus(`已更新 ${state.country.toUpperCase()} · ${state.type}`);
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
  els.searchInput.addEventListener("input", () => { state.search = els.searchInput.value.trim(); renderTree(); });
  els.currentRpInput.addEventListener("input", () => { state.currentRp = parseNumber(els.currentRpInput.value); saveState(); calculatePlan(); });
  els.folderModeSelect.addEventListener("change", () => { state.folderMode = els.folderModeSelect.value; saveState(); calculatePlan(); });
  els.planModeButton.addEventListener("click", () => setMode("plan"));
  els.ownedModeButton.addEventListener("click", () => setMode("owned"));
  els.clearButton.addEventListener("click", () => { state.planned.clear(); saveState(); calculatePlan(); });
  els.refreshDataButton.addEventListener("click", refreshCurrentTree);
  els.treeContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unit-id]");
    if (button) toggleUnit(button.dataset.unitId);
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
