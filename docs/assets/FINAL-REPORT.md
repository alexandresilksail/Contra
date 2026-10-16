# 8 关素材库建设 — 最终报告（P0–P4）

> 项目：TypeScript + HTML5 Canvas + Vite 魂斗罗复刻（`game/`）
> 参考仓库：Contra-Unity（`b8a4430c`）、hundouluo（`dd60029`）
> 生成时间：2026-10-16。本轮**未修改任何游戏逻辑代码**，未推送，未接入任何未授权素材。

---

## 0. 一句话结论

两个参考仓库**都只有第一关内容且没有任何可合法复制使用的素材**（GPL 代码 + 未标注
Konami 剥离美术 / 无许可证仓库），因此**本轮接入发布构建的外部素材数量为 0**。
交付物是一套**可重复执行、幂等、可追踪**的素材管线（扫描/解析/提取/转换/校验/清单）、
8 关 manifest 与缺口矩阵、统一资源注册器，以及第一关的完整回归验证。
第 2–8 关维持与用户拍板一致的程序化原创方案。

---

## 1. P0 — 扫描结果（实测，非 README）

| 来源 | Commit | 文件数 | 总大小 | 关键内容 |
|---|---|---|---|---|
| 当前项目 `public/` | f1ed33f | 6 | 229 KB | 6 张 Konami NES 剥离图（本地、gitignored） |
| Contra-Unity | b8a4430c | 2656 | 48.1 MB | 364 C# / 106 prefab / 30 scene / 86 asset / 74 mat / 76 anim / 13 游戏 PNG / 18 WAV |
| hundouluo | dd60029 | 141 | 7.6 MB | 21 C# / 3 prefab / 2 scene / 25 asset / 15 图（12 PNG + 3 JPG）/ 7 WAV |

- 机器可读清单：`docs/assets/asset-inventory.csv`（2803 行，每行含 SHA-256/尺寸/授权/接入状态）。
- 扫描工具：`tools/assets/scan-assets.mjs`（纯 Node，零依赖，PNG/JPEG/GIF/BMP/WebP/TGA/PSD/SVG/TIFF 头解析 + SHA-256）。

## 2. Unity 资源引用解析报告（`tools/assets/parse-unity-assets.mjs`）

| 仓库 | .meta 数 | GUID 引用 | 无法解析 | 切片图集 |
|---|---|---|---|---|
| Contra-Unity | 1470 | 1536 | 295 | 45（其中游戏图集 9 个，230 帧） |
| hundouluo | 62 | 48 | 2 | 0（均为单图 spriteMode=1） |

**Contra-Unity 缺失引用分类**：
- 大部分为 Unity 包脚本（URP / TextMesh Pro / Input System / Addressables / Mirror 示例），
  导入 Package Manager 后应可解析；
- **真实断链（仓库内无对应文件）**：`Assets/Scenes/Main.unity` 引用的 **15 个脚本 GUID
  在仓库中完全不存在**（另有 1 个资源 GUID）——即主场景提交态就带 Missing script 组件；
  另有 `Fireball.prefab` 子资源、`ContraPixel.asset` 字体、`InfoText/SelectList.prefab`
  脚本、`NetPlayer.prefab` 脚本、`Flash.asset`、`Player1.controller` 两处等共约 20 处。

**hundouluo 缺失引用**：仅 2 处，均为 UOS Launcher 外部 git 包的脚本
（`cnb.cool/unity/uos/UOSLauncher`，实测可达，锁定 hash `76a5a7e`），拉包即解。

## 3. 授权审查（详见 `asset-source-and-license.md`）

| 来源 | 代码 | 图像 | 音频 | 接入发布构建 |
|---|---|---|---|---|
| 当前本地素材 | 原创 | `THIRD_PARTY_RESTRICTED` | 程序化原创 | ❌ 图像不可（本地用） |
| Contra-Unity | `LICENSE_PARTIAL` GPL-3.0 | `THIRD_PARTY_RESTRICTED` | `THIRD_PARTY_RESTRICTED` | ❌ |
| hundouluo | `PERMISSION_REQUIRED`（无 LICENSE） | `PERMISSION_REQUIRED` | `PERMISSION_REQUIRED` | ❌ |

**没有任何素材获得 `APPROVED_FOR_PROJECT`。**

## 4. 提取与转换（隔离区技术评估，未接入）

| 产物 | 位置 | 内容 |
|---|---|---|
| Contra-Unity 图集切片 | `contra-unity-audit/extracted/` | 9 图集 **230 帧**（player 33 / map_tiles 68 / MapObjects 33 / Boss 20 / Font 40 / Enemy 14 / PlayerBullet 13 / Effect 7 / GameUI 2），坐标取自 `.meta` 的 `spriteSheet.sprites` rect（Unity 左下原点已翻转） |
| 联系表 | `contra-unity-audit/extracted/contact-sheets/` | 9 张 PNG（内审用，不替代源文件） |
| hundouluo 转换 | `audit/hundouluo/converted/` | 15 张 → WebP（含 alpha） |
| 管线脚本 | `game/tools/assets/` | scan / parse-unity / extract-sprites / convert / validate / build-manifest / build-inventory / contact-sheets，全部幂等 |

