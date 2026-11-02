/** Procedural canvas renderer: every sprite is drawn with primitives. */

import { BARREL_R, type Barrel, type Game, type Player } from './game';
import {
  BOSS_GIRDER,
  BOSS_X,
  GIRDERS,
  GIRDER_THICKNESS,
  type Girder,
  H,
  LADDERS,
  type Ladder,
  OIL_DRUM_X,
  RESCUEE_X,
  TOP_GIRDER,
  W,
  surfaceY,
} from './level';

type Ctx = CanvasRenderingContext2D;

const C = {
  steel: '#e0a526',
  steelDark: '#8a5a12',
  steelLight: '#ffd25e',
  ladder: '#9fb4c8',
  ladderDark: '#4c5d6e',
  overalls: '#ff7a1a',
  overallsDark: '#c4520a',
  hat: '#ffd21f',
  skin: '#f2b58a',
  boot: '#2a1a10',
  fur: '#5a3420',
  furLight: '#a0663c',
  barrel: '#23466e',
  barrelBand: '#9cc3e8',
  text: '#ffffff',
  hud: '#ff5a3c',
};

const HORIZON = 300;

export class Renderer {
  private readonly bg: HTMLCanvasElement;

  constructor(private readonly ctx: Ctx) {
    ctx.imageSmoothingEnabled = false;
    this.bg = buildBackground();
  }

  draw(game: Game): void {
    const ctx = this.ctx;
    const t = game.tick;
    ctx.drawImage(this.bg, 0, 0);
    drawSea(ctx, t);
    drawFlare(ctx, t);
    drawRigLegs(ctx);

    for (const l of LADDERS) drawLadder(ctx, l);
    GIRDERS.forEach((g, i) => drawGirder(ctx, g, i === TOP_GIRDER));
    drawOilDrum(ctx, t, game.drumFlare);
    drawBarrelStack(ctx);
    drawRescuee(ctx, t, game.phase === 'won');
    drawBoss(ctx, t, game.boss.throwTick, game.phase === 'won');

    for (const w of game.wrenches) if (!w.taken) drawWrench(ctx, w.x, w.y + Math.sin(t / 12) * 2, -0.6);
    for (const b of game.barrels) drawBarrel(ctx, b);

    if (game.phase !== 'title') drawPlayer(ctx, game.player, t, game.phase === 'dying' ? game.phaseTick : -1);

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (const p of game.popups) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.text, p.x, p.y - (50 - Math.min(p.ttl, 50)) * 0.4);
    }

    drawHud(ctx, game);
    drawOverlay(ctx, game);
  }
}

// ------------------------------------------------------------------ background

function buildBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#02040c');
  sky.addColorStop(0.7, '#0a1530');
  sky.addColorStop(1, '#1b2747');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Deterministic star field.
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
    ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * HORIZON * 0.85), rnd() < 0.15 ? 2 : 1, 1);
  }

  // Moon.
  ctx.fillStyle = '#f4f1d8';
  ctx.beginPath();
  ctx.arc(128, 64, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1530';
  ctx.beginPath();
  ctx.arc(135, 59, 12, 0, Math.PI * 2);
  ctx.fill();

  // Distant rigs on the horizon.
  ctx.fillStyle = '#0c1426';
  for (const [x, s] of [
    [30, 0.6],
    [300, 0.45],
    [380, 0.7],
  ] as const) {
    distantRig(ctx, x, HORIZON, s);
  }

  // Large derrick silhouette behind the playfield.
  ctx.strokeStyle = '#16233d';
  ctx.lineWidth = 3;
  derrick(ctx, 300, HORIZON + 40, 70, 250);
  return c;
}

function distantRig(ctx: Ctx, x: number, base: number, s: number): void {
  ctx.fillRect(x, base - 20 * s, 60 * s, 6 * s);
  ctx.fillRect(x + 6 * s, base - 14 * s, 4 * s, 14 * s);
  ctx.fillRect(x + 50 * s, base - 14 * s, 4 * s, 14 * s);
  ctx.beginPath();
  ctx.moveTo(x + 18 * s, base - 20 * s);
  ctx.lineTo(x + 28 * s, base - 70 * s);
  ctx.lineTo(x + 38 * s, base - 20 * s);
  ctx.fill();
  ctx.fillStyle = '#ff5a2a';
  ctx.fillRect(x + 27 * s, base - 72 * s, 2, 2);
  ctx.fillStyle = '#0c1426';
}

