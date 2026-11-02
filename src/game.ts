/** Game state and fixed-step simulation (one tick = 1/60 s). */

import {
  BARREL_SPAWN_X,
  BOSS_GIRDER,
  BOSS_X,
  GIRDERS,
  H,
  LADDERS,
  type Ladder,
  OIL_DRUM_X,
  PLAYER_START,
  TOP_GIRDER,
  W,
  WRENCH_SPOTS,
  downhill,
  spans,
  surfaceY,
} from './level';
import type { Input } from './input';
import type { Sfx } from './audio';

// Tunables (pixels / ticks).
const GRAVITY = 0.15;
const WALK_SPEED = 1.2;
const CLIMB_SPEED = 1.0;
const JUMP_VELOCITY = 2.9;
const SAFE_FALL = 30;
const LADDER_GRAB = 6;
export const PLAYER_W = 14;
export const PLAYER_H = 28;
export const BARREL_R = 9;
const BARREL_SPEED = 1.35;
const BARREL_LADDER_CHANCE = 0.3;
const WRENCH_TICKS = 600;
const BONUS_START = 5000;
const BONUS_STEP_TICKS = 120;
const DEATH_TICKS = 150;
const HIGH_SCORE_KEY = 'dk-oilrig-high';

export type Phase = 'title' | 'playing' | 'dying' | 'won' | 'gameover';
type PlayerState = 'ground' | 'air' | 'ladder';
type BarrelState = 'roll' | 'fall' | 'ladder';

export interface Player {
  x: number;
  y: number; // feet
  vx: number;
  vy: number;
  dir: 1 | -1;
  state: PlayerState;
  girder: number;
  ladder: Ladder | null;
  airStartY: number;
  walkDist: number;
  wrench: number; // ticks of wrench power remaining
  jumpedOver: Set<Barrel>;
}

export interface Barrel {
  x: number;
  y: number; // centre
  vx: number;
  vy: number;
  dir: 1 | -1;
  state: BarrelState;
  girder: number;
  ladder: Ladder | null;
  spin: number;
  bounced: boolean;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  ttl: number;
}

export interface Wrench {
  x: number;
  y: number;
  taken: boolean;
}

export interface Boss {
  cooldown: number;
  /** Ticks into current throw animation; 0 when idle. */
  throwTick: number;
}

const THROW_GRAB = 36; // barrel lifted overhead
const THROW_END = 56;

