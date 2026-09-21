const fs = require('fs');
const path = require('path');

function syncRankUnlocks() {
  const root = path.resolve(__dirname, '..');
  fs.copyFileSync(path.join(root, 'dict/unlock_quantity.js'), path.join(root, 'docs/unlock-quantity.js'));
}

if (require.main === module) syncRankUnlocks();
module.exports = {syncRankUnlocks};
