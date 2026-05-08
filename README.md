# War Thunder 研发计算器

这是一个基于当前 War Thunder Wiki 的科技树数据抓取器和本地研发计算器。

## 环境

- Node.js 20 或更高版本
- npm

## 安装

```bash
npm install
```

## 启动计算器

```bash
npm start
```

然后打开：

```text
http://localhost:3000
```

3000 端口仍然保留为主入口；网页右上角的“更新当前树”会继续调用后端更新当前国家/军种的科技树数据。

也可以直接双击项目根目录里的：

```text
WarThunderResearchCalculator.exe
```

它会启动 3000 端口服务并自动打开浏览器。如果要重新生成启动器：

```bash
npm run build:launcher
```

## 当前界面能力

- Wiki 式科技树：按国家、军种、等级和分支列展示本地 Wiki 科技树。
- 全树前置关系：科技树会显示所有可见载具之间的研发前置连线，而不是只画某条计划路线。
- 文件夹载具：文件夹内载具保持成组展示，后续载具会按前置关系连接到文件夹内项目。
- 中文显示：界面、国家、军种、科技树分区和常见载具定位会显示为中文；载具型号保留官方名称，避免把型号机翻错。

## 更新 Wiki 数据

更新一个科技树：

```bash
npm run pull -- usa ground
```

更新全部国家和军种：

```bash
npm run pull
```

也可以在网页右上角点击“更新当前树”，它会更新当前选择的国家和军种。

## 可用接口

- `GET /api/meta`：国家和军种列表
- `GET /api/tree/:country/:type`：读取本地数据库
- `GET /api/tree/:country/:type/flat`：读取扁平化载具列表
- `POST /api/calculate/:country/:type`：计算计划研发消耗
- `POST /api/update/:country/:type`：从当前 War Thunder Wiki 更新并写入本地数据库
- `GET /api/unit/:data_unit_id`：实时读取单个载具详情

## 说明

当前 Wiki 仍然输出 `unit-tree` / `wt-tree_*` 科技树 HTML，但详情页字段需要按卡片标题解析。本项目已经改为更稳的标题解析，并保存 `data-unit-req` 前置载具关系，计算器可以据此生成研发路径。
