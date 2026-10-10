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

### 每列包含的动画集（两套对称，坐标偏移约 +1039）

每行带 (band) 是一组完整姿态，逐像素测得的典型帧尺寸（2x 翻录，经 `PLAYER_SCALE=0.5` 切回 1x）：

| 姿态 | 帧数 | 源表尺寸(2x) | 切回 1x 尺寸 | 备注 |
|------|------|--------------|--------------|------|
| 行走循环 (walk cycle) | 12 | ~18×33 | ~9×16 | 主循环，脚/手摆动 |
| 攀爬 (climb) | 2 | 12×44 | 6×22 | 梯子姿态 |
| 卧倒 / 矮姿 (prone) | 4 | 13–18×13 | 7–9×7 | 贴地 |
| 蹲姿 (crouch) | 1 | 18×33 | 9×16 | 站立蹲下 |
| 跳 / 落 (jump / fall) | 12 | 14–22×39 | 7–11×20 | 含死亡/爆炸姿态 |
| 大图块 (death / close-up) | ~14 | 20–31×99–122 | 10–16×50–61 | 死亡/特写帧 |

- **透明区域**：每帧由 `chromaKey` 抠掉对应面板底色得到真实 alpha；精灵本体颜色（红突击兵的暗红/品红制服、肤色、钢色枪械）保留。
- **朝向**：源表精灵 **面朝右**（right）；`flipH` 生成左朝向。
- **总帧数**：两列合计约 556 个独立帧；单列（红突击兵）≈ 250 帧，其中可复用为敌兵动画的约 130 帧。

### 接入状态（已验证）
- `packPlayerArt('razor')` → 左列（比尔）✅ 已接入玩家1。
- `packPlayerArt('titan')` → 右列（红突击兵）✅ 已接入玩家2（兰斯）。
- `packEnemyFrames()` → 右列 12 帧行走循环 → **本次新增**，敌方步兵已接入（见 §5 修复记录）。

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
3. **每关独立地图数据**：仅 **第一关** 有手工编排地图（`level/layouts.ts` → `stage1Map`）。第二至八关仍为程序生成（procgen），尚无逐帧还原的原作地图数据。
4. **原作关卡参考图/录像**：无数字化素材，无法做逐帧比对还原；行为规范 (`gameplay-reference.md`) 基于代码现状与常识还原描述。
5. **门/机关/载具等专项精灵**：无（程序化兜底）。
6. **音效/音乐文件**：无（程序化蜂鸣 `audio.ts`）。

---

## 7. 本批次修复记录（第一批）
- ✅ 敌方步兵接入 `players.png` 右列红突击兵精灵（新增 `packEnemyFrames()` + `buildEnemyArt` 的 `SOLDIER_KINDS` + 按命中盒高度 `fitSetHeight` 贴合）。
- ✅ 拾取图标字母修复：无论是否有表，渲染时始终叠加正确武器字母（`pickup.ts`）。
- ✅ 敌兵动画改为按帧集长度取模（`% sets.length`），行走循环更顺滑。
- 验证：浏览器无头烟测 0 报错 / 60 FPS；`tsc --noEmit` 通过；`vitest` 68 项全过；逐像素 diff 确认红突击兵精灵已渲染（暗红/品红像素出现）。
