const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildVehicleUpdates } = require('./build-vehicle-updates.cjs');

const root = path.resolve(__dirname, '..');
const release = JSON.parse(fs.readFileSync(path.join(root, 'config/vehicle-release.json'), 'utf8'));
const marked = Object.values(release.trees).flat();
assert.equal(marked.length, 50);
assert.equal(new Set(marked).size, 50);
for (const id of ['b_52h', 'f_14d', 'f_16xl', 'germ_hummel', 'ussr_t_90m_arena_m', 'us_destroyer_gridley']) assert(!marked.includes(id));
for (const id of ['f_14d_vf_11', 'j_16', 'us_m7', 'h145m', 'us_destroyer_mahan_class', 'jp_type9_pt809']) assert(marked.includes(id));
const readData = file => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.WTVehicleUpdates));
};
const live = readData(path.join(root, 'public/vehicle-updates-data.js'));
assert.deepEqual(live, readData(path.join(root, 'docs/vehicle-updates-data.js')));
assert.equal(live.basis, 'game-major-update');
assert.equal(live.status, 'reviewed');
assert.deepEqual(Object.values(live.trees).flat().sort(), [...marked].sort());

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-release-test-'));
const write = (file, data) => {
  const target = path.join(temp, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data));
};
try {
  fs.mkdirSync(path.join(temp, 'public'));
  write('config/vehicle-release.json', release);
  write('config/data-version.json', { gameVersion: '2.59.0.27' });
  write('docs/database/manifest.json', { verified_at: '2099-01-01', files: [
    { path: 'database/usa/usa_aviation.json', added: ['b_52h', 'f_16xl'] },
  ] });
  write('docs/database/usa/usa_aviation.json', [{ researchable_vehicles: [[
    { data_unit_id: 'b_52h' }, { data_unit_id: 'f_16xl' },
    { items: [{ data_unit_id: 'f_102a_late' }, { data_unit_id: 'f_14d_vf_11' }] },
  ]] }]);
  const first = buildVehicleUpdates(temp);
  assert.deepEqual(first.trees['usa/aviation'], ['f_102a_late', 'f_14d_vf_11']);
  assert.equal(first.date, '2026-09-16');
  const output = fs.readFileSync(path.join(temp, 'public/vehicle-updates-data.js'), 'utf8');
  buildVehicleUpdates(temp);
  assert.equal(fs.readFileSync(path.join(temp, 'public/vehicle-updates-data.js'), 'utf8'), output);
  write('config/data-version.json', { gameVersion: '2.61.0.1' });
  const future = buildVehicleUpdates(temp);
  assert.equal(future.status, 'needs-review');
  assert.deepEqual(future.trees['usa/aviation'], []);
  console.log(JSON.stringify({ reviewed: marked.length, snapshotAdditionsIgnored: true, futureMajorClearsBadges: true, deterministic: true }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
