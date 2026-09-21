# War Thunder 研发计算器

一个用于规划《战争雷霆》科技树研发路线的本地工具。它可以按国家、军种和载具分支展示科技树，计算所选研发计划所需的研发点 RP 与银狮 SL，并在浏览器本机搜索满足前置关系和等级解锁数量的最低 RP 路线。

## 下载哪个？

如果你只是想直接使用，下载：

**[WarThunderResearchCalculator-v1.0.3-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.3/WarThunderResearchCalculator-v1.0.3-portable.zip)**

这是推荐给大多数玩家的便携版。解压后双击 `WarThunderResearchCalculator.exe` 即可运行，不需要安装 Node.js，也不需要执行 `npm install`。

| 文件 | 推荐人群 | 是否需要安装 Node.js | 使用方式 |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.3-portable.zip` | 普通玩家，推荐下载 | 不需要 | 解压后双击 exe |
| `WarThunderResearchCalculator-v1.0.3.zip` | 开发者或已安装 Node.js 的用户 | 需要 | 解压后运行 `npm install` |

## v1.0.3 更新内容

- 将原 J-16 配件研发样板扩展到全部拥有配件表的载具，共 3,225 辆、52,430 个配件。
- 配件的费用、等级、前置关系和等级门槛优先使用固定版本 Datamine，名称、图标与布局使用 Wiki 快照。
- 配件数据按 44 个国家/军种数据块延迟加载，保持小窗口横向滚动和固定底部预算操作区。
- 新增全量结构、哈希和多军种浏览器点击测试；10 个没有配件表的独立防空发射组件不会显示配件按钮。
- 保留 v1.0.2 的页面滚动、性能、右键规划、语言切换和无背景图优化。

## GitHub Pages 静态版

[打开网页版研发计算器](https://plastic-time.github.io/K13shot/)

GitHub Pages 可直接在浏览器中使用，无需安装或登录。它读取仓库 `docs/database` 内随发布提交的科技树快照，因此可以浏览科技树、选择载具并计算 RP 与 SL。精确规划也完全在当前浏览器中运行，不会调用第三方规划接口。

### 全载具配件研发

科技树中所有拥有配件表的载具现在都带有独立“配件”按钮，可打开接近游戏配件树布局的交互面板。当前覆盖 3,225 辆载具、52,430 个配件和 44 个国家/军种数据块；配件名称、图标与布局来自本地 War Thunder Wiki 快照，费用、真实等级、`prevModification`、`reqModification` 和每级解锁数量优先使用固定版本的 War Thunder Datamine 游戏配置。

- 左键配件可设为目标，右键可标记账号中已经研发的配件。
- 手动选择任意数量的配件时，等级数量、RP 与 SL 会立即更新；此时预算只统计玩家实际点选的配件。
- 点击“计算配件研发”后，会分别标出目标、必经配件和为满足等级门槛自动加入的配件。
- 每辆载具分别使用自己的等级门槛，计算时已研发配件会参与计数但不重复收费。
- 配件预算独立显示，不会混入主页面的载具研发 RP / SL。
- 浏览器先载入轻量索引，点击“配件”后才读取当前国家和军种的数据块，不会一次载入全部配件。
- 10 个防空系统的独立发射组件在 Wiki 与游戏配置中都没有配件表，因此不会显示“配件”按钮；这不是载具数据遗漏。
- `Do 217 J-2` 有 5 个 Wiki 配件不在当前 Datamine 配置中，这 5 项保留 Wiki 的等级、费用与明确前置；其余配件优先使用 Datamine 数据。实际研发前仍建议在游戏内核对。

完整的缺失项、差异项与回退清单保存在 [`tools/modifications-audit.json`](tools/modifications-audit.json)，不会作为网页内容显示。

重建并核验全部配件数据：

```powershell
npm run build:modifications
node tools/test-modifications.cjs
```

精确规划的使用方法：

1. 左键点击最终想研发的载具，或右键载具后选择“设为目标”。
2. 右键账号中已经拥有的载具并选择“标记为已拥有”；这些载具会参与等级解锁计数，但不会计入待研发费用。
3. 需要强制经过某辆载具时，右键它并选择“设为途经点”。
4. 点击右上角“精确规划”。紫色“等级补足”标签表示算法为满足下一级数量要求自动选择的载具。
5. “自动补位时避开折叠载具”只限制算法自动选择的补位载具，不会移除玩家明确指定的目标或途经点。

科技树右侧提供独立的浮动规划轨道。按钮只在科技树进入屏幕时出现，并跟随当前可见区域移动，不会覆盖载具卡片；悬停或聚焦按钮可展开目标数量和测试提醒。精确规划目前属于测试功能，结果仅供参考，请在游戏内自行手动核对后再决定研发路线。

页面顶部提供“使用指南”，以更新日志式分段说明左键、右键和精确规划的完整流程。原“点击操作”模式切换已删除：普通左键始终选择或取消目标，鼠标右键可直接选择“设为目标”“标记为已拥有”或“设为途经点”。再次选择已经生效的状态即可取消；初始载具会自动计入，因此右键选项不可修改。

算法以最低 RP 为首要目标，RP 相同时依次比较 SL、待研发载具数量和载具 ID，以保证结果稳定。礼包、金鹰、联队、活动及未持有的隐藏载具不会被自动选作等级补位；玩家明确标记为已拥有后仍可参与等级数量计算。如果搜索达到本机计算上限，页面会如实显示“当前找到的最低路线”，不会冒充已证明的最优解。

页面使用经过核验的 Wiki 快照，不会自动跟随 Wiki 的后续修改。快照时间、载具数量、各数据文件 SHA-256 和 Wiki 缺失费用清单见 [核验清单](https://plastic-time.github.io/K13shot/database/manifest.json)。所选载具和计算范围仅保存在当前浏览器的本地存储中，不会上传或同步。

网页版数据更新：重新抓取全部国家与军种的科技树及详情，逐项核对载具 ID、名称、等级、原始前置关系、各战斗类型的 BR、研发费用与购买货币。飞机默认显示空战 RB，不再被陆战或海战数值覆盖。计算器的前置补全、Rank I 和折叠组处理已恢复为本次数据更新前的规则，数据刷新不再改变这些规则。

金币、联队载具继续排除在普通研发费用合计之外，但 `wiki` 字段完整保留原始费用与货币，这不代表游戏内免费。Wiki 没有提供的费用保留为 `null`，网页显示“未提供”，合计提示“未知”，不冒充 0。下一级解锁数量使用项目原有的 `dict/unlock_quantity.js` 规则表，恢复“已选 / 所需”和达标提示；此表不是本次 Wiki 抓取结果。该表同步为 `docs/unlock-quantity.js`，独立于 Wiki 数据快照，后续数据更新不会清除这些门槛。网页版与 v1.0.3 下载包使用同一份数据。

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
- 支持目标、已拥有和途经点三种互斥标记。
- 本地精确规划会同时处理前置关系和各等级解锁数量，并按最低 RP 搜索路线。
- 自动补位载具与必经路线分别标记，可选择避开折叠载具。
- 正确处理叠加载具，不会把同组载具全部错误计入前置。
- Rank I 初始载具会自动标记为已解锁。
- 按原有规则计算前置与折叠组，并显示各等级解锁数量及达标进度。
- 多条研发线同时选择时，研发计划会按等级和科技树顺序自动排列。
- 本地运行，不需要登录账号。
- 3,225 辆拥有配件表的载具支持可视化配件研发、游戏前置和等级门槛补足。

## 使用方法

### 便携版，推荐

1. 下载 `WarThunderResearchCalculator-v1.0.3-portable.zip`。
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

A local research planning tool for War Thunder tech trees. It displays tech trees by nation, vehicle type, and branch, then searches locally for the lowest-RP route that satisfies prerequisites and rank unlock requirements.

## Which File Should I Download?

If you simply want to use the calculator, download:

**[WarThunderResearchCalculator-v1.0.3-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.3/WarThunderResearchCalculator-v1.0.3-portable.zip)**

This is the recommended portable package for most players. Extract it and double-click `WarThunderResearchCalculator.exe`. No Node.js installation or `npm install` is required.

| File | Recommended For | Requires Node.js | How to Use |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.3-portable.zip` | Most players | No | Extract and double-click the exe |
| `WarThunderResearchCalculator-v1.0.3.zip` | Developers or users with Node.js installed | Yes | Extract and run `npm install` |

## Features

- Multi-nation tech tree browsing.
- Supports ground, aviation, helicopters, bluewater fleet, and coastal fleet.
- Calculates required RP and Silver Lions.
- Supports separate target, owned, and waypoint markers.
- Searches locally for a minimum-RP route while satisfying prerequisites and rank unlock counts.
- Distinguishes mandatory route vehicles from automatic rank fillers and can avoid foldered fillers.
- Correct handling of foldered vehicle groups.
- Rank I starter vehicles are automatically marked as unlocked.
- Rank I to Rank II progression follows the in-game unlock count logic.
- Research plans are sorted by rank and tech tree progression when multiple lines are selected.
- Runs locally without requiring an online account.
- Provides interactive modification trees for 3,225 vehicles, with per-vehicle prerequisites, tier gates, RP, and Silver Lion costs.

## Creator

bilibili: 扑街的靓仔  
In-game ID: 如日方中
