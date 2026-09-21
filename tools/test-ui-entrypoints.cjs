const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const root = path.resolve(__dirname, '..');
for (const folder of ['public', 'docs']) {
  const read = file => fs.readFileSync(path.join(root, folder, file), 'utf8');
  const $ = cheerio.load(read('index.html'));
  assert.equal($('#planButton').length, 1);
  assert.equal($('#planButton').closest('#floatingBudget').length, 1);
  assert.equal($('#floatingPlanButton').length, 0);
  assert.equal($('.topbar-actions #planButton').length, 0);
  assert.equal($('#planButton .floating-plan-test').text(), '\u6d4b\u8bd5');
  assert.equal($('#budgetCount').length, 1);
  assert.equal($('#budgetRp').length, 1);
  assert.equal($('#budgetSl').length, 1);
  const scripts = $('script[src]').map((_, node) => $(node).attr('src').replace(/^\//, '').split('?')[0]).get();
  for (const script of ['vehicle-long-press.js', 'roster.js', 'modifications.js']) {
    assert(scripts.includes(script), `${folder}: missing ${script}`);
    assert(scripts.indexOf(script) < scripts.indexOf('app.js'));
  }
  for (const script of scripts.filter(src => !/^https?:/.test(src))) assert(fs.existsSync(path.join(root, folder, script)));
  assert($('#usageGuideDialog').text().includes('\u957f\u6309'));
  assert($('#usageGuideDialog').text().includes('\u9014\u7ecf\u70b9'));
  assert.match(read('app.js'), /VehicleLongPress\?\.configure/);
  assert.match(read('app.js'), /RosterAudit\?\.badges/);
  assert.match(read('modifications.js'), /isAutomaticallyUnlocked/);
}
for (const file of ['styles.css', 'tree-scroll.css', 'vehicle-long-press.js', 'modifications.js', 'modification-planner.js']) {
  assert(fs.readFileSync(path.join(root, 'public', file)).equals(fs.readFileSync(path.join(root, 'docs', file))), `${file}: copies differ`);
}
const pkg = require('../package.json');
const lock = require('../package-lock.json');
assert.equal(pkg.version, lock.version);
assert.equal(pkg.version, lock.packages[''].version);
console.log(JSON.stringify({ version: pkg.version, singlePlanner: true, touchMenu: true, categoryLabels: true, pass: true }));
