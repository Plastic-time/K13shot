const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkTreeAlignment({ evaluate, call, artifacts, suffix }) {
  const check = () => evaluate(`(() => {
    const errors=[], bands=new Map();
    for (const rank of els.treeContainer.querySelectorAll('.rank-block')) {
      const rows=new Map();
      for (const band of rank.querySelectorAll('.tree-band')) {
        const section=band.classList.contains('premium-band') ? 'premium' : 'researchable';
        const x=band.getBoundingClientRect().left;
        if (bands.has(section) && Math.abs(bands.get(section)-x)>1) errors.push('section alignment');
        bands.set(section,x);
        for (const column of band.querySelectorAll('.tree-column')) {
          [...column.children].forEach((item,index) => {
            const box=item.getBoundingClientRect();
            if (rows.has(index) && Math.abs(rows.get(index)-box.top)>1) errors.push('row '+index);
            rows.set(index,box.top);
            const next=item.nextElementSibling;
            if (next && next.getBoundingClientRect().top-box.bottom < 31) errors.push('row overlap');
            const tile=item.querySelector('.unit-tile');
            if (tile && tile.scrollWidth>tile.clientWidth+1) errors.push('text overflow');
          });
        }
      }
    }
    return {errors, rows:els.treeContainer.querySelectorAll('.rank-block').length,
      titles:els.treeContainer.querySelectorAll('.band-title').length,
      repeated:els.treeContainer.querySelectorAll('.rank-block .band-title').length};
  })()`);
  for (const [country,type] of [['china','aviation'],['usa','ground'],['israel','aviation'],['usa','ships']]) {
    await evaluate(`els.countrySelect.value='${country}';els.typeSelect.value='${type}';state.search='';els.searchInput.value='';loadTree()`);
    await evaluate('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve,100));
    const before=await evaluate('JSON.stringify([state.tree,state.units,state.planResult,els.budgetRp.textContent,els.budgetSl.textContent])');
    const result=await check();
    assert(result.rows>0, country+'/'+type+' must have ranks');
    assert.deepEqual(result.errors,[],country+'/'+type);
    assert.equal(result.titles,2,'Section headings appear once at the top');
    assert.equal(result.repeated,0);
    await evaluate('renderTree();renderTreeConnections()');
    assert.equal(await evaluate('JSON.stringify([state.tree,state.units,state.planResult,els.budgetRp.textContent,els.budgetSl.textContent])'),before,'Layout must not change data or budgets');
    if(country==='china') {
      await evaluate('els.treeContainer.scrollTop=0;els.treeContainer.scrollLeft=0;WTTreeScroll.sync()');
      await new Promise(resolve => setTimeout(resolve,100));
      const shot=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(artifacts,suffix+'-aligned-china.png'),Buffer.from(shot.data,'base64'));
      await evaluate("setLanguage('en')");
      assert.deepEqual((await check()).errors,[],'English rows align');
      await evaluate("setLanguage('zh');state.search='p-';els.searchInput.value='p-';renderTree()");
      assert.deepEqual((await check()).errors,[],'Filtered columns remain aligned');
      await evaluate("state.search='';els.searchInput.value='';renderTree()");
    }
  }
  console.log(JSON.stringify({alignment:suffix,rows:true,sections:true,singleHeadings:true,dataUnchanged:true}));
}

module.exports = { checkTreeAlignment };
