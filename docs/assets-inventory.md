# 素材清单 / Asset Inventory

> 阶段一交付物（Phase 1）。记录所有美术素材：文件路径、尺寸、帧数、用途、关联实体。
> 生成日期：2026-10-10。下一阶段见 `docs/gameplay-reference.md`。

---

## 0. 加载方式（重要约束）

游戏默认 **100% 程序化生成** 像素美术，零外部文件即可运行。本目录 `public/sprites/`
下的一套「可选精灵包」(`pack.ts`) 仅在文件存在时覆盖程序化美术；缺失时静默回落。

- 这些素材是 **本地接入**，已加入 `.gitignore`，**一律不入库、不推送**（版权合规：第三方素材不在本仓库分发）。
- 程序化美术 (`src/gfx/sprites.ts`) 始终保留，作为兜底与无素材环境下的完整可玩保证。

---

## 1. 精灵表文件（`public/sprites/`，均为可选覆盖层）

| 文件 | 尺寸(px) | 模式 | 用途 | 关联实体 / 系统 |
|------|----------|------|------|----------------|
| `players.png` | 2081 × 1075 | RGB | 角色精灵总表（双列：比尔 + 红色突击兵） | 玩家1(比尔)、玩家2(兰斯)、**敌方步兵** |
| `pickups.png` | 124 × 32 | RGB | 武器胶囊图标（5 格 × 24×32） | 武器拾取 (`pickup.ts`) |
| `title.png` | 560 × 576 | RGBA | 标题画面金属字标 | 标题场景 (`scenes/menu.ts`) |
| `stage1bg.png` | 3456 × 245 | RGB | 第一关横幅背景全景 | 第一关背景 (`packStage1Bg`) |
| `tiles1.png` | 288 × 64 | RGBA | 第一关 16px 地块集（18×4 网格） | 第一关地块 (`packStage1Tiles`) |
| `wall1.png` | 223 × 192 | RGB | 第一关防御墙 Boss | 防御墙 Boss (`packBossWall`) |

---

## 2. `players.png` 详细结构（已逐像素测量）

整张表是 **两列同构的角色精灵**，仅在调色板上不同：

- **左列 (x ≈ 0–1040) = 比尔 / 玩家1**：面板底色为蓝色 `[0,47,87]` 与 `[28,102,145]`（keyed out）。
- **右列 (x ≈ 1041–2081) = 红色突击兵**：面板底色为红色 `[157,28,72]` 与 `[82,14,0]`（keyed out）。

> 关键结论：**没有独立的「敌方步兵」精灵表**。原作《魂斗罗》里基础敌兵本就是红色突击兵，与兰斯共享同一套精灵数据、仅调色板不同。因此本项目的敌方步兵（grunt / runner / heavy / sniper / shield / bomber / jumper / flame）**复用右列的红突击兵精灵** —— 这是目前能得到的最忠实还原，且与原作一致。玩家2（兰斯）同样使用右列，故敌方与 P2 外观相近（符合原作）。

### 地面循环带（y ≈ 24，**逐像素实测**，Phase 3 修正）

用统一 30px 宽探针窗口测量每帧内容包围盒（`tools/player_frames.py` /
`tools/titan_frames.py` / `tools/player_ascii.py`）：

| 列 | 帧 | x 起点 | 内容宽(2x) | 语义 |
|----|----|--------|-----------|------|
| 左(比尔) | 0–5 | 25 90 154 220 285 349 | 16 / 20 / 16 / 18 / 20 / 16 | **徒手行进循环**（手臂收拢） |
| 左(比尔) | 6–11 | 415 480 544 610 675 739 | 25 / 25 / 23 / 25 / 25 / 23 | **持枪行进循环**（右侧横向步枪伸出） |
| 右(红突击兵) | 0–5 | 1063 1127 1195 1258 1321 1392 | 20 / 21 / 15 / 17 / 22 / 16 | **徒手行进循环** |
| 右(红突击兵) | 6–11 | 1453 1517 1585 1648 1712 1780 | 22 / 23 / 20 / 22 / 23 / 20 | **持枪行进循环** |

帧间距约 64–65px，两列**同为 12 帧布局**。

