const els = {
  statusText: document.getElementById("statusText"),
  countrySelect: document.getElementById("countrySelect"),
  typeSelect: document.getElementById("typeSelect"),
  searchInput: document.getElementById("searchInput"),
  languageZhButton: document.getElementById("languageZhButton"),
  languageEnButton: document.getElementById("languageEnButton"),
  dependencyModeSelect: document.getElementById("dependencyModeSelect"),
  guideButton: document.getElementById("guideButton"),
  routeExportButton: document.getElementById("routeExportButton"),
  budgetCount: document.getElementById("budgetCount"),
  budgetRp: document.getElementById("budgetRp"),
  budgetSl: document.getElementById("budgetSl"),
  budgetRpLabel: document.getElementById("budgetRpLabel"),
  budgetSlLabel: document.getElementById("budgetSlLabel"),
  usageGuideDialog: document.getElementById("usageGuideDialog"),
  planButton: document.getElementById("planButton"),

  floatingPlanCount: document.getElementById("floatingPlanCount"),
  unitContextMenu: document.getElementById("unitContextMenu"),
  unitContextTitle: document.getElementById("unitContextTitle"),
  unitContextHint: document.getElementById("unitContextHint"),
  avoidFoldedInput: document.getElementById("avoidFoldedInput"),
  clearButton: document.getElementById("clearButton"),
  refreshDataButton: document.getElementById("refreshDataButton"),
  totalRp: document.getElementById("totalRp"),
  totalSp: document.getElementById("totalSp"),
  missingCount: document.getElementById("missingCount"),
  plannedCount: document.getElementById("plannedCount"),
  pathCount: document.getElementById("pathCount"),
  plannerStatus: document.getElementById("plannerStatus"),
  ownedCount: document.getElementById("ownedCount"),
  waypointCount: document.getElementById("waypointCount"),
  plannedList: document.getElementById("plannedList"),
  missingList: document.getElementById("missingList"),
  treeContainer: document.getElementById("treeContainer"),
};

const state = {
  meta: null,
  localizedNames: {},
  tree: [],
  units: [],
  groups: [],
  unitMap: new Map(),
  groupMap: new Map(),
  initialUnlocked: new Set(),
  planned: new Set(),
  owned: new Set(),
  waypoints: new Set(),
  missing: [],
  planResult: null,
  rosterReport: null,
  country: "usa",
  type: "ground",
  folderMode: "all",
  dependencyMode: "selected",
  avoidFolded: false,
  language: "zh",
  search: "",
};

const connectionMediaQuery = window.matchMedia("(min-width: 960px) and (pointer: fine)");
let connectionTaskId = null;
let connectionMarkerSequence = 0;
const connectionMarkerIds = new WeakMap();


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
  return String(value || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[\u00a0\u807d]/g, " ").replace(/\s+/g, " ").trim();
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

function localizedTitles(unit) {
  const id = cleanText(unit?.data_unit_id).toLowerCase();
  const localized = state.localizedNames[id] || {};
  const fallback = cleanText(unit?.title);
  return {
    en: cleanText(localized.en || fallback),
    zh: cleanText(localized.zh || unit?.title_zh || unit?.zh_title || unit?.cn_title || localized.en || fallback),
  };
}

function displayTitle(unit) {
  const titles = localizedTitles(unit);
  return titles[state.language] || titles.en;
}

