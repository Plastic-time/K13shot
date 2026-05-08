# War Thunder 研发计算器 v1.0.0

## 应该下载哪个？

如果你只是想直接使用，下载：

**`WarThunderResearchCalculator-v1.0.0-portable.zip`**

这是推荐给大多数玩家的便携版。解压后双击 `WarThunderResearchCalculator.exe` 即可运行，不需要安装 Node.js，也不需要执行 `npm install`。

| 文件 | 推荐人群 | 是否需要安装 Node.js | 使用方式 |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.0-portable.zip` | 普通玩家，推荐下载 | 不需要 | 解压后双击 exe |
| `WarThunderResearchCalculator-v1.0.0.zip` | 开发者或已安装 Node.js 的用户 | 需要 | 解压后运行 `npm install` |

## 工具简介

War Thunder 研发计算器是一款用于规划《战争雷霆》科技树研发路线的本地工具。它可以按国家、军种和载具分支展示科技树，并计算所选研发计划所需的研发点 RP 与银狮 SL。

本工具支持“只算所选”和“包含前置”两种计算方式，适合用于规划从当前载具一路研发到高级载具的整体路线。

## 主要功能

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

### 轻量版

1. 下载 `WarThunderResearchCalculator-v1.0.0.zip`。
2. 确认电脑已安装 Node.js。
3. 在解压目录运行：

```bash
npm install
```

4. 双击 `WarThunderResearchCalculator.exe`，或运行：

```bash
npm start
```

## 注意事项

- 推荐大多数用户下载便携版。
- 如果端口 3000 已被其他程序占用，计算器可能无法启动，请先关闭占用端口的程序。
- 首次启动时，如果系统或安全软件提示未知程序，请确认文件来自本仓库发布页后再运行。

## 作者

bilibili关注：扑街的靓仔  
游戏ID：如日方中

---

# War Thunder Research Calculator v1.0.0

## Which File Should I Download?

If you simply want to use the calculator, download:

**`WarThunderResearchCalculator-v1.0.0-portable.zip`**

This is the recommended portable package for most players. Extract it and double-click `WarThunderResearchCalculator.exe`. No Node.js installation or `npm install` is required.

| File | Recommended For | Requires Node.js | How to Use |
| --- | --- | --- | --- |
| `WarThunderResearchCalculator-v1.0.0-portable.zip` | Most players | No | Extract and double-click the exe |
| `WarThunderResearchCalculator-v1.0.0.zip` | Developers or users with Node.js installed | Yes | Extract and run `npm install` |

## Overview

War Thunder Research Calculator is a local planning tool for War Thunder tech trees. It displays tech trees by nation, vehicle type, and branch, then calculates the required Research Points and Silver Lions for your selected research plan.

It supports both selected-only calculation and prerequisite-inclusive planning, making it useful for planning long research paths from early vehicles to high-tier vehicles.

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

## How to Use

### Portable Package, Recommended

1. Download `WarThunderResearchCalculator-v1.0.0-portable.zip`.
2. Extract it anywhere.
3. Double-click `WarThunderResearchCalculator.exe`.
4. The calculator page should open automatically in your browser.

If the browser does not open automatically, visit:

```text
http://localhost:3000
```

### Lightweight Package

1. Download `WarThunderResearchCalculator-v1.0.0.zip`.
2. Make sure Node.js is installed.
3. In the extracted folder, run:

```bash
npm install
```

4. Double-click `WarThunderResearchCalculator.exe`, or run:

```bash
npm start
```

## Notes

- The portable package is recommended for most users.
- If port 3000 is already in use, the calculator may fail to start. Close the program using that port and try again.
- On first launch, Windows or security software may warn about an unknown program. Only run the file if it was downloaded from this repository release page.

## Creator

bilibili: 扑街的靓仔  
In-game ID: 如日方中