## 5. 接入层（`public/assets/` + `src/assets/registry.ts`）

- `public/assets/` **只含元数据**：顶层 `manifest.json`（3 shared）+ 8 个关卡 manifest；
  素材以相对路径**引用** `public/sprites/`，零二进制复制、零重复。
- `AssetRegistry`：统一 Asset ID、缓存、进度回调、`dispose()` 防跨关泄漏、
  缺失抛 `AssetNotFoundError`（**绝不静默占位**）、publish 模式拒绝非发布级素材。
- **第一关加载链路（`src/gfx/pack.ts`）原样未动**——registry 是面向第 2–8 关的附加基础设施。

## 6. 测试与运行验证（全部实跑）

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ 干净 |
| `vitest` | ✅ **162/162 通过**（新增 10 项 registry 测试） |
| `vite build` | ✅ 129.60 kB / gzip 42.15 kB（与接入前完全一致，零负担） |
| 浏览器第一关完整通关 | ✅ phase play→boss→clear，bossHp 100→0，0 控制台错误，全景图 `mapImageActive:true` |
| 素材校验（validate-assets） | ✅ 当前项目 0 错误；hundouluo 仅 2 处 UOS 包脚本缺失（预期）；Contra-Unity 295 处（包脚本 + 真实断链，见 §2） |

## 7. 分层状态总表（按要求区分）

| 类别 | 内容 |
|---|---|
| **已提取** | Contra-Unity 9 图集 230 帧 + hundouluo 15 图转换（**均在隔离审计区**） |
| **已转换** | 15 WebP（hundouluo，评估用） |
| **已接入** | **0 个外部素材**；接入的是基础设施：8 关 manifest + registry + 管线脚本 |
| **已运行验证** | 第一关完整通关（浏览器）、162 单测、构建、traversal（第 2–8 关） |
| **授权已核验** | 三个来源全部核验（结论见 §3） |
| **尚未完成** | 第 2–8 关真素材（无授权来源）；第 2–8 关逐关浏览器端到端验收；芯片音乐合成器升级（建议项） |

## 8. 阻塞与下一步

1. **授权阻塞（不可绕过）**：第 2–8 关原作素材在两个仓库中不存在，且现存素材全部不可复制。
   若要真素材：约稿 / 可商用素材包（逐包审许可证）/ Konami 授权，三选一，需用户决策。
2. **建议项（非阻塞）**：把 hundouluo `ChiptuneSynth.cs` 的合成思路移植进 `src/audio/`
   （方法不受版权保护，自写实现），进一步夯实"音频 100% 原创"的合规立场。
3. **未推送**：本轮全部新文件均为许可证干净内容（代码 + 元数据），但按惯例等用户指令再提交。

## 9. 复现方式

```bash
npm run typecheck && npm test && npm run build
node tools/assets/scan-assets.mjs --label contra-unity --root < Contra-Unity 副本> --out tools/assets/out/scan-contra-unity.json
node tools/assets/parse-unity-assets.mjs --root < Contra-Unity 副本> --out tools/assets/out/unity-refs-contra-unity.json
node tools/assets/extract-sprites.mjs --unity-root <副本> --refs tools/assets/out/unity-refs-contra-unity.json --out <输出> --only "Assets/Data/Texture"
npm run assets:scan-current && npm run assets:manifest && npm run assets:validate
node tools/assets/build-inventory.mjs --current ... --contra-unity ... --hundouluo ... --out-dir docs/assets
```

---

# 第二轮（2026-10-16 晚）：原创 Chiptune 音频系统 + 授权干净素材接入

> 本轮范围：① 四个参考仓库素材整合（含 2 个新来源）；② 在现有音频架构上增量开发
> 原创 Chiptune 音频系统并接入八关游戏事件；③ 全量回归。**第一关渲染链路零改动。**

## 10. 参考仓库扫描补充（2 个新来源，实测）

| 来源 | 结论 | 证据 |
|---|---|---|
| `2cym/GameHub` commit `438fdba` | **12 个 PNG 全部授权干净（CC-BY 3.0 / CC0）** | Open Gunner 图形集（Master484，OpenGameArt 发布）；7 张图内自带许可横幅，与 OpenGameArt 发布页交叉核对；子弹集为 CC0 |
| `bevacqua/contra` | **无关仓库，零游戏素材** | 实为 `λ` 异步流控 JS 工具库（28 个 JS + 1 个 logo PNG），已记录排除 |

仓库名含 "contra" 不等于是魂斗罗游戏——本轮所有结论以实际文件内容为准。

## 11. 素材整合结果

- 12 个文件复制到 `public/assets/vendor/open-gunner/`（字节级原样，SHA-256 入清单），
  署名文件 `ATTRIBUTION.txt`（CC-BY 3.0 义务）。
- `tools/assets/asset-map.json` 新增 12 个 shared 条目（`publishable: true`，
  `LICENSE_VERIFIED`）；`public/assets/manifest.json` 重建，`vendor.*` 共 12 条。