function updateLanguageControls() {
  for (const [language, button] of [["zh", els.languageZhButton], ["en", els.languageEnButton]]) {
    const active = state.language === language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function setLanguage(language) {
  if (!["zh", "en"].includes(language) || state.language === language) return;
  state.language = language;
  localStorage.setItem("wt-research:vehicle-language", language);
  updateLanguageControls();
  renderSummary();
  renderTree();
}

async function loadLocalizedNames() {
  const response = await fetch("/vehicle-names.json?v=371120be", { cache: "no-cache" });
  if (!response.ok) throw new Error("中英文载具名称暂不可用");
  const payload = await response.json();
  if (payload.schema !== 1 || !payload.names) throw new Error("中英文载具名称格式错误");
  state.localizedNames = payload.names;
  state.language = localStorage.getItem("wt-research:vehicle-language") === "en" ? "en" : "zh";
  updateLanguageControls();
}

function displayRank(rank) {
  return `等级 ${cleanText(rank)}`;
}

function sectionLabel(section) {
  return zh.sections[section] || section;
}

function getRankUnlockQuantity(rank) {
  return parseNumber(rank.unlock_quantity);
}

function getUnlockCountVehicleIds() {
  const ids = new Set([...state.initialUnlocked, ...state.owned]);
  const source = state.planResult?.selectedIds || [...state.planned];
  source.forEach((id) => ids.add(id));
  return [...ids];
}

function getSelectedVehicleCount(rankValue) {
  let count = 0;
  for (const id of getUnlockCountVehicleIds()) {
    const unit = state.unitMap.get(id);
    if (unit && unit.rank === rankValue) count += 1;
  }
  return count;
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

function getGroupMainChildId(group) {
  return (group.items || []).map((item) => item.data_unit_id).find(Boolean) || "";
}

function isFirstRankValue(rank) {
  const value = cleanText(rank).toLowerCase();
  return value === "i" || value === "1";
}

function getRankOrder(rank) {
  const value = cleanText(rank).toLowerCase();
  const roman = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
  };
  return roman[value] || parseNumber(value) || Number.MAX_SAFE_INTEGER;
}

function getSectionOrder(section) {
  return section === "researchable" ? 0 : 1;
}

function compareUnitsByProgression(a, b) {
  return (
    getRankOrder(a.rank) - getRankOrder(b.rank) ||
    getSectionOrder(a.section) - getSectionOrder(b.section) ||
    parseNumber(a.columnIndex) - parseNumber(b.columnIndex) ||
    parseNumber(a.rowIndex) - parseNumber(b.rowIndex) ||
    displayTitle(a).localeCompare(displayTitle(b), "zh-CN")
  );
}

function getIndexedItem(id) {
  return state.unitMap.get(id) || state.groupMap.get(id);
}

function shouldIgnoreRequirement(unit, reqId) {
  if (!unit || !reqId) return false;
  if (isFirstRankValue(unit.rank)) return true;

  const requiredItem = getIndexedItem(reqId);
  return requiredItem ? isFirstRankValue(requiredItem.rank) : false;
}

function isInitialUnlockedUnit(unit) {
  if (!unit) return false;
  const className = cleanText(unit.class_name).toLowerCase();
  return (
    unit.section === "researchable" &&
    isFirstRankValue(unit.rank) &&
    !["prem", "premium", "squad", "event", "gift"].includes(className) &&
    parseNumber(unit.rp) === 0 &&
    parseNumber(unit.sp) === 0
  );
}

function isSquadronUnit(unit) {
  if (!unit) return false;
  const className = cleanText(unit.class_name).toLowerCase();
  return unit.is_squadron === true || unit.isSquadron === true || className === "squad";
}

function loadSavedState() {
  const saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  state.planned = new Set(saved.planned || []);
  state.owned = new Set(saved.owned || []);
  state.waypoints = new Set(saved.waypoints || []);
  state.avoidFolded = saved.avoidFolded === true;
  state.planResult = null;
  state.folderMode = "all";
  state.dependencyMode = saved.dependencyMode || "selected";
  els.dependencyModeSelect.value = state.dependencyMode;
  els.avoidFoldedInput.checked = state.avoidFolded;
}

function saveState() {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      planned: [...state.planned],
      owned: [...state.owned],
      waypoints: [...state.waypoints],
      avoidFolded: state.avoidFolded,
      dependencyMode: state.dependencyMode,
    })
  );
}

function flattenTree(tree) {
  const units = [];
  const groups = [];
  const previousByColumn = {
    researchable: [],
    premium: [],
  };
  let rankIndex = 0;

  for (const rank of tree) {
    if (rankIndex === 1) previousByColumn.researchable = [];

    for (const section of ["researchable_vehicles", "premium_vehicles"]) {
      const sectionType = section === "premium_vehicles" ? "premium" : "researchable";
      const columns = rank[section] || [];
      columns.forEach((column, columnIndex) => {
        let previousDependencyId = previousByColumn[sectionType][columnIndex] || "";
        column.forEach((item, rowIndex) => {
          const inferredReqId = sectionType === "researchable" ? previousDependencyId : "";
          if (item.type === "multiple") {
            const groupReqId = item.required_unit_id || inferredReqId;
            const groupMainChildId = getGroupMainChildId(item);
            const squadronGroup = isSquadronUnit(item);
            const group = {
              ...item,
              is_squadron: squadronGroup,
              required_unit_id: groupReqId,
              rank: rank.rank,
              section: sectionType,
              columnIndex,
              rowIndex,
            };
            groups.push(group);
            (item.items || []).forEach((subItem, subIndex) => {
              const subReqId = subItem.required_unit_id || groupReqId;
              units.push({
                ...subItem,
                class_name: subItem.class_name || (squadronGroup ? "squad" : ""),
                is_squadron: squadronGroup || subItem.is_squadron === true,
                required_unit_id: subReqId,
                rank: rank.rank,
                section: sectionType,
                parent_group_id: item.data_unit_id,
                parent_group_title: item.title,
                parent_required_unit_id: groupReqId,
                columnIndex,
                rowIndex: rowIndex + subIndex / 10,
              });
            });
            if (sectionType === "researchable") {
              previousDependencyId = groupMainChildId || item.data_unit_id || previousDependencyId;
              previousByColumn[sectionType][columnIndex] = previousDependencyId;
            }
          } else if (item.type === "single") {
            const reqId = item.required_unit_id || inferredReqId;
            units.push({ ...item, required_unit_id: reqId, rank: rank.rank, section: sectionType, columnIndex, rowIndex });
            if (sectionType === "researchable") {
              previousDependencyId = item.data_unit_id || previousDependencyId;
              previousByColumn[sectionType][columnIndex] = previousDependencyId;
            }
          }
        });
      });
    }
    rankIndex += 1;
  }

  state.units = units;
  state.groups = groups;
  state.unitMap = new Map(units.map((unit) => [unit.data_unit_id, unit]));
  state.groupMap = new Map(groups.map((group) => [group.data_unit_id, group]));
  state.initialUnlocked = new Set(units.filter(isInitialUnlockedUnit).map((unit) => unit.data_unit_id));
  state.initialUnlocked.forEach((id) => state.planned.delete(id));
  state.initialUnlocked.forEach((id) => state.owned.delete(id));
  state.initialUnlocked.forEach((id) => state.waypoints.delete(id));
}

