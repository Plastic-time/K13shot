const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const axios = require('axios');
const { cleanName, collectNodes } = require('./build-localized-names.cjs');

const root = path.resolve(__dirname, '..');
const commit = '510a793c2bdb01c51475118199c7b66b72935ff1';
const version = '2.59.0.17';
const base = `https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/${commit}/`;
const languages = { zh: 'Chinese', en: 'English', ru: 'Russian', de: 'German', fr: 'French', ja: 'Japanese', es: 'Spanish' };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));

function displayName(value) {
  return cleanName(String(value || '').replace(/\\[tnrvf]/g, ' '));
}

function assertDisplayName(value, label) {
  assert.ok(value, `Empty display name: ${label}`);
  assert.ok(!/[\\\u0000-\u001f\u007f]|<\/?[a-zA-Z][^>]*>|\{[^{}]+\}|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdfi]/.test(value), `Unresolved display formatting: ${label}`);
}

// Use the installed Python standard-library CSV parser, not a bespoke delimiter parser.
// Set PYTHON to an interpreter path on machines without Python on PATH.
function parseCsv(csv) {
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
  const python = process.env.PYTHON || (fs.existsSync(bundled) ? bundled : (process.platform === 'win32' ? 'python' : 'python3'));
  const script = 'import csv, io, json, sys\ntext = sys.stdin.buffer.read().decode("utf-8-sig")\nrows = list(csv.reader(io.StringIO(text, newline=""), delimiter=";", strict=True))\nsys.stdout.buffer.write(json.dumps(rows, ensure_ascii=True).encode("ascii"))';
  const result = spawnSync(python, ['-c', script], { input: csv, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`CSV parser failed: ${result.error?.message || result.stderr}`);
  return JSON.parse(result.stdout).filter(row => row.some(Boolean));
}

function buildRows(csv, lowerCase = false) {
  const records = parseCsv(csv);
  const headers = records.shift();
  if (!headers) throw new Error('Empty localization CSV');
  const idIndex = headers.findIndex(value => value.startsWith('<ID'));
  const indexes = Object.fromEntries(Object.entries(languages).map(([code, title]) => [code, headers.indexOf(`<${title}>`)]));
  if (idIndex < 0 || Object.values(indexes).some(index => index < 0)) throw new Error('Missing required localization CSV headers');
  const rows = new Map();
  const collisions = [];
  for (const values of records) {
    if (!values[idIndex]) continue;
    const key = lowerCase ? values[idIndex].toLowerCase() : values[idIndex];
    const localized = Object.fromEntries(Object.entries(indexes).map(([code, index]) => [code, displayName(values[index])]));
    if (rows.has(key) && JSON.stringify(rows.get(key)) !== JSON.stringify(localized)) {
      if (!lowerCase) throw new Error(`Conflicting localization key: ${key}`);
      // The existing vehicle builder folds keys and keeps the last source row.
      collisions.push({ key, selectedSourceKey: values[idIndex], policy: 'existing-last-row-wins' });
    }
    rows.set(key, localized);
  }
  return { rows, headers, collisions };
}

function createReport() {
  return {
    policy: 'Pinned requested language, then pinned English, then existing same-language label, existing English, or ID. Equal-to-English source text is not counted as a missing translation. Existing labels are not asserted to be pinned game translations.',
    languages: Object.fromEntries(Object.keys(languages).map(code => [code, { source: 0, englishFallback: 0, existingFallback: 0, idFallback: 0, sameAsEnglish: 0 }])),
    missingKeys: [],
    fallbacks: {},
  };
}

function resolveName(id, candidates, rows, existing, report) {
  const key = candidates.find(candidate => Object.values(rows.get(candidate) || {}).some(Boolean));
  const row = rows.get(key) || {};
  const result = {};
  if (!key) report.missingKeys.push(id);
  for (const code of Object.keys(languages)) {
    let kind = 'source';
    if (row[code]) result[code] = row[code];
    else if (row.en) { result[code] = row.en; kind = 'englishFallback'; }
    else if (existing?.[code] || existing?.en) { result[code] = displayName(existing[code] || existing.en); kind = 'existingFallback'; }
    else { result[code] = id; kind = 'idFallback'; }
    report.languages[code][kind]++;
    if (code !== 'en' && row[code] && row[code] === row.en) report.languages[code].sameAsEnglish++;
    if (kind !== 'source') (report.fallbacks[id] ||= {})[code] = kind;
  }
  return { name: result, key: key || null };
}

function vehicleCandidates(id, type) {
  return [...(type === 'multiple' ? [`shop/group/${id}`] : []), `${id}_shop`, `${id}_0`, id];
}

function collectModificationIds() {
  const catalog = readJson('docs/database/modifications/catalog.json');
  const ids = new Set();
  const labels = new Map();
  const legacySources = [];
  let occurrences = 0;
  for (const chunk of Object.values(catalog.chunks)) {
    legacySources.push({ path: `docs/${chunk.path}`, sha256: sha256(fs.readFileSync(path.join(root, 'docs', chunk.path))) });
    const payload = readJson(`docs/${chunk.path}`);
    for (const vehicle of Object.values(payload.v)) for (const mod of vehicle.m) {
      assert.equal(typeof mod[0], 'string');
      ids.add(mod[0]);
      if (!labels.has(mod[0])) labels.set(mod[0], { zh: new Set(), en: new Set() });
      if (displayName(mod[4])) labels.get(mod[0]).zh.add(displayName(mod[4]));
      if (displayName(mod[5])) labels.get(mod[0]).en.add(displayName(mod[5]));
      occurrences++;
    }
  }
  const existing = new Map([...labels].map(([id, value]) => [id, Object.fromEntries(Object.entries(value).filter(([, set]) => set.size === 1).map(([code, set]) => [code, [...set][0]]))]));
  const conflictingLegacyLabels = [...labels].filter(([, value]) => value.zh.size > 1 || value.en.size > 1).map(([id]) => id).sort();
  return { ids: [...ids].sort(), occurrences, existing, legacySources, conflictingLegacyLabels };
}

function modificationTemplate(id, config, rows) {
  const caliber = config?.caliber;
  if (!Number.isFinite(caliber) || caliber <= 0) return null;
  // Match the pinned bulletsInfo resolver: specific name first, then suffix and caliber.
  const suffix = ['_turret_new_gun', '_turret_belt_pack', '_new_gun', '_belt_pack'].find(value => id.endsWith(value));
  if (!suffix) return null;
  const baseKey = `modification/${suffix}`;
  const key = caliber >= 15 && rows.has(`${baseKey}/cannon`) ? `${baseKey}/cannon` : baseKey;
  const row = rows.get(key);
  if (!row) return null;
  const name = Object.fromEntries(Object.entries(row).map(([code, text]) => [code, text.replace(/%s/g, String(caliber))]));
  return { key, caliber, name };
}

async function fetchText(file) {
  const response = await axios.get(base + file, { responseType: 'text', transformResponse: [value => value], timeout: 60000 });
  return response.data;
}

function payload(file, csv, parsed, names, keys, coverage, extra = {}) {
  return {
    schema: 1, source: base + file, commit, version, sourceSha256: sha256(csv),
    languages: Object.keys(languages), headers: parsed.headers, collisions: parsed.collisions,
    count: Object.keys(names).length, ...extra,
    normalization: 'Decode literal game whitespace escapes (backslash t/n/r/v/f) to spaces, then existing cleanName: remove zero-width separators, normalize NBSP and whitespace; preserve game symbols and localized spelling. Reject unresolved markup, interpolation and printf placeholders in final names.',
    coverage, keys, names,
  };
}

async function main(check = false) {
  const sourceVersion = (await fetchText('version')).trim();
  assert.equal(sourceVersion, version, 'Pinned game version mismatch');
  const vehicleFile = 'lang.vromfs.bin_u/lang/units.csv';
  const modificationFile = 'lang.vromfs.bin_u/lang/units_modifications.csv';
  const weaponryFile = 'lang.vromfs.bin_u/lang/units_weaponry.csv';
  const configFile = 'char.vromfs.bin_u/config/modifications.blkx';
  const resolverFile = 'gui.vromfs.bin_u/scripts/weaponry/bulletsinfo.nut';
  const caliberFile = 'gui.vromfs.bin_u/scripts/weaponry/weaponryinfo.nut';
  const vehicleCsv = await fetchText(vehicleFile);
  const modificationCsv = await fetchText(modificationFile);
  const weaponryCsv = await fetchText(weaponryFile);
  const configText = await fetchText(configFile);
  const resolverText = await fetchText(resolverFile);
  const caliberText = await fetchText(caliberFile);
  const modificationConfig = JSON.parse(configText).modifications;
  const vehicleRows = buildRows(vehicleCsv, true);
  const modificationRows = buildRows(modificationCsv);
  const weaponryRows = buildRows(weaponryCsv);
  const keySources = new Map([...modificationRows.rows.keys()].map(key => [key, modificationFile]));
  for (const [key, row] of weaponryRows.rows) {
    if (!modificationRows.rows.has(key)) {
      modificationRows.rows.set(key, row);
      keySources.set(key, weaponryFile);
    }
  }
  const current = readJson('docs/vehicle-names.json');
  assert.deepEqual(Object.keys(current.names).sort(), Object.keys(readJson('public/vehicle-names.json').names).sort(), 'Public/docs vehicle IDs differ');
  const nodes = new Map();
  for (const entry of readJson('docs/database/manifest.json').files) collectNodes(readJson(`docs/${entry.path}`), nodes);
  const vehicles = {}, vehicleKeys = {}, vehicleCoverage = createReport();
  for (const id of Object.keys(current.names).sort()) {
    const resolved = resolveName(id, vehicleCandidates(id, nodes.get(id)?.type), vehicleRows.rows, current.names[id], vehicleCoverage);
    vehicles[id] = resolved.name;
    vehicleKeys[id] = resolved.key;
  }
  const modifications = {}, modificationKeys = {}, modificationCoverage = createReport();
  const { ids, occurrences, existing, legacySources, conflictingLegacyLabels } = collectModificationIds();
  const templates = {};
  for (const id of ids) {
    let rows = modificationRows.rows;
    const directKey = `modification/${id}`;
    if (!rows.has(directKey)) {
      const template = modificationTemplate(id, modificationConfig[id], rows);
      if (template) {
        rows = new Map([[directKey, template.name]]);
        templates[id] = { key: template.key, caliber: template.caliber, source: keySources.get(template.key) };
      }
    }
    const resolved = resolveName(id, [directKey], rows, existing.get(id), modificationCoverage);
    modifications[id] = resolved.name;
    modificationKeys[id] = templates[id]?.key || resolved.key;
  }
  const sources = [[modificationFile, modificationCsv], [weaponryFile, weaponryCsv], [configFile, configText], [resolverFile, resolverText], [caliberFile, caliberText]].map(([file, text]) => ({ path: file, source: base + file, commit, version, sha256: sha256(text) }));
  const outputs = {
    'vehicle-names.json': payload(vehicleFile, vehicleCsv, vehicleRows, vehicles, vehicleKeys, vehicleCoverage, { translated: Object.values(vehicles).filter(name => name.zh !== name.en).length }),
    'modification-names.json': payload(modificationFile, modificationCsv, modificationRows, modifications, modificationKeys, modificationCoverage, {
      occurrences, sources, templates, legacySources, conflictingLegacyLabels,
      lookup: 'Case-sensitive names[mod.id][lang]. If coverage.fallbacks[mod.id][lang] exists, prefer that vehicle modification name[lang] or name.en from the unchanged catalog. Global fallback labels are not authoritative or vehicle-specific.',
      keySources: Object.fromEntries([...new Set(Object.values(modificationKeys).filter(Boolean))].sort().map(key => [key, keySources.get(key)])),
    }),
  };
  for (const [file, output] of Object.entries(outputs)) {
    assert.equal(output.count, Object.keys(output.keys).length);
    for (const [id, name] of Object.entries(output.names)) for (const code of Object.keys(languages)) assertDisplayName(name[code], `${file}:${id}:${code}`);
    const content = JSON.stringify(output) + '\n';
    for (const directory of ['public', 'docs']) {
      const target = path.join(root, directory, file);
      if (check) assert.equal(fs.readFileSync(target, 'utf8'), content, `${directory}/${file} differs from pinned rebuild`);
      else fs.writeFileSync(target, content);
    }
  }
  console.log(JSON.stringify({ check, commit, version, outputs: Object.fromEntries(Object.entries(outputs).map(([file, output]) => [file, { count: output.count, occurrences: output.occurrences, templateCount: Object.keys(output.templates || {}).length, sourceCoverage: Object.fromEntries(Object.entries(output.coverage.languages).map(([code, stats]) => [code, stats.source])), missingKeyCount: output.coverage.missingKeys.length, fallbackEntries: Object.keys(output.coverage.fallbacks).length }])) }));
}

function selfTest() {
  assert.deepEqual(parseCsv('\uFEFF"id";"A; B";"He said ""yes"""\r\n"id2";"two\nlines";""'), [['id', 'A; B', 'He said "yes"'], ['id2', 'two\nlines', '']]);
  assert.throws(() => parseCsv('"unterminated'), /CSV parser failed/);
  const headers = ['<ID|readonly|noverify>', ...Object.values(languages).reverse().map(title => `<${title}>`)];
  const values = ['unit_shop', ...Object.keys(languages).reverse()];
  const parsed = buildRows(headers.join(';') + '\n' + values.join(';'));
  for (const code of Object.keys(languages)) assert.equal(parsed.rows.get('unit_shop')[code], code);
  assert.throws(() => buildRows('<ID>;<English>\nunit;Name'), /headers/);
  const collisions = buildRows(headers.join(';') + '\n' + values.join(';') + '\n' + ['UNIT_SHOP', ...Object.keys(languages).reverse().map(code => `${code}2`)].join(';'), true);
  assert.equal(collisions.collisions.length, 1);
  assert.equal(collisions.rows.get('unit_shop').en, 'en2');
  assert.throws(() => buildRows(headers.join(';') + '\n' + values.join(';') + '\n' + ['unit_shop', ...Object.keys(languages).reverse().map(code => `${code}2`)].join(';')), /Conflicting/);
  assert.equal(cleanName('\u200b\u2417Name\u00a0 Mk\u200b II'), '\u2417Name Mk II');
  const report = createReport();
  const rows = new Map([['unit_shop', { en: '\u2417Name', zh: '\u2417\u540d' }]]);
  assert.equal(resolveName('unit', vehicleCandidates('unit', 'single'), rows, null, report).name.ru, '\u2417Name');
  assert.equal(report.languages.ru.englishFallback, 1);
  assert.equal(resolveName('missing', [], rows, null, report).name.de, 'missing');
  assert.equal(resolveName('old', [], rows, { en: 'Existing' }, report).name.ja, 'Existing');
  assert.deepEqual(vehicleCandidates('group', 'multiple'), ['shop/group/group', 'group_shop', 'group_0', 'group']);
  const templates = new Map([['modification/_new_gun', { en: 'New %s mm MGs' }], ['modification/_new_gun/cannon', { en: 'New %s mm cannons' }]]);
  assert.equal(modificationTemplate('test_new_gun', { caliber: 12.7 }, templates).name.en, 'New 12.7 mm MGs');
  assert.equal(modificationTemplate('test_new_gun', { caliber: 15 }, templates).name.en, 'New 15 mm cannons');
  assert.equal(modificationTemplate('test_new_gun', {}, templates), null);
  console.log('Game locale parser, headers, symbols, candidates and fallback tests passed.');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main(process.argv.includes('--check')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { parseCsv, buildRows, resolveName, vehicleCandidates, createReport, displayName, assertDisplayName, modificationTemplate, main };
