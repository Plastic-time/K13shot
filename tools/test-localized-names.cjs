const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseCsvLine, cleanName, localizedName } = require('./build-localized-names.cjs');

assert.deepEqual(parseCsvLine('"id";"A; B";"他说""好"""'), ['id', 'A; B', '他说"好"']);
assert.equal(cleanName('布\u200b伦\u200b海\u200b姆\u00a0Mk IV'), '布伦海姆 Mk IV');
const rows = new Map([
  ['shop/group/test_group', { en: 'Full Group Name', zh: '完整分组名称' }],
  ['test_unit_shop', { en: 'Test Unit', zh: '测试载具' }],
]);
assert.deepEqual(localizedName({id:'test_group',type:'multiple',fallback:'Short'}, rows), {en:'Full Group Name',zh:'完整分组名称'});
assert.deepEqual(localizedName({id:'test_unit',type:'single',fallback:'Short'}, rows), {en:'Test Unit',zh:'测试载具'});

const docs = JSON.parse(fs.readFileSync('docs/vehicle-names.json', 'utf8'));
const local = JSON.parse(fs.readFileSync('public/vehicle-names.json', 'utf8'));
assert.deepEqual(local, docs);
assert.equal(docs.schema, 1);
assert.equal(Object.keys(docs.names).length, docs.count);
assert.deepEqual(docs.names.blenheim_group, {en:'Blenheim/Beaufort',zh:'布伦海姆/波佛特'});
assert.equal(docs.names.beaufighter_group.en, 'Beaufighter');
assert.equal(docs.names.j_7d.zh, '歼-7D');
assert.equal(docs.names.su_30mkk.zh, '␗苏-30MKK');
assert(docs.translated > 2000);
console.log(JSON.stringify({pass:true,count:docs.count,translated:docs.translated}));
