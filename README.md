# War Thunder 研发计算器

一个用于规划《战争雷霆》科技树研发路线的本地工具。它可以按国家、军种和载具分支展示科技树，计算所选研发计划所需的研发点 RP 与银狮 SL，并支持“只算所选 / 包含前置”两种计算方式。

## 下载哪个？

如果你只是想直接使用，下载：

**[WarThunderResearchCalculator-v1.0.2-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.2/WarThunderResearchCalculator-v1.0.2-portable.zip)**

这是推荐给大多数玩家的便携版。解压后双击 `WarThunderResearchCalculator.exe` 即可运行，不需要安装 Node.js，也不需要执行 `npm install`。

| 文件 | 推荐人群 | 是否需要安装 Node.js | 使用方式 |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.2-portable.zip` | 普通玩家，推荐下载 | 不需要 | 解压后双击 exe |
| `WarThunderResearchCalculator-v1.0.2.zip` | 开发者或已安装 Node.js 的用户 | 需要 | 解压后运行 `npm install` |

## v1.0.2 更新内容

- 修复鼠标停在科技树区域时无法上下滚轮的问题，恢复滚动向页面传递，保留科技树横向滚动。
- 移除大面积毛玻璃和固定背景图层，减轻载具卡片阴影。
- 桌面研发连线改为空闲时绘制；窄屏或触控设备隐藏连线并跳过计算。
- Pages 说明默认收起。本地版与静态版同步滚动修复。
- 本次没有重新抓取全部 Wiki 数据，内置科技树仍使用已有数据快照。

## GitHub Pages 静态版

GitHub Pages 可直接在浏览器中使用，无需安装或登录。它读取仓库 `docs/database` 内随发布提交的科技树快照，因此可以浏览科技树、选择载具并计算 RP 与 SL。

页面使用经过核验的 Wiki 快照，不会自动跟随 Wiki 的后续修改。快照时间、载具数量、各数据文件 SHA-256 和 Wiki 缺失费用清单见 [核验清单](https://plastic-time.github.io/K13shot/database/manifest.json)。所选载具和计算范围仅保存在当前浏览器的本地存储中，不会上传或同步。

网页版数据更新：重新抓取全部国家与军种的科技树及详情，逐项核对载具 ID、名称、等级、原始前置关系、各战斗类型的 BR、研发费用与购买货币。飞机默认显示空战 RB，不再被陆战或海战数值覆盖。计算器的前置补全、Rank I 和折叠组处理已恢复为本次数据更新前的规则，数据刷新不再改变这些规则。

金币、联队载具继续排除在普通研发费用合计之外，但 `wiki` 字段完整保留原始费用与货币，这不代表游戏内免费。Wiki 没有提供的费用保留为 `null`，网页显示“未提供”，合计提示“未知”，不冒充 0。下一级解锁数量使用项目原有的 `dict/unlock_quantity.js` 规则表，恢复“已选 / 所需”和达标提示；此表不是本次 Wiki 抓取结果。该表同步为 `docs/unlock-quantity.js`，独立于 Wiki 数据快照，后续数据更新不会清除这些门槛。本次更新只针对网页版，不替换已发布的 v1.0.2 安装包。

重新更新与核验（需 Node.js 20 和 `npm install`）：

```powershell
node tools/refresh-wiki.cjs
node tools/build-wiki-snapshot.cjs
node tools/verify-live-wiki.cjs
node tools/build-wiki-snapshot.cjs --apply
node tools/test-wiki.cjs
```

抓取使用 4 个并发、30 秒超时及有限重试；原始 HTML 和临时快照保存在被 Git 忽略的 `logs/wiki-refresh`，12 小时内可断点续跑。校验失败不会覆盖网页数据。`--apply` 在全量校验通过后更新 `docs/database`；仍需提交并成功部署 Pages 才会更新线上网页。

## 功能亮点

- 支持多国家科技树浏览。
- 支持陆战、空战、直升机、远洋舰队、近岸舰队。
- 自动计算所需 RP 与银狮 SL。
- 支持“只算所选 / 包含前置”两种计算方式。
- 正确处理叠加载具，不会把同组载具全部错误计入前置。
- Rank I 初始载具会自动标记为已解锁。
- 按原有规则计算前置与折叠组，并显示各等级解锁数量及达标进度。
- 多条研发线同时选择时，研发计划会按等级和科技树顺序自动排列。
- 本地运行，不需要登录账号。

## 使用方法

### 便携版，推荐

1. 下载 `WarThunderResearchCalculator-v1.0.2-portable.zip`。
2. 解压到任意文件夹。
3. 双击 `WarThunderResearchCalculator.exe`。
4. 浏览器会自动打开计算器页面。

如果浏览器没有自动打开，请手动访问：

```text
http://localhost:3000
```

### 轻量版 / 源码运行

轻量版和源码运行需要本机安装 Node.js 20 或更高版本。

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

也可以双击项目根目录里的：

```text
WarThunderResearchCalculator.exe
```

它会启动 3000 端口服务并自动打开浏览器。

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

## 作者

bilibili关注：扑街的靓仔  
游戏ID：如日方中

---

# War Thunder Research Calculator

A local research planning tool for War Thunder tech trees. It displays tech trees by nation, vehicle type, and branch, then calculates the required Research Points and Silver Lions for your selected research plan.

## Which File Should I Download?

If you simply want to use the calculator, download:

**[WarThunderResearchCalculator-v1.0.2-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.2/WarThunderResearchCalculator-v1.0.2-portable.zip)**

This is the recommended portable package for most players. Extract it and double-click `WarThunderResearchCalculator.exe`. No Node.js installation or `npm install` is required.

| File | Recommended For | Requires Node.js | How to Use |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.2-portable.zip` | Most players | No | Extract and double-click the exe |
| `WarThunderResearchCalculator-v1.0.2.zip` | Developers or users with Node.js installed | Yes | Extract and run `npm install` |

## Features

- Multi-nation tech tree browsing.
- Supports ground, aviation, helicopters, bluewater fleet, and coastal fleet.
- Calculates required RP and Silver Lions.
- Supports selected-only and prerequisite-inclusive calculation.
- Correct handling of foldered vehicle groups.
- Rank I starter vehicles are automatically marked as unlocked.
- Rank I to Rank II progression follows the in-game unlock count logic.
- Research plans are sorted by rank and tech tree progression when multiple lines are selected.
- Runs locally without requiring an online account.

## Creator

bilibili: 扑街的靓仔  
In-game ID: 如日方中
