# 素材来源与授权记录（Asset Source & License）

> 本文件记录全部素材来源的授权状态。授权状态枚举：
> `LICENSE_VERIFIED` / `LICENSE_PARTIAL` / `LICENSE_UNKNOWN` / `THIRD_PARTY_RESTRICTED` /
> `PERMISSION_REQUIRED` / `APPROVED_FOR_PROJECT`。
> **`APPROVED_FOR_PROJECT` 仅授予 Open Gunner（Master484, CC-BY 3.0/CC0）12 个文件**——
> 已复制到 `public/assets/vendor/open-gunner/` 并在 manifest 标记 `publishable: true`。
> 所有 Konami 相关素材仍 `THIRD_PARTY_RESTRICTED`（仅本地）。

生成时间：2026-10-16（当晚追加 GameHub/bevacqua 两个来源后更新）。
机器可读清单：`asset-inventory.csv`（2826 行，含每个文件的 SHA-256）。

---

## 1. 当前项目本地素材（`public/sprites/`，6 个文件）

| 文件 | 尺寸 | 授权状态 | 依据 |
|---|---|---|---|
| `stage1bg.png` | 3456×245 | `THIRD_PARTY_RESTRICTED` | Konami《魂斗罗》NES 剥离图（含水印带），用户提供用于本地开发 |
| `players.png` | 2081×1075 | `THIRD_PARTY_RESTRICTED` | 同上（比尔+兰斯角色总表） |
| `pickups.png` | 124×32 | `THIRD_PARTY_RESTRICTED` | 同上（武器胶囊） |
| `tiles1.png` | 288×64 | `THIRD_PARTY_RESTRICTED` | 同上（地块集） |
| `title.png` | 560×576 | `THIRD_PARTY_RESTRICTED` | 同上（标题字标） |
| `wall1.png` | 223×192 | `THIRD_PARTY_RESTRICTED` | 同上（防御墙 Boss） |

**处置（与用户确认的口径，2026-10-10 起生效）**：
- 这 6 个文件**仅本地接入**，已在 `.gitignore` 中排除，**永不入库、永不推送、不进入任何对外发布构建**。
- 仓库只包含原创代码 + 加载器（`src/gfx/pack.ts`），README 说明"自行放置素材"的中立做法。
- 游戏在素材缺失时回落到程序化原创美术（`src/gfx/sprites.ts`），因此无素材环境仍 100% 可玩。
- **本状态不因仓库改为 Private 而改变**：私有仓同样违反 GitHub ToS，且仍是未经授权的复制。

## 2. Open Gunner / GameHub（`2cym/GameHub` commit `438fdba81ea0aa2d0752c0fe583f439db49da240`）—— ✅ 唯一授权干净的素材来源

来源路径 `public/contra/*.png`。GameHub 仓库本身**无 LICENSE 文件**，但这批图是
Master484 的 **Open Gunner** 图形集（发布于 OpenGameArt，CC-BY 3.0 / CC0），
每张图自带许可横幅，并与 OpenGameArt 发布页交叉核对：

| 文件 | 尺寸 | 授权状态 | 依据 |
|---|---|---|---|
| `hero.png` | 1026×1280 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER HERO VERSION 2 / MADE BY MASTER484 / LICENSE: CC-BY 3.0" |
| `tiles.png` | 1040×904 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER STARTER TILESET" |
| `enemies.png` | 530×795 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER ENEMIES" |
| `mechs.png` | 773×1052 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER MECHS" |
| `enemy_soldier.png` | 762×527 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER ENEMY SOLDIER VERSION 2" |
| `pickups.png` | 770×740 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER MISC OBJECTS" |
| `hud.png` | 620×689 | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。图内横幅："OPEN GUNNER BARS AND PANELS" |
| `bg1.png` / `bg2.png` | 1728² / 1152² | **`APPROVED_FOR_PROJECT`** | CC-BY 3.0。Open Gunner 扩展包丛林背景（同 collection，OpenGameArt 发布页 CC-BY 3.0） |
| `bullets.png` | 520×361 | **`APPROVED_FOR_PROJECT`** | **CC0 1.0**（Master484 "M484 Bullet Collection 2"，OpenGameArt；公共领域奉献，无需署名） |
| `bg3.png` / `bg4.png` | 576² / 288² | **`APPROVED_FOR_PROJECT`** | 纯色平铺背景，无作者、无版权限制 |

**CC-BY 3.0 义务**：署名。项目内署名文件 `public/assets/vendor/open-gunner/ATTRIBUTION.txt`，
要求随游戏发布携带：

> "Art assets: Open Gunner by Master484 (CC-BY 3.0),
>  https://opengameart.org/content/open-gunner-starter-kit"

**接入状态**：12 个文件已复制到 `public/assets/vendor/open-gunner/`（字节级原样复制，
SHA-256 已入清单），manifest 中 `publishable: true`，可经 `src/assets/registry.ts`
统一加载。**渲染器尚未切换到这批素材**——第一关继续使用本地 Konami 素材（保护第一关
既有验收成果），切换是需单独批准的变更（见 `level-asset-matrix.md` 决策点 D-1）。
GameHub 的 React 游戏代码未复制（仓库无 LICENSE）。

