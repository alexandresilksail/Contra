# 素材资产清单（Asset Inventory）

> 由 `tools/assets/build-inventory.mjs` 从三个扫描根生成（幂等）。机器可读版本：
> `asset-inventory.csv`（2826 行）。

| 仓库 | 地址 | Commit | 文件数 | 总大小 |
|---|---|---|---|---|
| current-project | https://github.com/alexandresilksail/Contra (private) | `f1ed33f (loc` | 29 | 763.2 KB |
| contra-unity | https://github.com/RanZelong/Contra-Unity | `b8a4430c3ea0` | 2656 | 48.0 MB |
| hundouluo | https://github.com/nan896/hundouluo | `dd60029 (sin` | 141 | 7.6 MB |

## 分类统计

| 仓库 | 类别分布 | 格式分布 |
|---|---|---|
| current-project | doc/config×11, image/spritesheet×6, image/background×4, image/weapon×4, image/enemy×1, image/player×1, image/ui×1, image/tileset×1 | PNG×18, json×9, md×1, txt×1 |
| contra-unity | unity/meta×1470, code/csharp×497, unity/scriptableobject×128, unity/prefab×119, unity/material×86, other×85, unity/animation×77, doc/config×68, unity/scene×41, image/other×20, binary/plugin×19, audio/sfx×17, image/ui×9, image/spritesheet×7, image/player×6, image/enemy×2, audio/music×1, image/effect×1, image/tileset×1, image/background×1, font×1 | meta×1470, cs×497, asset×128, prefab×119, mat×86, anim×64, txt×45, unity×41, PNG×37, dll×19, wav×18, md×15, asmdef×15, shader×15, controller×11, physicmaterial×9, xml×9, JPEG×8, json×8, ×7, data×4, cginc×4, physicsmaterial2d×3, preset×3, config×3, overridecontroller×2, shadergraph×2, obj×2, TGA×2, fontsettings×1, inputactions×1, sdf×1, mtl×1, fbx×1, jslib×1, bytes×1, scenetemplate×1, pdf×1, ttf×1 |
| hundouluo | unity/meta×62, unity/scriptableobject×25, code/csharp×21, image/spritesheet×15, audio/sfx×6, doc/config×4, unity/prefab×3, other×2, unity/scene×2, audio/music×1 | meta×62, asset×25, cs×21, PNG×12, wav×7, prefab×3, JPEG×3, json×3, unity×2, ×1, asmdef×1, txt×1 |

## current-project — 图像资源（18）

| 文件 | 格式 | 尺寸 | 字节 | SHA-256(前12) | 类别 | 授权 |
|---|---|---|---|---|---|---|
| `assets/vendor/open-gunner/bg1.png` | PNG | 1728×1728 | 133953 | `b376e150caf1` | image/background | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/bg2.png` | PNG | 1152×1152 | 106394 | `f0b62c0364b8` | image/background | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/bg3.png` | PNG | 576×576 | 22796 | `df048fe90e2e` | image/background | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/bg4.png` | PNG | 288×288 | 4932 | `b9fcd7de717d` | image/background | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/bullets.png` | PNG | 520×361 | 22490 | `52f52ce30f2b` | image/weapon | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/enemies.png` | PNG | 530×795 | 17036 | `05ecf16bf927` | image/weapon | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/enemy_soldier.png` | PNG | 762×527 | 22856 | `e0c57e53b720` | image/enemy | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/hero.png` | PNG | 1026×1280 | 80792 | `695c55f2c39d` | image/player | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/hud.png` | PNG | 620×689 | 19160 | `a7aeb9b30098` | image/ui | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/mechs.png` | PNG | 773×1052 | 42213 | `fb53b18683d9` | image/weapon | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/pickups.png` | PNG | 770×740 | 19962 | `01b02595f757` | image/weapon | LICENSE_VERIFIED |
| `assets/vendor/open-gunner/tiles.png` | PNG | 1040×904 | 34955 | `adde8339114c` | image/tileset | LICENSE_VERIFIED |
| `sprites/pickups.png` | PNG | 124×32 | 1383 | `2deaf2625b81` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `sprites/players.png` | PNG | 2081×1075 | 108746 | `e568c6d7f419` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `sprites/stage1bg.png` | PNG | 3456×245 | 58789 | `8d91778ae391` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `sprites/tiles1.png` | PNG | 288×64 | 5069 | `a7e71b3f6038` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `sprites/title.png` | PNG | 560×576 | 58691 | `b215715decdd` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `sprites/wall1.png` | PNG | 223×192 | 2217 | `b381e8de04b7` | image/spritesheet | THIRD_PARTY_RESTRICTED |

## contra-unity — 图像资源（47）

