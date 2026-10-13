import {
  CONTINUE_LIMIT,
  LEVEL_ROWS,
  PAL,
  RESPAWN_DELAY,
  SCORE_EXTRA_LIFE,
  START_LIVES,
  TILE,
  VIEW_H,
  VIEW_W,
} from '../config/constants';
import { aabb, clamp, dist2 } from '../core/math';
import { Pool } from '../core/pool';
import type { DebugFlags, InputState, WorldCtx } from '../core/world';
import { Level, openBossDoor } from '../level/level';
import { buildWaves, stageDef, type StageDef, type Wave } from '../level/stages';
import { T } from '../level/tiles';
import { Camera } from '../systems/camera';
import { Particles } from '../systems/particles';
import { drawBullet, makeBulletPool, spawnBullet, updateBullet } from '../entities/bullet';
import { Player, updatePlayerBullets } from '../entities/player';
import {
  damageEnemy,
  drawEnemy,
  explodeEnemy,
  initEnemy,
  killEnemy,
  makeEnemyPool,
  updateEnemy,
  updateEnemyBullets,
  ENEMY_DEFS,
} from '../entities/enemy';
import { Boss, BOSS_DEFS, damageBoss, drawBoss, updateBoss } from '../entities/boss';
import { Pickup, drawPickup, updatePickup } from '../entities/pickup';
import { buildBackground, buildTileArt, THEMES, type BgLayer, type TileArt } from '../gfx/sprites';
import { bgOriginX, bgOriginY } from '../gfx/bgLayer';
import { packStage1Bg, packStage1Tiles } from '../gfx/pack';
import { drawText } from '../gfx/font';
import { drawCenterBanner, drawHud } from '../ui/hud';
import { audio } from '../audio/audio';
import { weaponDef, WEAPON_ORDER, type WeaponId } from '../weapons/weapons';
import type { CharId } from '../gfx/sprites';
import type { GameHost, StartOptions } from './types';

const MAX_ENEMIES = 22;

export class GameScene {
  host: GameHost;
  level!: Level;
  def!: StageDef;
  waves: Wave[] = [];
  players: Player[] = [];
  pbullets = makeBulletPool(200);
  ebullets = makeBulletPool(240);
  enemyPool = makeEnemyPool(26);
  pickupPool = new Pool<Pickup>(
    () => new Pickup(),
    () => {},
    10,
  );
  particles = new Particles();
  cam = new Camera();
  boss: Boss | null = null;
  world!: WorldCtx;
  debug: DebugFlags = { on: false, invincible: false, infiniteAmmo: false, hitbox: false, fps: false };

  theme = THEMES.base;
  tileArt!: TileArt;
  bg!: { sky: HTMLCanvasElement; layers: BgLayer[] };
  /** true when the uploaded Stage-1 map image is the level visual (1:1), so
   *  terrain tiles are not painted over it. */
  mapImageActive = false;

  phase: 'intro' | 'play' | 'boss' | 'clear' | 'over' = 'intro';
  phaseT = 0;
  stageTime = 0;
  showStageT = 0;
  bossTriggered = false;
  continueUsed = 0;
  fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private respawnT: number[] = [0, 0];
  private scrollActive = false;

