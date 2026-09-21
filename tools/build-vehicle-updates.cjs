const fs = require('node:fs');
const path = require('node:path');

function buildVehicleUpdates(root = path.resolve(__dirname, '..')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/database/manifest.json'), 'utf8'));
  const trees = {};
  for (const entry of manifest.files) {
    const match = /^database\/([a-z]+)\/\1_([a-z]+)\.json$/.exec(entry.path);
    if (!match) continue;
    const ranks = JSON.parse(fs.readFileSync(path.join(root, 'docs', entry.path), 'utf8'));
    const ids = new Set(ranks.flatMap(rank => [
      ...(rank.researchable_vehicles || []).flat(), ...(rank.premium_vehicles || []).flat(),
    ]).flatMap(item => item.items || [item]).map(item => item.data_unit_id));
    trees[`${match[1]}/${match[2]}`] = [...new Set(entry.added || [])].filter(id => ids.has(id));
  }
  const data = { date: manifest.verified_at.slice(0, 10), basis: 'snapshot-additions', trees };
  const content = `// Generated from the published snapshot; not a game release-date claim.\nwindow.WTVehicleUpdates = ${JSON.stringify(data, null, 2)};\n`;
  for (const dir of ['docs', 'public']) fs.writeFileSync(path.join(root, dir, 'vehicle-updates-data.js'), content);
  return data;
}

if (require.main === module) {
  const data = buildVehicleUpdates();
  console.log(JSON.stringify({ date: data.date, added: Object.values(data.trees).flat().length }));
}
module.exports = { buildVehicleUpdates };
