const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const axios = require('axios');

const root = path.join(__dirname, '..');
const commit = '371120bedae88b59fa0fa34c04566e83da64eed6';
const version = '2.59.0.16';
const source = `https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/${commit}/lang.vromfs.bin_u/lang/units.csv`;

function parseCsv(csv) {
  const rows = [];
  let values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ';') {
      values.push(value);
      value = '';
    } else if (character === '\r' || character === '\n') {
      values.push(value);
      if (values.some(Boolean)) rows.push(values);
      values = [];
      value = '';
      if (character === '\r' && csv[index + 1] === '\n') index++;
    } else value += character;
  }
  if (quoted) throw new Error('Unclosed quote in localization CSV');
  if (value || values.length) {
    values.push(value);
    if (values.some(Boolean)) rows.push(values);
  }
  return rows;
}

function parseCsvLine(line) {
  return parseCsv(line)[0] || [];
}

function cleanName(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectNodes(node, result = new Map()) {
  if (!node || typeof node !== 'object') return result;
  if ((node.type === 'single' || node.type === 'multiple') && node.data_unit_id) {
    result.set(node.data_unit_id.toLowerCase(), { id: node.data_unit_id, type: node.type, fallback: node.title });
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') collectNodes(value, result);
  return result;
}

function buildRows(csv) {
  const records = parseCsv(csv.replace(/^\uFEFF/, ''));
  const header = records.shift();
  const idIndex = header.findIndex(value => value.startsWith('<ID'));
  const englishIndex = header.indexOf('<English>');
  const chineseIndex = header.indexOf('<Chinese>');
  if ([idIndex, englishIndex, chineseIndex].some(index => index < 0)) throw new Error('Localization CSV headers changed');
  const rows = new Map();
  for (const values of records) {
    if (!values[idIndex]) continue;
    rows.set(values[idIndex].toLowerCase(), { en: cleanName(values[englishIndex]), zh: cleanName(values[chineseIndex]) });
  }
  return rows;
}

function localizedName(node, rows) {
  const id = node.id.toLowerCase();
  const candidates = node.type === 'multiple'
    ? [`shop/group/${id}`, `${id}_shop`, `${id}_0`, id]
    : [`${id}_shop`, `${id}_0`, id];
  const row = candidates.map(candidate => rows.get(candidate)).find(candidate => candidate?.en || candidate?.zh) || {};
  const fallback = cleanName(node.fallback || node.id);
  return { en: row.en || fallback, zh: row.zh || row.en || fallback };
}

async function main() {
  const response = await axios.get(source, { responseType: 'text', transformResponse: [value => value], timeout: 60000 });
  const rows = buildRows(response.data);
  const nodes = new Map();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/database/manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    collectNodes(JSON.parse(fs.readFileSync(path.join(root, 'docs', entry.path), 'utf8').replace(/^\uFEFF/, '')), nodes);
  }
  const names = {};
  let translated = 0;
  for (const [id, node] of [...nodes].sort(([left], [right]) => left.localeCompare(right))) {
    names[id] = localizedName(node, rows);
    if (names[id].zh !== names[id].en) translated++;
  }
  const output = JSON.stringify({ schema: 1, source, commit, version,
    sourceSha256: crypto.createHash('sha256').update(response.data).digest('hex'),
    count: nodes.size, translated, names });
  for (const directory of ['docs', 'public']) {
    fs.writeFileSync(path.join(root, directory, 'vehicle-names.json'), output);
  }
  console.log(JSON.stringify({ count: nodes.size, translated, rows: rows.size }));
}

module.exports = { parseCsv, parseCsvLine, cleanName, collectNodes, buildRows, localizedName };
// Preserve the historical entry point without regenerating an obsolete two-language file.
if (require.main === module) require('./build-game-locales.cjs').main(process.argv.includes('--check'))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
