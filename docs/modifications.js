(function initializeModificationWorkbench() {
  const dialog = document.getElementById("modificationDialog");
  if (!dialog || !window.ModificationPlanner) return;

  const tree = document.getElementById("modificationTree");
  const viewport = document.getElementById("modificationViewport");
  const title = document.getElementById("modificationTitle");
  const vehicleImage = document.getElementById("modificationVehicleImage");
  const rpOutput = document.getElementById("modificationRp");
  const slOutput = document.getElementById("modificationSl");
  const status = document.getElementById("modificationStatus");
  const ui = { data: null, selected: new Set(), researched: new Set(), unlocked: new Set(), result: null };
  let catalog = null;
  let catalogPromise = null;
  const chunkCache = new Map();

  const format = value => Number(value || 0).toLocaleString("en-US");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const language = () => (typeof state !== "undefined" && state.language === "en" ? "en" : "zh");
  const storageKey = id => `wt-research:modifications:${id}`;

  async function sha256(content) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    if (!catalogPromise) {
      catalogPromise = fetch("database/modifications/catalog.json?v=all-vehicles-20260920", { cache: "no-cache" })
        .then(response => {
          if (!response.ok) throw new Error("配件索引载入失败");
          return response.json();
        })
        .then(data => {
          if (data.schema !== 2 || !data.vehicles || !data.chunks) throw new Error("配件索引格式错误");
          catalog = data;
          return data;
        })
        .catch(error => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function hasVehicle(vehicleId) {
    return Boolean(catalog?.vehicles?.[vehicleId]);
  }

  function normalizeVehicle(raw) {
    const iconPrefix = "https://static.encyclopedia.warthunder.com/gui_skin/";
    return {
      vehicleId: raw.i,
      vehicleName: { zh: raw.n[0], en: raw.n[1] },
      vehicleIcon: raw.v,
      tierRequirements: { 1: raw.r[0], 2: raw.r[1], 3: raw.r[2] },
      totals: { rp: raw.t[0], sl: raw.t[1] },
      categories: raw.c.map((category, index) => ({
        id: String(index), name: { zh: category[0], en: category[1] }, columns: category[2],
      })),
      mods: raw.m.map(mod => ({
        id: mod[0], category: String(mod[1]), tier: mod[2], column: mod[3],
        name: { zh: mod[4], en: mod[5] },
        icon: mod[6].startsWith("http") ? mod[6] : `${iconPrefix}${mod[6]}`,
        artwork: mod[12] || null,
        rp: mod[7], sl: mod[8], ge: mod[9], requires: mod[10], order: mod[11],
      })),
    };
  }

  function renderIcon(mod) {
    const art = mod.artwork;
    const valid = files => Array.isArray(files) && files.every(file => /^[a-z0-9_-]+\.png$/i.test(file));
    if (!art || !valid(art.b) || !art.b.length || !valid(art.d)) {
      return `<img src="${escape(mod.icon)}" alt="" loading="eager">`;
    }
    const hint = art.v ? `${language() === "en" ? "Belt group preview" : "弹链组图示"}: ${art.n} (${art.v.map(item => item.w ? `${item.w}: ${item.n}` : item.n).join(" / ")})` : art.n;
    const images = files => files.map(file => `<img src="images/ammunition/${escape(file)}" alt="" loading="eager">`).join("");
    const ratio = Number.isFinite(art.r) && art.r > 0 && art.r <= 1 ? art.r : 1 / art.b.length;
    const width = ratio * 100;
    const space = 100 - width * art.b.length;
    const gap = space > 0 ? space / (art.b.length + 1) : space / Math.max(1, art.b.length - 1);
    const start = space > 0 ? gap : 0;
    const rounds = art.b.map((file, index) => `<img src="images/ammunition/${escape(file)}" alt="" loading="eager" style="left:${start + (width + gap) * index}%;width:${width}%">`).join("");
    return `<span class="modification-ammunition" title="${escape(hint)}" data-fallback="${escape(mod.icon)}">
      <span class="modification-ammunition-decor">${images(art.d)}</span>
      <span class="modification-ammunition-base">${rounds}</span>
    </span>`;
  }

  async function loadVehicle(vehicleId) {
    const index = await loadCatalog();
    const chunkKey = index.vehicles[vehicleId];
    const chunkMeta = index.chunks[chunkKey];
    if (!chunkKey || !chunkMeta) throw new Error("这辆载具没有可研发配件");
    if (!chunkCache.has(chunkKey)) {
      chunkCache.set(chunkKey, fetch(`${chunkMeta.path}?v=${chunkMeta.sha256.slice(0, 16)}`, { cache: "no-cache" })
        .then(async response => {
          if (!response.ok) throw new Error("配件数据载入失败");
          const content = await response.text();
          if (await sha256(content) !== chunkMeta.sha256) throw new Error("配件数据版本校验失败，请刷新页面");
          return JSON.parse(content);
        })
        .catch(error => { chunkCache.delete(chunkKey); throw error; }));
    }
    const chunk = await chunkCache.get(chunkKey);
    const raw = chunk.v?.[vehicleId];
    if (!raw) throw new Error("配件数据中找不到这辆载具");
    return normalizeVehicle(raw);
  }

  function save() {
    if (!ui.data) return;
    localStorage.setItem(storageKey(ui.data.vehicleId), JSON.stringify({
      selected: [...ui.selected], researched: [...ui.researched],
    }));
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(ui.data.vehicleId)) || "{}");
      const ids = new Set(ui.data.mods.filter(mod => !ui.unlocked.has(mod.id)).map(mod => mod.id));
      ui.selected = new Set((saved.selected || []).filter(id => ids.has(id)));
      ui.researched = new Set((saved.researched || []).filter(id => ids.has(id)));
    } catch {
      ui.selected.clear();
      ui.researched.clear();
    }
  }

  function currentTierCounts() {
    if (ui.result) return ui.result.tierCounts;
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const mod of ui.data.mods) {
      if (ui.unlocked.has(mod.id) || ui.researched.has(mod.id) || ui.selected.has(mod.id)) counts[mod.tier] += 1;
    }
    return counts;
  }

  function manualBudget() {
    return ui.data.mods.reduce((budget, mod) => {
      if (ui.selected.has(mod.id) && !ui.researched.has(mod.id) && !ui.unlocked.has(mod.id)) {
        budget.rp += mod.rp;
        budget.sl += mod.sl;
      }
      return budget;
    }, { rp: 0, sl: 0 });
  }

  function tileState(mod) {
    if (ui.unlocked.has(mod.id)) return "unlocked";
    if (ui.researched.has(mod.id)) return "researched";
    if (ui.selected.has(mod.id)) return "target";
    if (ui.result?.dependencyIds.includes(mod.id)) return "dependency";
    if (ui.result?.fillerIds.includes(mod.id)) return "filler";
    return "";
  }

  function stateLabel(mod) {
    const labels = { researched: "已研发", target: "目标", dependency: "必经", filler: "补足" };
    return labels[tileState(mod)] || "";
  }

  function render() {
    if (!ui.data) return;
    const lang = language();
    const categoryOffsets = new Map();
    let totalColumns = 0;
    for (const category of ui.data.categories) {
      categoryOffsets.set(category.id, totalColumns);
      totalColumns += category.columns;
    }
    const tierCounts = currentTierCounts();
    const selectedCount = ui.selected.size;
    const plannedSet = new Set([...(ui.result?.includedIds || []), ...ui.researched, ...ui.unlocked]);
    const cells = [];
    for (let tier = 1; tier <= 4; tier += 1) {
      for (let column = 0; column < totalColumns; column += 1) {
        cells.push(`<span class="modification-grid-cell" style="grid-column:${column + 2};grid-row:${tier + 1}"></span>`);
      }
    }
    const headers = ui.data.categories.map(category => {
      const start = categoryOffsets.get(category.id) + 2;
      return `<h3 class="modification-category" style="grid-column:${start}/span ${category.columns};grid-row:1">${escape(category.name[lang])}</h3>`;
    });
    const tiers = [1, 2, 3, 4].map(tier => {
      const required = ui.data.tierRequirements[tier];
      const gate = required ? `<small class="${tierCounts[tier] >= required ? "met" : ""}">${tierCounts[tier]}/${required}</small>` : `<small>${tierCounts[tier]}</small>`;
      return `<div class="modification-tier" style="grid-column:1;grid-row:${tier + 1}"><b>${["I", "II", "III", "IV"][tier - 1]}</b>${gate}</div>`;
    });
    const tiles = ui.data.mods.map(mod => {
      const column = categoryOffsets.get(mod.category) + mod.column + 2;
      const stateName = tileState(mod);
      const isPlanned = plannedSet.has(mod.id);
      const unlocked = ui.unlocked.has(mod.id);
      const name = mod.name[lang] || mod.name.en;
      const titleText = `${name} / ${mod.name.en}\n${unlocked ? "已解锁" : `RP ${format(mod.rp)} · SL ${format(mod.sl)}\n左键：目标 · 右键：已研发`}`;
      return `
        <button class="modification-tile ${stateName}${isPlanned ? " is-planned" : ""}" type="button"
          data-mod-id="${escape(mod.id)}" style="grid-column:${column};grid-row:${mod.tier + 1}" title="${escape(titleText)}"${unlocked ? " disabled" : ""}>
          ${renderIcon(mod)}
          <span class="modification-tile-copy"><b>${escape(name)}</b><small>${unlocked ? "✓ 已解锁" : `${format(mod.rp)} RP · ${format(mod.sl)} SL`}</small></span>
          ${stateName && !unlocked ? `<span class="modification-state">${stateName === "researched" ? "✓ " : ""}${stateLabel(mod)}</span>` : ""}
        </button>`;
    });

    tree.innerHTML = `
      <div class="modification-board" style="grid-template-columns:54px repeat(${totalColumns}, 178px)">
        <svg class="modification-links" aria-hidden="true"><defs><marker id="mod-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z"></path></marker></defs></svg>
        <div class="modification-tier-title">等级</div>${headers.join("")}${cells.join("")}${tiers.join("")}${tiles.join("")}
      </div>`;

    const budget = ui.result || manualBudget();
    rpOutput.textContent = format(budget.rp);
    slOutput.textContent = format(budget.sl);
    if (ui.unlocked.size === ui.data.mods.length) {
      status.textContent = "全部配件已解锁";
    } else if (ui.result) {
      const autoCount = ui.result.dependencyIds.length + ui.result.fillerIds.length;
      status.textContent = `目标 ${selectedCount} · 自动加入 ${autoCount} · 尚需研发 ${ui.result.includedIds.length}`;
    } else {
      status.textContent = selectedCount
        ? `手动选择 ${selectedCount} · 当前预算仅统计所选配件`
        : "可自由选择任意配件，点击计算后自动补齐前置";
    }
    requestAnimationFrame(drawConnections);
  }

  function drawConnections() {
    const board = tree.querySelector(".modification-board");
    const svg = board?.querySelector(".modification-links");
    if (!board || !svg || !ui.data) return;
    const boardRect = board.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${board.scrollWidth} ${board.scrollHeight}`);
    svg.setAttribute("width", board.scrollWidth);
    svg.setAttribute("height", board.scrollHeight);
    svg.querySelectorAll("path.modification-link").forEach(path => path.remove());
    const active = new Set([...(ui.result?.includedIds || []), ...ui.researched, ...ui.unlocked]);
    for (const mod of ui.data.mods) {
      const target = board.querySelector(`[data-mod-id="${CSS.escape(mod.id)}"]`);
      if (!target) continue;
      for (const requiredId of mod.requires || []) {
        const source = board.querySelector(`[data-mod-id="${CSS.escape(requiredId)}"]`);
        if (!source) continue;
        const from = source.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const x1 = from.left + from.width / 2 - boardRect.left;
        const y1 = from.bottom - boardRect.top - 3;
        const x2 = to.left + to.width / 2 - boardRect.left;
        const y2 = to.top - boardRect.top + 3;
        const middle = y1 + Math.max(8, (y2 - y1) / 2);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} V ${middle} H ${x2} V ${y2}`);
        path.setAttribute("class", `modification-link${active.has(mod.id) && active.has(requiredId) ? " active" : ""}`);
        path.setAttribute("marker-end", "url(#mod-arrow)");
        svg.append(path);
      }
    }
  }

  function calculate() {
    ui.result = window.ModificationPlanner.plan(ui.data, [...ui.selected], [...ui.researched]);
    save();
    render();
  }

  async function open(vehicleId) {
    try {
      if (ui.data?.vehicleId !== vehicleId) {
        ui.data = await loadVehicle(vehicleId);
        ui.unlocked = new Set(ui.data.mods.filter(window.ModificationPlanner.isAutomaticallyUnlocked).map(mod => mod.id));
        ui.result = null;
        restore();
      }
      const lang = language();
      title.textContent = `配件研发 — ${ui.data.vehicleName[lang] || ui.data.vehicleName.en}`;
      vehicleImage.src = ui.data.vehicleIcon;
      vehicleImage.alt = ui.data.vehicleName[lang] || ui.data.vehicleName.en;
      render();
      dialog.showModal();
      requestAnimationFrame(drawConnections);
    } catch (error) {
      if (typeof setStatus === "function") setStatus(error.message);
    }
  }

  document.addEventListener("click", event => {
    const launch = event.target.closest("[data-modifications-id]");
    if (launch) {
      event.preventDefault();
      event.stopPropagation();
      open(launch.dataset.modificationsId);
      return;
    }
    if (event.target === dialog || event.target.closest("[data-modification-close]")) dialog.close();
  });

  tree.addEventListener("click", event => {
    const tile = event.target.closest("[data-mod-id]");
    if (!tile) return;
    const id = tile.dataset.modId;
    if (ui.unlocked.has(id)) return;
    if (ui.researched.has(id)) ui.researched.delete(id);
    if (ui.selected.has(id)) ui.selected.delete(id); else ui.selected.add(id);
    ui.result = null;
    save();
    render();
  });

  tree.addEventListener("error", event => {
    const artwork = event.target.closest?.(".modification-ammunition");
    if (!artwork || !tree.contains(artwork)) return;
    const fallback = document.createElement("img");
    fallback.alt = "";
    fallback.src = artwork.dataset.fallback;
    artwork.replaceWith(fallback);
  }, true);

  tree.addEventListener("contextmenu", event => {
    const tile = event.target.closest("[data-mod-id]");
    if (!tile) return;
    event.preventDefault();
    const id = tile.dataset.modId;
    if (ui.unlocked.has(id)) return;
    if (ui.researched.has(id)) ui.researched.delete(id);
    else { ui.researched.add(id); ui.selected.delete(id); }
    ui.result = null;
    save();
    render();
  });

  dialog.addEventListener("click", event => {
    const action = event.target.closest("[data-modification-action]")?.dataset.modificationAction;
    if (!action) return;
    if (action === "calculate") calculate();
    if (action === "all") {
      ui.selected = new Set(ui.data.mods.filter(mod => !ui.researched.has(mod.id) && !ui.unlocked.has(mod.id)).map(mod => mod.id));
      calculate();
    }
    if (action === "clear") { ui.selected.clear(); ui.result = null; save(); render(); }
    if (action === "clear-owned") { ui.researched.clear(); ui.result = null; save(); render(); }
  });

  viewport.addEventListener("scroll", drawConnections, { passive: true });
  window.addEventListener("resize", drawConnections, { passive: true });

  window.ModificationWorkbench = { loadCatalog, hasVehicle, open };
})();