> **修正记录**：`PACK_MAP.titan` 原只列了 10 帧，漏掉 `x=1517` 与 `x=1712`；已补齐为 12 帧。
> 另：旧的 `packPlayerArt` 用索引 `[1,3,5,7]` 取跑步帧，而 `7` 实测是**持枪帧**，属错误映射；
> 现已改为 `0–5 = run`、`6–11 = shoot`。

### 其余姿态带

| 姿态带 | y | 帧数 | 备注 |
|--------|---|------|------|
| 攀爬 climb | ≈ 8 | 2 | 竖长姿态（内容高 ≈ 45 行） |
| 跳 / 落 jump / fall | ≈ 203 | 各 1 | 内容高 ≈ 40 行 |
| 死亡 dead | ≈ 203 | 2 | 内容高 ≈ 45 行 |
| 卧倒 / 矮姿 prone | ≈ 42 | 1 | 宽扁（40×16 单元格，内容 32 宽） |

- **透明区域**：每帧先 `chromaKey` 抠掉面板底色，再 `trimSprite` 裁掉四周空边，最后
  `alignFrames` 做**内容左对齐 + 底边对齐** —— 修掉了原实现里每帧含 7–14px 空白底边导致角色**悬空**的问题。
- **缩放**：整组按同一系数 `k = 命中盒高度 / 站立帧高度` 缩放（最近邻），使跑/跳/卧/爬的相对比例保持正确
  （卧倒仍矮、攀爬仍高），且站立帧高度正好等于命中盒高度（RAZOR 22 / TITAN 23）。
- **朝向**：源表精灵 **面朝右**（right）；`flipH` 生成左朝向。
- **武器位置**：源帧已将步枪烘焙进精灵（持枪帧）。程序化美术路径下则由运行时按实时 `aimAngle`
  旋转绘制「手臂 + 枪」，锚定在肩点，保证 8 向瞄准下武器始终连在手上。

### 接入状态（浏览器实测，`packActive: true`）

| 帧 | 输出尺寸 | 内容行范围 | 内容列范围 |
|----|----------|-----------|-----------|
| idle | 16×22 | 1..21 | 0..9 |
| run0 / run3 | 16×22 | 0..21 / 1..21 | 0..11 / 0..10 |
| shootRun0 / shootRun5 | 16×22 | 1..21 | 0..**15** / 0..**14** |
| jump / fall | 11×25 | 0..23 | 0..10 |
| crouch | 20×**10** | 0..9 | 0..19 |
| climb0 | 9×29 | 0..27 | 0..8 |
| dead0 | 13×29 | 0..27 | 0..11 |

- 站立/跑步帧内容底边 = 第 21 行 = `height-1` → **脚正好落地**，不再悬空。
- 持枪帧内容右边界 14–15，徒手帧 10–11 → **步枪确实伸出**，验证了 0–5 / 6–11 的语义划分。
- `packPlayerArt('razor')` → 左列（比尔）✅ 玩家1。
- `packPlayerArt('titan')` → 右列（红突击兵）✅ 玩家2（兰斯）。
- `packEnemyFrames()` → 右列 12 帧 → ✅ 敌方步兵（grunt/runner/heavy/sniper/shield/bomber/jumper/flame）。

---

## 3. `pickups.png`
- 5 个胶囊格子（24×32），从左到右排布。
- **已知问题（已修复）**：格子内烘焙的字母只有 5 个，且与原作的 7 种武器字母不对位（`rifle` 对应格子却显示 `M` 等）。修复方式见 §5：渲染时**始终叠加权威武器字母**（`weaponDef().letter`），不再依赖表内烘焙字。

## 4. 程序化美术（`src/gfx/sprites.ts`，无文件）
全部用 1px 矩形在离屏 canvas 上绘制，分类如下：
- 玩家角色 `buildPlayerArt`（RAZOR / TITAN，含 8 向枪械 `bakeGun`）
- 敌方 `ENEMY_ART`：soldier / turret / flyer / spider / mech / roller / drone / worm
- Boss `buildBossArt`：8 个 Boss（commander/guardian/crawler/worm/gunship/frostcore/hivemind/doomcore）
- 地块 / 背景 `buildTileArt` / `buildBackground`：9 套主题（base/forest/factory/cavern/city/snow/alien/finalbase）
- 拾取 / 特效 `buildCapsule` / `buildWeaponCrate` / `buildHeart` / `buildLogo`

---

## 5. 关联实体表

