// config/path_config.js
const path = require("path");

// 项目根目录
const root_dir = path.resolve(__dirname, "..");

// 输出目录
const output_dir = path.join(root_dir, "output");

// dict 目录
const dict_dir = path.join(root_dir, "dict");

module.exports = {
  root_dir,
  output_dir,
  dict_dir,
};
