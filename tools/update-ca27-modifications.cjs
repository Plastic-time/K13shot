const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const vehicleIds = ['ca_27_mk32_raaf', 'ca_27_mk32_malaysia'];
const correction = {
  confirmation: 'User approved 14000 SL on 2026-09-24 after reviewing pinned game configuration; GLBC mk.3 and 9000 RP retained',
  gameVersion: '2.59.0.34',
  datamineCommit: '2e2b2e050d80802a64dc1e155d16e088cf2cf122',
  sourcePath: 'char.vromfs.bin_u/config/wpcost.blkx',
  scope: 'GLBC mk.3 purchase cost for both CA-27 variants only',
  previousConfirmation: 'In-game screenshots and user-confirmed 9000 RP / 9000 SL; SL superseded with user approval on 2026-09-24',
  replaces: 'frc_mk2',
  modificationId: 'gloster_lbc',
  rp: 9000,
  sl: 14000,
};

function correctCa27(vehicle) {
  if (!vehicleIds.includes(vehicle.i)) return vehicle;
  const result = structuredClone(vehicle);
  const racks = result.m.filter(mod => ['frc_mk2', 'gloster_lbc'].includes(mod[0]));
  assert.equal(racks.length, 1, 'CA-27 rack changed; review correction');
  const rack = racks[0];
  assert.equal(rack[2], 3);
  rack[0] = 'gloster_lbc';
  rack[4] = 'GLBC Mk III \u6302\u67b6';
  rack[5] = 'GLBC mk.3';
  rack[6] = 'pilon_bomb.png';
  rack[7] = 9000;
  rack[8] = 14000;
  rack[10] = ['fmbc_mk2'];
  for (const mod of result.m) mod[10] = mod[10].map(id => id === 'frc_mk2' ? 'gloster_lbc' : id);
  result.aliases = {...result.aliases, frc_mk2: 'gloster_lbc'};
  assert.equal(result.m.length, 14);
  const ids = new Set(result.m.map(mod => mod[0]));
  for (const mod of result.m) for (const id of mod[10]) assert(ids.has(id), 'Dangling CA-27 prerequisite');
  result.t = [7, 8].map(index => result.m.reduce((sum, mod) => sum + mod[index], 0));
  assert.deepEqual(result.t, [145800, 226000]);
  return result;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const catalogPath = 'database/modifications/catalog.json';
  const catalogRaw = fs.readFileSync(path.join(root, 'docs', catalogPath));
  assert(catalogRaw.equals(fs.readFileSync(path.join(root, 'public', catalogPath))));
  const catalog = JSON.parse(catalogRaw);
  const writes = new Map();
  for (const id of vehicleIds) {
    const meta = catalog.chunks[catalog.vehicles[id]];
    const raw = fs.readFileSync(path.join(root, 'docs', meta.path));
    assert(raw.equals(fs.readFileSync(path.join(root, 'public', meta.path))));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), meta.sha256);
    const chunk = JSON.parse(raw);
    chunk.v[id] = correctCa27(chunk.v[id]);
    const content = JSON.stringify(chunk) + '\n';
    meta.bytes = Buffer.byteLength(content);
    meta.sha256 = crypto.createHash('sha256').update(content).digest('hex');
    catalog.corrections = {...catalog.corrections, [id]: correction};
    writes.set(meta.path, content);
  }
  writes.set(catalogPath, JSON.stringify(catalog) + '\n');
  for (const folder of ['docs', 'public']) {
    for (const [file, content] of writes) fs.writeFileSync(path.join(root, folder, file), content);
  }
  console.log(JSON.stringify({vehicles: vehicleIds, rack: [9000, 14000], totals: [145800, 226000]}));
}
if (require.main === module) main();
module.exports = {correctCa27, vehicleIds, correction};
