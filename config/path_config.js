const path = require("path");

const root_dir = path.resolve(__dirname, "..");
const output_dir = path.join(root_dir, "output");
const dict_dir = path.join(root_dir, "dict");

module.exports = {
  root_dir,
  output_dir,
  dict_dir,
};
