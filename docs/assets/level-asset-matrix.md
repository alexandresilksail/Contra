# 8 关素材覆盖矩阵（Level Asset Matrix）

> 对每一关逐项盘点。状态枚举：`AVAILABLE_AND_VERIFIED` / `AVAILABLE_NOT_VERIFIED` /
> `PARTIAL` / `MISSING` / `LICENSE_BLOCKED`。
> 每项同时标注**原作素材**与**当前实现」两个事实，不允许把程序化原创冒充成原版素材。

生成时间：2026-10-16。关卡配置：`public/assets/levels/level-*/manifest.json`。

---

## Level 01 — JUNGLE（丛林）

| # | 项目 | 原作素材 | 当前实现 | 状态 |
|---|---|---|---|---|
| 1 | 完整关卡地图 | ✅ `stage1bg.png` 3456×245 全景图（本地 Konami 素材，`LICENSE_BLOCKED` 于发布） | 1:1 世界锁定绘制，碰撞独立提取 | `AVAILABLE_AND_VERIFIED`（本地）+ `LICENSE_BLOCKED`（发布） |
| 2 | 背景/视差 | ✅ 全景图内含 | 无额外视差层（原作为单幅） | `AVAILABLE_AND_VERIFIED` |
| 3 | 地面/平台/墙体/障碍 | ✅ `tiles1.png` + 提取碰撞 | Tile 数据（六类 RLE） | `AVAILABLE_AND_VERIFIED` |
| 4 | 玩家精灵/动画 | ✅ `players.png` 左列（比尔） | idle/run/shootRun/jump/fall/crouch/climb/dead 全姿态 | `AVAILABLE_AND_VERIFIED` |
| 5 | 武器/子弹/特效 | ✅ `pickups.png`（5 图标，字母运行时校正） | 7 种武器，子弹程序化 | `PARTIAL`（图标真、子弹程序化） |
| 6 | 敌人种类/精灵/动画 | ✅ `players.png` 右列（红突击兵=原作敌兵换色） | 8 种步兵（grunt/runner/heavy/sniper/shield/bomber/jumper/flame） | `AVAILABLE_AND_VERIFIED` |
| 7 | Boss 精灵/动画/血条 | ✅ `wall1.png`（防御墙） | HP/受击/阶段/击败演出 | `AVAILABLE_AND_VERIFIED` |
| 8 | 可破坏对象 | ✅ 桥梁（图中桥板）+ 武器面板 | `T.BRIDGE` 可毁瓦片 + 洞口水重视图 | `AVAILABLE_AND_VERIFIED` |
| 9 | 水域/爆炸/命中/死亡/重生 | ✅ 图中河流 | 溺死判定、死亡穿桥下落、屏幕底剔除 | `AVAILABLE_AND_VERIFIED` |
| 10 | 道具/武器拾取/HUD | ✅ `pickups.png` + `title.png` | HUD 程序化 | `PARTIAL` |
| 11 | 关卡开始/Boss 战/完成/胜利界面 | ✅ `title.png` | 场景链完整 | `PARTIAL`（标题真、其余程序化） |
| 12 | 音效/BGM | ❌ 无原作音频文件 | 100% 程序化原创音轨（含 Boss 战曲） | `PARTIAL`（原创，无版权风险） |

**运行验证**：浏览器完整通关验收通过（出生→跑图→击破武器面板→Boss HP 100→0→过关），
0 控制台错误；152→162 项单元测试全过；像素级 canvas vs 全景图 100% 匹配。

## Level 02–08 — BASE / WATERFALL / SNOW FIELD / ENERGY ZONE / HANGAR / ALIEN LAIR / HEART