function getDependencyIds(unitId, visited = new Set()) {
  if (!unitId || visited.has(unitId)) return [];
  visited.add(unitId);

  const unit = state.unitMap.get(unitId);
  if (!unit) {
    const group = state.groupMap.get(unitId);
    if (group) {
      const mainChildId = getGroupMainChildId(group);
      if (mainChildId && mainChildId !== unitId) return getDependencyIds(mainChildId, visited);
      return getDependencyIds(group.required_unit_id, visited);
    }

    return [];
  }

  const parentReq = unit.parent_required_unit_id && !unit.required_unit_id ? unit.parent_required_unit_id : "";
  const reqId = unit.required_unit_id || parentReq;
  const dependencyIds = shouldIgnoreRequirement(unit, reqId) ? [] : getDependencyIds(reqId, visited);
  return [...dependencyIds, unitId];
}

function calculatePlan() {
  const orderedIds = state.planResult?.selectedIds || [...state.planned];

  state.missing = orderedIds
    .map((id) => state.unitMap.get(id))
    .filter((unit) => unit && !isInitialUnlockedUnit(unit))
    .filter(Boolean)
    .sort(compareUnitsByProgression);

  renderSummary();
  renderTree();
}

function invalidateExactPlan() {
  state.planResult = null;
}

const contextModeLabels = {
  target: ["设为目标", "取消目标"],
  owned: ["标记为已拥有", "取消拥有标记"],
  waypoint: ["设为途经点", "取消途经点"],
};

function getModeSet(mode) {
  if (mode === "owned") return state.owned;
  if (mode === "waypoint") return state.waypoints;
  return state.planned;
}

function closeUnitContextMenu() {
  if (!els.unitContextMenu) return;
  els.unitContextMenu.hidden = true;
  delete els.unitContextMenu.dataset.unitId;
}

function openUsageGuide() {
  closeUnitContextMenu();
  if (els.usageGuideDialog && !els.usageGuideDialog.open) els.usageGuideDialog.showModal();
}

function closeUsageGuide() {
  if (els.usageGuideDialog?.open) els.usageGuideDialog.close();
}

function openUnitContextMenu(id, clientX, clientY) {
  const unit = state.unitMap.get(id);
  if (!unit || !els.unitContextMenu) return;
  const initial = state.initialUnlocked.has(id);
  els.unitContextMenu.dataset.unitId = id;
  els.unitContextTitle.textContent = displayTitle(unit);
  els.unitContextHint.textContent = initial ? "初始载具已经自动计入，无需设置" : "再次选择当前状态即可取消";
  els.unitContextMenu.querySelectorAll("[data-context-action]").forEach((button) => {
    const mode = button.dataset.contextAction;
    const active = getModeSet(mode).has(id);
    button.disabled = initial;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
    button.querySelector("[data-context-label]").textContent = contextModeLabels[mode][active ? 1 : 0];
  });
  els.unitContextMenu.hidden = false;
  els.unitContextMenu.style.left = "0px";
  els.unitContextMenu.style.top = "0px";
  const rect = els.unitContextMenu.getBoundingClientRect();
  const left = Math.max(8, Math.min(clientX, document.documentElement.clientWidth - rect.width - 8));
  const top = Math.max(8, Math.min(clientY, window.innerHeight - rect.height - 8));
  els.unitContextMenu.style.left = `${Math.round(left)}px`;
  els.unitContextMenu.style.top = `${Math.round(top)}px`;
}

function toggleUnitMode(id, mode) {
  if (state.initialUnlocked.has(id)) return;
  const targetSet = getModeSet(mode);
  if (targetSet.has(id)) {
    targetSet.delete(id);
  } else {
    state.planned.delete(id);
    state.owned.delete(id);
    state.waypoints.delete(id);
    targetSet.add(id);
  }
  invalidateExactPlan();
  saveState();
  calculatePlan();
}

async function loadRosterReport() {
  try {
    const response = await fetch("/roster-audit.json?v=roster-1", { cache: "no-cache" });
    if (response.ok) state.rosterReport = await response.json();
  } catch {
    state.rosterReport = null;
  }
}

function runExactPlan() {
  if (!state.planned.size && !state.waypoints.size) {
    els.plannerStatus.textContent = "请先选择至少一个目标或途经点";
    return;
  }
  if (!window.LocalPlanner?.plan) {
    els.plannerStatus.textContent = "本地规划器未能载入";
    return;
  }
  setPlanButtonsDisabled(true);
  els.plannerStatus.textContent = "正在本机搜索最低 RP 路线";
  window.setTimeout(() => {
    try {
      const rosterUnits = state.rosterReport?.trees?.[`${state.country}/${state.type}`]?.units || {};
      const hiddenIds = Object.entries(rosterUnits).filter(([, unit]) => unit.hidden).map(([id]) => id);
      state.planResult = window.LocalPlanner.plan({
        units: state.units,
        groups: state.groups,
        ranks: state.tree.map(rank => ({ rank: rank.rank, unlockQuantity: getRankUnlockQuantity(rank) })),
        initialIds: [...state.initialUnlocked],
        ownedIds: [...state.owned],
        targetIds: [...state.planned],
        waypointIds: [...state.waypoints],
        hiddenIds,
        avoidFolded: state.avoidFolded,
        timeLimitMs: 1800,
      });
      calculatePlan();
      saveState();
    } catch (error) {
      state.planResult = null;
      els.plannerStatus.textContent = `规划失败：${error.message}`;
    } finally {
      setPlanButtonsDisabled(false);
    }
  }, 20);
}