| 素材 | 关联实体 |
|------|----------|
| `players.png` 左列 | 玩家1（RAZOR / 比尔） |
| `players.png` 右列 | 玩家2（TITAN / 兰斯）**+ 全部步兵敌兵** |
| `pickups.png` | 武器胶囊（`WEAPON_ORDER` 7 种武器） |
| `title.png` | 标题画面 |
| `stage1bg.png` | 第一关背景 |
| `tiles1.png` | 第一关地块（solid/platform/water） |
| `wall1.png` | 第一关 Boss「基地指挥官 / 防御墙」 |
| 程序化 | 其余所有 Boss、载具类敌兵、地块/背景兜底 |

---

## 6. 缺失 / 待补素材（明确列出，不臆造）

1. **独立敌方步兵精灵表**：无。当前复用红突击兵（兰斯）列 —— 视觉上即原作红敌兵，属合理还原，但需知悉敌方与 P2 外观一致。
2. **子弹精灵表**：无。子弹为程序化矩形/激光（`bullet.ts`）。与原作小圆点/光束风格一致，可接受。
3. **每关独立地图数据**：✅ 已补齐 —— 第 1–8 关全部为手工编排的原创 tile 地图（`level/layouts.ts`
   → `stage1Map..stage8Map`）。但仍是**结构化还原**（地形节奏/主题符合原作），**非逐像素照搬**
   原作关卡（无原作 tile 像素数据可提取）。
4. **原作关卡参考图/录像**：无数字化素材，无法做逐帧比对还原；行为规范 (`gameplay-reference.md`) 基于代码现状与常识还原描述。
5. **门/机关/载具等专项精灵**：无（程序化兜底）。
6. **音效/音乐文件**：无（程序化蜂鸣 `audio.ts`）。

---

## 7. 修复记录

### 第一批（Phase 1/2）
- ✅ 敌方步兵接入 `players.png` 右列红突击兵精灵（新增 `packEnemyFrames()` + `buildEnemyArt` 的 `SOLDIER_KINDS`）。
- ✅ 拾取图标字母修复：无论是否有表，渲染时始终叠加正确武器字母（`pickup.ts`）。
- ✅ 敌兵动画改为按帧集长度取模（`% sets.length`），行走循环更顺滑。
- 验证：浏览器无头烟测 0 报错 / 60 FPS；`tsc` 通过；`vitest` 68 项全过；逐像素 diff 确认红突击兵已渲染。

### 第二批（Phase 4 — 地图）
- ✅ 第 2–8 关手工地图 + `MapBuilder` 工具 + `tests/traversal.test.ts`（机器人逐关抵达 BOSS 门）。

### 第三批（Phase 3 — 玩家状态机与动画映射）
- ✅ 新增 `src/entities/playerState.ts`：`MoveState` / `AnimTag` / `ANIM_FPS` / `ANIM_FRAMES` /
  `resolveMoveState()` / `animFrame()` / `animTag()` —— 姿态由真实物理推导，射击为叠加层。
- ✅ `Player` 增加 `moveState` / `shootT` / `hurtT` / `landT` 与 `anim` getter；姿态切换时 `animT` 归零。
- ✅ 新增持枪变体美术 `PlayerArt.shoot`（`idle/run/jump/fall/crouch/climb`），实现"边跑边射/边跳边射"。
- ✅ 修复 `a.hurt` 从未被使用的缺陷（受击现在真的播放 HURT 姿态）。
- ✅ 修复地面后坐力把静止玩家推成 RUN 姿态（`|vx|=30 > 12`）：地面后坐力降为 30%。
- ✅ 切片管线修正：`trimSprite` 去空边 + `alignFrames` 底边对齐 + 整组统一缩放，修掉角色悬空与逐帧抖动。
- ✅ 修正 `PACK_MAP` 帧映射错误（titan 漏 2 帧；run 误取持枪帧）。
- ✅ 程序化美术补齐 6 帧跑步循环（`run4/run5`）并对齐 6 帧的精灵表循环。
- 验证：`tsc --noEmit` 干净；`vite build` 成功（126.4 kB / gzip 41.1 kB）；
  **vitest 109/109 通过**（新增 `tests/playerState.test.ts` 25 项）；
  浏览器实测 0 报错 / 60 FPS，键盘输入观察到 10 种姿态切换。
