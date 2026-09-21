const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkMobileLongPress({ evaluate, call, artifacts, suffix, country }) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const touch = (type, points = []) => call('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((p, i) => ({ x:p.x, y:p.y, id:i+1, radiusX:2, radiusY:2, force:1 })),
  });
  const menu = () => evaluate(`({ open:!els.unitContextMenu.hidden, id:els.unitContextMenu.dataset.unitId })`);
  const marks = () => evaluate('JSON.stringify([[...state.planned],[...state.owned],[...state.waypoints]])');
  const pointFor = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center', inline:'center'})`);
    await pause(120);
    return evaluate(`(() => {
      const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return {x:r.left+Math.min(22,r.width/2), y:r.top+r.height/2};
    })()`);
  };
  const tap = async point => { await touch('touchStart',[point]); await touch('touchEnd'); await pause(80); };
  const hold = async point => { await touch('touchStart',[point]); await pause(600); };
  const choose = async action => {
    const point = await evaluate(`(() => {const r=els.unitContextMenu.querySelector('[data-context-action="${action}"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await tap(point);
  };
  await call('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:5});
  try {
    if (country) await evaluate(`els.countrySelect.value=${JSON.stringify(country)}; els.typeSelect.value='ground'; loadTree()`);
    await evaluate('document.fonts.ready');
    await evaluate('els.clearButton.click(); closeUnitContextMenu();');
    const id = await evaluate(`[...document.querySelectorAll('#treeContainer .unit-tile')].find(tile => !state.initialUnlocked.has(tile.dataset.unitId) && state.unitMap.get(tile.dataset.unitId)?.rp > 0).dataset.unitId`);
    const selector = `#treeContainer .unit-tile[data-unit-id="${id}"]`;
    let point = await pointFor(selector);
    await tap(point);
    assert(await evaluate(`state.planned.has('${id}')`), 'A short tap selects a target');
    await tap(await pointFor(selector));
    assert(!(await evaluate(`state.planned.has('${id}')`)), 'A second short tap deselects');

    for (const [action, set] of [['target','planned'], ['owned','owned'], ['waypoint','waypoints']]) {
      point = await pointFor(selector);
      const before = await marks();
      await hold(point);
      const currentMenu = await menu();
      if (!currentMenu.open) {
        const failed = await call('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(artifacts,`${suffix}-touch-failure.png`),Buffer.from(failed.data,'base64'));
      }
      assert.deepEqual(currentMenu, {open:true,id}, `Long press opens the menu for ${action}`);
      assert.equal(await marks(), before, 'Opening the menu does not change a vehicle');
      await touch('touchEnd');
      await pause(100);
      assert((await menu()).open, 'The menu stays open after releasing the finger');
      assert.equal(await marks(), before, 'Release must not produce a target click');
      const bounds = await evaluate(`(() => { const r=els.unitContextMenu.getBoundingClientRect(); return { fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight, rows:[...els.unitContextMenu.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height) }; })()`);
      assert(bounds.fits && bounds.rows.every(height => height >= 44), 'Touch menu must fit and have finger-sized options');
      if (action === 'target') {
        const shot=await call('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(artifacts,`${suffix}-long-press.png`),Buffer.from(shot.data,'base64'));
      }
      await choose(action);
      assert(await evaluate(`state.${set}.has('${id}')`), `${action} must apply through the menu`);
      assert(!(await menu()).open);
    }

    point = await pointFor(selector);
    await hold(point); await touch('touchEnd');
    await choose('waypoint');
    assert(!(await evaluate(`state.waypoints.has('${id}')`)), 'Selecting the same menu state cancels it');

    point = await pointFor(selector);
    const beforeSwipe = await marks();
    const scrollBefore = await evaluate('els.treeContainer.scrollTop');
    await touch('touchStart',[point]);
    for (let step=1; step<=5; step++) { await touch('touchMove',[{x:point.x,y:point.y-step*18}]); await pause(25); }
    await pause(550); await touch('touchEnd'); await pause(200);
    assert(!(await menu()).open, 'Swiping must cancel long press');
    assert.equal(await marks(), beforeSwipe, 'Swiping must not select a target');
    assert(await evaluate('els.treeContainer.scrollTop') > scrollBefore, 'Native touch scrolling must still work');

    point = await pointFor(selector);
    await touch('touchStart',[point]); await touch('touchCancel'); await pause(550);
    assert(!(await menu()).open, 'Cancelled touch must not open a delayed menu');
    await touch('touchStart',[point]);
    await touch('touchStart',[point,{x:point.x+30,y:point.y+20}]);
    await pause(550); await touch('touchEnd');
    assert(!(await menu()).open, 'Multi-touch must not open the vehicle menu');

    point = await pointFor(selector);
    await hold(point); await touch('touchEnd');
    await tap({x:8,y:8});
    assert(!(await menu()).open, 'Tapping outside dismisses the menu');

    const folderSelector = '#treeContainer [data-folder-key]';
    await tap(await pointFor(folderSelector));
    assert(await evaluate('!document.querySelector(".folder-popup").hidden'));
    const foldedId = await evaluate(`[...document.querySelectorAll('.folder-popup .unit-tile')].find(tile => !state.initialUnlocked.has(tile.dataset.unitId)).dataset.unitId`);
    point = await pointFor(`.folder-popup .unit-tile[data-unit-id="${foldedId}"]`);
    const beforeFolder = await marks();
    await hold(point); await touch('touchEnd'); await pause(80);
    assert.deepEqual(await menu(), {open:true,id:foldedId}, 'Folded vehicles support the same long press');
    assert.equal(await marks(),beforeFolder);
    await choose('owned');
    assert(await evaluate(`state.owned.has('${foldedId}')`));
    await evaluate('VehicleFolders.close(); closeUnitContextMenu();');

    point = await pointFor(selector);
    await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'right',clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'right',clickCount:1});
    assert.deepEqual(await menu(),{open:true,id},'Desktop right click is unchanged');
    await evaluate('closeUnitContextMenu(); els.clearButton.click(); els.treeContainer.scrollTop=0;');
    console.log(JSON.stringify({longPress:suffix, targets:true, owned:true, waypoints:true, folded:true, swipe:true, rightClick:true, pass:true}));
  } finally {
    await touch('touchCancel').catch(()=>{});
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  }
}

module.exports = {checkMobileLongPress};
