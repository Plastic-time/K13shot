const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const correction = {
  gameVersion: '2.59.0.22',
  datamineCommit: '32912b19fc2e61615c3940a5dc502493064cc475',
  confirmation: 'In-game screenshot and user-confirmed RP per tier',
};

function correctKa29(vehicle) {
  if (vehicle.i !== 'ka_29') return vehicle;
  const result = structuredClone(vehicle);
  const rpByTier = {1: 9800, 2: 17000, 3: 15000, 4: 48000};
  result.m = result.m.filter(mod => mod[0] !== 'il_28sh_s24');
  for (const mod of result.m) {
    assert(Object.hasOwn(rpByTier, mod[2]), 'Unexpected Ka-29 modification tier');
    mod[7] = rpByTier[mod[2]];
    if (mod[2] === 2) mod[8] = 25000;
    // The removed S-24 unlock no longer sits between B-8M1 and the ATGM rack.
    if (mod[0] === 'mi_24_su_9M114') mod[10] = ['yak_38_b8m1'];
  }
  assert.equal(result.m.length, 17, 'Ka-29 layout changed; review this correction');
  const ids = new Set(result.m.map(mod => mod[0]));
  for (const mod of result.m) for (const id of mod[10]) assert(ids.has(id), 'Dangling Ka-29 prerequisite');
  result.t = [7, 8].map(index => result.m.reduce((sum, mod) => sum + mod[index], 0));
  assert.deepEqual(result.t, [297800, 436000]);
  return result;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const catalogPath = 'database/modifications/catalog.json';
  const oldCatalog = fs.readFileSync(path.join(root, 'docs', catalogPath));
  assert(oldCatalog.equals(fs.readFileSync(path.join(root, 'public', catalogPath))));
  const catalog = JSON.parse(oldCatalog);
  const meta = catalog.chunks[catalog.vehicles.ka_29];
  const raw = fs.readFileSync(path.join(root, 'docs', meta.path));
  assert(raw.equals(fs.readFileSync(path.join(root, 'public', meta.path))));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), meta.sha256);
  const chunk = JSON.parse(raw);
  const oldCount = chunk.v.ka_29.m.length;
  chunk.v.ka_29 = correctKa29(chunk.v.ka_29);
  const delta = chunk.v.ka_29.m.length - oldCount;
  meta.modifications += delta;
  catalog.stats.modifications += delta;
  const content = JSON.stringify(chunk) + '\n';
  meta.bytes = Buffer.byteLength(content);
  meta.sha256 = crypto.createHash('sha256').update(content).digest('hex');
  catalog.corrections = {...catalog.corrections, ka_29: correction};
  for (const folder of ['docs', 'public']) {
    fs.writeFileSync(path.join(root, folder, meta.path), content);
    fs.writeFileSync(path.join(root, folder, catalogPath), JSON.stringify(catalog) + '\n');
  }
  console.log(JSON.stringify({vehicle: 'ka_29', modifications: chunk.v.ka_29.m.length, rp: chunk.v.ka_29.t[0], sl: chunk.v.ka_29.t[1]}));
}
if (require.main === module) main();
module.exports = {correctKa29, correction};
