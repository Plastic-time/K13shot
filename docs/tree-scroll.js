(() => {
  const tree = document.getElementById('treeContainer');
  const bar = document.getElementById('treeScrollBar');
  const slider = document.getElementById('treeScrollRange');
  let frame = 0;
  let canvas = null;

  function sync() {
    frame = 0;
    const rect = tree.getBoundingClientRect();
    const max = Math.max(0, tree.scrollWidth - tree.clientWidth);
    const left = Math.max(0, rect.left);
    const right = Math.min(document.documentElement.clientWidth, rect.right);
    bar.hidden = max <= 1 || right <= left;
    bar.style.left = `${left}px`;
    bar.style.width = `${Math.max(0, right - left)}px`;
    slider.max = String(max);
    slider.value = String(Math.max(0, tree.scrollLeft));
    slider.setAttribute('aria-valuetext', `${Math.round(max ? tree.scrollLeft / max * 100 : 0)}%`);
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
  slider.addEventListener('input', () => { tree.scrollLeft = Number(slider.value); });
  tree.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.WTTreeScroll = { schedule, sync };
  schedule();
})();
