const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const audit = require("./ammunition-icon-audit.json");
const prefix = "https://static.encyclopedia.warthunder.com/gui_skin/";

async function main() {
  const sources = [];
  for (const directory of ["docs", "public"]) fs.mkdirSync(path.join(root, directory, "images/ammunition"), { recursive: true });
  for (const name of audit.assets) {
    assert.match(name, /^[a-z0-9_-]+\.png$/i);
    const url = prefix + name;
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200, name);
        assert(response.headers.get("content-type")?.startsWith("image/png"), name);
        data = Buffer.from(await response.arrayBuffer());
        assert(data.length < 500000 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), name);
        break;
      } catch (error) { if (attempt === 2) throw error; }
    }
    for (const directory of ["docs", "public"]) fs.writeFileSync(path.join(root, directory, "images/ammunition", name), data);
    sources.push({ file: name, url, bytes: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") });
  }
  fs.writeFileSync(path.join(root, "tools/ammunition-assets.json"), JSON.stringify({ source: "War Thunder Wiki / Gaijin original GUI artwork", assets: sources }, null, 2) + "\n");
  console.log(JSON.stringify({ assets: sources.length, bytes: sources.reduce((sum, item) => sum + item.bytes, 0) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
