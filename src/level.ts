/** Static level geometry: sloped rig decks (girders), ladders and fixed props. */

export const W = 448;
export const H = 512;

export interface Girder {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface Ladder {
  readonly x: number;
  /** Index of the girder at the foot of the ladder. */
  readonly lower: number;
  /** Index of the girder at the head of the ladder. */
  readonly upper: number;
  /** Surface y at the foot / head. */
  readonly bottom: number;
  readonly top: number;
}

export const GIRDER_THICKNESS = 10;

/** Index 0 is the bottom deck, 5 the boss deck, 6 the rescue platform. */
export const GIRDERS: readonly Girder[] = [
  { x1: 0, y1: 494, x2: 448, y2: 484 },
  { x1: 0, y1: 414, x2: 412, y2: 428 },
  { x1: 36, y1: 358, x2: 448, y2: 344 },
  { x1: 0, y1: 276, x2: 412, y2: 290 },
  { x1: 36, y1: 220, x2: 448, y2: 206 },
  { x1: 0, y1: 140, x2: 412, y2: 152 },
  { x1: 156, y1: 86, x2: 260, y2: 86 },
];

export const TOP_GIRDER = GIRDERS.length - 1;
export const BOSS_GIRDER = TOP_GIRDER - 1;

export function surfaceY(g: Girder, x: number): number {
  return g.y1 + ((g.y2 - g.y1) * (x - g.x1)) / (g.x2 - g.x1);
}

export function spans(g: Girder, x: number): boolean {
  return x >= g.x1 && x <= g.x2;
}

/** Direction (+1 right / -1 left) in which a barrel rolls on this girder. */
export function downhill(g: Girder): 1 | -1 {
  return g.y2 > g.y1 ? 1 : -1;
}

function ladder(x: number, lower: number): Ladder {
  const upper = lower + 1;
  return {
    x,
    lower,
    upper,
    bottom: surfaceY(GIRDERS[lower], x),
    top: surfaceY(GIRDERS[upper], x),
  };
}

export const LADDERS: readonly Ladder[] = [
  ladder(196, 0),
  ladder(370, 0),
  ladder(84, 1),
  ladder(250, 1),
  ladder(176, 2),
  ladder(330, 2),
  ladder(96, 3),
  ladder(264, 3),
  ladder(204, 4),
  ladder(380, 4),
  ladder(236, 5),
];

export const PLAYER_START = { x: 64, girder: 0 } as const;
export const OIL_DRUM_X = 20;
export const BOSS_X = 56;
export const BARREL_SPAWN_X = 96;
export const RESCUEE_X = 184;

/** Wrench power-ups: position of the hanging tool (centre). */
export const WRENCH_SPOTS: readonly { x: number; girder: number }[] = [
  { x: 400, girder: 2 },
  { x: 70, girder: 4 },
];
