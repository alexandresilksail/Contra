# IRON STORM ⚔️

一款**原创**的 8/16-bit 风格横版 **Run-and-Gun（跑打）射击游戏**，使用 HTML5 Canvas 2D + TypeScript + Vite 从零构建。

> 本项目所有美术、音乐、代码均为**原创**，不依赖任何第三方素材或受版权保护的资源——全部像素图、音效与关卡均通过代码程序化生成。

---

## 🎮 核心特性

| 类别 | 内容 |
| --- | --- |
| 角色 | 2 名可选角色：`RAZOR`（高速 / 稳定）、`TITAN`（重火力 / 低后坐） |
| 敌人 | 15 种原创敌人，各自独立 AI（grunt / runner / heavy / sniper / shield / bomber / jumper / flame / turret / flyer / spider / mech / roller / drone / worm） |
| Boss | 8 个 Boss，每个含 **3 个阶段** + 漂移弱点机制 |
| 武器 | 7 种（步枪 / 速射 / 散射 / 穿透 / 爆破 / 激光 / 追踪） |
| 关卡 | 8 个完整关卡，含视差滚屏、镜头跟随、强制卷轴关（Stage 5） |
| 合作 | 本地双人合作（P1 + P2），独立生命 / 武器 / 复活 |
| 系统 | 生命 / Game Over / Continue（续关，最多 3 次）/ 得分 / 额外生命 |
| 调试 | 调试模式（`F1`–`F8`） |
| 工程 | 自动化测试（`npm test`）、类型检查、生产构建（`npm run build`） |

---

## 💻 运行要求

- **Node.js 18+**（建议 20+）
- 支持 Canvas 2D 的现代浏览器（Chrome / Edge / Firefox 等）

---

## 🚀 安装与运行

```bash
npm install      # 安装依赖（首次运行必须）
npm run dev      # 启动开发服务器，默认 http://localhost:5173 并自动打开浏览器
```

构建生产版本（输出到 `dist/`，可丢到任意静态服务器）：

```bash
npm run build    # 先 tsc 类型检查，再 vite 打包到 dist/
npm run preview  # 本地预览 dist/（默认 http://localhost:4173）
```

运行测试：

```bash
npm test         # 等价于 vitest run（node 环境下无头运行）
```

---

## ⚡ Windows 一键启动

直接双击 **`start.bat`**：脚本会自动检查 Node.js → 安装依赖（如缺失）→ 启动开发服务器 → 打开浏览器。不污染任何环境变量。

---

## 🎯 操作说明

### 玩家 1（键盘左侧）

| 动作 | 按键 |
| --- | --- |
| 左右移动 | `A` / `D` |
| 跳跃 | `W` 或 `K` |
| 下蹲 | `S` |
| 8 方向瞄准 | 射击时按住 `W` / `S`（上下）配合左右 |
| 射击 | `J` |
| 开始 / 确认 | `Enter` |

### 玩家 2（键盘右侧 / 小键盘）

| 动作 | 按键 |
| --- | --- |
| 左右移动 | `←` / `→` |
| 跳跃 | 数字键 `1`（`Digit1`） |
| 下蹲 | `↓` |
| 射击 | 数字键 `0`（`Digit0`） |
| 开始 / 确认 | 小键盘 `Enter`（`NumpadEnter`） |

### 通用

| 动作 | 按键 |
| --- | --- |
| 暂停 | `Esc` |
| 全屏 | `F11`（或 `Alt`+`Enter`） |
| 菜单导航 | `W`/`S` 选择，`Enter` 确认 |

> 按键可在主菜单 **KEY CONFIG** 中为每个玩家重新绑定。

---

## 🛠 调试键（先按 `F1` 开启调试模式）

| 按键 | 功能 |
| --- | --- |
| `F1` | 切换调试模式 |
| `F2` | 无敌 |
| `F3` | 无限弹药 |
| `F4` | 跳过当前关卡（直接通关） |
| `F5` | Boss 测试（传送到 Boss 竞技场；已触发 Boss 时将其血量降到 35%） |
| `F6` | 敌人测试（刷出全部敌人种类） |
| `F7` | 显示判定框（Hitbox） |
| `F8` | 显示 FPS |

---

## 📖 玩法要点

- 射击木箱（CRATE）可获得武器与补给（武器从 7 种中随机掉落）。
- **Boss 弱点**：攻击发光的黄色弱点圈可造成 **2.2 倍**伤害；命中普通部位为 **0.8 倍**。
- 每关推进到竞技场入口即触发 Boss 战，镜头锁定并展开 3 阶段战斗。
- 得分累计达到阈值（每 20000 分）可获得额外生命。
- 通关全部 8 关后进入结局画面。

---

## 🧱 技术架构

- **固定时间步长循环**：`FIXED_DT = 1/60`，使用累加器（accumulator）保证物理在不同帧率下表现一致。
- **整数倍像素缩放**：内部分辨率 `640×360`，默认 `2×`（即 `1280×720`）映射到窗口，保证像素清晰锐利。
- **对象池**：子弹 / 敌人 / 粒子均使用对象池，避免逐帧内存分配与 GC 抖动。
- **碰撞系统**：轴分离的 AABB 对瓦片地图碰撞 + 子步进（sub-stepping），并修复了静止贴地时的接地抖动。
- **程序化像素美术**：所有精灵、背景、字体均由离屏 Canvas 在启动时绘制，无需任何外部图片/音频文件。
- **存档**：`localStorage` 持久化（含内存回退），保存设置、按键绑定、最高分与解锁关卡。