| 文件 | 格式 | 尺寸 | 字节 | SHA-256(前12) | 类别 | 授权 |
|---|---|---|---|---|---|---|
| `Assets/Data/Texture/Boss.png` | PNG | 384×336 | 10435 | `adeefe5dbd5c` | image/enemy | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/Effect.png` | PNG | 128×72 | 1945 | `792fda0c49be` | image/effect | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/Enemy.png` | PNG | 128×128 | 2484 | `3664976768eb` | image/enemy | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/FileIcon.png` | PNG | 88×88 | 2456 | `0ac58b0c6ceb` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/Font.png` | PNG | 80×80 | 767 | `3cde6abfef11` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/map_tiles.png` | PNG | 256×496 | 10140 | `e4f24a1ce8ef` | image/tileset | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/MapObjects.png` | PNG | 312×256 | 6750 | `737e38d42deb` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/player.png` | PNG | 256×360 | 7270 | `9d4f48e31b99` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/PlayerBullet.png` | PNG | 24×128 | 854 | `ec9bced1e34b` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/UI/Background.png` | PNG | 64×64 | 220 | `3229d8f352dc` | image/background | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/UI/Cover.png` | PNG | 88×72 | 2424 | `d6ee242d3e37` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/UI/Cursor.png` | PNG | 16×10 | 206 | `670d422ce234` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/UI/GameUI.png` | PNG | 64×64 | 467 | `1006867a89f0` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Texture/UI/Title.png` | PNG | 192×80 | 2777 | `a76084236a2b` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Editor/Icon/MirrorIcon.png` | PNG | 512×512 | 138247 | `5f1ee2247319` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Back_Tex.jpeg` | JPEG | 1024×1024 | 68766 | `583a17e36d95` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Down_Tex.jpeg` | JPEG | 1024×1024 | 75605 | `9fd5881ae5da` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Front_Tex.jpeg` | JPEG | 1024×1024 | 72964 | `7f04ab4cee3b` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Left_Tex.jpeg` | JPEG | 1024×1024 | 68026 | `ac9ea21e5d82` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Right_Tex.jpeg` | JPEG | 1024×1024 | 70199 | `64039cc82cba` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/AdditiveLevels/Textures/Up_Tex.jpeg` | JPEG | 1024×1024 | 69705 | `8700fe79d4de` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/CharacterSelection/Textures/dirtMoon.jpg` | JPEG | 256×256 | 20017 | `074c64e1d82f` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/CharacterSelection/Textures/IconRandomColour.png` | PNG | 512×512 | 89302 | `12628323c766` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/CharacterSelection/Textures/IconResetColour.png` | PNG | 512×512 | 18042 | `0ec4e2a112a2` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/CharacterSelection/Textures/IconStickPerson.png` | PNG | 256×512 | 11503 | `c346bcdff7af` | image/player | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Pong/Sprites/Ball.png` | PNG | 1×1 | 2791 | `98db868437e2` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Pong/Sprites/DottedLine.png` | PNG | 1×29 | 2799 | `64af6a4e7438` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Pong/Sprites/Racket.png` | PNG | 2×4 | 2800 | `8b3731fc3d54` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Pong/Sprites/WallHorizontal.png` | PNG | 50×1 | 2796 | `20828fcce771` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Pong/Sprites/WallVertical.png` | PNG | 1×32 | 2800 | `6eba05eb8044` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Room/Materials/Textures/Wall01_n.tga` | TGA | 512×512 | 1048620 | `bbe696304cff` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Room/Materials/Textures/Wall01.tga` | TGA | 512×512 | 1048620 | `7a39e3d202af` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Tanks/Models/(Public Domain) Recon_Tank/BaseColor.png` | PNG | 1024×1024 | 939498 | `dc01ae6a554a` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Tanks/Models/(Public Domain) Recon_Tank/Emissive.png` | PNG | 1024×1024 | 80294 | `9d96735f5de8` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Tanks/Models/(Public Domain) Recon_Tank/Metallic.png` | PNG | 1024×1024 | 62860 | `bb108506d92f` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Tanks/Models/(Public Domain) Recon_Tank/Normal.png` | PNG | 1024×1024 | 666342 | `8754ed618159` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Examples/Tanks/Textures/(Public Domain) Dirt Hand Painted Texture/dirt.png` | PNG | 256×256 | 105829 | `f40cfcba1dc2` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Mirror/Transports/Edgegap/edgegap.png` | PNG | 400×400 | 4347 | `d9a2bb9d1b24` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Demigiant/DOTween/Editor/Imgs/DOTweenIcon.png` | PNG | 93×18 | 1565 | `6e6ca81af7b3` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Demigiant/DOTween/Editor/Imgs/DOTweenMiniIcon.png` | PNG | 9×9 | 319 | `29cd2e4bf91e` | image/ui | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Demigiant/DOTween/Editor/Imgs/Footer_dark.png` | PNG | 194×24 | 4429 | `2bc04d9700e6` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Demigiant/DOTween/Editor/Imgs/Footer.png` | PNG | 194×24 | 4409 | `b1bccfb25ef5` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Demigiant/DOTween/Editor/Imgs/Header.jpg` | JPEG | 512×164 | 22787 | `80652902491d` | image/other | THIRD_PARTY_RESTRICTED |
| `Assets/Plugins/Sirenix/Odin Inspector/Assets/Editor/SdfIconAtlas.png` | PNG | 3072×3072 | 1834055 | `a673e5dbf89a` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `Assets/TextMesh Pro/Sprites/EmojiOne.png` | PNG | 512×512 | 112319 | `a87b965a701d` | image/spritesheet | THIRD_PARTY_RESTRICTED |
| `pic0.png` | PNG | 2560×1600 | 43264 | `951b33958073` | image/other | THIRD_PARTY_RESTRICTED |
| `pic1.png` | PNG | 2560×1600 | 58712 | `4e6effd90e4a` | image/other | THIRD_PARTY_RESTRICTED |

