const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function sync() {
  const manifest = read('docs/database/manifest.json');
  const version = read('config/data-version.json');
  assert.equal(manifest.tree_count, version.treeCount);
  assert.equal(manifest.unit_count, version.vehicleCount);
  const rules = ['dict/unlock_quantity.js', 'dict/shop_dependencies.json', 'docs/unlock-quantity.js',
    'docs/app.js', 'public/app.js', 'docs/planner.js', 'public/planner.js', 'main.js'];
  const before = rules.map(file => hash(fs.readFileSync(path.join(root, file))));
  // All source files must validate before any desktop snapshot is replaced.
  const files = manifest.files.map(entry => {
    assert.match(entry.path, /^database\/[a-z]+\/[a-z]+_[a-z]+\.json$/);
    const bytes = fs.readFileSync(path.join(root, 'docs', entry.path));
    assert.equal(hash(bytes), entry.sha256, entry.path);
    assert(Array.isArray(JSON.parse(bytes)));
    return { file: entry.path, bytes };
  });
  for (const { file, bytes } of files) fs.writeFileSync(path.join(root, file), bytes);
  assert.deepEqual(rules.map(file => hash(fs.readFileSync(path.join(root, file)))), before);
  console.log(`Desktop snapshot synchronized: ${files.length} trees, ${version.vehicleCount} vehicles; rule files unchanged.`);
}
if (require.main === module) sync();
module.exports = { sync };
