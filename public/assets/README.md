# public/assets — 8 关素材库（元数据层）

本目录**只包含元数据**（manifest JSON），**不存放任何二进制素材文件**。

## 为什么这样组织

1. **不重复复制**：共享素材（角色表、武器图标、标题字标）被各关 manifest 以相对路径
   *引用*，而不是复制 8 份。第一关的三件素材同样以引用方式指向 `public/sprites/`。
2. **版权卫生**：现有 Stage-1 素材是 Konami NES 剥离图（`THIRD_PARTY_RESTRICTED`，
   仅本地使用，已在 `.gitignore` 中排除，永不入库）。元数据（清单/哈希/授权状态）
   不含受版权保护的像素数据，可以安全提交。
3. **可追踪**：每个素材条目都带 SHA-256、字节数、尺寸、授权依据与接入状态，
   与 `docs/assets/asset-inventory.csv` 一一对应。

## 结构

```
public/assets/
  manifest.json                  # 顶层：shared 素材 + 关卡索引
  levels/level-01..08/
    manifest.json                # 每关：本关素材 + shared 引用 + 缺口清单
```

## 运行时消费

`src/assets/registry.ts`（`AssetRegistry`）读取这些 manifest：

- 统一 Asset ID；缺失素材抛 `AssetNotFoundError`，**绝不静默替换为占位图**；
- publish 模式只加载 `publishable: true` 的素材（当前为 0 个）；
- 图片缓存 + `dispose()` 防跨关泄漏；
- 进度回调 `onProgress(loaded, total, assetId)`。

第一关现有加载链路（`src/gfx/pack.ts` → `loadPack()`）**保持原样**，已经过浏览器
通关验收；registry 是面向第 2–8 关接入的附加基础设施，不改动已验证路径。

## 重新生成

```bash
node tools/assets/scan-assets.mjs --label current-project --root public --out tools/assets/out/scan-current.json
node tools/assets/build-asset-manifest.mjs      # 读取 tools/assets/asset-map.json
node tools/assets/validate-assets.mjs --scan tools/assets/out/scan-current.json \
  --manifest public/assets/manifest.json --manifest-root public/assets
```

两个参考仓库的素材（Contra-Unity / hundouluo）**没有任何一个通过授权审查**，
其提取结果只存放在隔离审计区（`contra-unity-audit/`、`audit/hundouluo/`），
不进入本目录、不进入发布构建。详见 `docs/assets/asset-source-and-license.md`。
