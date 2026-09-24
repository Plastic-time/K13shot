# v1.0.11 CA-27 配件费用修正

- 英国、日本 CA-27 Mk.32 的 GLBC mk.3 挂架银狮费用由 9,000 调整为 14,000，研发点保持 9,000。
- 每辆全部配件总计为 145,800 RP / 226,000 SL。
- 保留已选、已研发状态和旧挂架名称的兼容映射；不改变前置、等级门槛、界面或规划算法。
- 网页和桌面便携版同步更新。普通用户下载 `WarThunderResearchCalculator-v1.0.11-portable.zip`，解压后运行 `WarThunderResearchCalculator.exe`。

## 数据来源与范围

本次费用修正已由用户确认，依据游戏配置 **2.59.0.34**，固定提交 `2e2b2e050d80802a64dc1e155d16e088cf2cf122` 中的 `char.vromfs.bin_u/config/wpcost.blkx`。

仅更新 `ca_27_mk32_raaf`、`ca_27_mk32_malaysia` 的 `gloster_lbc` 银狮费用，替代此前用户确认的 9,000 SL。整体载具数据基准仍为 **2.59.0.17**，不是全量快照升级；Ka-29 和 Do 217 J-2 的已有修正保持不变。
