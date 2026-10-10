# 原作行为规范 / Gameplay Reference

> 阶段二交付物（Phase 2）。以**代码现状**为依据记录行为，标注「证据来源」「当前实现」「验证状态」。
> 原则：**不臆造原作数值**。凡需与原版《魂斗罗》比对之处，一律标注 `待与原作比对`，不凭空写数字。

---

## 1. 玩家移动（Player Movement）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 基础跑速 | `BASE_SPEED = 122` px/s（×角色系数） | `player.ts:26` | ✅ 已调为 Contra 节奏（原 ~178 → 122） |
| 角色系数 | RAZOR 1.06 / TITAN 0.88 | `sprites.ts` `CHAR_DEFS` | ✅ |
| 地面加速度 | `PLAYER_ACCEL = 900` | `constants.ts` | ✅ |
| 空中加速度 | `PLAYER_AIR_ACCEL = 620` | `constants.ts` | ✅ |
| 地面摩擦 | `PLAYER_FRICTION = 1150` | `constants.ts` | ✅ |
| 重力 | `GRAVITY = 1500` | `constants.ts` | ⚠️ 待与原作重力曲线比对 |
| 最大下落 | `MAX_FALL = 460` | `constants.ts` | ⚠️ 待比对 |
| 跳跃初速 | `JUMP_VELOCITY = 390` | `constants.ts` | ⚠️ 待比对 |
| 跳跃切割(松键) | `JUMP_CUT = 0.42` | `constants.ts` | ✅ |
| 土狼时间 | `COYOTE_TIME = 0.09` | `constants.ts` | ✅ |
| 跳跃缓冲 | `JUMP_BUFFER = 0.1` | `constants.ts` | ✅ |
| 梯子速度 | `LADDER_SPEED = 78` | `constants.ts` | ⚠️ 待比对 |
| 命中盒 | 12 × (h-2)，RAZOR h24→22，TITAN h25→23 | `player.ts:34,69` | ✅ |

逻辑要点（`player.ts:139-283`）：
- 水平加速/摩擦分地面与空中两套；蹲下时锁水平输入。
- 跳跃支持 coyote + buffer + 切割，且可从梯子起跳。
- **行走可边跑边射、边跳边射**（与原作一致）：射击 `fire()` 独立于移动状态（`player.ts:273,285`）。

### 1.1 玩家状态机（Phase 3 已完成）

`player.state`（`alive/dying/dead/victory`）保留为**生命周期**状态，场景/复活/HUD 依赖它，不改动。
新增正交的**位移动画状态** `Player.moveState`（`src/entities/playerState.ts`）：

| 状态 | 进入条件（每固定步由真实物理判定） | 源码 |
|------|-----------------------------------|------|
| `IDLE` | 在地面、不蹲、不满爬、`\|vx\| ≤ 12` | `playerState.ts:resolveMoveState` |
| `RUN` | 在地面、`\|vx\| > 12` | 同上 |
| `JUMP` | 不在地面且 `vy < 0` | 同上 |
| `FALL` | 不在地面且 `vy ≥ 0` | 同上 |
| `CROUCH` | 在地面且蹲下 | 同上 |
| `CLIMB` | `onLadder` | 同上 |
| `HURT` | `hurtT > 0`（非致命受击，`HURT_TIME = 0.26`） | `player.ts:hurt()` |
| `DEAD` | `dying/dead` | `player.ts:update()` |
| `VICTORY` | 通关 | `scenes/game.ts` |

**射击是叠加层而非替换层**（原作行为）：`shootT > 0` 时选用该位移姿态的**持枪变体** `art.shoot.*`，
得到 `SHOOT_IDLE / SHOOT_RUN / SHOOT_JUMP / SHOOT_FALL / SHOOT_CROUCH / SHOOT_CLIMB`。
`HURT`/`DEAD` 无持枪变体。

动画驱动规则：姿态变化时 `animT` 与 `frame` 归零（跑步永远从第一步开始，不再沿用上一姿态的陈旧帧计数）；
帧号 = `animFrame(state, animT, 实际美术帧数)`，按真实帧数取模，不会越界。