  constructor(host: GameHost) {
    this.host = host;
    const w: WorldCtx = {
      level: null as unknown as Level,
      cam: this.cam,
      particles: this.particles,
      pbullets: this.pbullets,
      ebullets: this.ebullets,
      players: this.players,
      enemies: this.enemyPool.active,
      audio,
      debug: this.debug,
      time: 0,
      shake: (m, t) => this.cam.shake(m, t),
      addScore: (n, idx) => this.addScore(n, idx),
      nearestPlayer: (x, y) => this.nearestPlayer(x, y),
      spawnPickup: (x, y, kind, weapon) => this.spawnPickup(x, y, kind as any, weapon as WeaponId),
      spawnEnemy: (kind, x, y, facing) => this.spawnEnemy(kind, x, y, facing),
      explode: (x, y, radius, dmg) => this.explodeAt(x, y, radius, dmg),
      boss: null,
      bossActive: false,
    };
    this.world = w;
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  start(opt: StartOptions): void {
    this.def = stageDef(opt.stage);
    this.level = new Level(this.def);
    this.waves = buildWaves(this.def).map((w) => ({ ...w, done: false }));
    this.theme = THEMES[this.def.theme] ?? THEMES.base;
    this.tileArt = buildTileArt(this.theme, this.def.seed);
    this.bg = buildBackground(this.theme, this.def.seed);
    if (this.def.id === 1) {
      // optional sprite-pack overrides for stage 1 (silently skipped when absent)
      const pt = packStage1Tiles();
      if (pt) {
        this.tileArt.solid = pt.solid;
        this.tileArt.platform = pt.platform;
        this.tileArt.water = pt.water;
      }
      const pb = packStage1Bg();
      if (pb) {
        this.mapImageActive = true;
        this.bg = {
          sky: pb.sky,
          // world-locked: speed 1 is implied by `lock`, and `y` is a WORLD
          // coordinate (image row 0), not a screen coordinate
          layers: [{ sprite: pb.sprite, speed: 1, repeat: true, y: pb.worldY, lock: true }],
        };
      }
    }
    this.continueUsed = opt.continueUsed ?? 0;

    this.pbullets.clear();
    this.ebullets.clear();
    this.enemyPool.clear();
    this.pickupPool.clear();
    this.particles.clear();
    this.boss = null;
    this.bossTriggered = false;
    this.phase = 'intro';
    this.phaseT = 0;
    this.stageTime = 0;
    this.showStageT = 3.2;
    this.scrollActive = false;
    this.respawnT = [0, 0];

    this.players = [];
    const count = opt.twoPlayer ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const p = new Player(i as 0 | 1, opt.chars[i]);
      p.lives = START_LIVES;
      p.active = true;
      this.players.push(p);
    }
    if (this.host.save.settings.players === 2 && count === 1) {
      // keep a slot so the HUD does not break
    }

    this.world.level = this.level;
    this.world.players = this.players;
    this.world.enemies = this.enemyPool.active;

    this.cam.setBounds(this.level.pixelW, this.level.pixelH);
    this.cam.reset(0, Math.max(0, this.level.pixelH - VIEW_H - 60));
    this.cam.shakeEnabled = this.host.save.settings.screenShake;

    const startX = 48;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.place(startX + i * 18, this.findGroundY(startX + i * 18, p.h));
    }

