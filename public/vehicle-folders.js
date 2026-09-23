(() => {
  "use strict";
  const t = (source, params) => window.WTI18n.t(source, params);
  let options, panel, backdrop, content, heading, activeKey = "", activeGroup = "", trigger, frame;
  let restoreUnit = "";
  const buttons = () => [...options.tree.querySelectorAll("[data-folder-key]")];

  function close(restoreFocus = false) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    backdrop.hidden = true;
    buttons().forEach(button => button.setAttribute("aria-expanded", "false"));
    activeKey = "";
    options.closeContext();
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }

  function position() {
    if (panel.hidden || !trigger?.isConnected) return;
    const anchor = trigger.closest(".folder-tile").getBoundingClientRect();
    const width = panel.offsetWidth, height = panel.offsetHeight, gap = 12;
    const left = Math.max(gap, Math.min(anchor.left + (anchor.width - width) / 2, innerWidth - width - gap));
    const top = Math.max(gap, Math.min(anchor.top - panel.querySelector("header").offsetHeight - 10, innerHeight - height - gap));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  function refresh() {
    if (!activeKey) return;
    trigger = buttons().find(button => button.dataset.folderKey === activeKey);
    const group = trigger && options.group(activeGroup);
    if (!group) { close(); return; }
    const scroll = content.scrollTop;
    heading.textContent = group.title;
    content.innerHTML = '<div class="folder-popup-canvas"><svg class="tree-links" aria-hidden="true"></svg><div class="folder-popup-items">' + group.html + '</div></div>';
    content.scrollTop = scroll;
    buttons().forEach(button => button.setAttribute("aria-expanded", String(button === trigger)));
    panel.hidden = false;
    backdrop.hidden = false;
    position();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (panel.hidden) return;
      const canvas = content.firstElementChild;
      options.draw(canvas);
      const svg = canvas.querySelector("svg");
      svg.insertAdjacentHTML("afterbegin", '<defs><marker id="folder-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#b83339"/></marker></defs>');
      svg.querySelectorAll(":scope > path").forEach(path => path.setAttribute("marker-end", "url(#folder-arrow)"));
      position();
      if (restoreUnit) {
        [...content.querySelectorAll("[data-unit-id]")].find(tile => tile.dataset.unitId === restoreUnit)?.focus({ preventScroll: true });
        restoreUnit = "";
      }
    });
  }

  function configure(config) {
    if (options) return;
    options = config;
    backdrop = document.createElement("div");
    backdrop.className = "folder-focus-backdrop";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
    document.body.append(backdrop);
    panel = document.createElement("section");
    panel.className = "folder-popup";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "folderPopupTitle");
    panel.innerHTML = '<header class="folder-popup-heading"><span id="folderPopupTitle"></span><button type="button" class="folder-popup-close">×</button></header><div class="folder-popup-content"></div>';
    translateControls();
    document.body.append(panel);
    heading = panel.querySelector("#folderPopupTitle");
    content = panel.querySelector(".folder-popup-content");
    panel.querySelector(".folder-popup-close").addEventListener("click", () => close(true));
    options.tree.addEventListener("click", event => {
      const button = event.target.closest("[data-folder-key]");
      if (!button) return;
      if (activeKey === button.dataset.folderKey) { close(true); return; }
      options.closeContext();
      trigger = button;
      activeKey = button.dataset.folderKey;
      activeGroup = button.dataset.folderGroup;
      refresh();
      panel.querySelector(".folder-popup-close").focus({ preventScroll: true });
    });
    panel.addEventListener("click", event => {
      const tile = event.target.closest("[data-unit-id]");
      if (!tile) return;
      restoreUnit = tile.dataset.unitId;
      options.select(tile.dataset.unitId);
    });
    const context = (tile, x, y) => options.context(tile.dataset.unitId, x, y);
    panel.addEventListener("contextmenu", event => {
      const tile = event.target.closest("[data-unit-id]");
      if (!tile) return;
      event.preventDefault();
      context(tile, event.clientX, event.clientY);
    });
    panel.addEventListener("keydown", event => {
      const tile = event.target.closest("[data-unit-id]");
      if (tile && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
        event.preventDefault();
        const rect = tile.getBoundingClientRect();
        context(tile, rect.left + 20, rect.top + 20);
      }
    });
    document.addEventListener("pointerdown", event => {
      if (!event.target.closest(".folder-popup, [data-folder-key], #unitContextMenu, dialog")) close(true);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) close(true);
      if (event.key === "Tab" && !panel.hidden && !document.querySelector("dialog[open]")) {
        const menu = document.getElementById("unitContextMenu");
        const root = menu && !menu.hidden ? menu : panel;
        const targets = [...root.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
          .filter(element => element.getClientRects().length > 0);
        const index = targets.indexOf(document.activeElement);
        if (index === -1 || (event.shiftKey ? index === 0 : index === targets.length - 1)) {
          event.preventDefault();
          targets[event.shiftKey ? targets.length - 1 : 0]?.focus({ preventScroll: true });
        }
      }
    });
    options.tree.addEventListener("scroll", () => close(), { passive: true });
    window.addEventListener("resize", () => close(), { passive: true });
    new MutationObserver(() => {
      if (activeKey && !buttons().some(button => button.dataset.folderKey === activeKey)) close();
    }).observe(options.tree, { childList: true });
  }

  function translateControls() {
    const closeButton = panel?.querySelector('.folder-popup-close');
    closeButton?.setAttribute('aria-label', t('关闭'));
    closeButton?.setAttribute('title', t('关闭'));
  }

  document.addEventListener('wt-language-change', () => {
    translateControls();
    if (!panel || panel.hidden) return;
    if (panel.contains(document.activeElement)) restoreUnit = document.activeElement.dataset.unitId || '';
    refresh();
  });

  window.VehicleFolders = { configure, refresh, close, beforeTreeRender() {
    if (panel?.contains(document.activeElement)) restoreUnit = document.activeElement.dataset.unitId || "";
  }};
})();
