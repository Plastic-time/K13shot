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

## 第一次使用

仓库不预置完整 `database/` 数据。启动网页后，如果当前国家和军种没有本地数据，可以点击右上角“更新当前树”。

也可以用命令更新一个科技树：

```bash
npm run pull -- usa ground
```

更新全部国家和军种：

```bash
npm run pull
```

## 可用接口

- `GET /api/meta`：国家和军种列表
- `GET /api/tree/:country/:type`：读取本地数据库
- `GET /api/tree/:country/:type/flat`：读取扁平化载具列表
- `POST /api/calculate/:country/:type`：计算计划研发消耗
- `POST /api/update/:country/:type`：从当前 War Thunder Wiki 更新并写入本地数据库
- `GET /api/unit/:data_unit_id`：实时读取单个载具详情

## 说明

当前 Wiki 仍然输出 `unit-tree` / `wt-tree_*` 科技树 HTML，但详情页字段需要按卡片标题解析。本项目已经改为更稳的标题解析，并保存 `data-unit-req` 前置载具关系，计算器可以据此生成研发路径。