| # | 项目 | 原作素材 | 当前实现 | 状态 |
|---|---|---|---|---|
| 1 | 完整关卡地图 | ❌ 两个参考仓库均无（已核查） | 手工编排 tile 地图（`layouts.ts`，结构化还原） | `PARTIAL` |
| 2 | 背景/视差 | ❌ 无 | `buildBackground(theme)` 每关独立主题 | `PARTIAL` |
| 3 | 地面/平台/墙体/障碍 | ❌ 无 | 程序化地块 + 布局数据 | `PARTIAL` |
| 4 | 玩家精灵/动画 | ✅ 共享 `players.png`（本地） | 同第一关 | `AVAILABLE_AND_VERIFIED`（本地） |
| 5 | 武器/子弹/特效 | ✅ 共享 `pickups.png` + 程序化子弹 | 同第一关 | `PARTIAL` |
| 6 | 敌人种类/精灵/动画 | ⚠️ 步兵共享红突击兵列；载具类无素材 | 程序化敌人（turret/flyer/mech 等） | `PARTIAL` |
| 7 | Boss 精灵/动画/血条 | ❌ 无（原作仅第一关 Boss 有素材） | 7 个程序化 Boss（行为/阶段/弱点齐备） | `PARTIAL` |
| 8 | 可破坏对象 | ❌ 无 | 程序化可毁物 | `PARTIAL` |
| 9 | 水域/爆炸/命中/死亡/重生 | ❌ 无原作素材 | 通用系统（第一关同款逻辑） | `PARTIAL` |
| 10 | 道具/武器拾取/HUD | ✅ 共享图标 | 同第一关 | `PARTIAL` |
| 11 | 关卡开始/Boss 战/完成/胜利界面 | ❌ 无 | 程序化界面 | `PARTIAL` |
| 12 | 音效/BGM | ❌ 无 | 程序化原创 | `PARTIAL` |

**运行验证**：traversal 测试（机器人逐关抵达 Boss 门）通过；每关有实际关卡内容
（不是改背景色/改关卡名）。第 2–8 关**未做逐关浏览器端到端验收**（本轮范围：
第一关回归 + 资产体系建设）→ 标记 `AVAILABLE_NOT_VERIFIED` 于运行时细节。

---

## 汇总

| 关卡 | 原作素材覆盖 | 当前实现 | 运行验证 |
|---|---|---|---|
| level-01 | 完整（地图/角色/敌人/Boss/图标） | 已接入 | ✅ 完整通关 |
| level-02 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-03 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-04 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-05 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-06 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-07 | 无 | 程序化 + 手工地图 | ✅ traversal |
| level-08 | 无 | 程序化 + 手工地图 | ✅ traversal |

**参考仓库素材覆盖结论（如实报告）**：Contra-Unity 与 hundouluo **都只有第一关**内容，
对原版第 2–8 关零覆盖。本轮未从它们接入任何素材（授权全部不合规），
第 2–8 关继续沿用与用户拍板一致的程序化原创方案。

---

## 补充：Open Gunner 授权干净素材（2026-10-16 晚，GameHub commit 438fdba）

从 `2cym/GameHub` 提取 **12 个 CC-BY 3.0 / CC0 素材**（Master484 "Open Gunner"
图形集，OpenGameArt 发布），已复制到 `public/assets/vendor/open-gunner/` 并在
manifest 标记 `publishable: true`（`APPROVED_FOR_PROJECT`，署名见
`vendor/open-gunner/ATTRIBUTION.txt`）。

| 素材 | 可支持的关卡内容 | 当前状态 |
|---|---|---|
| hero.png（1026×1280 主角总表） | 全 8 关玩家精灵（站/蹲/跳/跑/8向瞄准/爬梯/受伤/死亡） | 已入库，**渲染器未切换** |
| tiles.png（1040×904，50px 地块） | 全 8 关地形/背景/门/梯 | 已入库，未切换 |
| enemies.png / mechs.png / enemy_soldier.png | 全 8 关敌人（炮塔/炸弹载体/飞行机器人/机甲/士兵） | 已入库，未切换 |
| pickups.png / bullets.png / hud.png | 全 8 关道具/子弹/HUD | 已入库，未切换 |
| bg1/bg2/bg3/bg4 | 视差背景/纯色底 | 已入库，未切换 |

**决策点 D-1（待用户批准）**：是否把渲染器从"本地 Konami 素材（仅本地）"切换为
"Open Gunner（可再发布）"？切换后仓库即可包含完整可发布构建；不切换则维持现状
（第一关视觉不变、本地 Konami 素材不推送）。在批准前，第一关渲染链路**不做任何改动**。
