const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkPlannedFolderCount({ evaluate, call, artifacts, suffix }) {
  await evaluate("els.countrySelect.value='usa';els.typeSelect.value='ground';state.search='';els.searchInput.value='';loadTree()");
  await evaluate("els.clearButton.click();state.avoidFolded=false;calculatePlan();toggleUnitMode('us_m18_hellcat','target')");
  const plan = async () => {
    await evaluate("runExactPlan()");
    for (let i=0;i<80;i++) {
      if (await evaluate("Boolean(state.planResult) && !state.planResult.dirty && !els.planButton.disabled")) return;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    throw new Error('Exact planning did not finish');
  };
  const check = () => evaluate(`(() => {
    const selected=new Set(state.planResult.selectedIds);
    return [...els.treeContainer.querySelectorAll('[data-folder-group]')].map(button => {
      const group=state.groupMap.get(button.dataset.folderGroup);
      const ids=group.items.map(unit => unit.data_unit_id);
      return {
        group:group.data_unit_id,
        expected:ids.filter(id => selected.has(id) && !state.owned.has(id)).length,
        actual:Number(button.closest('.folder-tile').querySelector('.folder-selection-count')?.dataset.selectedCount || 0),
        automatic:ids.filter(id => selected.has(id) && !state.planned.has(id) && !state.waypoints.has(id)),
      };
    });
  })()`);
  await plan();
  let counts=await check();
  const automatic=counts.find(group => group.automatic.length>0);
  assert(automatic,'Fixture must include an automatically planned folder vehicle');
  assert(counts.every(group => group.actual === group.expected),JSON.stringify(counts.filter(group => group.actual !== group.expected)));
  const before=await evaluate("JSON.stringify(state.planResult)");
  await evaluate(`[...els.treeContainer.querySelectorAll('[data-folder-group]')].find(b => b.dataset.folderGroup === "${automatic.group}").click()`);
  const popupState = () => evaluate(`(() => {
    const panel=document.querySelector('.folder-popup');
    return !panel.hidden && [...panel.querySelectorAll('[data-unit-id]')].every(tile => {
      const id=tile.dataset.unitId;
      const expected=state.planResult.selectedIds.includes(id) && !state.owned.has(id) && !state.planned.has(id) && !state.waypoints.has(id);
      const label=tile.querySelector('.auto-planned-label');
      return tile.classList.contains('auto-planned') === expected && Boolean(label) === expected
        && (!label || (getComputedStyle(label).display !== 'none' && tile.scrollWidth <= tile.clientWidth+1));
    });
  })()`);
  assert(await popupState(),'Automatically planned folder vehicles must visibly show selection');
  await evaluate("renderTree();setLanguage('en')");
  assert(await popupState(),'Selection survives popup refresh and language changes');
  assert.equal(await evaluate("JSON.stringify(state.planResult)"),before,'Display updates must not mutate planning results');
  counts=await check();
  assert(counts.every(group => group.actual === group.expected));
  await evaluate("setLanguage('zh')");
  await new Promise(resolve => setTimeout(resolve,150));
  const selectedShot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,suffix+'-folder-auto-selected.png'),Buffer.from(selectedShot.data,'base64'));
  await evaluate("VehicleFolders.close()");
  await evaluate(`(() => {
    const button=[...els.treeContainer.querySelectorAll('[data-folder-group]')].find(b => b.dataset.folderGroup === "${automatic.group}");
    const rect=button.closest('.folder-tile').getBoundingClientRect(), tree=els.treeContainer;
    tree.scrollTop+=rect.top-tree.getBoundingClientRect().top-50;
    tree.scrollLeft+=rect.left-tree.getBoundingClientRect().left-104;
  })()`);
  await new Promise(resolve => setTimeout(resolve,150));
  const shot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,suffix+'-planned-folder-count.png'),Buffer.from(shot.data,'base64'));
  const ownedId=automatic.automatic[0];
  await evaluate(`toggleUnitMode("${ownedId}","owned")`);
  assert(await evaluate("state.planResult?.dirty === true"));
  counts=await check();
  assert(counts.every(group => group.actual === group.expected),'Edited plans retain accurate folder counts');
  assert(await evaluate(`!state.planResult.selectedIds.includes("${ownedId}")`));
  await evaluate("toggleUnitMode(state.units.find(unit => !state.initialUnlocked.has(unit.data_unit_id) && !state.owned.has(unit.data_unit_id) && !state.planned.has(unit.data_unit_id)).data_unit_id,'waypoint')");
  await plan();
  counts=await check();
  assert(counts.every(group => group.actual === group.expected),'Replanning excludes owned vehicles');
  assert(await evaluate(`!state.planResult.selectedIds.includes("${ownedId}")`));
  assert(await evaluate("state.planned.size > 0 && state.owned.size > 0 && state.waypoints.size > 0 && state.planResult !== null"),'Clear fixture includes every selection state');
  await evaluate("els.clearButton.click()");
  assert(await evaluate("state.planned.size === 0 && state.owned.size === 0 && state.waypoints.size === 0 && state.planResult === null"),'Clear plan must clear owned marks as well as targets and waypoints');
  assert(await evaluate("els.treeContainer.querySelectorAll('.owned-label, .target-label, .waypoint-label').length === 0"),'Cleared marks disappear from vehicle cards');
  assert(await evaluate("els.budgetCount.textContent === '0' && els.budgetRp.textContent === '0' && els.budgetSl.textContent === '0'"),'Clear resets the budget');
  assert(await evaluate("Object.values(JSON.parse(localStorage.getItem(storageKey()))).filter(Array.isArray).every(ids => ids.length === 0)"),'Cleared selection is saved');
  await evaluate("loadTree()");
  assert(await evaluate("state.owned.size === 0 && state.planned.size === 0 && state.waypoints.size === 0"),'Owned marks must not reappear after reload');
  assert(await evaluate("els.treeContainer.querySelectorAll('.folder-selection-count').length === 0"));
  await evaluate(`[...els.treeContainer.querySelectorAll('[data-folder-group]')].find(b => b.dataset.folderGroup === "${automatic.group}").click()`);
  assert(await evaluate("!document.querySelector('.auto-planned-label')"),'Reopening after clear must not show stale popup selection');
  await evaluate("VehicleFolders.close()");
  await evaluate("els.countrySelect.value='israel';els.typeSelect.value='aviation';loadTree()");
  const symbolGroup=await evaluate("[...state.groupMap.values()].find(g => g.items?.length > 1 && displayTitle(g).includes(String.fromCharCode(0xf059))).data_unit_id");
  await evaluate(`[...els.treeContainer.querySelectorAll('[data-folder-group]')].find(b => b.dataset.folderGroup === "${symbolGroup}").click();document.fonts.ready`);
  await call('DOM.enable');
  await call('CSS.enable');
  const {root}=await call('DOM.getDocument');
  const {nodeId}=await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#folderPopupTitle'});
  const {fonts}=await call('CSS.getPlatformFontsForNode',{nodeId});
  assert(fonts.some(font => font.isCustomFont && font.glyphCount > 0),'Folder heading must render its game symbol with the bundled font');
  const symbolShot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,suffix+'-folder-symbol.png'),Buffer.from(symbolShot.data,'base64'));
  await evaluate("VehicleFolders.close()");
  console.log(JSON.stringify({plannedFolderCount:suffix,automatic:true,replanned:true,invalidated:true,ownedExcluded:true,clearOwned:true,clearPersisted:true}));
}

module.exports = { checkPlannedFolderCount };
