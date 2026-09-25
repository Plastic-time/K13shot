(() => {
  const tree = document.getElementById('treeContainer');
  const horizontal = document.getElementById('treeScrollBar');
  const vertical = document.getElementById('treeVerticalScrollBar');
  const corner = document.getElementById('treeScrollCorner');
  const xRange = document.getElementById('treeScrollRange');
  const yRange = document.getElementById('treeVerticalScrollRange');
  const viewport = window.visualViewport;
  let frame = 0;
  let canvas = null;

  function updateRange(input, max, value) {
    input.max = String(max);
    input.disabled = max <= 1;
    input.value = String(Math.max(0, Math.min(max, value)));
    input.setAttribute('aria-valuetext', Math.round(max ? value / max * 100 : 0) + '%');
  }

  function sync() {
    frame = 0;
    const rect = tree.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(horizontal).getPropertyValue('--tree-scroll-size'));
    const scale = viewport?.scale || 1;
    const viewLeft = viewport?.offsetLeft || 0;
    const viewTop = viewport?.offsetTop || 0;
    const left = Math.max(viewLeft, rect.left);
    const right = Math.min(viewLeft + (viewport?.width ?? document.documentElement.clientWidth), rect.right);
    const top = Math.max(viewTop, rect.top);
    const bottom = Math.min(viewTop + (viewport?.height ?? window.innerHeight), rect.bottom);
    const thickness = size / scale;
    const visible = !!tree.querySelector('.tree-canvas') && right - left > thickness && bottom - top > thickness;
    [horizontal, vertical, corner].forEach(element => { element.hidden = !visible; });
    if (!visible) return;

    // Pin the controls to the visible tree during pinch zoom without magnifying their thickness.
    const transform = `scale(${1 / scale})`;
    Object.assign(horizontal.style, { left: left + 'px', top: (bottom - thickness) + 'px', width: ((right - left) * scale - size) + 'px', transform });
    Object.assign(vertical.style, { left: (right - thickness) + 'px', top: top + 'px', height: ((bottom - top) * scale - size) + 'px', transform });
    vertical.style.setProperty('--tree-scroll-length', Math.max(0, (bottom - top) * scale - size - 4) + 'px');
    Object.assign(corner.style, { left: (right - thickness) + 'px', top: (bottom - thickness) + 'px', transform });
    updateRange(xRange, Math.max(0, tree.scrollWidth - tree.clientWidth), tree.scrollLeft);
    updateRange(yRange, Math.max(0, tree.scrollHeight - tree.clientHeight), tree.scrollTop);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  const resize = new ResizeObserver(schedule);
  resize.observe(tree);
  new MutationObserver(() => {
    if (canvas) resize.unobserve(canvas);
    canvas = tree.querySelector('.tree-canvas');
    if (canvas) resize.observe(canvas);
    schedule();
  }).observe(tree, { childList: true });
  xRange.addEventListener('input', () => { tree.scrollLeft = Number(xRange.value); });
  yRange.addEventListener('input', () => { tree.scrollTop = Number(yRange.value); });
  // The vertical control uses the identical horizontal skin, so map its keys to visual direction.
  yRange.addEventListener('keydown', event => {
    const changes = { ArrowDown: 40, ArrowUp: -40, PageDown: tree.clientHeight * 0.9, PageUp: -tree.clientHeight * 0.9 };
    if (event.key !== 'Home' && event.key !== 'End' && !(event.key in changes)) return;
    event.preventDefault();
    tree.scrollTop = event.key === 'Home' ? 0 : event.key === 'End' ? Number(yRange.max) : tree.scrollTop + changes[event.key];
    sync();
  });
  tree.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  viewport?.addEventListener('resize', schedule, { passive: true });
  viewport?.addEventListener('scroll', schedule, { passive: true });
  window.WTTreeScroll = { schedule, sync };
  schedule();
})();