export class Game {
  phase: Phase = 'title';
  tick = 0;
  phaseTick = 0;
  score = 0;
  high = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0) || 0;
  lives = 3;
  bonus = BONUS_START;
  paused = false;
  drumFlare = 0;

  player!: Player;
  barrels: Barrel[] = [];
  popups: Popup[] = [];
  wrenches: Wrench[] = [];
  boss: Boss = { cooldown: 0, throwTick: 0 };
  private barrelsThrown = 0;

  constructor(
    private readonly input: Input,
    private readonly sfx: Sfx,
  ) {
    this.resetLevel();
  }

  private newGame(): void {
    this.score = 0;
    this.lives = 3;
    this.resetLevel();
    this.setPhase('playing');
  }

  private resetLevel(): void {
    const g = GIRDERS[PLAYER_START.girder];
    this.player = {
      x: PLAYER_START.x,
      y: surfaceY(g, PLAYER_START.x),
      vx: 0,
      vy: 0,
      dir: 1,
      state: 'ground',
      girder: PLAYER_START.girder,
      ladder: null,
      airStartY: 0,
      walkDist: 0,
      wrench: 0,
      jumpedOver: new Set(),
    };
    this.barrels = [];
    this.popups = [];
    this.wrenches = WRENCH_SPOTS.map((s) => ({ x: s.x, y: surfaceY(GIRDERS[s.girder], s.x) - 40, taken: false }));
    this.boss = { cooldown: 70, throwTick: 0 };
    this.barrelsThrown = 0;
    this.bonus = BONUS_START;
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTick = 0;
  }

  update(): void {
    const input = this.input;
    if (input.wasPressed('mute')) this.sfx.muted = !this.sfx.muted;

    switch (this.phase) {
      case 'title':
      case 'won':
      case 'gameover':
        if (input.wasPressed('start')) this.newGame();
        break;
      case 'dying':
        if (++this.phaseTick >= DEATH_TICKS) {
          this.lives--;
          if (this.lives <= 0) {
            this.saveHigh();
            this.setPhase('gameover');
          } else {
            this.resetLevel();
            this.setPhase('playing');
          }
        }
        break;
      case 'playing':
        if (input.wasPressed('pause')) this.paused = !this.paused;
        if (this.paused) return;
        this.phaseTick++;
        this.stepPlaying();
        break;
    }
    this.tick++;
    this.popups = this.popups.filter((p) => --p.ttl > 0);
    if (this.drumFlare > 0) this.drumFlare--;
  }

  private stepPlaying(): void {
    if (this.phaseTick % BONUS_STEP_TICKS === 0) {
      this.bonus = Math.max(0, this.bonus - 100);
      if (this.bonus === 0) return this.kill();
    }
    this.updatePlayer();
    if (this.phase !== 'playing') return;
    this.updateBoss();
    this.updateBarrels();
    this.checkCollisions();
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(): void {
    const p = this.player;
    const inp = this.input;
    if (p.wrench > 0) p.wrench--;
    const h = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);

    switch (p.state) {
      case 'ground': {
        if (inp.wasPressed('jump') && p.wrench === 0) {
          p.state = 'air';
          p.vy = -JUMP_VELOCITY;
          p.vx = h * WALK_SPEED;
          p.airStartY = p.y;
          p.jumpedOver.clear();
          this.sfx.jump();
          break;
        }
        if (p.wrench === 0 && (inp.isDown('up') || inp.isDown('down'))) {
          const up = inp.isDown('up');
          const l = LADDERS.find(
            (l) => Math.abs(l.x - p.x) <= LADDER_GRAB && (up ? l.lower : l.upper) === p.girder,
          );
          if (l) {
            p.state = 'ladder';
            p.ladder = l;
            p.x = l.x;
            break;
          }
        }
        if (h !== 0) {
          p.dir = h as 1 | -1;
          p.x = clamp(p.x + h * WALK_SPEED, PLAYER_W / 2, W - PLAYER_W / 2);
          const before = Math.floor(p.walkDist / 12);
          p.walkDist += WALK_SPEED;
          if (Math.floor(p.walkDist / 12) !== before) this.sfx.step();
        }
        const g = GIRDERS[p.girder];
        if (spans(g, p.x)) {
          p.y = surfaceY(g, p.x);
        } else {
          // Walked off an edge.
          p.state = 'air';
          p.vx = 0;
          p.vy = 0;
          p.airStartY = p.y;
        }
        break;
      }
      case 'ladder': {
        const l = p.ladder!;
        const v = (inp.isDown('down') ? 1 : 0) - (inp.isDown('up') ? 1 : 0);
        p.y += v * CLIMB_SPEED;
        if (v !== 0) p.walkDist += CLIMB_SPEED;
        if (p.y <= l.top) {
          this.landOn(l.upper, l.top);
          if (l.upper === TOP_GIRDER) this.win();
        } else if (p.y >= l.bottom) {
          this.landOn(l.lower, l.bottom);
        }
        break;
      }
      case 'air': {
        const prevX = p.x;
        const prevY = p.y;
        p.vy += GRAVITY;
        p.x = clamp(p.x + p.vx, PLAYER_W / 2, W - PLAYER_W / 2);
        p.y += p.vy;
        if (p.vy > 0) {
          for (let i = 0; i < GIRDERS.length; i++) {
            const g = GIRDERS[i];
            if (!spans(g, p.x)) continue;
            const s = surfaceY(g, p.x);
            const sPrev = spans(g, prevX) ? surfaceY(g, prevX) : s;
            if (prevY <= sPrev + 0.01 && p.y >= s) {
              if (s - p.airStartY > SAFE_FALL) return this.kill();
              this.landOn(i, s);
              if (i === TOP_GIRDER) this.win();
              return;
            }
          }
        }
        if (p.y > H + 40) this.kill();
        else this.scoreJumps();
        break;
      }
    }
    this.collectWrenches();
  }

  private landOn(girder: number, y: number): void {
    const p = this.player;
    p.state = 'ground';
    p.girder = girder;
    p.ladder = null;
    p.y = y;
    p.vx = p.vy = 0;
  }

  private scoreJumps(): void {
    const p = this.player;
    for (const b of this.barrels) {
      if (p.jumpedOver.has(b) || b.state !== 'roll') continue;
      const below = b.y - p.y;
      if (Math.abs(b.x - p.x) < 8 && below > 0 && below < 44) {
        p.jumpedOver.add(b);
        this.addScore(100, b.x, b.y - 18);
        this.sfx.score();
      }
    }
  }

  private collectWrenches(): void {
    const p = this.player;
    for (const w of this.wrenches) {
      if (w.taken) continue;
      if (Math.abs(w.x - p.x) < 12 && w.y > p.y - PLAYER_H - 4 && w.y < p.y) {
        w.taken = true;
        p.wrench = WRENCH_TICKS;
        this.sfx.pickup();
      }
    }
  }

  // ---------------------------------------------------------------- boss & barrels

  private updateBoss(): void {
    const b = this.boss;
    if (b.throwTick > 0) {
      b.throwTick++;
      if (b.throwTick === THROW_GRAB) this.spawnBarrel();
      if (b.throwTick >= THROW_END) b.throwTick = 0;
      return;
    }
    if (--b.cooldown <= 0) {
      b.throwTick = 1;
      // Gets angrier as the level goes on.
      const min = Math.max(60, 120 - this.barrelsThrown * 3);
      b.cooldown = min + Math.floor(Math.random() * 80);
    }
  }

  private spawnBarrel(): void {
    const g = GIRDERS[BOSS_GIRDER];
    this.barrels.push({
      x: BARREL_SPAWN_X,
      y: surfaceY(g, BARREL_SPAWN_X) - BARREL_R,
      vx: 0,
      vy: 0,
      dir: downhill(g),
      state: 'roll',
      girder: BOSS_GIRDER,
      ladder: null,
      spin: 0,
      bounced: false,
    });
    this.barrelsThrown++;
    this.sfx.throw();
  }

  private updateBarrels(): void {
    const speed = BARREL_SPEED + Math.min(0.5, this.barrelsThrown * 0.01);
    for (const b of this.barrels) {
      switch (b.state) {
        case 'roll': {
          const g = GIRDERS[b.girder];
          const prevX = b.x;
          b.x += b.dir * speed;
          b.spin += (b.dir * speed) / BARREL_R;
          if (!spans(g, b.x)) {
            b.state = 'fall';
            b.vx = b.dir * 0.7;
            b.vy = 0;
            b.bounced = false;
            break;
          }
          b.y = surfaceY(g, b.x) - BARREL_R;
          // Maybe take a ladder down whose head we just crossed.
          for (const l of LADDERS) {
            if (l.upper !== b.girder || (prevX - l.x) * (b.x - l.x) > 0) continue;
            if (Math.random() < this.ladderChance(l)) {
              b.state = 'ladder';
              b.ladder = l;
              b.x = l.x;
            }
            break;
          }
          break;
        }
        case 'ladder': {
          const l = b.ladder!;
          b.y += speed * 0.8;
          if (b.y + BARREL_R >= l.bottom) {
            b.state = 'roll';
            b.girder = l.lower;
            b.dir = downhill(GIRDERS[l.lower]);
            b.ladder = null;
            b.y = l.bottom - BARREL_R;
          }
          break;
        }
        case 'fall': {
          const prevX = b.x;
          const prevY = b.y;
          b.vy += GRAVITY;
          b.x += b.vx;
          b.y += b.vy;
          // After a bounce the barrel may land again on the girder it bounced on.
          const limit = b.girder + (b.bounced ? 1 : 0);
          for (let i = 0; i < limit; i++) {
            const g = GIRDERS[i];
            if (!spans(g, b.x)) continue;
            const s = surfaceY(g, b.x) - BARREL_R;
            const sPrev = (spans(g, prevX) ? surfaceY(g, prevX) : s + BARREL_R) - BARREL_R;
            if (prevY <= sPrev + 0.01 && b.y >= s) {
              b.girder = i;
              b.y = s;
              if (!b.bounced && b.vy > 2) {
                b.bounced = true;
                b.vy = -1.4;
              } else {
                b.state = 'roll';
                b.dir = downhill(g);
              }
              break;
            }
          }
          break;
        }
      }
    }
    this.barrels = this.barrels.filter((b) => {
      if (b.girder === 0 && b.state === 'roll' && b.x <= OIL_DRUM_X + 10) {
        this.drumFlare = 40; // barrel fed into the burning drum
        return false;
      }
      return b.y < H + 30;
    });
  }

  /** Barrels favour ladders that lead towards the player. */
  private ladderChance(l: Ladder): number {
    const p = this.player;
    const playerBelow = p.y > l.top + 10;
    return playerBelow && Math.abs(p.x - l.x) < 80 ? BARREL_LADDER_CHANCE * 1.6 : BARREL_LADDER_CHANCE * 0.6;
  }

  // ---------------------------------------------------------------- collisions & scoring

  private checkCollisions(): void {
    const p = this.player;
    const px0 = p.x - PLAYER_W / 2 + 2;
    const px1 = p.x + PLAYER_W / 2 - 2;
    const py0 = p.y - PLAYER_H + 4;
    const py1 = p.y;

    // Wrench swing hitbox: in front of and above the player.
    const hx0 = p.dir > 0 ? p.x : p.x - 26;
    const hx1 = hx0 + 26;
    const hy0 = p.y - PLAYER_H - 16;

    const smashed = new Set<Barrel>();
    for (const b of this.barrels) {
      if (p.wrench > 0 && circleRect(b.x, b.y, BARREL_R, hx0, hy0, hx1, py1)) {
        smashed.add(b);
        this.addScore(300, b.x, b.y - 14);
        this.sfx.smash();
        continue;
      }
      if (circleRect(b.x, b.y, BARREL_R - 2, px0, py0, px1, py1)) return this.kill();
    }
    if (smashed.size > 0) this.barrels = this.barrels.filter((b) => !smashed.has(b));

    // Touching the boss is fatal too.
    const bossTop = surfaceY(GIRDERS[BOSS_GIRDER], BOSS_X) - 52;
    if (px1 > BOSS_X - 24 && px0 < BOSS_X + 24 && py1 > bossTop && py0 < bossTop + 52) this.kill();
  }

  private addScore(points: number, x: number, y: number): void {
    this.score += points;
    this.popups.push({ x, y, text: String(points), ttl: 50 });
    if (this.score > this.high) this.high = this.score;
  }

  private kill(): void {
    if (this.phase !== 'playing') return;
    this.setPhase('dying');
    this.sfx.death();
  }

  private win(): void {
    this.score += this.bonus;
    if (this.score > this.high) this.high = this.score;
    this.saveHigh();
    this.setPhase('won');
    this.sfx.win();
  }

  private saveHigh(): void {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(this.high));
    } catch {
      /* storage unavailable: ignore */
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function circleRect(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = cx - clamp(cx, x0, x1);
  const dy = cy - clamp(cy, y0, y1);
  return dx * dx + dy * dy < r * r;
}
