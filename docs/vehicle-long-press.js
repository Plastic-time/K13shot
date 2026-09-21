(() => {
  "use strict";
  let configured = false;

  function configure({ open, close }) {
    if (configured) return;
    configured = true;
    const pointers = new Set();
    let hold = null;
    let blockedClickUntil = 0;
    const tileFor = target => {
      const tile = target.closest?.(".unit-tile[data-unit-id]");
      return tile && tile.closest("#treeContainer, .folder-popup") &&
        !target.closest("[data-roster-hidden-help], [data-modifications-id]") ? tile : null;
    };
    const cancel = () => {
      if (hold) clearTimeout(hold.timer);
      hold = null;
    };
    const show = () => {
      if (!hold || hold.opened || !hold.tile.isConnected || !hold.tile.getClientRects().length) return;
      clearTimeout(hold.timer);
      hold.opened = true;
      blockedClickUntil = performance.now() + 1500;
      open(hold.tile.dataset.unitId, hold.x + 8, hold.y + 8);
    };

    document.addEventListener("pointerdown", event => {
      blockedClickUntil = 0;
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        cancel();
        return;
      }
      pointers.add(event.pointerId);
      cancel();
      if (pointers.size !== 1 || !event.isPrimary || event.button !== 0) return;
      const tile = tileFor(event.target);
      if (!tile) return;
      hold = { tile, pointerId: event.pointerId, x: event.clientX, y: event.clientY, opened: false };
      hold.timer = setTimeout(show, 450);
    }, { capture: true, passive: true });

    document.addEventListener("pointermove", event => {
      if (!hold || event.pointerId !== hold.pointerId) return;
      if (Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) {
        blockedClickUntil = performance.now() + 1500;
        if (hold.opened) close();
        cancel();
      }
    }, { capture: true, passive: true });

    document.addEventListener("pointerup", event => {
      pointers.delete(event.pointerId);
      if (!hold || event.pointerId !== hold.pointerId) return;
      if (hold.opened) {
        // Releasing the held finger must not select the card or a menu item beneath it.
        blockedClickUntil = performance.now() + 1500;
        event.preventDefault();
      }
      cancel();
    }, true);

    document.addEventListener("pointercancel", event => {
      pointers.delete(event.pointerId);
      if (hold?.pointerId === event.pointerId) cancel();
    }, { capture: true, passive: true });

    document.addEventListener("click", event => {
      if (event.detail === 0 || performance.now() > blockedClickUntil) return;
      blockedClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener("contextmenu", event => {
      if (!tileFor(event.target) || (!hold && event.pointerType !== "touch" && event.pointerType !== "pen")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      show();
    }, true);

    document.addEventListener("scroll", () => {
      cancel();
      close();
    }, { capture: true, passive: true });
    window.addEventListener("resize", cancel, { passive: true });
    window.addEventListener("blur", () => { cancel(); pointers.clear(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancel(); pointers.clear(); }
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") cancel(); });
  }

  window.VehicleLongPress = { configure };
})();