function derrick(ctx: Ctx, cx: number, base: number, halfW: number, height: number): void {
  const top = base - height;
  const tw = 10;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, base);
  ctx.lineTo(cx - tw, top);
  ctx.lineTo(cx + tw, top);
  ctx.lineTo(cx + halfW, base);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const y0 = base - (height * i) / n;
    const y1 = base - (height * (i + 1)) / n;
    const w0 = halfW - ((halfW - tw) * i) / n;
    const w1 = halfW - ((halfW - tw) * (i + 1)) / n;
    ctx.moveTo(cx - w0, y0);
    ctx.lineTo(cx + w1, y1);
    ctx.moveTo(cx + w0, y0);
    ctx.lineTo(cx - w1, y1);
    ctx.moveTo(cx - w1, y1);
    ctx.lineTo(cx + w1, y1);
  }
  ctx.stroke();
  ctx.fillStyle = '#16233d';
  ctx.fillRect(cx - 16, top - 8, 32, 8);
}

function drawSea(ctx: Ctx, t: number): void {
  const sea = ctx.createLinearGradient(0, HORIZON, 0, H);
  sea.addColorStop(0, '#0d1d3a');
  sea.addColorStop(1, '#030915');
  ctx.fillStyle = sea;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Flare reflection.
  const flick = 0.5 + 0.25 * Math.sin(t / 5) + 0.15 * Math.sin(t / 2.3);
  ctx.fillStyle = `rgba(255,120,40,${0.12 * flick})`;
  for (let y = HORIZON + 4; y < H; y += 6) {
    const w = 6 + (y - HORIZON) * 0.12 + Math.sin(t / 9 + y) * 4;
    ctx.fillRect(410 - w / 2, y, w, 2);
  }

  // Wave lines.
  for (let row = 0; row < 14; row++) {
    const y = HORIZON + 6 + row * row * 1.1;
    const amp = 1 + row * 0.25;
    ctx.strokeStyle = `rgba(120,170,230,${0.08 + row * 0.012})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const yy = y + Math.sin(x / (14 + row * 2) + t / (30 - row) + row) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawFlare(ctx: Ctx, t: number): void {
  // Flare boom from the right edge.
  ctx.strokeStyle = '#3a4a62';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W, 200);
  ctx.lineTo(420, 70);
  ctx.moveTo(W, 186);
  ctx.lineTo(426, 70);
  for (let i = 0; i < 6; i++) {
    const a = i / 6;
    const b = (i + 1) / 6;
    ctx.moveTo(W + (420 - W) * a, 200 + (70 - 200) * a);
    ctx.lineTo(W + (426 - W) * b, 186 + (70 - 186) * b);
  }
  ctx.stroke();

  const x = 423;
  const y = 66;
  const glow = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 60);
  const f = 0.75 + 0.25 * Math.sin(t / 4) * Math.sin(t / 7.3);
  glow.addColorStop(0, `rgba(255,170,60,${0.45 * f})`);
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 60, y - 70, 120, 120);

  const layers: [string, number][] = [
    ['#ff3d10', 1],
    ['#ff8a1c', 0.7],
    ['#ffe27a', 0.4],
  ];
  for (const [col, s] of layers) {
    const h = (26 + Math.sin(t / 3 + s * 5) * 6 + Math.sin(t / 1.7) * 3) * s;
    const w = 9 * s + 2;
    const lean = Math.sin(t / 20) * 4 * s - 4 * s; // wind
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.5, x + lean, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.5, x + w, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#5a6a80';
  ctx.fillRect(x - 4, y, 8, 5);
}

function drawRigLegs(ctx: Ctx): void {
  ctx.fillStyle = '#2a3346';
  for (const x of [40, 220, 400]) {
    ctx.fillRect(x - 6, 494, 12, H - 494);
    ctx.fillStyle = '#3a465e';
    ctx.fillRect(x - 6, 494, 3, H - 494);
    ctx.fillStyle = '#2a3346';
  }
}

// ------------------------------------------------------------------ structures

function drawGirder(ctx: Ctx, g: Girder, isTop: boolean): void {
  const th = GIRDER_THICKNESS;
  ctx.fillStyle = C.steel;
  ctx.beginPath();
  ctx.moveTo(g.x1, g.y1);
  ctx.lineTo(g.x2, g.y2);
  ctx.lineTo(g.x2, g.y2 + th);
  ctx.lineTo(g.x1, g.y1 + th);
  ctx.closePath();
  ctx.fill();

  // Top/bottom flanges.
  ctx.strokeStyle = C.steelLight;
  ctx.lineWidth = 1;
  line(ctx, g.x1, g.y1 + 0.5, g.x2, g.y2 + 0.5);
  ctx.strokeStyle = C.steelDark;
  line(ctx, g.x1, g.y1 + th - 0.5, g.x2, g.y2 + th - 0.5);

  // Truss zig-zag.
  ctx.beginPath();
  const step = 10;
  for (let x = g.x1; x < g.x2; x += step) {
    const x2 = Math.min(x + step, g.x2);
    const xm = (x + x2) / 2;
    ctx.moveTo(x, surfaceY(g, x) + th - 2);
    ctx.lineTo(xm, surfaceY(g, xm) + 2);
    ctx.lineTo(x2, surfaceY(g, x2) + th - 2);
  }
  ctx.stroke();

  if (isTop) {
    // Helideck-style hazard edge on the rescue platform.
    for (let x = g.x1; x < g.x2; x += 8) {
      ctx.fillStyle = (x / 8) % 2 === 0 ? '#111' : '#ffd21f';
      ctx.fillRect(x, g.y1 - 3, 8, 3);
    }
  }
}

function drawLadder(ctx: Ctx, l: Ladder): void {
  const top = l.top + GIRDER_THICKNESS;
  const x0 = l.x - 7;
  const x1 = l.x + 7;
  ctx.fillStyle = C.ladderDark;
  for (let y = l.bottom - 5; y > top; y -= 7) ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.fillStyle = C.ladder;
  ctx.fillRect(x0 - 1, top, 2, l.bottom - top);
  ctx.fillRect(x1 - 1, top, 2, l.bottom - top);
}

function drawOilDrum(ctx: Ctx, t: number, flare: number): void {
  const g = GIRDERS[0];
  const base = surfaceY(g, OIL_DRUM_X);
  const x = OIL_DRUM_X - 12;
  const y = base - 30;
  ctx.fillStyle = '#1d3d66';
  ctx.fillRect(x, y, 24, 30);
  ctx.fillStyle = C.barrelBand;
  ctx.fillRect(x, y + 3, 24, 2);
  ctx.fillRect(x, y + 25, 24, 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OIL', OIL_DRUM_X, y + 18);
  // Fire on top.
  const big = 1 + flare / 25;
  for (let i = 0; i < 4; i++) {
    const h = (8 + Math.abs(Math.sin(t / 4 + i * 1.7)) * 8) * big;
    ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff5a1a';
    ctx.beginPath();
    ctx.moveTo(x + 2 + i * 5, y);
    ctx.lineTo(x + 5 + i * 5, y - h);
    ctx.lineTo(x + 8 + i * 5, y);
    ctx.fill();
  }
}

function drawBarrelStack(ctx: Ctx): void {
  const g = GIRDERS[BOSS_GIRDER];
  const by = surfaceY(g, 14);
  for (const [dx, dy] of [
    [6, 0],
    [20, 0],
    [13, 1],
  ] as const) {
    const x = dx;
    const y = by - 18 - dy * 18;
    uprightBarrel(ctx, x, y);
  }
}

function uprightBarrel(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = C.barrel;
  ctx.fillRect(x - 6, y, 12, 18);
  ctx.fillStyle = C.barrelBand;
  ctx.fillRect(x - 6, y + 3, 12, 1);
  ctx.fillRect(x - 6, y + 14, 12, 1);
}

// ------------------------------------------------------------------ actors

function drawBarrel(ctx: Ctx, b: Barrel): void {
  ctx.save();
  ctx.translate(Math.round(b.x), Math.round(b.y));
  if (b.state === 'ladder') {
    // Seen end-on while dropping down a ladder.
    ctx.fillStyle = C.barrel;
    ctx.beginPath();
    ctx.ellipse(0, 0, BARREL_R + 3, BARREL_R - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.barrelBand;
    ctx.fillRect(-BARREL_R - 2, -3, 2 * BARREL_R + 4, 1);
    ctx.fillRect(-BARREL_R - 2, 2, 2 * BARREL_R + 4, 1);
  } else {
    ctx.rotate(b.spin);
    ctx.fillStyle = C.barrel;
    ctx.beginPath();
    ctx.arc(0, 0, BARREL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.barrelBand;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, BARREL_R - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-BARREL_R + 3, 0);
    ctx.lineTo(BARREL_R - 3, 0);
    ctx.stroke();
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-1.5, -BARREL_R + 1, 3, 3); // bung
  }
  ctx.restore();
}

function drawPlayer(ctx: Ctx, p: Player, t: number, deathTick: number): void {
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));

  if (deathTick >= 0) {
    // Spin, then lie flat.
    if (deathTick < 60) ctx.rotate((Math.floor(deathTick / 6) * Math.PI) / 2);
    else {
      ctx.rotate(Math.PI / 2);
      ctx.translate(-8, 0);
    }
    if (deathTick < 60) ctx.translate(0, 14);
  } else if (p.dir < 0) ctx.scale(-1, 1);

  const climbing = p.state === 'ladder';
  const stride = Math.floor(p.walkDist / 6) % 2;

  // Legs & boots.
  ctx.fillStyle = C.overallsDark;
  if (climbing) {
    const s = stride ? 3 : -3;
    ctx.fillRect(-6, -10 + s, 5, 8);
    ctx.fillRect(1, -10 - s, 5, 8);
    ctx.fillStyle = C.boot;
    ctx.fillRect(-6, -3 + s, 5, 3);
    ctx.fillRect(1, -3 - s, 5, 3);
  } else if (p.state === 'air') {
    ctx.fillRect(-6, -10, 5, 7);
    ctx.fillRect(2, -11, 5, 6);
    ctx.fillStyle = C.boot;
    ctx.fillRect(-7, -3, 7, 3);
    ctx.fillRect(3, -6, 7, 3);
  } else {
    const s = stride ? 2 : 0;
    ctx.fillRect(-6 + s, -10, 5, 8);
    ctx.fillRect(1 - s, -10, 5, 8);
    ctx.fillStyle = C.boot;
    ctx.fillRect(-6 + s, -3, 6, 3);
    ctx.fillRect(1 - s, -3, 7, 3);
  }

  // Torso: orange overalls with reflective strip.
  ctx.fillStyle = C.overalls;
  ctx.fillRect(-7, -18, 14, 9);
  ctx.fillStyle = '#e8f0ff';
  ctx.fillRect(-7, -14, 14, 2);
  ctx.fillStyle = C.overallsDark;
  ctx.fillRect(-4, -18, 2, 4);
  ctx.fillRect(2, -18, 2, 4);

  // Arms.
  ctx.fillStyle = C.overalls;
  if (climbing) {
    const s = stride ? -3 : 3;
    ctx.fillRect(-9, -24 + s, 3, 8);
    ctx.fillRect(6, -24 - s, 3, 8);
  } else if (p.wrench > 0) {
    ctx.fillRect(3, -20, 7, 3);
  } else {
    ctx.fillRect(-9, -18, 3, 7);
    ctx.fillRect(5, -18, 4, 7);
    ctx.fillStyle = C.skin;
    ctx.fillRect(5, -12, 4, 2);
  }

  // Head.
  ctx.fillStyle = C.skin;
  ctx.fillRect(-5, -24, 10, 7);
  if (!climbing) {
    ctx.fillStyle = '#000';
    ctx.fillRect(2, -23, 2, 2);
    ctx.fillStyle = '#5a3015';
    ctx.fillRect(1, -19, 5, 2); // moustache
  }

  // Hard hat.
  ctx.fillStyle = C.hat;
  ctx.fillRect(-6, -29, 12, 5);
  ctx.fillRect(-7, -25, 16, 2);
  ctx.fillStyle = '#fff3a0';
  ctx.fillRect(-3, -28, 3, 2);

  if (p.wrench > 0 && deathTick < 0) {
    const up = Math.floor(t / 8) % 2 === 0;
    if (up) drawWrench(ctx, 9, -34, -0.3);
    else drawWrench(ctx, 18, -16, Math.PI / 2 - 0.2);
  }
  ctx.restore();
}

function drawWrench(ctx: Ctx, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#c9d3dd';
  ctx.fillRect(-2, -2, 4, 18); // handle
  ctx.beginPath();
  ctx.arc(0, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.fillRect(-2, -12, 4, 7); // jaw opening
  ctx.fillStyle = '#7d8a96';
  ctx.fillRect(-1, 4, 2, 10);
  ctx.restore();
}

function drawBoss(ctx: Ctx, t: number, throwTick: number, defeated: boolean): void {
  const g = GIRDERS[BOSS_GIRDER];
  const feet = surfaceY(g, BOSS_X);
  ctx.save();
  ctx.translate(BOSS_X, Math.round(feet));
  const lifting = throwTick > 0 && throwTick < 36;
  const thrown = throwTick >= 36;
  const beat = !lifting && !thrown && !defeated && Math.floor(t / 10) % 6 < 2;

  // Legs.
  ctx.fillStyle = C.fur;
  ctx.fillRect(-18, -14, 12, 14);
  ctx.fillRect(6, -14, 12, 14);
  // Body & chest.
  ctx.fillRect(-22, -40, 44, 28);
  ctx.fillStyle = C.furLight;
  ctx.fillRect(-14, -36, 28, 20);
  ctx.fillStyle = C.fur;
  ctx.fillRect(-1, -34, 2, 16);

  // Arms.
  ctx.fillStyle = C.fur;
  if (lifting) {
    ctx.fillRect(-28, -64, 10, 30);
    ctx.fillRect(18, -64, 10, 30);
    // Barrel overhead (edge-on).
    ctx.fillStyle = C.barrel;
    ctx.fillRect(-16, -74, 32, 16);
    ctx.fillStyle = C.barrelBand;
    ctx.fillRect(-16, -70, 32, 2);
    ctx.fillRect(-16, -62, 32, 2);
  } else if (thrown) {
    ctx.fillRect(-30, -40, 10, 24);
    ctx.fillRect(20, -34, 30, 9);
  } else if (beat) {
    ctx.fillRect(-20, -34, 16, 9);
    ctx.fillRect(4, -34, 16, 9);
  } else {
    ctx.fillRect(-30, -38, 10, 34);
    ctx.fillRect(20, -38, 10, 34);
  }

  // Head with hard hat.
  ctx.fillStyle = C.fur;
  ctx.fillRect(-14, -56, 28, 18);
  ctx.fillStyle = C.furLight;
  ctx.fillRect(-10, -48, 20, 9);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-9, -53, 6, 4);
  ctx.fillRect(3, -53, 6, 4);
  ctx.fillStyle = defeated ? '#000' : '#e01010';
  ctx.fillRect(-6, -52, 3, 3);
  ctx.fillRect(3, -52, 3, 3);
  ctx.fillStyle = '#000';
  // Angry brows.
  ctx.beginPath();
  ctx.moveTo(-11, -57);
  ctx.lineTo(-2, -54);
  ctx.lineTo(-2, -52);
  ctx.lineTo(-11, -55);
  ctx.moveTo(11, -57);
  ctx.lineTo(2, -54);
  ctx.lineTo(2, -52);
  ctx.lineTo(11, -55);
  ctx.fill();
  // Mouth: teeth when throwing.
  ctx.fillRect(-6, -43, 12, 3);
  if (thrown || lifting) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-5, -43, 10, 1);
  }
  ctx.fillStyle = C.hat;
  ctx.fillRect(-15, -64, 30, 8);
  ctx.fillRect(-18, -57, 36, 3);
  ctx.fillStyle = '#c99a00';
  ctx.fillRect(-2, -64, 4, 8);
  ctx.restore();
}

function drawRescuee(ctx: Ctx, t: number, saved: boolean): void {
  const g = GIRDERS[TOP_GIRDER];
  ctx.save();
  ctx.translate(RESCUEE_X, g.y1);
  const wave = Math.floor(t / 12) % 2;
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-5, -3, 4, 3);
  ctx.fillRect(1, -3, 4, 3);
  ctx.fillStyle = '#2e6fd8';
  ctx.fillRect(-5, -12, 4, 9);
  ctx.fillRect(1, -12, 4, 9);
  ctx.fillRect(-6, -20, 12, 9);
  ctx.fillStyle = '#e8f0ff';
  ctx.fillRect(-6, -16, 12, 2);
  ctx.fillStyle = '#2e6fd8';
  ctx.fillRect(-9, -20, 3, 7);
  if (saved || wave) ctx.fillRect(6, -30, 3, 11);
  else ctx.fillRect(6, -26, 7, 3);
  ctx.fillStyle = C.skin;
  ctx.fillRect(-4, -26, 8, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(-2, -24, 1, 1);
  ctx.fillRect(2, -24, 1, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-5, -30, 10, 4);
  ctx.fillRect(-6, -27, 12, 2);
  ctx.restore();

  if (saved) {
    heart(ctx, RESCUEE_X + 18, g.y1 - 44);
  } else if (Math.floor(t / 40) % 3 !== 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HELP!', RESCUEE_X + 12, g.y1 - 30);
  }
}

function heart(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#ff3a6a';
  ctx.beginPath();
  ctx.arc(x - 4, y, 4, Math.PI, 0);
  ctx.arc(x + 4, y, 4, Math.PI, 0);
  ctx.lineTo(x, y + 9);
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------------ HUD & overlays

function drawHud(ctx: Ctx, game: Game): void {
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = C.hud;
  ctx.fillText('1UP', 12, 16);
  ctx.fillText('HIGH', 170, 16);
  ctx.fillStyle = C.text;
  ctx.fillText(pad(game.score), 12, 30);
  ctx.fillText(pad(game.high), 170, 30);

  // Bonus box.
  ctx.strokeStyle = '#4ea3ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(338, 6, 62, 30);
  ctx.fillStyle = '#4ea3ff';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('BONUS', 352, 17);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = game.bonus <= 1000 && game.tick % 30 < 15 ? '#ff4040' : C.text;
  ctx.fillText(String(game.bonus).padStart(4, '0'), 354, 31);

  // Lives as little hard hats.
  for (let i = 0; i < game.lives - (game.phase === 'dying' ? 1 : 0); i++) {
    ctx.fillStyle = C.hat;
    ctx.fillRect(12 + i * 16, 38, 10, 4);
    ctx.fillRect(11 + i * 16, 41, 13, 2);
  }
}

function drawOverlay(ctx: Ctx, game: Game): void {
  const panel = (lines: [string, string, number][]) => {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    const h = lines.length * 22 + 26;
    ctx.fillRect(40, H / 2 - h / 2 - 20, W - 80, h);
    ctx.strokeStyle = C.hat;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, H / 2 - h / 2 - 20, W - 80, h);
    ctx.textAlign = 'center';
    lines.forEach(([text, color, size], i) => {
      ctx.font = `bold ${size}px monospace`;
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, H / 2 - h / 2 + 8 + i * 22);
    });
  };
  const blink = Math.floor(game.tick / 30) % 2 === 0;
  switch (game.phase) {
    case 'title':
      panel([
        ['RINKEY KING', C.hat, 26],
        ['Offshore Rescue', '#9fd0ff', 13],
        ['', '#fff', 12],
        ['Arrows/WASD move & climb', '#fff', 12],
        ['Space jump   P pause   M mute', '#fff', 12],
        [blink ? 'PRESS ENTER' : '', C.hud, 14],
      ]);
      break;
    case 'won':
      panel([
        ['WORKER RESCUED!', '#7dff8a', 22],
        [`Bonus ${game.bonus}   Score ${game.score}`, '#fff', 14],
        [blink ? 'PRESS ENTER TO PLAY AGAIN' : '', C.hud, 12],
      ]);
      break;
    case 'gameover':
      panel([
        ['GAME OVER', '#ff4a4a', 24],
        [`Score ${game.score}`, '#fff', 14],
        [blink ? 'PRESS ENTER TO RESTART' : '', C.hud, 12],
      ]);
      break;
    case 'playing':
      if (game.paused) panel([['PAUSED', '#fff', 20]]);
      break;
    default:
      break;
  }
}

function pad(n: number): string {
  return String(n).padStart(6, '0');
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
