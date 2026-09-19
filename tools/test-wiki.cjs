const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {parseWikiDetail}=require('../src/wiki-snapshot');
const {sha,root}=require('./refresh-wiki.cjs');

function fixture({rp='2,900',purchase='700',currency='SL',kind='regular',air=false}={}) {
  const card=(title,value)=>value===null?'':`<div class="game-unit_card-info_item"><div class="game-unit_card-info_value">${value}</div><div class="game-unit_card-info_title">${title}</div></div>`;
  const br=value=>`<div class="game-unit_br-item"><div class="mode">RB</div><div class="value">${value}</div></div>`;
  return `<link rel="canonical" href="https://wiki.warthunder.com/unit/test"><div class="game-unit game-unit--${kind}">${card('Purchase',purchase===null?null:purchase+`<img alt="${currency}">`)}${card('Main role','Light tank')}${card('Rank','I')}${card('Research country','USA')}${card('Research',rp)}<div class="game-unit_br">${air?`<div id="unit-br-air" class="tab-pane active">${br('2.0')}</div><div id="unit-br-tank" class="tab-pane">${br('2.3')}</div><div id="unit-br-ship" class="tab-pane">${br('1.7')}</div>`:br('2.0')}</div></div>`;
}
assert.equal(parseWikiDetail(fixture(),'test').rp,2900);
assert.equal(parseWikiDetail(fixture(),'test').sp,700);
assert.equal(parseWikiDetail(fixture({rp:'Free',purchase:'Free'}),'test').rp,0);
assert.equal(parseWikiDetail(fixture({rp:null,purchase:null}),'test').rp,null);
const premium=parseWikiDetail(fixture({kind:'premium',rp:null,purchase:'250',currency:'GE'}),'test');
assert.equal(premium.sp,0); assert.equal(premium.wiki.purchase_currency,'GE'); assert.equal(premium.wiki.purchase,'250');
const squadron=parseWikiDetail(fixture({kind:'squadron',rp:'400,000',purchase:'450,000'}),'test');
assert.equal(squadron.rp,0); assert.equal(squadron.wiki.research,'400,000');
assert.equal(parseWikiDetail(fixture({air:true}),'test').br,'2.0');
assert.equal(parseWikiDetail(fixture({air:true}),'test').wiki.battle_ratings_by_battle.tank.RB,'2.3');
assert.throws(()=>parseWikiDetail('<html>error</html>','test'));
assert.throws(()=>parseWikiDetail(fixture(),'wrong-id'));
assert.throws(()=>parseWikiDetail(fixture({rp:'broken value'}),'test'));

const context=vm.createContext({document:{getElementById:()=>({})},window:{matchMedia:()=>({matches:false})},console});
const app=fs.readFileSync(path.join(root,'docs/app.js'),'utf8').replace(/\binit\(\);\s*$/,'');
vm.runInContext(app+'\nrenderTree=()=>{};renderSummary=()=>{};globalThis.calc={state,flattenTree,getDependencyIds,calculatePlan,isInitialUnlockedUnit,formatCost};',context);
const {calc}=context;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/database/manifest.json'),'utf8'));
let total=0,components=0,unknown=0;
for (const entry of manifest.files) {
  const content=fs.readFileSync(path.join(root,'docs',entry.path),'utf8');
  assert.equal(sha(content),entry.sha256,entry.path);
  const tree=JSON.parse(content);
  calc.state.planned=new Set(); calc.flattenTree(tree);
  assert.equal(calc.state.units.length,entry.units);
  const graph=new Map();
  for(const group of calc.state.groups) graph.set(group.data_unit_id,group.items[0]?.data_unit_id||group.required_unit_id);
  for(const unit of calc.state.units) graph.set(unit.data_unit_id,unit.required_unit_id);
  for(const id of graph.keys()) {
    const visited=new Set(); let cursor=id;
    while(cursor) {assert(!visited.has(cursor),`${entry.path}: cyclic prerequisite ${cursor}`);visited.add(cursor); assert(graph.has(cursor),`${id}: missing dependency ${cursor}`);cursor=graph.get(cursor);}
  }
  for(const unit of calc.state.units) {
    total++;
    assert.equal(unit.br,unit.wiki.battle_ratings.RB||null);
    if(unit.is_component) {components++;assert.equal(unit.required_unit_id,unit.component_of);assert.equal(unit.rp,0);}
    if(unit.rp===null||unit.sp===null) {unknown++;assert(!calc.isInitialUnlockedUnit(unit));}
    if(unit.is_squadron||unit.is_premium) {assert.equal(unit.rp,0);assert.equal(unit.sp,0);}
    const actual=new Set(calc.getDependencyIds(unit.data_unit_id));
    const expected=new Set(); let cursor=unit.data_unit_id;
    while(cursor) {if(calc.state.unitMap.has(cursor)) expected.add(cursor);cursor=graph.get(cursor);}
    assert.deepEqual([...actual].sort(),[...expected].sort());
  }
}
assert.equal(total,manifest.unit_count);
calc.flattenTree([{rank:'I',researchable_vehicles:[[{type:'single',data_unit_id:'a',rp:0,sp:0,required_unit_id:''},{type:'single',data_unit_id:'b',rp:100,sp:200,required_unit_id:''},{type:'single',data_unit_id:'c',rp:100,sp:200,required_unit_id:'b'}]],premium_vehicles:[]}]);
assert.deepEqual([...calc.getDependencyIds('b')],['b'],'No invented column predecessor');
assert.deepEqual([...calc.getDependencyIds('c')],['b','c'],'Rank I requirements preserved');
assert.equal(calc.formatCost(null),'未提供');
console.log(JSON.stringify({pass:true,trees:manifest.files.length,units:total,components,unknownCosts:unknown,parserCases:11}));