| 参数 | 值 | 源码 |
|------|----|------|
| 跑步帧率 | 12 FPS | `playerState.ts:ANIM_FPS` |
| 站立帧率 | 2 FPS（呼吸感） | 同上 |
| 爬梯帧率 | 8 FPS | 同上 |
| 死亡帧率 | 2 FPS（先翻滚后尸体） | 同上 |
| 射击姿态保持 | `SHOOT_ANIM_TIME = 0.16` | `constants.ts` |
| 受击硬直 | `HURT_TIME = 0.26` | `constants.ts` |

**后坐力修正**：地面后坐力降为 30%（空中仍 100%）。原实现里步枪 30px/s 的后坐力会把静止玩家推成
`RUN` 姿态（`\|vx\|=30 > 12`），导致"站着开枪却在播放跑步动画"。

验证：`tests/playerState.test.ts`（25 项，含纯函数与真实物理驱动）；浏览器实测键盘输入序列
观察到 `IDLE→RUN→SHOOT_RUN→SHOOT_JUMP→JUMP→SHOOT_FALL→FALL→CROUCH→SHOOT_CROUCH→SHOOT_IDLE`。

---

## 2. 姿态与射击（Stances & Shooting）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 8 向瞄准 | `aimAngle` 由上下左右合成（含 45° 斜射、纯上/下、水平） | `player.ts:247-270` | ✅ |
| 蹲下瞄准 | 蹲姿时锁定为水平（不可斜下） | `player.ts:260-263` | ✅ |
| 跑动射击 | 允许（射击不与移动互斥） | `player.ts:273` | ✅ |
| 跳跃射击 | 允许 | `player.ts:273` | ✅ |
| 枪口位置 | 蹲下偏低、站立约身高 42% | `player.ts:299` | ✅ |
| 后坐力 | 按武器 `recoil`×角色系数，强后坐力可影响空中姿态 | `player.ts:332-333` | ✅ |

---

## 3. 子弹与弹道（Bullets & Ballistics）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 统一子弹模型 | 单 `Bullet` 类（方向/速度/穿透/爆炸/跟踪/激光/重力） | `bullet.ts` | ✅ 非「单一通用子弹」——已按武器配置生成 |
| 每武器独立配置 | `WEAPONS`：damage/interval/count/spread/speed/pierce/explode/homing/laser/size/ammo/recoil | `weapons.ts:27-175` | ✅ |
| 武器顺序 | `rifle→rapid→spread→pierce→blast→laser→homing` | `weapons.ts:177` | ✅ |
| 散布/齐射 | spread 角、count 发、扇形分布 | `player.ts:300-304` | ✅ |
| 跟踪弹 | 选取最近敌人为 target 后修正 | `player.ts:305-319` | ✅ |
| 子弹精灵 | 程序化矩形/光束（`bullet.ts`）—— **无子弹精灵表** | 见 `assets-inventory.md` §6.2 | ⚠️ 缺失素材 |

**已知差距**：子弹为程序化形状（与原作小圆点/光束风格可接受），无独立子弹精灵表。

---

## 4. 碰撞规则（Collision）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 扫掠碰撞 | 轴分离 AABB vs 瓦片图，`moveAndCollide`，子步 ≤ 6px 防穿透 | `collision.ts` | ✅ 无隧穿 |
| 单向平台 | 支持 `oneWay`，`dropThrough`（下+跳）穿越 | `collision.ts` | ✅ |
| 落地抖动修复 | flush-ground 处理 | `collision.ts` | ✅ |
| 命中盒分层 | 玩家 / 地形 / 敌命中盒 / 子弹命中盒 / 伤害区 在各自系统独立 | `player.ts` / `enemy.ts` / `bullet.ts` / `boss.ts` | ✅ |
| 梯子卡死 / 墙夹 / 子弹穿敌 / 玩家卡墙 / Boss 不可击 | 已通过轴分离 + 子步 + 单向平台逻辑规避 | `collision.ts` | ⚠️ 需逐关回归验证 |

---