function setPlanButtonsDisabled(disabled) {
  els.planButton.disabled = disabled;
  els.planButton.querySelector("[data-plan-button-label]").textContent = disabled ? "规划中" : "精确规划";
}


function renderSummary() {
  const plannedUnits = [...state.planned].map((id) => state.unitMap.get(id)).filter(Boolean).sort(compareUnitsByProgression);
  const rawRp = state.missing.reduce((sum, unit) => sum + parseNumber(unit.rp), 0);
  const totalSp = state.missing.reduce((sum, unit) => sum + parseNumber(unit.sp), 0);

  els.totalRp.textContent = formatNumber(rawRp);
  els.totalSp.textContent = formatNumber(totalSp);
  els.missingCount.textContent = state.missing.length;
  els.plannedCount.textContent = plannedUnits.length;
  els.pathCount.textContent = state.missing.length;
  els.ownedCount.textContent = state.owned.size;
  els.waypointCount.textContent = state.waypoints.size;
  els.floatingPlanCount.textContent = `目标 ${state.planned.size} · 途经点 ${state.waypoints.size}`;
  els.budgetCount.textContent = state.missing.length;
  els.budgetRp.textContent = formatNumber(rawRp);
  els.budgetSl.textContent = formatNumber(totalSp);
  els.budgetRpLabel.textContent = state.missing.some(unit => unit.rp == null) ? "已知 RP" : "RP";
  els.budgetSlLabel.textContent = state.missing.some(unit => unit.sp == null) ? "已知 SL" : "SL";
  els.routeExportButton.disabled = !state.units.length || window.RouteExporter?.isBusy();

  if (state.planResult) {
    const result = state.planResult;
    const mainStatus = result.feasible
      ? (result.searchComplete ? "已找到最低 RP 路线" : "已返回当前找到的最低路线")
      : "当前数据无法组成完整路线";
    const details = `${result.fillerIds.length} 个等级补足 · ${result.exploredStates.toLocaleString("en-US")} 个方案状态 · ${result.elapsedMs} ms`;
    els.plannerStatus.textContent = `${mainStatus} · ${details}${result.warnings.length ? ` · ${result.warnings.join(" ")}` : ""}`;
  } else {
    els.plannerStatus.textContent = state.planned.size || state.waypoints.size
      ? "计划已改变，请点击“精确规划”重新计算"
      : "选择目标后点击“精确规划”";
  }

  els.plannedList.innerHTML = plannedUnits.length
    ? plannedUnits.map((unit) => renderListItem(unit, true)).join("")
    : `<div class="empty-state">暂无选择</div>`;

  els.missingList.innerHTML = state.missing.length
    ? state.missing.map((unit) => renderListItem(unit, false)).join("")
    : `<div class="empty-state">暂无计算结果</div>`;
}

function getRouteKind(unit) {
  const id = unit.data_unit_id;
  if (state.planned.has(id)) return "目标";
  if (state.waypoints.has(id)) return "途经点";
  if (state.planResult?.fillerIds?.includes(id)) return "等级补足";
  return "必经路线";
}

function buildRouteExportPayload() {
  const hasUnknownRp = state.missing.some((unit) => unit.rp == null);
  const hasUnknownSl = state.missing.some((unit) => unit.sp == null);
  const totalRp = state.missing.reduce((sum, unit) => sum + parseNumber(unit.rp), 0);
  const totalSl = state.missing.reduce((sum, unit) => sum + parseNumber(unit.sp), 0);
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10);

  return {
    country: translateCountry(state.country),
    type: translateType(state.type),
    generatedAt: new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date),
    targetCount: state.planned.size,
    pendingCount: state.missing.length,
    rpLabel: hasUnknownRp ? "已知 RP" : "总 RP",
    slLabel: hasUnknownSl ? "已知 SL" : "总 SL",
    totalRp: formatNumber(totalRp),
    totalSl: formatNumber(totalSl),
    filename: `war-thunder-route-${state.country}-${state.type}-${stamp}.png`,
    routes: state.missing.map((unit) => ({
      title: displayTitle(unit),
      rank: displayRank(unit.rank || "-"),
      br: cleanText(unit.br) || "-",
      rp: unit.rp == null ? "未提供" : formatNumber(unit.rp),
      sl: unit.sp == null ? "未提供" : formatNumber(unit.sp),
      kind: getRouteKind(unit),
    })),
  };
}

async function exportRouteImage() {
  if (!state.units.length || window.RouteExporter?.isBusy()) return;
  if (!window.RouteExporter?.download) {
    setStatus("路线图生成器未能载入");
    return;
  }

  els.routeExportButton.disabled = true;
  els.routeExportButton.textContent = "正在生成截图…";
  try {
    await window.RouteExporter.download(buildRouteExportPayload(), els.treeContainer.querySelector(".tree-canvas"), renderTreeConnections);
    setStatus("完整科技树截图已下载");
  } catch (error) {
    setStatus(`路线图生成失败：${error.message}`);
  } finally {
    els.routeExportButton.disabled = !state.units.length;
    els.routeExportButton.textContent = "导出科技树截图";
  }
}

