(() => {
  const tree = document.getElementById('treeContainer');
  const horizontal = document.getElementById('treeScrollBar');
  const vertical = document.getElementById('treeVerticalScrollBar');
  const corner = document.getElementById('treeScrollCorner');
  const xRange = document.getElementById('treeScrollRange');
  const yRange = document.getElementById('treeVerticalScrollRange');
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
    const left = Math.max(0, rect.left);
    const right = Math.min(document.documentElement.clientWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const visible = !!tree.querySelector('.tree-canvas') && right - left > size && bottom - top > size;
    [horizontal, vertical, corner].forEach(element => { element.hidden = !visible; });
    if (!visible) return;

    Object.assign(horizontal.style, { left: left + 'px', top: (bottom - size) + 'px', width: (right - left - size) + 'px' });
    Object.assign(vertical.style, { left: (right - size) + 'px', top: top + 'px', height: (bottom - top - size) + 'px' });
    vertical.style.setProperty('--tree-scroll-length', Math.max(0, bottom - top - size - 4) + 'px');
    Object.assign(corner.style, { left: (right - size) + 'px', top: (bottom - size) + 'px' });
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
  window.WTTreeScroll = { schedule, sync };
  schedule();
})();
