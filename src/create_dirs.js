const fs = require("fs");
const path = require("path");

const nations = [
  "usa",
  "germany",
  "ussr",
  "britain",
  "japan",
  "china",
  "italy",
  "france",
  "sweden",
  "israel",
];

const baseDir = process.cwd(); // 当前目录

nations.forEach((nation) => {
  const dir = path.join(baseDir, nation);

  // 创建文件夹（若不存在）
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // 创建三个文件
  const files = [
    `${nation}_aviation.json`,
    `${nation}_ground.json`,
    `${nation}_helicopters.json`,
  ];

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "", "utf-8"); // 默认写入空 JSON
    }
  });
});

console.log("✅ 所有文件夹和文件已创建完成！");