## 5. 受伤 / 死亡 / 复活 / 无敌 / 生命（Hurt/Death/Respawn/Invuln/Lives）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 生命数 | `START_LIVES = 3` | `constants.ts` | ✅ |
| 受击无敌 | `INVULN_TIME = 1.6`（出生也赋此值） | `constants.ts`, `player.ts:110` | ✅ |
| 受击闪白 | `HIT_FLASH = 0.12`；受击额外 0.9s 短无敌 | `constants.ts`, `player.ts:130` | ✅ |
| 死亡时长 | `DEATH_TIME = 1.1` | `constants.ts` | ✅ |
| 复活延迟 | `RESPAWN_DELAY = 0.85` | `constants.ts` | ✅ |
| 死亡反馈 | 爆炸粒子 + 震屏 + 音效 | `player.ts:347-348` | ✅ |
| 复活 | 由场景 `respawn` 重置到检查点/出生点 | `scenes/game.ts` | ⚠️ 待逐关验证 |

---

## 6. 武器拾取 / 切换 / 丢失（Weapon Pickup/Switch/Lose）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 拾取 | 胶囊落地、自动吸取、按武器字母/颜色 | `pickup.ts`, `entities/pickup.ts` | ✅ |
| 切换 | 拾取即替换当前武器（保留步枪为默认） | `player.ts:91-95` | ✅ |
| 丢失 | 弹药耗尽自动回落步枪；死亡武器回落步枪 | `player.ts:289-293,345` | ✅ |
| 图标字母 | **本次修复**：始终叠加权威字母（`weaponDef().letter`） | `pickup.ts` | ✅ 修复后正确 |
| 图标素材 | `pickups.png` 5 格（仅背景，字母覆盖） | `assets-inventory.md` §3 | ✅ |

---

## 7. 敌人（Enemies）

### 7.1 基础数据（`enemy.ts` `ENEMY_DEFS`，节选）
| 敌人 | 尺寸 | HP | 速度 | AI | 掉落 |
|------|------|----|------|----|------|
| grunt 步兵 | 12×22 | 12 | 56 | grunt（巡逻/射击） | – |
| runner 游击 | 11×21 | 8 | 138 | runner（高速冲锋） | – |
| heavy 重装 | 18×24 | 42 | 34 | heavy（三连射） | spread 35% |
| sniper 神枪 | 12×22 | 14 | 42 | sniper（瞄准穿透） | pierce 40% |
| shield 盾兵 | 16×23 | 34 | 48 | shield（正面挡弹） | rapid 35% |
| bomber 自爆 | 12×20 | 10 | 118 | bomber（接触引爆） | – |
| jumper 跳跃 | 11×20 | 12 | 74 | jumper（弹跳突进） | – |
| flame 喷火 | 16×22 | 28 | 58 | flame（近距火焰） | blast 40% |
| turret 炮塔 | 18×16 | 24 | 0 | turret（定点连射） | – |
| flyer/ spider/ mech/ roller/ drone/ worm | 各异 | 各异 | 各异 | 各自独立 AI | 各异 |

### 7.2 AI 行为
每个 AI 在 `updateEnemy()` 中按 `switch(e.def.ai)` 分派（`enemy.ts`），已实现**非统一「朝玩家移动」**：巡逻、瞄准、射击、跳跃、飞行、定点炮塔、特殊弹道等各自独立。

### 7.3 视觉（本次修复重点）
- **步兵类 8 种**（grunt/runner/heavy/sniper/shield/bomber/jumper/flame）现已接入 `players.png` 右列**红突击兵**精灵（真实还原）。
- 载具/异形类（turret/flyer/spider/mech/roller/drone/worm）仍为程序化绘制（无对应素材）。
- 死亡动画为翻转+淡出（`enemy.ts:594-600`）。

**验证状态**：✅ 步兵视觉已还原（浏览器烟测确认红突击兵渲染）；⚠️ 各 AI 的具体参数（射速/弹速/触发距离）待与原作逐类比对。

---

## 8. Boss（Boss）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| Boss 状态机 | `entry → fight → dying → dead`，相位按 HP 比例切换 | `boss.ts` | ✅ |
| 弱点 | 弱点坐标偏移 + 2.2×，其它部位 0.8×（非爆炸弹） | `boss.ts` `damageBoss()` | ✅ 伤害一致 |
| 攻击脚本 | `execAttack`：aimed/spread/ring/rain/wall/bombs/laser/summon/charge | `boss.ts` | ✅ |
| 第一关 Boss | 防御墙（commander），`wall1.png` 精灵已接入 | `boss.ts`, `pack.ts` | ✅ |
| 其余 7 个 Boss | 全部程序化绘制（`sprites.ts` `buildBossArt`） | `sprites.ts` | ⚠️ 无原作 Boss 精灵素材 |

