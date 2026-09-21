# War Thunder 研发计算器

一个用于规划《战争雷霆》科技树研发路线的本地工具。它可以按国家、军种和载具分支展示科技树，计算所选研发计划所需的研发点 RP 与银狮 SL，并支持“只算所选 / 包含前置”两种计算方式。

## 下载哪个？

如果你只是想直接使用，下载：

**`WarThunderResearchCalculator-v1.0.0-portable.zip`**

这是推荐给大多数玩家的便携版。解压后双击 `WarThunderResearchCalculator.exe` 即可运行，不需要安装 Node.js，也不需要执行 `npm install`。

| 文件 | 推荐人群 | 是否需要安装 Node.js | 使用方式 |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.0-portable.zip` | 普通玩家，推荐下载 | 不需要 | 解压后双击 exe |
| `WarThunderResearchCalculator-v1.0.0.zip` | 开发者或已安装 Node.js 的用户 | 需要 | 解压后运行 `npm install` |

## 功能亮点

- 支持多国家科技树浏览。
- 支持陆战、空战、直升机、远洋舰队、近岸舰队。
- 自动计算所需 RP 与银狮 SL。
- 支持“只算所选 / 包含前置”两种计算方式。
- 正确处理叠加载具，不会把同组载具全部错误计入前置。
- Rank I 初始载具会自动标记为已解锁。
- Rank I 到 Rank II 按游戏内“解锁指定数量载具”机制处理。
- 多条研发线同时选择时，研发计划会按等级和科技树顺序自动排列。
- 本地运行，不需要登录账号。

## 使用方法

### 便携版，推荐

1. 下载 `WarThunderResearchCalculator-v1.0.0-portable.zip`。
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

**`WarThunderResearchCalculator-v1.0.0-portable.zip`**

This is the recommended portable package for most players. Extract it and double-click `WarThunderResearchCalculator.exe`. No Node.js installation or `npm install` is required.

| File | Recommended For | Requires Node.js | How to Use |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.0-portable.zip` | Most players | No | Extract and double-click the exe |
| `WarThunderResearchCalculator-v1.0.0.zip` | Developers or users with Node.js installed | Yes | Extract and run `npm install` |

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