window.WTRouteExport = {
  buildPayload: buildRouteExportPayload,
  render: () => window.RouteExporter?.render(buildRouteExportPayload(), els.treeContainer.querySelector(".tree-canvas"), renderTreeConnections),
};

function renderListItem(unit, removable) {
  const removeButton = removable
    ? `<button class="mini-button" type="button" data-remove-plan="${escapeHtml(unit.data_unit_id)}">移除</button>`
    : `<span class="list-meta">${escapeHtml(displayRank(unit.rank || ""))}</span>`;
  const role = translateRole(unit.main_role);
  const routeLabel = !removable && state.planResult
    ? (state.planResult.fillerIds.includes(unit.data_unit_id) ? " · 等级补足" : " · 必经路线")
    : "";

  return `
    <div class="list-item">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <div>
        <div class="list-title">${escapeHtml(displayTitle(unit))}</div>
        <div class="list-meta">BR ${escapeHtml(unit.br || "-")} · RP ${formatCost(unit.rp)} · SL ${formatCost(unit.sp)}${role ? ` · ${escapeHtml(role)}` : ""}${routeLabel}</div>
      </div>
      ${removeButton}
    </div>
  `;
}

function unitMatchesSearch(unit) {
  if (!state.search) return true;
  const titles = localizedTitles(unit);
  const parentTitles = state.localizedNames[cleanText(unit.parent_group_id).toLowerCase()] || {};
  const haystack =
    `${titles.zh} ${titles.en} ${unit.title || ""} ${unit.data_unit_id || ""} ${parentTitles.zh || ""} ${parentTitles.en || ""} ${unit.parent_group_title || ""} ${translateRole(unit.main_role)}`.toLowerCase();
  return haystack.includes(state.search.toLowerCase());
}

function renderUnit(unit, inFolder = false) {
  const id = unit.data_unit_id;
  const autoSelected = inFolder && state.planResult?.selectedIds.includes(id)
    && !state.owned.has(id) && !state.planned.has(id) && !state.waypoints.has(id);
  const update = window.WTVehicleUpdates;
  const isNew = update?.trees?.[`${state.country}/${state.type}`]?.includes(id);
  const updateTip = isNew ? (state.language === "en"
    ? `Added to this calculator snapshot on ${update.date}; not necessarily newly released in game.`
    : `${update.date} 数据更新新增收录；不一定是游戏本次新推出的载具。`) : "";
  const updateBadge = isNew ? `<span class="unit-update-label" title="${escapeHtml(updateTip)}">${state.language === "en" ? "NEW" : "新增"}</span> ` : "";
  const classes = ["unit-tile"];
  if (autoSelected) classes.push("auto-planned");
  const className = cleanText(unit.class_name).toLowerCase();
  const squadron = isSquadronUnit(unit);
  if (state.planned.has(id)) classes.push("planned");
  if (state.owned.has(id)) classes.push("owned");
  if (state.waypoints.has(id)) classes.push("waypoint");
  if (state.planResult?.fillerIds.includes(id)) classes.push("rank-filler");
  if (state.missing.some((missing) => missing.data_unit_id === id)) classes.push("missing");
  if (isInitialUnlockedUnit(unit)) classes.push("unlocked");
  if (squadron) classes.push("squadron");
  if (className) classes.push(className);
  if (unit.section === "premium" || className === "prem" || className === "premium") classes.push("premium");
  const role = translateRole(unit.main_role);
  const unlocked = isInitialUnlockedUnit(unit);

  const modificationButton = window.ModificationWorkbench?.hasVehicle(id)
    ? `<button class="unit-modifications-launch" type="button" data-modifications-id="${escapeHtml(id)}" aria-label="打开 ${escapeHtml(displayTitle(unit))} 配件研发" title="配件研发"><span aria-hidden="true">⚙</span><b>配件</b></button>`
    : "";

  return `
    <div class="unit-tile-shell${modificationButton ? " has-modifications" : ""}">
    <button class="${classes.join(" ")}" type="button" data-unit-id="${escapeHtml(id)}" title="${escapeHtml(id)} · 右键或长按设置目标、已拥有或途经点">
      ${unit.vehicle_icon ? `<img src="${escapeHtml(unit.vehicle_icon)}" alt="">` : `<span></span>`}
      <span>
        <span class="unit-title">${updateBadge}${escapeHtml(displayTitle(unit))}</span>
        <span class="unit-meta">
          ${window.RosterAudit?.badges(state.country, state.type, unit, displayTitle(unit)) || ""}
          <span class="pill">BR ${escapeHtml(unit.br || "-")}</span>
          ${squadron ? `<span class="pill squadron-label">联队载具</span>` : `<span class="pill rp">RP ${formatCost(unit.rp)}</span><span class="pill sp">SL ${formatCost(unit.sp)}</span>`}
          ${unlocked ? `<span class="pill unlocked">初始载具</span>` : ""}
          ${state.planned.has(id) ? `<span class="pill target-label">目标</span>` : ""}
          ${state.owned.has(id) ? `<span class="pill owned-label">已拥有</span>` : ""}
          ${state.waypoints.has(id) ? `<span class="pill waypoint-label">途经点</span>` : ""}
          ${autoSelected ? `<span class="pill auto-planned-label">${state.language === "en" ? "Selected" : "已选"} · ${state.planResult.fillerIds.includes(id) ? (state.language === "en" ? "Rank filler" : "等级补足") : (state.language === "en" ? "Required route" : "必经路线")}</span>` : ""}
          ${state.planResult?.fillerIds.includes(id) ? `<span class="pill filler-label">等级补足</span>` : ""}
          ${role ? `<span class="pill role">${escapeHtml(role)}</span>` : ""}
        </span>
      </span>
      ${isNew ? '<span class="unit-update-edge" aria-hidden="true"></span>' : ""}
    </button>${modificationButton}
    </div>
  `;
}

