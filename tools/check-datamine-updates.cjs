const fs = require('node:fs');
const path = require('node:path');

const repository = 'gszabi99/War-Thunder-Datamine';
const root = path.resolve(__dirname, '..');

async function read(url, json = true) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'K13shot-data-review', Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Public source returned HTTP ${response.status}`);
  return json ? response.json() : response.text();
}

async function checkDatamineUpdates() {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'config/data-version.json'), 'utf8'));
  const head = await read(`https://api.github.com/repos/${repository}/commits/master`);
  if (!/^[a-f0-9]{40}$/.test(head.sha)) throw new Error('Invalid source revision');
  const version = (await read(`https://raw.githubusercontent.com/${repository}/${head.sha}/version`, false)).trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid source version');
  const changed = head.sha !== baseline.gameDataCommit;
  const compare = changed ? await read(`https://api.github.com/repos/${repository}/compare/${baseline.gameDataCommit}...${head.sha}`) : null;
  const files = (compare?.files || []).map(file => ({ path: file.filename, status: file.status }));
  const report = {
    checkedAt: new Date().toISOString(), repository: `https://github.com/${repository}`,
    baseline: { version: baseline.gameVersion, commit: baseline.gameDataCommit, scope: baseline.scope },
    upstream: { version, commit: head.sha }, changed,
    comparisonStatus: compare?.status || 'identical',
    requiresReview: changed,
    // GitHub limits comparison file lists to 300; never imply a complete audit.
    fileListMayBeTruncated: files.length >= 300,
    relevantFiles: files.filter(file => /^(char\.vromfs\.bin_u\/config\/|aces\.vromfs\.bin_u\/|gui\.vromfs\.bin_u\/|atlases\.vromfs\.bin_u\/|images\.vromfs\.bin_u\/|lang\.vromfs\.bin_u\/)/.test(file.path)),
    compareUrl: `https://github.com/${repository}/compare/${baseline.gameDataCommit}...${head.sha}`,
    applied: false,
  };
  const output = path.join(root, 'logs/datamine-update-check.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) checkDatamineUpdates().then(report => {
  console.log(JSON.stringify(report, null, 2));
}).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { checkDatamineUpdates };
