const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const removedIds = new Set(['ju-88_4xSC250', 'flamm_250', 'ju-88_2xSC500', 'flamm_500', 'etc1000_1_mod']);
const correction = {
  gameVersion: '2.59.0.22',
  datamineCommit: '32912b19fc2e61615c3940a5dc502493064cc475',
  confirmation: 'In-game screenshot: 14 modifications, no bomb unlocks, 5940 total RP',
};
function isRemovedDo217Modification(vehicleId, modId) {
  return vehicleId === 'do_217j_2' && removedIds.has(modId);
}
function correctDo217(vehicle) {
  if (vehicle.i !== 'do_217j_2') return vehicle;
  const result = structuredClone(vehicle);
  result.m = result.m.filter(mod => !removedIds.has(mod[0]));
  assert.equal(result.m.length, 14, 'Do 217 J-2 layout changed; review correction');
  for (const [index, category] of result.c.entries()) {
    if (category[1] === 'Weaponry') category[2] = Math.max(...result.m.filter(mod => mod[1] === index).map(mod => mod[3])) + 1;
  }
  const ids = new Set(result.m.map(mod => mod[0]));
  for (const mod of result.m) for (const id of mod[10]) assert(ids.has(id), 'Dangling Do 217 J-2 prerequisite');
  result.t = [7, 8].map(index => result.m.reduce((sum, mod) => sum + mod[index], 0));
  assert.deepEqual(result.t, [5940, 4480]);
  return result;
}
function main() {
  const root = path.resolve(__dirname, '..');
  const catalogPath = 'database/modifications/catalog.json';
  const catalogRaw = fs.readFileSync(path.join(root, 'docs', catalogPath));
  assert(catalogRaw.equals(fs.readFileSync(path.join(root, 'public', catalogPath))));
  const catalog = JSON.parse(catalogRaw);
  const meta = catalog.chunks[catalog.vehicles.do_217j_2];
  const raw = fs.readFileSync(path.join(root, 'docs', meta.path));
  assert(raw.equals(fs.readFileSync(path.join(root, 'public', meta.path))));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), meta.sha256);
  const chunk = JSON.parse(raw);
  const oldCount = chunk.v.do_217j_2.m.length;
  chunk.v.do_217j_2 = correctDo217(chunk.v.do_217j_2);
  const delta = chunk.v.do_217j_2.m.length - oldCount;
  meta.modifications += delta;
  catalog.stats.modifications += delta;
  const content = JSON.stringify(chunk) + '\n';
  meta.bytes = Buffer.byteLength(content);
  meta.sha256 = crypto.createHash('sha256').update(content).digest('hex');
  catalog.corrections = {...catalog.corrections, do_217j_2: correction};
  const auditPath = path.join(root, 'tools/modifications-audit.json');
  const audit = JSON.parse(fs.readFileSync(auditPath));
  const previous = audit.samples.missingGameMods;
  const remaining = previous.filter(entry => ![...removedIds].some(id => entry === 'do_217j_2:' + id));
  audit.missingGameMods -= previous.length - remaining.length;
  audit.samples.missingGameMods = remaining;
  catalog.audit.missingGameMods = audit.missingGameMods;
  for (const folder of ['docs', 'public']) {
    fs.writeFileSync(path.join(root, folder, meta.path), content);
    fs.writeFileSync(path.join(root, folder, catalogPath), JSON.stringify(catalog) + '\n');
  }
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({vehicle: 'do_217j_2', modifications: 14, rp: 5940, sl: 4480}));
}
if (require.main === module) main();
module.exports = {correctDo217, isRemovedDo217Modification, correction};