## contra-unity — 音频资源（18）

| 文件 | 格式 | 字节 | SHA-256(前12) | 类别 | 授权 |
|---|---|---|---|---|---|
| `Assets/Data/Sound/BGM.wav` | wav | 4754438 | `a376db29f731` | audio/music | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Boss.wav` | wav | 396440 | `6e2120735215` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Dead.wav` | wav | 91696 | `471a251eea42` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Effect0.wav` | wav | 80880 | `82b0676de0ee` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Effect1.wav` | wav | 38518 | `5adee30f0646` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Effect2.wav` | wav | 103090 | `0aff9125a0ce` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Effect3.wav` | wav | 92108 | `27307758d51e` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Effect4.wav` | wav | 294132 | `3031f3750b34` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Fail.wav` | wav | 549840 | `5673c7480c5d` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Foot.wav` | wav | 6476 | `ec65d1263792` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/GameStart.wav` | wav | 284954 | `07e8e9050c8d` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/ShootF.wav` | wav | 59352 | `c686c2113187` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/ShootL.wav` | wav | 81658 | `a7e355729e0b` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/ShootM.wav` | wav | 74222 | `37899f2fcc99` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/ShootN.wav` | wav | 54602 | `2867ea67ffbf` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/ShootS.wav` | wav | 58344 | `1d7f9ec7a723` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Success.wav` | wav | 395126 | `dcb0eaefde87` | audio/sfx | THIRD_PARTY_RESTRICTED |
| `Assets/Data/Sound/Title.wav` | wav | 1008078 | `fc41f86e08e7` | audio/sfx | THIRD_PARTY_RESTRICTED |

## hundouluo — 图像资源（15）

| 文件 | 格式 | 尺寸 | 字节 | SHA-256(前12) | 类别 | 授权 |
|---|---|---|---|---|---|---|
| `Assets/Sprites/boss.png` | PNG | 2048×2048 | 961927 | `25edc9d52af4` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/bullet.png` | PNG | 2048×2048 | 73911 | `9b3a06a0ba82` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/checkpoint.png` | PNG | 2048×2048 | 396123 | `8f074ee2f7e2` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/flying.png` | PNG | 2048×2048 | 461280 | `dfaddf04d9f0` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/jungle.jpg` | JPEG | 2560×1440 | 562670 | `6eb028148ade` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/muzzle.png` | PNG | 2048×2048 | 243055 | `32a24d1a354c` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/player_jump.png` | PNG | 2048×2048 | 352313 | `998a494cb7c3` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/player_run.png` | PNG | 1024×1024 | 796516 | `3f47dffc81b8` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/player_up.png` | PNG | 2048×2048 | 212074 | `12c098bd5b19` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/powerup.png` | PNG | 2048×2048 | 349982 | `3df35fd40a45` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/sky.png` | PNG | 1024×512 | 9623 | `d6ec0961864c` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/soldier_walk.png` | PNG | 1024×1024 | 717196 | `d5885669b4ba` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/tile_ground.jpg` | JPEG | 2048×2048 | 332501 | `9619d3e2664c` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/tile_platform.jpg` | JPEG | 2048×2048 | 180193 | `72534a820f87` | image/spritesheet | PERMISSION_REQUIRED |
| `Assets/Sprites/turret.png` | PNG | 2048×2048 | 237086 | `c0ab40b8e390` | image/spritesheet | PERMISSION_REQUIRED |

## hundouluo — 音频资源（7）

| 文件 | 格式 | 字节 | SHA-256(前12) | 类别 | 授权 |
|---|---|---|---|---|---|
| `Assets/Audio/bgm.wav` | wav | 1411244 | `56cdb58aff70` | audio/music | PERMISSION_REQUIRED |
| `Assets/Audio/enemy_death.wav` | wav | 24740 | `faf0c2f16e8f` | audio/sfx | PERMISSION_REQUIRED |
| `Assets/Audio/jump.wav` | wav | 12392 | `429d00f55d39` | audio/sfx | PERMISSION_REQUIRED |
| `Assets/Audio/pickup.wav` | wav | 39734 | `d35d5e03bc5b` | audio/sfx | PERMISSION_REQUIRED |
| `Assets/Audio/player_death.wav` | wav | 70604 | `710644d30fe7` | audio/sfx | PERMISSION_REQUIRED |
| `Assets/Audio/shoot.wav` | wav | 5334 | `a8b4e6d5b194` | audio/sfx | PERMISSION_REQUIRED |
| `Assets/Audio/victory.wav` | wav | 97062 | `897e1a95edcc` | audio/sfx | PERMISSION_REQUIRED |