function renderGroup(group, context) {
  const matchingItems = (group.items || []).filter(unitMatchesSearch);
  const groupMatches = unitMatchesSearch(group);
  if (!groupMatches && matchingItems.length === 0) return "";
  const className = cleanText(group.class_name).toLowerCase();
  const squadronGroup = isSquadronUnit(group);
  const classes = ["group-tile", "folder-tile"];
  if (className) classes.push(className);
  if (context.section === "premium" || className === "prem" || className === "premium") classes.push("premium");

  const children = group.items || [];
  if (!children.length) return "";
  const key = `${state.country}/${state.type}/${group.data_unit_id}`;
  const folded = children.slice(1);
  const selectedIds = new Set(state.planResult?.selectedIds || [...state.planned, ...state.waypoints]);
  const selectedCount = children.filter(item =>
    !state.owned.has(item.data_unit_id) &&
    selectedIds.has(item.data_unit_id)
  ).length;
  const selected = folded.filter(item => selectedIds.has(item.data_unit_id) || state.owned.has(item.data_unit_id)).length;
  const hasNew = folded.some(item => window.WTVehicleUpdates?.trees?.[`${state.country}/${state.type}`]?.includes(item.data_unit_id));
  const matches = state.search ? folded.filter(unitMatchesSearch).length : 0;
  const en = state.language === "en";
  const items = children.slice(0, 1).map((item) =>
    renderUnit({
      ...item,
      class_name: item.class_name || (squadronGroup ? "squad" : ""),
      is_squadron: squadronGroup || item.is_squadron === true,
      rank: context.rank,
      section: context.section,
      parent_group_id: group.data_unit_id,
      parent_group_title: group.title,
      parent_required_unit_id: group.required_unit_id || "",
    })
  );

  return `
    <div class="${classes.join(" ")}">
      ${items[0]}
      ${folded.length && selectedCount ? `<span class="folder-selection-count" data-selected-count="${selectedCount}" title="${en ? "Selected vehicles in the current route, including the main vehicle and automatically planned vehicles; owned vehicles excluded." : "本组当前路线已选载具，含主载具及自动规划载具，不含已拥有载具。"}">${en ? `${selectedCount} selected` : `已选 ${selectedCount} 辆`}</span>` : ""}
      ${folded.length ? `<button type="button" class="folder-toggle${selected ? " has-selection" : ""}${hasNew ? " has-new" : ""}${matches ? " has-match" : ""}"
        data-folder-key="${escapeHtml(key)}" data-folder-group="${escapeHtml(group.data_unit_id)}"
        aria-expanded="false" aria-haspopup="dialog"
        aria-label="${escapeHtml(displayTitle(group))} · ${children.length} ${en ? "vehicles" : "辆"}"
        title="${escapeHtml(displayTitle(group))} · ${children.length} ${en ? "vehicles" : "辆"}${selected ? ` · ${en ? "Marked" : "已标记"} ${selected}` : ""}${matches ? ` · ${en ? "Matches" : "匹配"} ${matches}` : ""}${hasNew ? ` · ${en ? "NEW" : "新增"}` : ""}"><span aria-hidden="true">≡</span></button>` : ""}
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

function visibleTreeColumns(columns) {
  return columns.map(column => column.filter(item => item.type === "multiple"
    ? unitMatchesSearch(item) || (item.items || []).some(unitMatchesSearch)
    : unitMatchesSearch(item)));
}

function renderBand(columns, context) {
  const visibleColumns = visibleTreeColumns(columns);

  if (!visibleColumns.some((column) => column.length > 0)) return "";

  const count = context.columnCount;
  const sectionClass = `${context.section}-band`;
  return `
    <div class="tree-band ${sectionClass}">
      <div class="column-grid" style="grid-template-columns: repeat(${count}, 168px);">
        ${visibleColumns.map((column) => renderColumn(column, context)).join("")}
      </div>
    </div>
  `;
}

function resolveRequirementSources(reqId) {
  if (!reqId) return [];
  const group = state.groupMap.get(reqId);
  if (!group) return [reqId];

  const mainChildId = getGroupMainChildId(group);
  return mainChildId ? [mainChildId] : [reqId];
}

function getDisplayRequirement(unit) {
  // Draw the stored relationship without applying research-planning exemptions.
  return unit?.required_unit_id || unit?.parent_required_unit_id || "";
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
  const direction = fromAbove ? 1 : -1;
  const folderToggle = from.closest(".folder-tile")?.querySelector(".folder-toggle");
  if (fromAbove && folderToggle) start.y = Math.max(start.y, folderToggle.getBoundingClientRect().bottom - canvasBox.top);
  start.y += 4 * direction;
  // The main-tree shaft stops at the arrowhead base, leaving the tip clear of the card.
  end.y -= (from.closest(".folder-popup") ? 5 : 15) * direction;
  const sameColumn = Math.abs(start.x - end.x) < 6;
  const gap = Math.abs(end.y - start.y);
  const minStub = 14;

  if (sameColumn) {
    return `M ${svgNumber(start.x)} ${svgNumber(start.y)} V ${svgNumber(end.y)}`;
  }

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

function renderTreeConnections(exportCanvas = null) {
  const canvas = exportCanvas || els.treeContainer.querySelector(".tree-canvas");
  const svg = canvas?.querySelector(".tree-links");
  if (!svg || !canvas) return;

  svg.innerHTML = "";
  svg.setAttribute("width", canvas.scrollWidth);
  svg.setAttribute("height", canvas.scrollHeight);
  svg.setAttribute("viewBox", `0 0 ${canvas.scrollWidth} ${canvas.scrollHeight}`);

  const canvasBox = canvas.getBoundingClientRect();
  const visibleTiles = new Map(
    [...canvas.querySelectorAll(".unit-tile[data-unit-id]")]
      .filter(tile => !tile.closest("details:not([open])"))
      .map((tile) => [tile.dataset.unitId, tile])
  );
  const segments = [];
  if (!connectionMarkerIds.has(svg)) connectionMarkerIds.set(svg, `tree-arrow-${++connectionMarkerSequence}`);
  const markerId = connectionMarkerIds.get(svg);

  for (const [id, to] of visibleTiles.entries()) {
    const unit = state.unitMap.get(id);
    const reqId = getDisplayRequirement(unit);
    for (const sourceId of resolveRequirementSources(reqId)) {
      const sourceGroup = state.groupMap.get(state.unitMap.get(sourceId)?.parent_group_id);
      const from = visibleTiles.get(sourceId) || (sourceGroup && visibleTiles.get(getGroupMainChildId(sourceGroup)));
      if (!from || !to || from === to) continue;

      segments.push(`<path data-from="${escapeHtml(from.dataset.unitId)}" data-to="${escapeHtml(id)}" d="${renderOrthogonalConnector(from, to, canvasBox)}" marker-end="url(#${markerId})" />`);
    }
  }

  svg.innerHTML = `<defs><marker id="${markerId}" viewBox="0 0 10 20" refX="0" refY="10" markerWidth="10" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto"><polygon points="0,0 10,10 0,20" fill="#657f8a"/></marker></defs>` + segments.join("");
}

