const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const cheerio=require('cheerio');
const {cache,types,download}=require('./refresh-wiki.cjs');
const {parseWikiDetail}=require('../src/wiki-snapshot');

async function verify() {
  const manifest=JSON.parse(fs.readFileSync(path.join(cache,'staged/database/manifest.json'),'utf8'));
  const samples=new Set();
  const signature=html=>{
    const $=cheerio.load(html);
    return $('.unit-tree').map((_,e)=>{
      const tree=$(e);
      return JSON.stringify({country:tree.attr('data-tree-id'),nodes:tree.find('[data-unit-id]').map((_,n)=>JSON.stringify({id:$(n).attr('data-unit-id'),req:$(n).attr('data-unit-req')||'',class:$(n).attr('class'),title:$(n).find('.wt-tree_item-text span').first().text()})).get(),ranks:tree.find('.wt-tree_r-header_label span').map((_,n)=>$(n).text()).get()});
    }).get();
  };
  for (const type of types) {
    const fresh=path.join(cache,'live-check',`${type}.html`);
    await download(`https://wiki.warthunder.com/${type}?v=t`,fresh,true);
    assert.deepEqual(signature(fs.readFileSync(fresh,'utf8')), signature(fs.readFileSync(path.join(cache,`${type}.html`),'utf8')),`${type}: Wiki tree changed during refresh`);
  }
  for (const entry of manifest.files) {
    const tree=JSON.parse(fs.readFileSync(path.join(cache,'staged',entry.path),'utf8'));
    const singles=tree.flatMap(r=>[...r.researchable_vehicles,...r.premium_vehicles].flat()).flatMap(i=>i.items||[i]);
    if (!singles.length) continue;
    for (const unit of [singles[0],singles.at(-1),singles[Math.floor(singles.length/2)],singles.find(i=>i.is_squadron),singles.find(i=>i.is_component)]) if(unit) samples.add(unit.data_unit_id);
  }
  let index=0;
  const ids=[...samples];
  await Promise.all(Array.from({length:4},async()=>{
    while(index<ids.length) {
      const id=ids[index++];
      const fresh=path.join(cache,'live-check/units',`${id}.html`);
      await download(`https://wiki.warthunder.com/unit/${id}`,fresh,true);
      assert.deepEqual(parseWikiDetail(fs.readFileSync(fresh,'utf8'),id),parseWikiDetail(fs.readFileSync(path.join(cache,'units',`${id}.html`),'utf8'),id),`${id}: Wiki detail changed during refresh`);
    }
  }));
  const result={verified_at:new Date().toISOString(),live_tree_pages:types.length,live_unit_samples:ids.length,failures:0,snapshot_files:manifest.files.map(({path,sha256})=>({path,sha256}))};
  fs.writeFileSync(path.join(cache,'live-report.json'),JSON.stringify(result,null,2));
  console.log(`Fresh network recheck passed: ${types.length} tree pages and ${ids.length} unit pages`);
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
