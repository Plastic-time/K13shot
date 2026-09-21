const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkModificationSymbols({ evaluate, call, artifacts, suffix }) {
  const language=await evaluate('state.language');
  await evaluate("setLanguage('zh');ModificationWorkbench.open('il_m113_hvms')");
  await evaluate('document.fonts.ready');
  assert(await evaluate("document.getElementById('modificationDialog').open"),'Workbench must open');
  assert(await evaluate("document.getElementById('modificationTitle').textContent.includes(String.fromCharCode(0xf059))"),'Check the original game symbol, not a replacement');
  await call('DOM.enable');
  await call('CSS.enable');
  const {root}=await call('DOM.getDocument');
  const {nodeId}=await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#modificationTitle'});
  const {fonts}=await call('CSS.getPlatformFontsForNode',{nodeId});
  assert(fonts.some(font => font.isCustomFont && font.glyphCount > 0),'Workbench title must actually use the bundled game font');
  const budget=await evaluate("[document.getElementById('modificationRp').textContent,document.getElementById('modificationSl').textContent]");
  const shot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,suffix+'-modification-symbol.png'),Buffer.from(shot.data,'base64'));
  await evaluate("document.getElementById('modificationDialog').close();setLanguage('en');ModificationWorkbench.open('il_m113_hvms')");
  assert(await evaluate("document.getElementById('modificationTitle').textContent.includes('Bardelas/60mm HVMS')"));
  assert.deepEqual(await evaluate("[document.getElementById('modificationRp').textContent,document.getElementById('modificationSl').textContent]"),budget,'Font and language do not change modification costs');
  await evaluate(`document.getElementById('modificationDialog').close();setLanguage('${language}')`);
  console.log(JSON.stringify({modificationSymbols:suffix,customGlyph:true,english:true,budgetUnchanged:true}));
}

module.exports = { checkModificationSymbols };
