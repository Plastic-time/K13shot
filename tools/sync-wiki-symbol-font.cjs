const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const source = 'https://wiki.warthunder.com/fonts/symbols_skyquake.bfc9728c6a6bc73f209a.ttf';

async function sync() {
  const {data} = await axios.get(source, {responseType:'arraybuffer', timeout:30000, maxContentLength:5*1024*1024});
  const font = Buffer.from(data);
  if (font.length < 1000 || font.readUInt32BE(0) !== 0x00010000) throw new Error('Invalid TrueType font response');
  const sha256 = crypto.createHash('sha256').update(font).digest('hex');
  for (const site of ['docs','public']) {
    const folder = path.resolve(__dirname,'..',site,'assets/fonts');
    fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'wt-symbols.ttf'),font);
    fs.writeFileSync(path.join(folder,'source.json'),JSON.stringify({name:'WTSymbols',source,owner:'Gaijin Games',sha256,bytes:font.length},null,2)+'\n');
  }
  console.log(JSON.stringify({source,sha256,bytes:font.length}));
}

sync().catch(error=>{console.error(error.message);process.exitCode=1;});