---

## 🎨 可选素材包（本地专属，不入库）

游戏自带 **100% 程序化生成的像素美术**，零外部文件即可运行。

额外提供一个**可选的素材覆盖层**：若 `public/sprites/` 下存在图片，游戏会优先切片使用它们；文件缺失或加载失败则**自动回退**到程序化美术，不影响构建与运行。

```
public/sprites/
├── players.png   # 角色精灵表（覆盖 idle / run / jump / fall / crouch / climb / dead / 选人立绘）
├── pickups.png   # 武器胶囊图标（5 个，按 x = 0/25/50/75/100 切片）
├── title.png     # 标题字标（色键抠底后替换程序化 Logo）
├── stage1bg.png  # Stage 1 全景背景（视差滚动层，底部白边自动裁切）
└── tiles1.png    # Stage 1 瓦片（地面草皮/岩石填充/薄台/水面动画，黑 = 透明键）
```

- 该目录已写入 `.gitignore`，**仓库不包含任何图片文件**；请自行放入你**合法获得**的素材。
- 所有切片坐标集中在 `src/gfx/pack.ts`（`PACK_MAP` / `TITLE_LOGO` / `T1`）；若某个姿态或瓦片不对，只改那里的数字即可，无需动其他代码。
- 素材表的不透明底板由 `slice()` 自动色键抠除（每张表有自己的键色与容差，见 `KEY_COLORS`）。
- 仓库默认状态（无素材）就是纯程序化原创版本。

---

## 📂 目录结构

```
iron-storm/
├── index.html              # 入口 HTML（挂载 canvas #game）
├── package.json
├── vite.config.ts          # Vite + Vitest 配置（base: './'，便于静态托管）
├── tsconfig.json
├── start.bat               # Windows 一键启动脚本
├── src/
│   ├── main.ts             # 引导入口，创建 Game 并 boot
│   ├── game.ts             # 顶层编排：场景切换、暂停、全屏、缩放
│   ├── audio/audio.ts      # 程序化音效与音乐（WebAudio）
│   ├── config/constants.ts # 全局常量（分辨率、物理、调色板等）
│   ├── core/
│   │   ├── input.ts        # 输入系统（双玩家、按键绑定、捕获）
│   │   ├── math.ts         # AABB / clamp / dist 等数学工具
│   │   ├── pool.ts         # 通用对象池
│   │   ├── save.ts         # 存档（localStorage + 回退）
│   │   └── world.ts        # 世界上下文类型（供实体/系统共享）
│   ├── entities/
│   │   ├── player.ts       # 玩家（移动/跳跃/8 方向瞄准/射击）
│   │   ├── enemy.ts        # 15 种敌人 AI
│   │   ├── boss.ts         # 8 个 Boss + 3 阶段攻击脚本 + 弱点
│   │   ├── bullet.ts       # 子弹池与更新
│   │   └── pickup.ts       # 武器/生命/得分拾取
│   ├── gfx/
│   │   ├── pixel.ts        # 像素绘制基础
│   │   ├── sprites.ts      # 程序化生成角色/敌人/Boss/背景/瓦片
│   │   └── font.ts         # 位图字体
│   ├── level/
│   │   ├── level.ts        # 关卡运行时（瓦片碰撞、梯子、危险物）
│   │   ├── stages.ts       # 8 关定义 + 波次生成
│   │   └── tiles.ts        # 瓦片类型与主题
│   ├── scenes/
│   │   ├── game.ts         # 核心玩法场景（波次/Boss/碰撞/拾取/调试/通关）
│   │   ├── menu.ts         # 标题/选人/选关/选项/按键/结算/结局
│   │   └── types.ts        # 场景与宿主（GameHost）类型
│   ├── systems/
│   │   ├── camera.ts       # 镜头跟随、竞技场锁定、强制卷轴、震屏
│   │   ├── collision.ts    # 轴分离 AABB 碰撞
│   │   └── particles.ts    # 粒子特效
│   ├── ui/hud.ts           # 抬头显示（生命/武器/分数/Boss 血条）
│   └── weapons/weapons.ts  # 7 种武器定义
└── tests/
    ├── setup/dom.ts        # Vitest 无头 DOM/Canvas 桩
    ├── collision.test.ts   # 碰撞单元测试
    ├── core.test.ts        # 核心工具/存档测试
    ├── entities.test.ts    # 实体单元测试
    ├── level.test.ts       # 关卡/波次测试
    ├── player.test.ts      # 玩家移动/跳跃/8 方向瞄准测试
    └── integration.test.ts # 集成测试：8 关启动刷怪+Boss、Boss 击杀→通关、F4 跳关
```

---

## ✅ 测试

- **单元测试**：碰撞、核心工具、实体、关卡、玩家——覆盖数值、边界与瞄准逻辑。
- **集成测试**（`integration.test.ts`）：在无头环境中模拟 8 个关卡启动、刷出敌人、Boss 生成；以及完整的「触发 Boss → 击杀 → 通关」流程与 `F4` 跳关流程。

运行：

```bash
npm test
```

---

## 📜 许可证

本项目为**原创作品**，仅供学习与非商业用途。
