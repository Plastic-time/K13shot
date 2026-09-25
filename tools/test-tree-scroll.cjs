const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/tree-scroll.js'), 'utf8');
assert.equal(source, fs.readFileSync(path.join(__dirname, '../docs/tree-scroll.js'), 'utf8'));

function setup(viewport) {
  const target = extra => Object.assign({
    events: {}, style: { setProperty(name, value) { this[name] = value; } },
    addEventListener(name, callback) { this.events[name] = callback; },
    setAttribute() {},
  }, extra);
  const tree = target({
    getBoundingClientRect: () => ({ left: 0, right: 390, top: 192, bottom: 844 }),
    querySelector: () => ({}), scrollWidth: 1800, clientWidth: 390,
    scrollHeight: 6000, clientHeight: 652, scrollTop: 100, scrollLeft: 50,
  });
  const ids = ['treeScrollBar', 'treeVerticalScrollBar', 'treeScrollCorner', 'treeScrollRange', 'treeVerticalScrollRange'];
  const elements = Object.fromEntries(ids.map(id => [id, target({})]));
  elements.treeContainer = tree;
  const window = target({ innerHeight: 844, visualViewport: viewport && target(viewport) });
  let frame;
  vm.runInNewContext(source, {
    window, document: { getElementById: id => elements[id], documentElement: { clientWidth: 390 } },
    getComputedStyle: () => ({ getPropertyValue: () => '17px' }),
    requestAnimationFrame: callback => { frame = callback; return 1; },
    ResizeObserver: class { observe() {} unobserve() {} },
    MutationObserver: class { observe() {} },
  });
  const flush = () => { const callback = frame; frame = null; callback?.(); };
  flush();
  return { elements, window, flush };
}

test('zoomed controls follow visual viewport resize and pan events', () => {
  const { elements: e, window, flush } = setup({ width: 195, height: 422, offsetLeft: 120, offsetTop: 300, scale: 2 });
  const h = e.treeScrollBar.style, v = e.treeVerticalScrollBar.style;
  assert.equal(h.left, '120px');
  assert.equal(h.top, '713.5px');
  assert.equal(v.left, '306.5px');
  assert.equal(v.top, '300px');
  assert.equal(h.transform, 'scale(0.5)');
  assert.equal(e.treeScrollRange.max, '1410');
  assert.equal(e.treeVerticalScrollRange.max, '5348');
  window.visualViewport.offsetLeft = 180;
  window.visualViewport.offsetTop = 400;
  window.visualViewport.events.scroll();
  flush();
  assert.equal(h.left, '180px');
  assert.equal(h.top, '813.5px');
  assert.equal(v.left, '366.5px');
  window.visualViewport.height = 250;
  window.visualViewport.events.resize();
  flush();
  assert.equal(h.top, '641.5px');
  assert.equal(e.treeContainer.scrollLeft, 50);
  assert.equal(e.treeContainer.scrollTop, 100);
});

test('zoom reset restores geometry and controls hide when the tree is not visible', () => {
  const { elements: e, window, flush } = setup({ width: 195, height: 100, offsetLeft: 0, offsetTop: 0, scale: 2 });
  assert(e.treeScrollBar.hidden);
  Object.assign(window.visualViewport, { width: 390, height: 844, scale: 1 });
  window.visualViewport.events.resize();
  flush();
  assert(!e.treeScrollBar.hidden);
  assert.equal(e.treeVerticalScrollBar.style.left, '373px');
  assert.equal(e.treeScrollBar.style.top, '827px');
  assert.equal(e.treeScrollBar.style.transform, 'scale(1)');
});

test('browsers without VisualViewport keep the original layout and range controls', () => {
  const { elements: e } = setup();
  assert.equal(e.treeVerticalScrollBar.style.left, '373px');
  e.treeScrollRange.value = '500';
  e.treeScrollRange.events.input();
  assert.equal(e.treeContainer.scrollLeft, 500);
  e.treeVerticalScrollRange.events.keydown({ key: 'End', preventDefault() {} });
  assert.equal(e.treeContainer.scrollTop, 5348);
});