- **第一关继续使用本地 Konami 素材，渲染器未切换**（保护既有验收成果）；
  切换为"全量可再发布构建"是待批准的决策点 D-1（见 `level-asset-matrix.md`）。
- 第 2–8 关维持程序化原创美术（用户 2026-10-13 拍板），未强行替换。

## 12. 原创 Chiptune 音频系统（`src/audio/audio.ts` 重写 + 接线）

在原有 9 首原创曲目/22 种音效基础上增量增强（公开 API 向后兼容，现有调用点零改动）：

| 能力 | 实现 | 状态 |
|---|---|---|
| 8 关独立 BGM + 循环 | `TRACKS[0..7]`，16 步音序器循环 | RUNTIME_VERIFIED（A02/A06） |
| Boss 战音乐切换 | `TRACKS[8]` + `triggerBoss` 接线；阶段加速 `setIntensity` | RUNTIME_VERIFIED（A05） |
| 全套音效 | 射击/跳跃/受伤/敌死/爆炸/拾取/Boss/通关/失败/**胜利（新增 fanfare）** 等 23 种 | RUNTIME_VERIFIED（A03 + 单测） |
| 方波/三角波/锯齿/正弦 + 多声部 + 包络 | bass+lead×2+鼓组，AD 包络 | RUNTIME_VERIFIED |
| 主音量/音乐音量/音效音量/静音 | `setMasterVolume/setMuted` + 设置持久化 + Options UI 两新行 | RUNTIME_VERIFIED（A07 + UI 探针） |
| 浏览器初始化/手势解锁 | `resume()+init()` on first gesture | RUNTIME_VERIFIED（A01） |
| 节点释放（防泄漏） | VoicePool `onended` 全链 disconnect | RUNTIME_VERIFIED（单测 + A03 after=0） |
| 防声音重叠 | 每音效最小间隔节流 + 28 声音上限（窃夺最旧） | RUNTIME_VERIFIED（单测） |
| 暂停/恢复（位置保持） | `pauseTrack/resumeTrack` 保留 pattern step；**修复了旧实现恢复时丢失 Boss 音乐的 bug** | RUNTIME_VERIFIED（A04） |
| 切后台防爆音 | 调度器落后 >250ms 重新锚定 | RUNTIME_VERIFIED（单测） |

音频合成思路参考 hundouluo `ChiptuneSynth.cs`（方法不受版权保护），**实现为 100% 自写
TypeScript + Web Audio**，无音频文件、无第三方代码复制。

## 13. 本轮测试与运行验证（全部实跑）

| 项 | 结果 |
|---|---|
| `npm run typecheck` | PASS（零错误） |
| `npm test` | **PASS 192/192**（新增 `tests/audioEngine.test.ts` 30 项：Mock AudioContext 测图结构/音量/静音/节流/声心上限/节点释放/调度/暂停恢复/dispose） |
| `npm run build` | PASS 132.48 kB / gzip 43.06 kB |
| 浏览器音频探针 `tools/audio_probe.mjs` | **PASS 10/10**（A01 解锁/A02 主题+推进/A03 音效生命周期/A04 暂停恢复/A05 Boss 曲/A06 换关换曲/A07 主音量+静音/A08 vendor 素材经 registry 真实解码/A09 零错误） |
| Options UI 探针 | PASS（MUTE 切换并持久化、MASTER VOLUME 0.9→1.0 钳位、9 行渲染、0 错误） |
| 第一关完整通关回归 | PASS（play→boss→clear、bossHp 100→0、0 错误、全景图正常） |
| 第 2–8 关 | 既有 headless 测试覆盖（traversal + 每关 Boss 可被普通伤害打死，192 项内）；逐关浏览器端到端验收未做 → `NOT_VERIFIED` |

截图：`tools/aud_1_stage1.png`、`aud_2_stage3.png`、`aud_3_options.png`、`aud_4_options_mute.png`、`acc_*.png`。

## 14. 文件变更清单（未提交，等用户指令）

- 修改：`src/audio/audio.ts`（重写）、`src/core/save.ts`（masterVolume/muted）、
  `src/game.ts`（接线 + 暂停恢复）、`src/scenes/menu.ts`（Options 两行 + victory 接线）、
  `tools/assets/asset-map.json`（12 vendor 条目）
- 新增：`public/assets/vendor/open-gunner/`（12 PNG + ATTRIBUTION.txt）、
  `tests/audioEngine.test.ts`、`tools/audio_probe.mjs`、`tools/aud_*.png`、
  `docs/assets/asset-source-and-license.md`（重写）、`level-asset-matrix.md`（追加）、
  `asset-inventory.csv`（2826 行）
- 未动：第一关渲染/碰撞/关卡数据、`src/gfx/`、`src/level/`、既有测试。

## 15. 未解决 / 待决策

1. **决策点 D-1**：是否把渲染器切换为 Open Gunner 素材（可再发布）？未批准前第一关视觉不变。
2. 第 2–8 关逐关浏览器端到端验收未做（headless 已覆盖逻辑）。
3. 所有新文件未提交/未推送（等用户指令）。