    audio.playTrack(this.def.music);
    audio.setIntensity(1);
  }

  private findGroundY(x: number, h: number): number {
    for (let d = 0; d < 10; d++) {
      const col = Math.floor((x + d * TILE) / TILE);
      if (col >= this.level.tilesX) break;
      const row = this.level.groundRow(col);
      if (row < this.level.rows) return row * TILE - h;
    }
    return (LEVEL_ROWS - 4) * TILE - h;
  }

  /* ------------------------------------------------------------------ */
  /* update                                                              */
  /* ------------------------------------------------------------------ */

  update(dt: number): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    this.handleDebugKeys();

    if (this.phase === 'clear' || this.phase === 'over') {
      this.phaseT += dt;
      this.particles.update(dt);
      for (const p of this.players) p.update(dt, emptyInput, this.world);
      if (this.phase === 'clear' && this.phaseT > 4.2) this.host.goto('stageclear');
      if (this.phase === 'over' && this.phaseT > 2.6) this.host.goto('gameover');
      return;
    }

    this.stageTime += dt;
    this.world.time += dt;
    if (this.showStageT > 0) this.showStageT -= dt;

    if (this.phase === 'intro') {
      this.phaseT += dt;
      if (this.phaseT > 1.2) {
        this.phase = 'play';
        this.phaseT = 0;
      }
    }

    /* ---- input ---- */
    const input = this.host.input;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const wasDead = p.state === 'dead';
      const st: InputState = {
        left: input.held(i as 0 | 1, 'left'),
        right: input.held(i as 0 | 1, 'right'),
        up: input.held(i as 0 | 1, 'up'),
        down: input.held(i as 0 | 1, 'down'),
        jumpHeld: input.held(i as 0 | 1, 'jump'),
        jumpPressed: input.pressed(i as 0 | 1, 'jump'),
        shootHeld: input.held(i as 0 | 1, 'shoot'),
      };
      if (p.state === 'dead') {
        if (!wasDead) this.onPlayerDead(p, i);
        this.respawnT[i] -= dt;
        if (this.respawnT[i] <= 0) this.respawn(p, i);
        continue;
      }
      p.update(dt, st, this.world);
      if ((p.state as string) === 'dead' && !wasDead) this.onPlayerDead(p, i);
    }

    /* ---- forced scroll ---- */
    this.updateForcedScroll(dt);

    /* ---- waves ---- */
    this.updateWaves();

    /* ---- boss trigger ---- */
    if (!this.bossTriggered) {
      const bx = this.level.bossArenaX();
      const anyNear = this.players.some((p) => p.alive && p.x > bx - 150);
      if (anyNear) this.triggerBoss();
    }

    /* ---- entities ---- */
    for (const e of this.enemyPool.active) updateEnemy(e, dt, this.world);
    this.enemyPool.sweep((e) => e.dead);

    if (this.boss) {
      updateBoss(this.boss, dt, this.world, this.players.filter((p) => p.alive));
      this.world.bossActive = this.boss.state === 'fight';
      if (this.boss.state === 'dead' && this.phase === 'boss') this.onBossDefeated();
    }

    updatePlayerBullets(this.world, dt);
    updateEnemyBullets(this.world, dt);

    for (const p of this.pickupPool.active) updatePickup(p, dt, this.world);
    this.pickupPool.sweep((p) => p.dead);

    this.particles.update(dt);

    /* ---- collisions ---- */
    this.collide();

    /* ---- camera ---- */
    this.cam.update(dt, this.players.filter((p) => p.state !== 'dead') as any);

    /* ---- despawn far enemies ---- */
    for (const e of this.enemyPool.active) {
      if (e.x < this.cam.x - 260 || e.x > this.cam.x + VIEW_W + 420) e.dead = true;
    }
    this.enemyPool.sweep((e) => e.dead);

    /* ---- game over check ---- */
    if ((this.phase as string) !== 'over' && this.players.every((p) => p.lives < 0 && p.state === 'dead')) {
      this.phase = 'over';
      this.phaseT = 0;
      audio.stopTrack();
      audio.sfx('gameOver');
    }
  }

  private updateForcedScroll(dt: number): void {
    const s = this.def.scroll;
    if (!s) return;
    const [a, b, speed] = s;
    const ax = a * TILE;
    const bx = b * TILE;
    const active = this.cam.x + VIEW_W > ax && this.cam.x < bx;
    this.cam.forced = active;
    this.cam.forcedSpeed = speed;
    this.scrollActive = active;
    if (!active) return;
    void dt;
    for (const p of this.players) {
      if (!p.alive) continue;
      const left = this.cam.x + 6;
      if (p.x < left) {
        p.x = left;
        if (p.hurt(this.world, 1, p.x - 20)) continue;
      }
      const right = this.cam.x + VIEW_W - p.w - 6;
      if (p.x > right) p.x = right;
    }
  }

  private updateWaves(): void {
    const trigger = this.cam.x + VIEW_W * 0.75;
    for (const wv of this.waves) {
      if (wv.done || wv.x > trigger) continue;
      wv.done = true;
      if (this.bossTriggered) continue;
      for (const e of wv.entries) this.spawnWaveEntry(e.kind, e.count, e.from, e.delay ?? 0);
    }
  }

  private spawnWaveEntry(kind: string, count: number, from: string, delay: number): void {
    if (!ENEMY_DEFS[kind]) kind = 'grunt';
    const camX = this.cam.x;
    void delay;
    for (let i = 0; i < count; i++) {
      if (this.enemyPool.count >= MAX_ENEMIES) return;
      let x = camX + VIEW_W + 24 + i * 26;
      let y = 60;
      let facing: 1 | -1 = -1;
      if (from === 'left') {
        x = camX - 24 - i * 26;
        facing = 1;
      } else if (from === 'air') {
        x = camX + 120 + Math.random() * (VIEW_W - 160);
        y = 30 + Math.random() * 90;
        facing = -1;
      } else if (from === 'spot') {
        x = camX + 220 + i * 60;
        y = this.findGroundY(x, 20);
        facing = -1;
      } else {
        y = this.findGroundY(x, 24) + 2;
      }
      x = clamp(x, 10, this.level.pixelW - 40);
      if (this.bossTriggered && x > this.level.bossArenaX() - 40) continue;
      this.spawnEnemy(kind, x, y, facing);
    }
  }

  spawnEnemy(kind: string, x: number, y: number, facing: 1 | -1 = -1): any {
    if (this.enemyPool.count >= MAX_ENEMIES) return null;
    const e = this.enemyPool.spawn();
    initEnemy(e, kind, x, y, facing);
    return e;
  }

  spawnPickup(x: number, y: number, kind: 'weapon' | 'life' | 'score', weapon?: WeaponId): void {
    if (this.pickupPool.count > 8) return;
    const p = this.pickupPool.spawn();
    p.reset(kind, x, y - 12, weapon);
  }

  addScore(n: number, idx: number): void {
    if (idx >= 0 && this.players[idx]) {
      const p = this.players[idx];
      const before = p.score;
      p.score += n;
      if (Math.floor(before / SCORE_EXTRA_LIFE) !== Math.floor(p.score / SCORE_EXTRA_LIFE)) {
        p.lives = Math.min(9, p.lives + 1);
        audio.sfx('pickup');
      }
    } else {
      for (const p of this.players) {
        if (!p.alive) continue;
        const before = p.score;
        p.score += n;
        if (Math.floor(before / SCORE_EXTRA_LIFE) !== Math.floor(p.score / SCORE_EXTRA_LIFE)) {
          p.lives = Math.min(9, p.lives + 1);
        }
      }
    }
    const best = Math.max(...this.players.map((p) => p.score), 0);
    if (best > this.host.save.highScore) {
      this.host.save.highScore = best;
      this.host.persist();
    }
  }

  nearestPlayer(x: number, y: number): Player | null {
    let best: Player | null = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = dist2(p.x + p.w / 2, p.y + p.h / 2, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* boss                                                                */
  /* ------------------------------------------------------------------ */

  private triggerBoss(): void {
    this.bossTriggered = true;
    openBossDoor(this.level);
    audio.sfx('door');
    const def = BOSS_DEFS[this.def.bossId] ?? BOSS_DEFS.commander;
    const left = this.level.bossArenaX();
    // The arena is exactly one screen wide (VIEW_W / TILE columns) ending at the
    // gate, so the camera locks to a single screen and the boss is always in
    // view. For Stage 1 the gate is placed before the ravine, so the arena
    // stops well short of the chasms and the fortress wall.
    const arenaCols = Math.floor(VIEW_W / TILE);
    const right = Math.min(this.level.pixelW, (this.def.bossStart + arenaCols) * TILE);
    const b = new Boss(def, left + (right - left) / 2 - def.w / 2, 40);
    b.hp = this.def.bossHp;
    b.maxHp = this.def.bossHp;
    b.arenaLeft = left;
    b.arenaRight = right;
    // entry state descends exactly 96px, so start one descent above the ground
    b.y = this.findGroundY(b.x + b.w / 2, b.h) - 96;
    this.boss = b;
    this.world.boss = b;
    this.phase = 'boss';
    this.cam.lock = [left, Math.max(left, right - VIEW_W)];
    for (const w of this.waves) w.done = true;
    // distinct boss-battle music (original composition) instead of merely
    // speeding up the stage track; falls back to the stage track.
    audio.playTrack(this.def.bossMusic ?? this.def.music);
  }

  private onBossDefeated(): void {
    this.addScore(5000 * (this.def.id + 1), -1);
    this.phase = 'clear';
    this.phaseT = 0;
    for (const p of this.players) {
      p.state = 'victory';
      p.stateT = 0;
    }
    audio.playTrack(this.def.music);
    audio.sfx('stageClear');
    if (this.host.save.maxStageUnlocked < Math.min(8, this.def.id + 1)) {
      this.host.save.maxStageUnlocked = Math.min(8, this.def.id + 1);
      this.host.persist();
    }
  }

  /* ------------------------------------------------------------------ */
  /* collisions                                                          */
  /* ------------------------------------------------------------------ */

  private collide(): void {
    const enemies = this.enemyPool.active;

    /* player bullets -> enemies / boss */
    for (const b of this.pbullets.active) {
      if (b.dead) continue;
      for (const e of enemies) {
        if (e.dead || e.state === 'death') continue;
        if (!aabb(b.box, e.box)) continue;
        if (b.hitIds.includes(e.uid)) continue;
        b.hitIds.push(e.uid);
        const explosive = b.explode > 0;
        const killed = damageEnemy(e, b.dmg, this.world, b.x, explosive);
        if (killed && this.players[b.ownerIndex]) this.players[b.ownerIndex].kills++;
        if (b.explode > 0) {
          this.explodeAt(b.x, b.y, b.explode, b.dmg);
          b.dead = true;
        } else if (b.pierce > 0) {
          b.pierce--;
        } else {
          b.dead = true;
        }
        if (b.dead) break;
      }
      if (b.dead) continue;
      const boss = this.boss;
      if (boss && boss.state === 'fight' && aabb(b.box, boss.box)) {
        if (!b.hitIds.includes(-1)) {
          b.hitIds.push(-1);
          damageBoss(boss, b.dmg, this.world, b.x, b.y, b.explode > 0);
          if (b.explode > 0) {
            this.explodeAt(b.x, b.y, b.explode, b.dmg);
            b.dead = true;
          } else if (b.pierce > 0) {
            b.pierce--;
          } else {
            b.dead = true;
          }
        }
      }
    }
    this.pbullets.sweep((b) => b.dead);

    /* enemy bullets -> players */
    for (const b of this.ebullets.active) {
      if (b.dead) continue;
      for (const p of this.players) {
        if (!p.alive) continue;
        if (!aabb(b.box, p.box)) continue;
        p.hurt(this.world, 1, b.x);
        b.dead = true;
        break;
      }
    }
    this.ebullets.sweep((b) => b.dead);

    /* enemies -> players (contact) */
    for (const e of enemies) {
      if (e.dead || e.state === 'death') continue;
      for (const p of this.players) {
        if (!p.alive) continue;
        if (!aabb(p.box, e.box)) continue;
        if (e.kind === 'bomber') {
          explodeEnemy(e, this.world, false);
          p.hurt(this.world, 1, e.x);
        } else {
          p.hurt(this.world, 1, e.x);
        }
      }
    }

    /* boss body -> players */
    if (this.boss && this.boss.state === 'fight') {
      for (const p of this.players) {
        if (!p.alive) continue;
        if (aabb(p.box, this.boss.box)) p.hurt(this.world, 1, this.boss.x + this.boss.w / 2);
      }
    }

    /* pickups -> players */
    for (const pk of this.pickupPool.active) {
      if (pk.dead) continue;
      for (const p of this.players) {
        if (!p.alive) continue;
        if (!aabb(p.box, { x: pk.x, y: pk.y, w: pk.w, h: pk.h })) continue;
        this.collect(p, pk);
        pk.dead = true;
        break;
      }
    }
    this.pickupPool.sweep((p) => p.dead);

    /* player bullets -> destructible tiles */
    for (const b of this.pbullets.active) {
      if (b.dead) continue;
      const tx = Math.floor(b.x / TILE);
      const ty = Math.floor(b.y / TILE);
      const t = this.level.get(tx, ty);
      if (t === T.CRATE || t === T.HIDDEN) {
        this.level.destroyTile(tx, ty);
        this.particles.burst(tx * TILE + 8, ty * TILE + 8, 8, [PAL.brown, PAL.sand, PAL.white], 90, 0.35, 300);
        audio.sfx('explosionSmall');
        if (t === T.HIDDEN && Math.random() < 0.7) {
          this.spawnPickup(tx * TILE, ty * TILE, 'weapon', WEAPON_ORDER[(Math.random() * WEAPON_ORDER.length) | 0]);
        }
        b.dead = true;
      }
    }
    this.pbullets.sweep((b) => b.dead);
  }

  private explodeAt(x: number, y: number, radius: number, dmg: number): void {
    this.particles.explosion(x, y, radius);
    audio.sfx('explosion');
    this.cam.shake(3, 0.2);
    for (const e of this.enemyPool.active) {
      if (e.dead || e.state === 'death') continue;
      const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
      if (d < radius) damageEnemy(e, dmg * 0.7, this.world, x, true);
    }
    if (this.boss && this.boss.state === 'fight') {
      const d = Math.hypot(this.boss.x + this.boss.w / 2 - x, this.boss.y + this.boss.h / 2 - y);
      if (d < radius + this.boss.w / 2) damageBoss(this.boss, dmg * 0.7, this.world, x, y, true);
    }
    // blow up crates and bridge decks near the blast (Stage-1 bridges are
    // destructible by explosions - the deck is blown open and the river below
    // is lethal, exactly like the original). A blast removes ONE plank
    // section (its own column): a hole you jump, never an erased bridge.
    const tr = Math.max(1, Math.round(radius / TILE) - 1);
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    for (let ty = cy - tr; ty <= cy + tr; ty++)
      for (let tx = cx - tr; tx <= cx + tr; tx++) {
        const t = this.level.get(tx, ty);
        if (t === T.CRATE) this.level.destroyTile(tx, ty);
        else if (t === T.BRIDGE && tx === cx) {
          this.level.destroyTile(tx, ty);
          this.particles.burst(tx * TILE + 8, ty * TILE + 8, 8, [PAL.steel, PAL.white, PAL.orange], 120, 0.4, 260);
        }
      }
  }

  private collect(p: Player, pk: Pickup): void {
    audio.sfx('pickup');
    this.particles.burst(pk.x + 8, pk.y + 8, 8, [PAL.yellow, PAL.white], 90, 0.3);
    if (pk.kind === 'weapon') {
      p.giveWeapon(pk.weapon);
      this.addScore(500, p.index);
      this.showWeaponToast(p, weaponDef(pk.weapon).short);
    } else if (pk.kind === 'life') {
      p.lives = Math.min(9, p.lives + 1);
      this.addScore(300, p.index);
    } else {
      this.addScore(1000, p.index);
    }
  }

  private toast = '';
  private toastT = 0;
  private showWeaponToast(p: Player, name: string): void {
    this.toast = `P${p.index + 1} ${name}`;
    this.toastT = 1.4;
  }

  /* ------------------------------------------------------------------ */
  /* respawn                                                             */
  /* ------------------------------------------------------------------ */

  private respawn(p: Player, i: number): void {
    if (p.lives < 0) return;
    const x = clamp(this.cam.x + 48 + i * 20, 8, this.level.pixelW - 40);
    p.place(x, this.findGroundY(x, p.h));
    p.invuln = 1.8;
  }

  private onPlayerDead(p: Player, i: number): void {
    p.lives--;
    if (p.lives >= 0) this.respawnT[i] = RESPAWN_DELAY;
  }

  /* ------------------------------------------------------------------ */
  /* debug                                                               */
  /* ------------------------------------------------------------------ */

  private handleDebugKeys(): void {
    const inp = this.host.input;
    if (inp.rawPressed('F1')) this.debug.on = !this.debug.on;
    if (inp.rawPressed('F2')) this.debug.invincible = !this.debug.invincible;
    if (inp.rawPressed('F3')) this.debug.infiniteAmmo = !this.debug.infiniteAmmo;
    if (inp.rawPressed('F7')) this.debug.hitbox = !this.debug.hitbox;
    if (inp.rawPressed('F8')) this.debug.fps = !this.debug.fps;
    if (!this.debug.on) return;
    if (inp.rawPressed('F4')) {
      // skip stage
      if (this.boss) {
        this.boss.hp = 0;
        this.boss.state = 'dying';
        this.boss.stateT = 0;
      } else {
        this.onBossDefeated();
      }
    }
    if (inp.rawPressed('F5')) {
      if (!this.bossTriggered) {
        for (const p of this.players) {
          p.x = this.level.bossArenaX() - 120;
          p.y = this.findGroundY(p.x, p.h);
        }
        this.cam.x = Math.max(0, this.level.bossArenaX() - 200);
      } else if (this.boss) {
        this.boss.hp = Math.max(1, Math.floor(this.boss.maxHp * 0.35));
      }
    }
    if (inp.rawPressed('F6')) {
      let i = 0;
      for (const kind of Object.keys(ENEMY_DEFS)) {
        this.spawnEnemy(kind, this.cam.x + 60 + (i % 8) * 70, 60 + Math.floor(i / 8) * 70, -1);
        i++;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* render                                                              */
  /* ------------------------------------------------------------------ */

  draw(ctx: CanvasRenderingContext2D): void {
    const camX = this.cam.offsetX;
    const camY = this.cam.offsetY;

    // background
    ctx.drawImage(this.bg.sky, 0, 0);
    for (const l of this.bg.layers) {
      const w = l.sprite.width;
      const ox = bgOriginX(l, camX);
      const oy = bgOriginY(l, camY);
      for (let x = ox; x < VIEW_W; x += w) {
        ctx.drawImage(l.sprite, Math.round(x), oy);
      }
    }

    this.drawTiles(ctx, camX, camY);

    for (const pk of this.pickupPool.active) drawPickup(ctx, pk, camX, camY);
    for (const e of this.enemyPool.active) drawEnemy(ctx, e, camX, camY, this.debug.hitbox);
    if (this.boss) drawBoss(ctx, this.boss, camX, camY, this.debug.hitbox);
    for (const b of this.ebullets.active) drawBullet(ctx, b, camX, camY);
    for (const b of this.pbullets.active) drawBullet(ctx, b, camX, camY);
    for (const p of this.players) p.draw(ctx, camX, camY, this.debug.hitbox);
    this.particles.draw(ctx, camX, camY);

    // dead-player respawn notice
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.state === 'dead' && p.lives >= 0) {
        drawText(ctx, `P${i + 1} READY  x${p.lives}`, VIEW_W / 2, VIEW_H / 2 + 20, {
          color: PAL.white,
          shadow: PAL.black,
          align: 'center',
          scale: 1,
        });
      }
    }

    if (this.toastT > 0) {
      this.toastT -= 1 / 60;
      drawText(ctx, this.toast, VIEW_W / 2, VIEW_H - 40, {
        color: PAL.yellow,
        shadow: PAL.black,
        align: 'center',
        scale: 1,
      });
    }

    drawHud(ctx, this.players, {
      highScore: this.host.save.highScore,
      stageName: `${this.def.name}  ${this.def.subtitle}`,
      boss: this.boss,
      showStageT: this.showStageT,
      time: this.stageTime,
    });

    if (this.phase === 'clear') {
      drawCenterBanner(ctx, 'STAGE CLEAR', `TIME ${this.stageTime.toFixed(1)}s`, VIEW_H / 2 - 40, PAL.yellow);
      const bonus = 1000 * this.def.id;
      drawText(ctx, `BONUS ${bonus}`, VIEW_W / 2, VIEW_H / 2 + 14, {
        color: PAL.white,
        shadow: PAL.black,
        align: 'center',
        scale: 1,
      });
    }
    if (this.phase === 'over') {
      drawCenterBanner(ctx, 'GAME OVER', 'PRESS ENTER', VIEW_H / 2 - 30, PAL.red);
    }

    this.drawDebug(ctx);
  }

  private drawTiles(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const tx0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const tx1 = Math.min(this.level.tilesX - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
    const ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const ty1 = Math.min(LEVEL_ROWS - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);
    const waterFrame = Math.floor(this.world.time * 6) % 3;
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const t = this.level.get(tx, ty);
        if (t === T.EMPTY) continue;
        // Stage 1 draws the uploaded map image 1:1 as the level visual, so the
        // terrain the picture already shows must NOT be painted a second time
        // with tile art - that would cover the original art. Only objects the
        // picture does not carry (the boss gate, crates, spikes, ladders,
        // ledges) are still drawn here.
        if (this.mapImageActive && (t === T.SOLID || t === T.WATER || t === T.HIDDEN || t === T.BRIDGE)) {
          continue;
        }
        const px = tx * TILE - camX;
        const py = ty * TILE - camY;
        switch (t) {
          case T.SOLID: {
            const above = this.level.get(tx, ty - 1);
            const spr = above === T.EMPTY || above === T.WATER || above === T.LADDER
              ? this.tileArt.solid[0]
              : this.tileArt.solid[1 + ((tx * 7 + ty * 3) % 3)];
            ctx.drawImage(spr, px, py);
            break;
          }
          case T.PLATFORM:
            ctx.drawImage(this.tileArt.platform[(tx % 2) as 0 | 1], px, py);
            break;
          case T.LADDER:
            ctx.drawImage(this.tileArt.ladder, px, py);
            break;
          case T.SPIKE:
            ctx.drawImage(this.tileArt.spike, px, py);
            break;
          case T.WATER:
            ctx.drawImage(this.tileArt.water[waterFrame], px, py);
            break;
          case T.BRIDGE:
            // fallback art for when the map image is absent: metal planks
            ctx.drawImage(this.tileArt.solid[0], px, py);
            break;
          case T.CRATE: {
            const dmgKey = this.level.key(tx, ty);
            void dmgKey;
            ctx.drawImage(this.tileArt.crate[0], px, py);
            break;
          }
          case T.HIDDEN:
            ctx.drawImage(this.tileArt.crate[0], px, py);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = this.theme.bg2;
            ctx.fillRect(px, py, TILE, TILE);
            ctx.globalAlpha = 1;
            break;
          case T.DOOR:
            ctx.drawImage(this.tileArt.door, px, py - 32);
            break;
          default:
            break;
        }
      }
    }
  }

  private drawDebug(ctx: CanvasRenderingContext2D): void {
    if (this.debug.fps) {
      drawText(ctx, `${this.fps.toFixed(0)} FPS`, 4, VIEW_H - 12, { color: PAL.green, scale: 1 });
      drawText(ctx, `E:${this.enemyPool.count} B:${this.pbullets.count + this.ebullets.count} P:${this.particles.pool.count}`, 60, VIEW_H - 12, {
        color: PAL.green,
        scale: 1,
      });
    }
    if (!this.debug.on) return;
    const lines = [
      'DEBUG MODE  F1',
      `INVINCIBLE  F2 : ${this.debug.invincible ? 'ON' : 'OFF'}`,
      `AMMO        F3 : ${this.debug.infiniteAmmo ? 'ON' : 'OFF'}`,
      'SKIP STAGE  F4',
      'BOSS TEST   F5',
      'ENEMY TEST  F6',
      `HITBOX      F7 : ${this.debug.hitbox ? 'ON' : 'OFF'}`,
      `FPS         F8 : ${this.debug.fps ? 'ON' : 'OFF'}`,
    ];
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(4, 30, 140, lines.length * 9 + 6);
    lines.forEach((l, i) => drawText(ctx, l, 8, 34 + i * 9, { color: PAL.cyan, scale: 1 }));
    drawText(ctx, `CAM ${this.cam.x.toFixed(0)},${this.cam.y.toFixed(0)}`, 8, 34 + lines.length * 9 + 4, {
      color: PAL.green,
      scale: 1,
    });
    if (this.scrollActive) drawText(ctx, 'FORCED SCROLL', VIEW_W - 90, 30, { color: PAL.orange, scale: 1 });
  }

  /* called by the host when the player dies outside the update loop */
  notifyDeath(index: number): void {
    this.onPlayerDead(this.players[index], index);
  }

  canContinue(): boolean {
    return this.continueUsed < CONTINUE_LIMIT;
  }

  /** used by the pause menu */
  get paused(): boolean {
    return false;
  }

  restartFromCheckpoint(): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.lives = START_LIVES;
      const x = clamp(this.cam.x + 48 + i * 20, 8, this.level.pixelW - 40);
      p.place(x, this.findGroundY(x, p.h));
    }
  }
}

const emptyInput: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  shootHeld: false,
};

export { spawnBullet, updateBullet, killEnemy };
