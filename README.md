# War Thunder 研发计算器

想知道开到目标载具还需要走哪条线、花多少研发点和银狮？这款《战争雷霆》研发计算器将**自动路线规划**与**可视化配件研发**放在同一个科技树界面中：选择想开的载具，标记已经拥有的载具，再计算路线；进入配件窗口，还能为单辆载具定制配件研发计划。

**[直接打开网页版，无需下载](https://plastic-time.github.io/K13shot/)** · [下载便携版](https://github.com/Plastic-time/K13shot/releases/tag/v1.0.11)

无需登录游戏账号，规划计算在当前浏览器中完成。以下介绍以当前网页版为准，已发布的下载包保留其发布时的功能，不会自动获得后续网页更新。

网页版标题旁显示“当前在线”浏览器估计数：约每 30 秒更新，超过 90 秒未上报的不再计入，同一浏览器多个标签页合并统计。统计异常不影响研发计算；桌面版不接入这项统计。[统计规则与维护说明](doc/online-counter.md)

## 自动计算研发路线

**不只合计你点选的载具，还会根据项目当前的前置规则和等级解锁数量，搜索通往目标的低 RP 路线。**

1. **选目标**：左键点击或手机轻点想研发的载具，可同时选择多个目标。
2. **标记已有进度**：右键或手机长按约半秒，将账号已有载具标记为“已拥有”，它们参与等级数量计算，但不重复计入待研发费用。
3. **指定必走路线**：有特别想开的载具时，右键或长按设为“途经点”。
4. **开始自动计算**：点击底部研发总计右侧带“测试”标签的“精确规划”，查看需要研发的载具、RP 和银狮预算。

计算后，科技树会区分目标、途经点与自动加入的等级补足载具。折叠组下方显示已选数量，展开后也能看到自动选择的载具及其用途。底部浮动预算方便边看路线边核对花费，“导出科技树截图”可将当前完整科技树和预算保存为图片，便于分享规划结果。

- **优先节省 RP**：以最低 RP 为首要搜索目标，RP 相同时再比较银狮、待研发载具数量等条件。
- **可避开折叠补位**：开启“自动补位时避开折叠载具”，限制自动补位选择；你明确指定的目标和途经点仍会保留。
- **保留选择空间**：也可以只手动选择载具查看预算，不使用自动规划。
- **调整规划结果**：自动规划后可单独取消载具或标记已拥有，其他路线选择保留；再次点击被取消的自动载具会恢复其原有角色，不会统一变成目标。手动调整后按当前选择统计预算，重新点击“精确规划”才会重新搜索路线。
- **一键重新开始**：“清空计划”会一起清除目标、途经点、已拥有标记和自动规划结果。

> **精确规划仍为测试功能。** 结果受当前数据快照、项目规则和本机搜索上限影响。达到计算上限时，仅表示当前找到的路线，不保证是全局最优；实际研发前请在游戏内核对前置关系、等级门槛和费用。

## 可视化配件研发窗口

**不仅能规划开哪辆车，也能规划这辆车先开哪些配件。** 点击载具卡片上的“配件”，即可打开参照游戏配件树组织的独立窗口，按配件类别、I–IV 级和前置箭头查看研发关系。

1. **自由选配件**：左键选择或取消目标，可以只选一个配件，也可以定制一组配件，不必全部研发。
2. **记录已研发**：右键标记已完成的配件，它们参与等级门槛计数，但不重复收费。
3. **即时看预算**：手动选择后立即更新 RP、银狮与等级数量；此时只统计实际选中的配件。
4. **自动补齐条件**：点击“计算配件研发”，按该载具的配件前置和等级门槛补齐所需项目，并区分“目标”“必经配件”“等级补足”“已研发”。

RP 和银狮均明确为 0 的配件直接显示“已解锁”，无需点击，自动计入配件等级数量；未知费用不视为 0。

窗口底部单独显示配件预算，**不会与科技树的载具研发费用混在一起**。支持“全部配件”“清空目标”和“清除已研发”，便于比较不同配件方案。

当前配件快照覆盖 **3,225 辆载具、52,424 个配件**。拥有配件表的载具才显示入口；不具备独立配件表的组件不会强行添加按钮。费用、等级和前置优先使用固定版本游戏配置，名称、图标和布局结合 Wiki 快照，具体数据来源与已知例外见下文。

## Wiki 载具详情

点击卡片左上角的小书签，在弹窗中查看该载具的 War Thunder Wiki 页面；“配件”入口仍留在卡片内部。折叠组也支持此入口，打开或关闭详情不会修改研发计划。

Wiki 需要联网，内容由第三方网站提供。网络缓慢、验证提示或嵌入限制可能影响显示，可使用窗口右上角的外部打开按钮；加载较慢时窗口也会提供“在新标签页打开 Wiki”的入口。关闭窗口后停止嵌入页面。

## 下载哪个？

如果你只是想直接使用，下载：

**[WarThunderResearchCalculator-v1.0.11-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.11/WarThunderResearchCalculator-v1.0.11-portable.zip)**

这是推荐给大多数玩家的便携版。解压后双击 `WarThunderResearchCalculator.exe` 即可运行，不需要安装 Node.js，也不需要执行 `npm install`。

| 文件 | 推荐人群 | 是否需要安装 Node.js | 使用方式 |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.11-portable.zip` | 普通玩家，推荐下载 | 不需要 | 解压后双击 exe |
| `WarThunderResearchCalculator-v1.0.11.zip` | 开发者或已安装 Node.js 的用户 | 需要 | 解压后运行 `npm install` |

## v1.0.11 CA-27 配件费用修正

- 英国、日本 CA-27 Mk.32 的 GLBC mk.3 挂架调整为 9,000 RP / 14,000 SL；每辆全部配件总计 145,800 RP / 226,000 SL。
- 本次经用户确认，按固定游戏配置 2.59.0.34 更新这两项银狮费用，替代 v1.0.8 的 9,000 SL 修正；不升级整体数据快照，不改界面、研发点、前置或规划算法。详情见 [v1.0.11 更新说明](doc/release-v1.0.11.md)。

## v1.0.10 多语言与界面优化

- 新增全站中文、英语、俄语、德语、法语、日语、西班牙语切换，覆盖按钮、指南、规划提示和配件窗口；切换时保留规划状态。
- 载具名称使用固定游戏版本的语言文件，支持多语言搜索。未找到官方语言条目的配件沿用已有名称；第三方 Wiki 正文不由本项目翻译。
- 底部预算栏采用深色半透明玻璃效果，可点击控件加入按压回弹，并尊重减少动态效果设置。
- 等级栏贴合左侧边缘，背景半透明而文字保持清晰；配件和 Wiki 按钮不会盖住等级栏。
- “新增”金边仅标记当前游戏大版本新增载具，不再把较早版本载具算作新增。
- 优化手机端多语言长文案和配件按钮排布。本次不升级游戏数据快照，不改费用、前置和规划搜索规则。详情见 [v1.0.10 更新说明](doc/release-v1.0.10.md)。

## v1.0.9 规划交互与 Wiki 详情

- 自动规划结果支持逐辆调整，保留其余选择、原有角色和刷新后的路线草稿；重新规划仍以明确指定的目标、途经点和已拥有状态为依据。
- 新增小书签形式的 Wiki 详情入口，兼容折叠载具、手机触控和独立配件按钮。
- 加载缓慢时提供外部打开入口，避免一直停留在“正在载入”；第三方 Wiki 的验证和可用性不由本项目控制。
- 保留原有金币、礼包分类标签、零值费用显示和 BR 字号；不更新游戏费用、数据快照或规划搜索算法。详情见 [v1.0.9 更新说明](doc/release-v1.0.9.md)。

## v1.0.8 配件数据修正

- Ka-29 移除多出的 S-24 并修正分层费用、对应前置，总计 297,800 RP / 436,000 SL。
- Do 217 J-2 移除 5 项多余炸弹解锁并收起空列，总计 5,940 RP / 4,480 SL。
- 英国、日本 CA-27 Mk.32 的第三层挂架修正为 GLBC mk.3，按游戏内确认值采用 9,000 RP / 9,000 SL；每辆全部配件总计 145,800 RP / 221,000 SL，保留旧挂架保存的选择状态。
- 网页与下载版同步；不更改界面、载具费用或规划算法。整体数据基准仍为 2.59.0.17，详细来源与局部修正范围见 [v1.0.8 更新说明](doc/release-v1.0.8.md)。

## v1.0.7 界面更新

- 采用深色石墨风格，统一科技树、折叠窗口与底部预算栏的视觉样式。
- 国家改为国旗选择面板，手机上从底部展开；军种改为图标标签，窄屏可横向滑动。
- 移除顶部重复的国家、军种文字，切换后仍保留各科技树的规划状态。
- 桌面版同步此前网页的炮弹与弹链图标、手机配件标题适配及更高分辨率科技树截图。
- 研发算法、载具费用、等级门槛和前置关系未改。在线人数仍仅用于网页版。详情见 [v1.0.7 更新说明](doc/release-v1.0.7.md)。

## v1.0.6 交互更新

- 规划按钮合并到半透明底栏右侧，移除顶部和右侧重复入口。
- 手机长按载具约半秒打开目标、已拥有、途经点菜单，折叠载具同样支持；轻点和滑动保持正常。
- 零 RP 且零银狮的配件直接标记“已解锁”，计入配件等级数量；未知费用不会误判为零。
- 桌面版恢复金鹰、礼包等分类标签；与已核对的网页数据保持一致。
- 载具规划算法、价格快照、等级门槛和前置规则未改。详情见 [v1.0.6 更新说明](doc/release-v1.0.6.md)。

## v1.0.5 数据同步

- 网页和桌面左上角显示游戏数据版本 **2.59.0.17**，表示 2026-09-21 载具 RP / 银狮核对的版本基准。
- 桌面版同步目前网页版的 **3,235 辆载具**，较 v1.0.4 补齐 106 辆，修正 34 辆的 66 个已确认费用字段。
- Wiki 未标价的项目保留为空，不用游戏内部数值直接补成玩家可用价格。
- 不修改规划代码、等级门槛或前置规则文件，配件沿用独立快照；新增桌面和网页数据库一致性测试。

## v1.0.4 维护更新

- 下载版服务默认仅本机可访问，更新接口增加临时凭证、来源检查和频率限制。
- 限制更新并发为 1–8，拒绝异常参数；失败、超时或空数据不会覆盖原数据库。
- 错误响应不再返回本机路径和调用栈；移除公开说明中的个人目录路径。
- 更新依赖，使用 Node.js 24 LTS 与 .NET 10 构建，新增请求与数据回归测试、发布前隐私检查。
- 保留原有 UI、研发算法、等级门槛、载具及配件数据，下载包附 SHA-256 校验文件。

本项目公开源码，压缩包和启动器不等于源码加密。浏览器仍需向战雷图片服务请求图标；本地计划保存在浏览器中。服务器部署与管理员更新说明见 [安全配置](doc/server-security.md)。

## v1.0.3 更新内容

- 将原 J-16 配件研发样板扩展到全部拥有配件表的载具，共 3,225 辆、52,430 个配件。
- 配件的费用、等级、前置关系和等级门槛优先使用固定版本 Datamine，名称、图标与布局使用 Wiki 快照。
- 配件数据按 44 个国家/军种数据块延迟加载，保持小窗口横向滚动和固定底部预算操作区。
- 新增全量结构、哈希和多军种浏览器点击测试；10 个没有配件表的独立防空发射组件不会显示配件按钮。
- 保留 v1.0.2 的页面滚动、性能、右键规划、语言切换和无背景图优化。

## GitHub Pages 静态版

[打开网页版研发计算器](https://plastic-time.github.io/K13shot/)

GitHub Pages 可直接在浏览器中使用，无需安装或登录。它读取仓库 `docs/database` 内随发布提交的科技树快照，因此可以浏览科技树、选择载具并计算 RP 与 SL。精确规划也完全在当前浏览器中运行，不会调用第三方规划接口。

### 配件数据与核验

科技树中所有拥有配件表的载具现在都带有独立“配件”按钮，可打开接近游戏配件树布局的交互面板。当前覆盖 3,225 辆载具、52,424 个配件和 44 个国家/军种数据块；配件名称、图标与布局来自本地 War Thunder Wiki 快照，费用、真实等级、`prevModification`、`reqModification` 和每级解锁数量优先使用固定版本的 War Thunder Datamine 游戏配置。

- 左键配件可设为目标，右键可标记账号中已经研发的配件。
- 手动选择任意数量的配件时，等级数量、RP 与 SL 会立即更新；此时预算只统计玩家实际点选的配件。
- 点击“计算配件研发”后，会分别标出目标、必经配件和为满足等级门槛自动加入的配件。
- 每辆载具分别使用自己的等级门槛，计算时已研发配件会参与计数但不重复收费。
- 配件预算独立显示，不会混入主页面的载具研发 RP / SL。
- 浏览器先载入轻量索引，点击“配件”后才读取当前国家和军种的数据块，不会一次载入全部配件。
- 10 个防空系统的独立发射组件在 Wiki 与游戏配置中都没有配件表，因此不会显示“配件”按钮；这不是载具数据遗漏。
- `Ka-29` 与 `Do 217 J-2` 根据游戏截图及 2.59.0.22 配置作了局部修正：分别移除过时的 S-24 项目和 5 项炸弹解锁，配件总研发点为 297,800 和 5,940；修正来源单独记录在配件索引中，不代表其他载具快照已整体升级。实际研发前仍建议在游戏内核对。

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
4. 点击底部研发总计右侧的“精确规划”。紫色“等级补足”标签表示算法为满足下一级数量要求自动选择的载具。
5. “自动补位时避开折叠载具”只限制算法自动选择的补位载具，不会移除玩家明确指定的目标或途经点。

科技树底部显示半透明的浮动预算栏，“精确规划”位于总计右侧并带有“测试”标签，下滑时仍可使用。精确规划目前属于测试功能，结果仅供参考，请在游戏内自行手动核对后再决定研发路线。

页面顶部提供“使用指南”，以更新日志式分段说明左键、右键和精确规划的完整流程。原“点击操作”模式切换已删除：普通左键始终选择或取消目标，鼠标右键可直接选择“设为目标”“标记为已拥有”或“设为途经点”。再次选择已经生效的状态即可取消；初始载具会自动计入，因此右键选项不可修改。

算法以最低 RP 为首要目标，RP 相同时依次比较 SL、待研发载具数量和载具 ID，以保证结果稳定。礼包、金鹰、联队、活动及未持有的隐藏载具不会被自动选作等级补位；玩家明确标记为已拥有后仍可参与等级数量计算。如果搜索达到本机计算上限，页面会如实显示“当前找到的最低路线”，不会冒充已证明的最优解。

页面使用经过核验的 Wiki 快照，不会自动跟随 Wiki 的后续修改。快照时间、载具数量、各数据文件 SHA-256 和 Wiki 缺失费用清单见 [核验清单](https://plastic-time.github.io/K13shot/database/manifest.json)。所选载具和计算范围仅保存在当前浏览器的本地存储中，不会上传或同步。

网页版数据更新：重新抓取全部国家与军种的科技树及详情，逐项核对载具 ID、名称、等级、原始前置关系、各战斗类型的 BR、研发费用与购买货币。飞机默认显示空战 RB，不再被陆战或海战数值覆盖。计算器的前置补全、Rank I 和折叠组处理已恢复为本次数据更新前的规则，数据刷新不再改变这些规则。

金币、联队载具继续排除在普通研发费用合计之外，但 `wiki` 字段完整保留原始费用与货币，这不代表游戏内免费。Wiki 没有提供的费用保留为 `null`，网页显示“未提供”，合计提示“未知”，不冒充 0。下一级解锁数量使用项目原有的 `dict/unlock_quantity.js` 规则表，恢复“已选 / 所需”和达标提示；此表不是本次 Wiki 抓取结果。该表同步为 `docs/unlock-quantity.js`，独立于 Wiki 数据快照，后续数据更新不会清除这些门槛。网页版与 v1.0.5 下载包使用同一份科技树数据；v1.0.4 的桌面数据库存在滞后，已在 v1.0.5 同步。

重新更新与核验（需 Node.js 24 LTS 和 `npm install`）：

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
- 初始载具显示“初始载具”标签，并自动参与对应的等级数量计算。
- 按原有规则计算前置与折叠组，并显示各等级解锁数量及达标进度。
- 多条研发线同时选择时，研发计划会按等级和科技树顺序自动排列。
- 本地运行，不需要登录账号。
- 3,225 辆拥有配件表的载具支持可视化配件研发、游戏前置和等级门槛补足。

## 使用方法

### 便携版，推荐

1. 下载 `WarThunderResearchCalculator-v1.0.8-portable.zip`。
2. 解压到任意文件夹。
3. 双击 `WarThunderResearchCalculator.exe`。
4. 浏览器会自动打开计算器页面。

如果浏览器没有自动打开，请手动访问：

```text
http://localhost:3000
```

### 轻量版 / 源码运行

轻量版和源码运行需要本机安装 Node.js 24 LTS 或更高版本。

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

A War Thunder calculator focused on **automatic vehicle research planning** and **interactive modification trees**. Choose the vehicles you want, mark what you already own, and calculate a route and its RP / Silver Lion budget. Open a vehicle's modification window to build a separate, customized upgrade plan.

**[Use the web calculator without downloading](https://plastic-time.github.io/K13shot/)**

### Automatic Research Planning

Right-click a vehicle on desktop or press and hold it for about half a second on mobile to set targets, owned vehicles, and optional waypoints, then run **Exact Planning** from the button on the right of the bottom budget bar. The browser searches for a minimum-RP route using the project's current prerequisite and rank-unlock rules, excludes owned vehicles from pending costs, and identifies automatic rank fillers. You can avoid foldered fillers, inspect selected vehicles inside folders, and export the full tech tree as an image with its budget.

Planning is experimental. A search that reaches its computation limit reports the best route found, not a guaranteed global optimum. Check the result against the game before committing to a research route.

### Interactive Modification Window

Open **Modifications** on a supported vehicle to see a game-style tree with categories, tiers, and prerequisite arrows. Left-click to choose any number of upgrades and right-click to mark researched ones. Manual selection updates the selected-only budget immediately; **Calculate Modification Research** adds required prerequisites and tier fillers. Modification RP and Silver Lions remain separate from vehicle research costs.

The current snapshot contains 3,225 vehicles with modification tables and 52,424 modifications. This overview describes the current web version; downloadable releases retain the features available when they were packaged. Data is snapshot-based rather than automatically synchronized with the live game.

## Which File Should I Download?

If you simply want to use the calculator, download:

**[WarThunderResearchCalculator-v1.0.8-portable.zip](https://github.com/Plastic-time/K13shot/releases/download/v1.0.8/WarThunderResearchCalculator-v1.0.8-portable.zip)**

This is the recommended portable package for most players. Extract it and double-click `WarThunderResearchCalculator.exe`. No Node.js installation or `npm install` is required.

| File | Recommended For | Requires Node.js | How to Use |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.8-portable.zip` | Most players | No | Extract and double-click the exe |
| `WarThunderResearchCalculator-v1.0.8.zip` | Developers or users with Node.js installed | Yes | Extract and run `npm install` |

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
