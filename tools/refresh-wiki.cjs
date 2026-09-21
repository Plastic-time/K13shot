const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const {extract_rank_tb} = require('../src/2-extract_rank_tb');
const {collectSingleItems} = require('../src/4-fill_tree_details');

const root = path.resolve(__dirname, '..');
const cache = path.join(root, 'logs/wiki-refresh');
const countries = ['usa','germany','ussr','britain','japan','china','italy','france','sweden','israel'];
const types = ['ground','aviation','helicopters','ships','boats'];
const sha = content => crypto.createHash('sha256').update(content).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function download(url, file, force = false) {
  if (!force && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 12*3600000) return;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await axios.get(url, {timeout:30000, headers:{'User-Agent':'K13shot-WikiSnapshot/1.0 (research calculator; bounded refresh)'}});
      if (!response.data.includes('game-unit') && !response.data.includes('unit-tree')) throw new Error('Not a Wiki data page');
      fs.mkdirSync(path.dirname(file), {recursive:true});
      fs.writeFileSync(file + '.tmp', response.data);
      fs.renameSync(file + '.tmp', file);
      return;
    } catch (error) {
      if (attempt === 3 || error.response?.status === 404) throw new Error(`${url}: ${error.message}`);
      await sleep(1500 * 2**attempt);
    }
  }
}

function readTrees() {
  const trees = [];
  for (const type of types) {
    const html = fs.readFileSync(path.join(cache, `${type}.html`), 'utf8');
    const $ = cheerio.load(html);
    if ($('.unit-tree[data-tree-id]').length < 5) throw new Error(`Incomplete ${type} tree page`);
    for (const country of countries) {
      const element = $(`.unit-tree[data-tree-id="${country}"]`);
      const absentNavalTree = ['ships','boats'].includes(type) && ['china','sweden','israel'].includes(country);
      if (element.length > 1 || (!element.length && !absentNavalTree)) throw new Error(`Missing or duplicate tree: ${country}/${type}`);
      const data = element.length ? extract_rank_tb($.html(element), country, type) : [];
      // Compare parsed IDs with all real unit links, independently of rank/column traversal.
      const sourceIds = [...new Set(element.find('a.wt-tree_item-link').map((_,e) => $(e).attr('href').split('/').pop()).get())].sort();
      const items = collectSingleItems(data);
      if (JSON.stringify(items.map(i=>i.data_unit_id).sort()) !== JSON.stringify(sourceIds)) throw new Error(`Tree coverage mismatch: ${country}/${type}`);
      trees.push({country,type,data,sourceIds,sourceHash:sha(html)});
    }
  }
  return trees;
}

async function fetchAll() {
  for (const type of types) await download(`https://wiki.warthunder.com/${type}?v=t`, path.join(cache, `${type}.html`));
  const trees = readTrees();
  const ids = [...new Set(trees.flatMap(t=>t.sourceIds))];
  let index = 0, completed = 0;
  const failures = [];
  const start = Date.now();
  console.log(`Fetching ${ids.length} unique units with 4 workers`);
  await Promise.all(Array.from({length:4}, async () => {
    while (index < ids.length) {
      const id = ids[index++];
      try { await download(`https://wiki.warthunder.com/unit/${id}`, path.join(cache, 'units', `${id}.html`)); }
      catch(error) { failures.push({id,error:error.message}); console.error(error.message); }
      completed++;
      if (completed % 100 === 0 || completed === ids.length) console.log(`${completed}/${ids.length}; ${failures.length} failed; ${Math.round((Date.now()-start)/1000)}s`);
      await sleep(100);
    }
  }));
  fs.writeFileSync(path.join(cache,'fetch-report.json'), JSON.stringify({finishedAt:new Date().toISOString(),uniqueUnits:ids.length,failures},null,2));
  if (failures.length) throw new Error(`${failures.length} failed units; published snapshot unchanged`);
}

if (require.main === module) fetchAll().catch(error=>{console.error(error);process.exitCode=1;});
module.exports = {root, cache, countries, types, sha, readTrees, download};