## 3. bevacqua/contra（`bevacqua/contra`）—— ❌ 无关仓库

**不是游戏**：这是 Nicola Bevaqua 的 `λ`（lambda）**异步流控制 JavaScript 工具库**
（each/map/queue/emitter 等 28 个 JS 文件）。仓库内唯一图片是项目 logo
（`resources/contra.png`），**零游戏素材**。已在扫描中记录并排除。
教训：仓库名含 "contra" 不等于是魂斗罗游戏——本报告所有结论均以实际文件内容为准。

## 4. Contra-Unity（`RanZelong/Contra-Unity`，commit `b8a4430c`，2024-10-11）

| 资产类别 | 数量 | 授权状态 | 依据 |
|---|---|---|---|
| C# 代码（364 个 `.cs`） | — | `LICENSE_PARTIAL` | 仓库 GPL-3.0（强 copyleft）。复制代码进本项目会使衍生作品受 GPL 传染；且用户明确要求不复制其游戏逻辑 |
| 游戏图像（13 个 PNG，`Assets/Data/Texture/`） | — | `THIRD_PARTY_RESTRICTED` | 无任何授权/来源标注；从内容看是 NES 剥离图（© Konami）。GPL 许可证**不会**自动覆盖图片 |
| 音频（18 个 WAV，含 4.75MB BGM、1MB Title） | — | `THIRD_PARTY_RESTRICTED` | 同上，极可能为 NES 音频剥离，零标注 |
| Unity 资源（场景/Prefab/Anim/Tilemap 等） | 106 prefab / 30 scene / 86 asset / 74 mat / 76 anim | `LICENSE_PARTIAL` | 随仓库 GPL-3.0，但其中引用的纹理仍是第三方受限 |
| 内置第三方插件 | Mirror / DOTween / ParrelSync / **Sirenix Odin（商业付费）** | `THIRD_PARTY_RESTRICTED` | 各自许可证；Odin Inspector 为付费资产，仓库 vendored 不等于可自由使用 |

**结论：不可复制、不可接入。** 代码有 GPL 传染风险，美术音频是未标注的 Konami 素材。
仅作玩法/结构参考（且其主场景 `Main.unity` 有 15 个脚本引用在仓库中无法解析，见
`asset-inventory.md` 与 Unity 引用解析报告）。

## 5. hundouluo（`nan896/hundouluo`，commit `dd60029`，2026-09-18）

| 资产类别 | 数量 | 授权状态 | 依据 |
|---|---|---|---|
| 全部内容（代码 + 美术 + 音频） | 141 文件 | `PERMISSION_REQUIRED` | **仓库无 LICENSE 文件** = 保留所有权利，任何复制都需作者授权 |
| 音频（7 个 WAV） | — | `PERMISSION_REQUIRED`（文件层面） | 文件由 `ChiptuneSynth.cs` 程序化合成，**声音本身是原创、无第三方 IP**，但仓库无许可证 → 不可复制文件；合成**方法/思路**不受版权保护，可自行重写实现 |
| 图像（15 个，现代高清像素画） | — | `PERMISSION_REQUIRED` | 无授权声明；目视检查为现代高清像素画风（疑似 AI 生成或约稿），非 NES 剥离，但同样不可复制 |

**结论：不可复制、不可接入。** 唯一有价值的收获是 `ChiptuneSynth.cs` 的**思路**
（方波/噪声合成芯片音乐）——本项目已用**自写的 TypeScript + Web Audio 实现**
（`src/audio/audio.ts` + 本轮新增的合成器/包络/混音管线）落地该思路，见
`FINAL-REPORT.md` 音频章节。

## 6. 授权状态汇总

| 来源 | 代码 | 图像 | 音频 | 可否接入发布构建 |
|---|---|---|---|---|
| 当前项目本地素材 | 原创 | `THIRD_PARTY_RESTRICTED` | 程序化原创 | ❌ 图像不可；音频可（自写程序化合成） |
| **Open Gunner（经 GameHub）** | — | **CC-BY 3.0 / CC0** | — | ✅ **12 个文件已接入并标记可发布（须署名）** |
| Contra-Unity | `LICENSE_PARTIAL`(GPL) | `THIRD_PARTY_RESTRICTED` | `THIRD_PARTY_RESTRICTED` | ❌ 全部不可 |
| hundouluo | `PERMISSION_REQUIRED` | `PERMISSION_REQUIRED` | `PERMISSION_REQUIRED` | ❌ 全部不可（思路可借鉴，已自写实现） |
| bevacqua/contra | — | — | — | 无关仓库（JS 工具库），零游戏素材 |

**接入发布构建的外部素材 = 12 个 Open Gunner 文件（全部授权已核验、署名义务已履行）。**
第一关继续使用本地 Konami 素材（仅本地、不推送）；第 2–8 关继续使用程序化原创美术
（与用户 2026-10-13 拍板一致）；Open Gunner 素材作为"全量可再发布构建"的替换选项
已就位（manifest `publishable: true`），切换渲染器属单独批准的变更。
