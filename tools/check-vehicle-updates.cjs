const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkVehicleUpdates({ evaluate, call, artifacts, suffix }) {
  const checkMarks = async () => {
    const result = await evaluate(`(() => {
      const expected = WTVehicleUpdates.trees[state.country + '/' + state.type] || [];
      const cards = [...document.querySelectorAll('.unit-tile')];
      return {
        expected: cards.filter(card => expected.includes(card.dataset.unitId)).map(card => card.dataset.unitId).sort(),
        actual: cards.filter(card => card.querySelector('.unit-update-edge')).map(card => card.dataset.unitId).sort(),
        badges: cards.filter(card => card.querySelector('.unit-update-label')).map(card => card.dataset.unitId).sort(),
        accurateTips: cards.every(card => !card.querySelector('.unit-update-label') ||
          card.querySelector('.unit-update-label').title.includes(WTVehicleUpdates.date)),
      };
    })()`);
    assert.deepEqual(result.actual, result.expected);
    assert.deepEqual(result.badges, result.expected);
    assert(result.accurateTips);
    return result.actual;
  };
  await evaluate("els.countrySelect.value='britain';els.typeSelect.value='aviation';loadTree()");
  assert((await checkMarks()).includes('hawk_t1a_early'));
  await evaluate("els.searchInput.value='hawk_t1a_early';els.searchInput.dispatchEvent(new Event('input'))");
  await checkMarks();
  await evaluate("setLanguage('en')");
  assert.equal(await evaluate("document.querySelector('.unit-update-label').textContent"), 'NEW');
  await evaluate("setLanguage('zh')");
  await evaluate("document.querySelector('[data-unit-id=hawk_t1a_early]').click()");
  assert(await evaluate("document.querySelector('[data-unit-id=hawk_t1a_early]').classList.contains('planned')"));
  await checkMarks();
  await evaluate("document.querySelector('[data-unit-id=hawk_t1a_early]').click()");
  await evaluate(`els.treeContainer.scrollTop=0;
    els.treeContainer.scrollLeft += document.querySelector('[data-unit-id=hawk_t1a_early]').getBoundingClientRect().left - els.treeContainer.getBoundingClientRect().left - 104;
    WTTreeScroll.sync()`);
  assert(await evaluate(`(() => {
    const card = document.querySelector('[data-unit-id=hawk_t1a_early]');
    const badge = card.querySelector('.unit-update-label').getBoundingClientRect();
    const tile = card.getBoundingClientRect();
    const edge = card.querySelector('.unit-update-edge').getBoundingClientRect();
    return badge.left >= tile.left && badge.right <= tile.right && edge.height === 4;
  })()`));
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifacts, suffix + '-new-vehicle.png'), Buffer.from(shot.data, 'base64'));
  await evaluate("els.searchInput.value='';els.searchInput.dispatchEvent(new Event('input'));els.countrySelect.value='usa';els.typeSelect.value='aviation';loadTree()");
  const aviation = await checkMarks();
  if (suffix.startsWith('pages')) assert(await evaluate(`(() => {
    const unit = state.unitMap.get('f_14d');
    if (!unit.parent_group_id) return document.querySelector('[data-unit-id="f_14d"] .unit-update-label') !== null;
    return [...document.querySelectorAll('[data-folder-group]')].some(button =>
      button.dataset.folderGroup === unit.parent_group_id && button.classList.contains('has-new'));
  })()`), 'Collapsed folders indicate new vehicles inside');
  await evaluate("els.countrySelect.value='germany';els.typeSelect.value='ground';loadTree()");
  await checkMarks();
  await evaluate("els.countrySelect.value='usa';els.typeSelect.value='ground';loadTree()");
  console.log(JSON.stringify({ updates: suffix, goldEdge: true, language: true, selection: true, countryScope: true }));
}

module.exports = { checkVehicleUpdates };