**差距**：仅第一关有原作防御墙精灵；其余 Boss 程序化（无素材）。Boss 行为逻辑完整，但**绝不允许**用坐标 hack/HP 归零/调试跳过“作弊通关”——调试键 F4 仅供开发验证，非通关路径。

---

## 9. 摄像机 / 自动卷轴 / 边界 / 关卡切换

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 跟随 | 死区跟随（deadzone W120/H70，lerp 9） | `camera.ts`, `constants.ts` | ✅ |
| 强制卷轴 | `Camera.forced` + 关卡 `scroll` 段（如第五关 120–190 列 62px/s） | `camera.ts`, `stages.ts:151` | ⚠️ 逐关验证 |
| 竞技场锁定 | Boss 触发后锁死，Boss 死亡解锁 | `scenes/game.ts` | ✅ |
| 震屏 | `shake` | `camera.ts` | ✅ |
| 关卡切换 | 过 DOOR 或击败 Boss → `onBossDefeated` 进下一关 | `scenes/game.ts` | ⚠️ 逐关验证 |

---

## 10. 逐关地形 / 波次 / 结束

| 关 | 主题 | 地图数据来源 | 波次 | 结束条件 | 验证 |
|----|------|--------------|------|----------|------|
| 1 FORTRESS GATE | base | **手工编排** `layouts.ts` `stage1Map`（出生走廊/两处河谷/炮台/狙击台/炮场/滚地丛林/终段/DOOR） | `buildWaves` 程序波次（x 触发，90 列起） | 击败 commander | ✅ 手工地图 |
| 2–8 | 各异 | **程序生成**（procgen） | 程序波次 | 击败对应 Boss | ⚠️ 待逐关还原（Phase 4） |

**差距（Phase 4）**：仅第一关有手工还原地图；第二至八关为程序生成，尚无逐帧还原的原作地图数据。

---

## 11. 双人（2-Player）

| 项 | 当前实现 | 证据 | 验证状态 |
|----|----------|------|----------|
| 第二玩家 | TITAN/兰斯，独立输入与摄像机分屏 | `scenes/game.ts`, `player.ts` | ⚠️ 需联机/双人输入验证无冲突 |
| 共享/CAM | 分屏双摄像机 | `camera.ts` | ⚠️ 待验证 |

---

## 12. 验证状态总览

| 系统 | 状态 |
|------|------|
| 固定步长循环（FIXED_DT 1/60，≤5 子步） | ✅ 已实现（`game.ts`） |
| 玩家速度 / 跳跃手感 | ✅ 已调（122，coyote/buffer/cut） |
| 射击可用、子弹方向/速度/命中 | ✅ |
| 敌兵视觉（红突击兵） | ✅ 本次修复（浏览器确认渲染） |
| 拾取图标字母 | ✅ 本次修复 |
| 地图/碰撞一致性 | ⚠️ 第一关已验证；2–8 关待逐关 |
| 敌人 AI 非统一 | ✅ 逻辑；⚠️ 参数待比对 |
| 各关可通关 / Boss 正常击败 | ⚠️ 第一关验证；2–8 关待 Phase 4/6 |
| 双人无输入冲突 | ⚠️ 待验证 |
| 暂停/死亡/复活/重开 安全 | ⚠️ 待验证 |
| Windows Chrome/Edge 运行 | ✅ 烟测通过（0 报错，60 FPS） |
| `npm run build` / 测试 | ✅ 构建通过；`vitest` 68 项全过 |

---

## 13. 待续（后续阶段）
- **Phase 3**：玩家全状态机（动画按真实状态而非固定循环）。
- **Phase 4**：第二至八关地图逐关还原（优先补素材或程序还原地形/波次/可通关性）。
- **Phase 5**：敌人/Boss 参数与原作逐类比对微调。
- **Phase 6/7**：逐关自动化验收 + 修复流程（定位→复现→根因→最小修复→回归→重建）。
- **未决清单**：渲染分辨率（当前 640×360 16:9，原作 NES 256×240 4:3）是否切换；子弹精灵素材；Boss 原作精灵（仅第一关有防御墙）。
