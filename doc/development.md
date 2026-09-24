# 本地运行与数据维护

[返回项目首页](../README.md) · [English overview](../README.en.md)

## 本地运行

普通用户建议下载 [Windows 便携版](https://github.com/Plastic-time/K13shot/releases/latest)。开发环境使用 **Node.js 24 LTS，版本不低于 24.21.0 且低于 25**，以 `package.json` 的 `engines` 为准。

```powershell
npm ci --ignore-scripts
npm start
```

默认访问 `http://localhost:3000`。Windows 启动器由 .NET 10 构建；便携包自带 Node.js，不要求用户安装开发环境。

## 发布结构

| 路径 | 用途 |
| --- | --- |
| `public/` | 本地和桌面版网页 |
| `docs/` | GitHub Pages 静态网页及发布快照 |
| `database/` | 桌面后端载具数据 |
| `public/database/modifications/`、`docs/database/modifications/` | 配件索引与 44 个按国家、军种划分的数据块 |
| `config/data-version.json` | 载具费用版本与核对范围 |
| `config/vehicle-release.json` | 当前游戏大版本的新增载具标记 |
| `dict/unlock_quantity.js`、`docs/unlock-quantity.js` | 项目独立等级解锁数量规则 |
| `doc/` | 维护说明、版本记录与 README 展示素材 |

静态版在浏览器内计算，不调用第三方规划接口。桌面版使用本地 Express 服务。网页发布和桌面打包是两个步骤；已下载的旧包不会自动获得新网页内容。

## 游戏配置核对

先阅读 [项目数据规则](../AGENTS.md)。游戏配置是未来费用、等级、前置和配件成员核对的主要依据，Wiki 仅作补充；现有历史导入器不能视为已经全部完成这一迁移。

```powershell
node tools/check-datamine-updates.cjs
```

这条命令固定上游提交后读取版本，生成 `logs/datamine-update-check.json`，**不导入数据、不自动升级生产快照**。文件变化不等于玩家价格变化，也不证明载具已公开推出。GitHub 对比接口的文件清单可能有数量上限，需查看报告中的截断提示。

更新前逐项检查 RP、银狮、购买货币、公开可用状态、配件成员、前置和等级门槛。缺失费用不当作 0，也不能用游戏内部价格直接填充玩家购买费用。

Ka-29、Do 217 J-2 和两架 CA-27 的已确认修正记录在配件索引中。v1.0.11 的 CA-27 修正仅涉及两项挂架银狮费用；整体载具费用基准仍为 2.59.0.17，不应把局部更新写成全量升级。

## 历史导入工具

以下工具仍用于开发核对，**不要未经差异审查直接运行后发布**：

| 工具 | 行为与注意事项 |
| --- | --- |
| `npm run pull -- usa ground` | 更新本地指定 Wiki 科技树；可能改变本地数据库 |
| `npm run pull` | 更新本地全部 Wiki 科技树 |
| `node tools/refresh-wiki.cjs` | 抓取 Wiki 候选快照，临时资料位于 `logs/wiki-refresh` |
| `node tools/build-wiki-snapshot.cjs` | 构建候选网页快照；`--apply` 会写入发布数据，应先审查 |
| `node tools/verify-live-wiki.cjs` | 核对 Wiki，不代表已经核对游戏费用 |
| `npm run build:modifications` | 重建配件快照；必须复核来源及用户确认修正 |

“更新当前树”和本地更新接口同样属于历史更新流程，不是自动跟随固定游戏配置的升级器。不要以 Wiki 覆盖已确认的游戏数据。代码审查应将数据变化与 UI、规划算法变化分开。

## 回归检查

```powershell
node tools/test-wiki.cjs
node tools/test-desktop-snapshot.cjs
node tools/test-planner.cjs
node tools/test-modifications.cjs
node tools/test-site-locales.cjs
npm run test:security
```

发布前还需检查实际浏览器页面、下载包及网页数据一致性。配件校验覆盖条目数量、哈希、前置、预算和已确认修正；结构检查通过不等于每一项玩家价格均已实机核对。

## 本地接口

| 接口 | 用途 |
| --- | --- |
| `GET /api/meta` | 国家与军种列表 |
| `GET /api/tree/:country/:type` | 读取本地科技树 |
| `GET /api/tree/:country/:type/flat` | 读取扁平化载具列表 |
| `POST /api/calculate/:country/:type` | 计算载具研发费用 |
| `GET /api/unit/:data_unit_id` | 获取单个载具详情 |
| `POST /api/update/:country/:type` | 有权限校验的本地数据更新，会写入数据库 |

不要把更新凭证放入公开前端。服务暴露范围、管理员更新及部署注意事项见 [服务器配置](server-security.md)。

## 提交与发布

提交须遵守 [隐私规则](commit-privacy.md) 和 [AGENTS.md](../AGENTS.md)，使用指定的 GitHub noreply 身份，不导入隐私清理前的 Git 历史。

```powershell
node tools/check-commit-privacy.cjs --identity
node tools/check-publish-privacy.cjs
node tools/check-commit-privacy.cjs --all
```

版本说明单独存放在 `doc/release-v*.md`。推送主分支会触发 Pages 部署；发布版本标签会触发 Windows 构建和 Release。打包命令为 `npm run package:release`，内容与流程见 `.github/workflows/release.yml`。
