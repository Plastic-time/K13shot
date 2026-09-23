const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cheerio = require('cheerio');
const files = ['i18n.js', 'app-translations.js', 'static-translations.js', 'module-translations.js'];
const keys = new Map();
const context = { window: { WTI18n: { register(rows, scope = '') { for (const row of rows) {
  assert.equal(row.length, 7, row[0]);
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const value of row) {
    assert.equal(typeof value, 'string');
    assert(value.length, row[0]);
    assert.deepEqual(placeholders(value), placeholders(row[0]), row[0]);
  }
  const key = scope ? `${scope}\u0004${row[0]}` : row[0];
  if (keys.has(key)) assert.deepEqual(Array.from(row), Array.from(keys.get(key)), `Conflicting translations: ${key}`);
  keys.set(key, row);
} } } } };
for (const file of files.slice(1)) vm.runInNewContext(fs.readFileSync(`public/${file}`, 'utf8'), context);
for (const file of files) assert(fs.readFileSync(`public/${file}`).equals(fs.readFileSync(`docs/${file}`)), `${file}: copies differ`);
for (const dir of ['public', 'docs']) {
  const $ = cheerio.load(fs.readFileSync(`${dir}/index.html`, 'utf8'));
  assert.equal($('#languageSelect option').length, 7);
  const scripts = $('script[src]').map((_, node) => $(node).attr('src').replace(/^\//, '').split('?')[0]).get();
  for (const file of files) assert(scripts.indexOf(file) >= 0 && scripts.indexOf(file) < scripts.indexOf('modifications.js'), file);
  $('[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-aria-label]').each((_, node) => {
    for (const attribute of ['data-i18n', 'data-i18n-title', 'data-i18n-placeholder', 'data-i18n-aria-label']) {
      const source = $(node).attr(attribute);
      if (source) assert(keys.has(source), `Missing static translation: ${source}`);
    }
  });
}
console.log(JSON.stringify({ languages: 7, messages: keys.size, placeholderParity: true, staticCoverage: true }));
