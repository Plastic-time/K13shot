const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const axios=require('axios');
const {root,sha}=require('./refresh-wiki.cjs');

async function check() {
  const base='https://plastic-time.github.io/K13shot/';
  const stamp=Date.now();
  const get=async file=>(await axios.get(`${base}${file}?verify=${stamp}`,{timeout:30000,responseType:'arraybuffer'})).data;
  const manifest=JSON.parse(await get('database/manifest.json'));
  assert.deepEqual(manifest,JSON.parse(fs.readFileSync(path.join(root,'docs/database/manifest.json'),'utf8')),'Published manifest differs');
  let index=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(index<manifest.files.length) {
      const entry=manifest.files[index++];
      assert.equal(sha(await get(entry.path)),entry.sha256,`Published hash mismatch: ${entry.path}`);
    }
  }));
  for(const file of ['index.html','app.js','styles.css']) assert.equal(sha(await get(file)),sha(fs.readFileSync(path.join(root,'docs',file))),`Stale frontend: ${file}`);
  console.log(JSON.stringify({url:base,publishedSnapshot:manifest.fetched_to,trees:manifest.files.length,units:manifest.unit_count,staticFiles:3,hashMismatches:0}));
}
check().catch(error=>{console.error(error);process.exitCode=1;});