function scheduleTreeConnections() {
  if (connectionTaskId !== null) {
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(connectionTaskId);
    else window.clearTimeout(connectionTaskId);
  }

  const render = () => {
    connectionTaskId = null;
    renderTreeConnections();
  };

  if (typeof window.requestIdleCallback === "function") {
    connectionTaskId = window.requestIdleCallback(render, { timeout: 500 });
  } else {
    connectionTaskId = window.setTimeout(render, 40);
  }
}

function renderRankUnlockGate(rank, nextRank) {
  const quantity = getRankUnlockQuantity(rank);
  const selected = getSelectedVehicleCount(rank.rank);
  const complete = quantity > 0 && selected >= quantity;
  const targetLabel = nextRank ? `解锁${displayRank(nextRank.rank)}` : "后续等级要求";

  return `
    <div class="rank-unlock-line ${quantity ? "" : "is-zero"} ${complete ? "is-complete" : ""}" aria-label="已选择 ${selected} 个，${targetLabel}需要 ${quantity} 个载具">
      <span>${targetLabel}：${selected} / ${quantity}</span>
    </div>
  `;
}

function renderRankRail(rank) {
  const quantity = getRankUnlockQuantity(rank);
  const selected = getSelectedVehicleCount(rank.rank);
  const complete = quantity > 0 && selected >= quantity;

  return `
    <div class="rank-rail ${complete ? "is-complete" : ""}">
      <span class="rank-name">${escapeHtml(displayRank(rank.rank))}</span>
    </div>
  `;
}

function renderTree() {
  window.VehicleFolders?.beforeTreeRender();
  if (!state.tree.length) {
    els.treeContainer.innerHTML = `<div class="loading">没有本地数据</div>`;
    return;
  }

  const researchColumns = Math.max(0, ...state.tree.map(rank => (rank.researchable_vehicles || []).length));
  const premiumColumns = Math.max(0, ...state.tree.map(rank => (rank.premium_vehicles || []).length));
  const columnWidth = count => count ? count * 168 + (count - 1) * 8 : 0;
  const html = state.tree
    .map((rank, index, ranks) => {
      const researchable = renderBand(rank.researchable_vehicles || [], {
        rank: rank.rank,
        section: "researchable",
        columnCount: researchColumns,
      });
      const premium = renderBand(rank.premium_vehicles || [], {
        rank: rank.rank,
        section: "premium",
        columnCount: premiumColumns,
      });
      if (!researchable && !premium) return "";
      const rows = Math.max(1, ...visibleTreeColumns([
        ...(rank.researchable_vehicles || []), ...(rank.premium_vehicles || []),
      ]).map(column => column.length));
      return `
        <article class="rank-block">
          ${renderRankRail(rank)}
          <div class="rank-field" style="grid-template-rows: repeat(${rows}, max-content);">
            ${researchable}
            ${premium}
          </div>
          ${renderRankUnlockGate(rank, ranks[index + 1])}
        </article>
      `;
    })
    .join("");

  els.treeContainer.innerHTML = html
    ? `<div class="tree-canvas" style="--research-width: ${columnWidth(researchColumns)}px; --premium-width: ${premiumColumns ? columnWidth(premiumColumns) + 27 : 0}px;"><svg class="tree-links" aria-hidden="true"></svg><div class="tree-content"><div class="tree-headings rank-field">${researchColumns ? `<h3 class="band-title researchable-title">${sectionLabel("researchable")}</h3>` : ""}${premiumColumns ? `<h3 class="band-title premium-title">${sectionLabel("premium")}</h3>` : ""}</div>${html}</div></div>`
    : `<div class="loading">没有匹配项</div>`;
  scheduleTreeConnections();

  window.VehicleFolders?.refresh();
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
  closeUnitContextMenu();
  state.country = els.countrySelect.value;
  state.type = els.typeSelect.value;
  setStatus("正在读取科技树数据");
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
    state.initialUnlocked = new Set();
    state.missing = [];
    setStatus(err.message);
    renderSummary();
    renderTree();
  }
}

