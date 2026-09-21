# 配件弹药图标

本次仅调整配件图像，不改变配件 ID、RP、银狮、等级、前置条件或规划逻辑。

## 显示规则

- 炮弹使用原始弹体、命中效果和装甲图层组合，不再只显示弹体或通用弹药箱。
- 防空车和步战车按具体弹链保留弹头类型、颜色、数量和顺序。例如 M15 的 API、AP、API-T、M54、M59A1 是五种独立图示。
- 弹链组配件可能同时解锁多种弹链。卡片显示其中一种真实弹链作为组图示，悬停说明列出对应变体；这不是新增弹链选择或改变研发目标。
- 不同武器共用一个研发配件时，保留各武器的真实变体记录，不把所有武器认定为同一种弹链。
- 资料无法确认的项目保留原图。导弹和炮塔改装等非炮弹、弹链项目不强行替换。
- 所有组合素材随网页和本地源代码提供。缺图时回退原图，不影响配件选择和预算计算。

## 来源与复核

优先解析已有 Wiki 快照中具体载具的弹药表，而不是只取配件弹窗里的通用图标。
额外武器使用 `catalog.json` 记录的游戏拆包提交版本核对，不使用浮动的最新版本。
图层名称、弹头比例和排列方式依据游戏 `config/gui.blkx` 与 `scripts/weaponry/bulletsvisual.nut`。
弹链补充对应关系来自具体载具、武器预设、武器弹链和 `config/modifications.blkx`。

- `tools/ammunition-assets.json`：原始素材地址、字节数和 SHA-256；素材归 Gaijin 所有。
- `tools/game-ammunition-art.json`：经游戏武器定义确认的补充映射及源文件。
- `tools/ammunition-icon-audit.json`：覆盖数量和未替换项目清单。

离线 Wiki 快照和游戏配置缓存位于被 Git 忽略的 `logs/`，不随网页发布。
更新映射后运行 `node tools/update-modification-icons.cjs`，并在需要新素材时运行
`node tools/fetch-ammunition-assets.cjs`。更新器只允许新增、替换图示字段和相应文件校验值。

核验命令：

```text
node --test tools/test-modification-icons.cjs
node tools/test-modifications.cjs
node tools/check-ammunition-art.cjs
```

最后一项需要可用的 Playwright 和 Chrome；验证桌面、手机、网页和本地入口、缺图回退及已解锁状态。
