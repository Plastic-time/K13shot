const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { wikiUnits } = require('./audit-datamine-roster.cjs');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = read('docs/database/manifest.json');
const version = read('config/data-version.json');
const units = new Map();
for (const entry of manifest.files) {
  const desktop = fs.readFileSync(path.join(root, entry.path));
  const web = fs.readFileSync(path.join(root, 'docs', entry.path));
  assert(desktop.equals(web), entry.path + ': desktop and web snapshots must match');
  assert.equal(crypto.createHash('sha256').update(web).digest('hex'), entry.sha256);
  for (const [id, unit] of wikiUnits(JSON.parse(desktop))) {
    assert(!units.has(id), id + ': duplicate');
    units.set(id, unit);
    if (unit.is_premium || unit.is_squadron || unit.is_component) {
      assert.equal(unit.rp, 0); assert.equal(unit.sp, 0);
    }
  }
}
assert.equal(units.size, version.vehicleCount);
assert.equal(manifest.files.length, version.treeCount);
assert.equal(units.get('us_m1a2_abrams').rp, 350000);
assert.equal(units.get('us_m1a2_abrams').sp, 950000);
assert.equal(units.get('jp_type_5_ho_ri_production').rp, null);
assert.equal(units.get('jp_type_5_ho_ri_production').sp, null);
assert(units.has('j_16'));
assert(units.has('rafale_eg_greece'));
for (const folder of ['public', 'docs']) {
  const $ = cheerio.load(fs.readFileSync(path.join(root, folder, 'index.html'), 'utf8'));
  assert.equal($('[data-game-version]').length, 1);
  assert.equal($('[data-game-version]').text(), version.gameVersion);
  assert($('[data-game-version]').closest('.topbar').length, 'Version must stay outside the scrollable tree');
}
assert.equal(require('../dict/unlock_quantity').get_unlock_quantity('israel', 'aviation', 'VIII'), 3);
console.log(JSON.stringify({ trees: manifest.files.length, units: units.size, gameVersion: version.gameVersion,
  desktopWebIdentical: true, costsAndExclusions: true, cornerLabel: true }));