function toggleUnit(id) {
  toggleUnitMode(id, "target");
}

async function refreshCurrentTree() {
  setStatus("正在从官方 Wiki 更新当前树");
  els.refreshDataButton.disabled = true;
  try {
    const session = await api("/api/session", { cache: "no-store" });
    const result = await api(`/api/update/${state.country}/${state.type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-WT-Update-Token": session.token },
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
  window.VehicleLongPress?.configure({ open: openUnitContextMenu, close: closeUnitContextMenu });
  els.countrySelect.addEventListener("change", loadTree);
  els.typeSelect.addEventListener("change", loadTree);
  els.languageZhButton.addEventListener("click", () => setLanguage("zh"));
  els.languageEnButton.addEventListener("click", () => setLanguage("en"));

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim();
    renderTree();
  });

  els.dependencyModeSelect.addEventListener("change", () => {
    state.dependencyMode = els.dependencyModeSelect.value;
    saveState();
    calculatePlan();
  });

  els.avoidFoldedInput.addEventListener("change", () => {
    state.avoidFolded = els.avoidFoldedInput.checked;
    invalidateExactPlan();
    saveState();
    calculatePlan();
  });

  els.planButton.addEventListener("click", runExactPlan);

  els.guideButton.addEventListener("click", openUsageGuide);
  els.routeExportButton.addEventListener("click", exportRouteImage);

  els.usageGuideDialog.addEventListener("click", (event) => {
    if (event.target === els.usageGuideDialog || event.target.closest("[data-guide-close]")) closeUsageGuide();
  });

  els.clearButton.addEventListener("click", () => {
    state.planned.clear();
    state.owned.clear();
    state.waypoints.clear();
    invalidateExactPlan();
    saveState();
    calculatePlan();
  });

  els.refreshDataButton.addEventListener("click", refreshCurrentTree);

  window.addEventListener("resize", scheduleTreeConnections, { passive: true });

  if (typeof connectionMediaQuery.addEventListener === "function") {
    connectionMediaQuery.addEventListener("change", scheduleTreeConnections);
  } else {
    connectionMediaQuery.addListener(scheduleTreeConnections);
  }

  window.VehicleFolders?.configure({
    tree: els.treeContainer,
    group: id => {
      const group = state.groupMap.get(id);
      return group ? {
        title: displayTitle(group),
        html: (group.items || []).map(item => renderUnit(state.unitMap.get(item.data_unit_id), true)).join(""),
      } : null;
    },
    select: toggleUnit,
    context: openUnitContextMenu,
    closeContext: closeUnitContextMenu,
    draw: renderTreeConnections,
  });

  els.treeContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unit-id]");
    if (!button) return;
    toggleUnit(button.dataset.unitId);
  });

  els.treeContainer.addEventListener("contextmenu", (event) => {
    const tile = event.target.closest("[data-unit-id]");
    if (!tile) return;
    event.preventDefault();
    openUnitContextMenu(tile.dataset.unitId, event.clientX, event.clientY);
  });

  els.treeContainer.addEventListener("keydown", (event) => {
    const tile = event.target.closest("[data-unit-id]");
    if (!tile || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
    event.preventDefault();
    const rect = tile.getBoundingClientRect();
    openUnitContextMenu(tile.dataset.unitId, rect.left + Math.min(rect.width, 48), rect.top + Math.min(rect.height, 36));
  });

  els.unitContextMenu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-context-action]");
    const id = els.unitContextMenu.dataset.unitId;
    if (!action || !id || action.disabled) return;
    closeUnitContextMenu();
    toggleUnitMode(id, action.dataset.contextAction);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#unitContextMenu")) closeUnitContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeUnitContextMenu();
  });
  window.addEventListener("scroll", closeUnitContextMenu, { passive: true });
  els.treeContainer.addEventListener("scroll", closeUnitContextMenu, { passive: true });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-plan]");
    if (!button) return;
    state.planned.delete(button.dataset.removePlan);
    invalidateExactPlan();
    saveState();
    calculatePlan();
  });
}

async function init() {
  try {
    wireEvents();
    await loadRosterReport();
    await window.RosterAudit?.load();
    await loadLocalizedNames();
    await window.ModificationWorkbench?.loadCatalog();
    await loadMeta();
    await loadTree();
  } catch (err) {
    setStatus(err.message);
  }
}

init();
