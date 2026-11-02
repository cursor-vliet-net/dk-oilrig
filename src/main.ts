/** Entry point: wires input, audio, simulation and renderer into a fixed-step loop. */

import { Sfx } from './audio';
import { Game } from './game';
import { Input } from './input';
import { Renderer } from './render';

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const sfx = new Sfx();
const input = new Input(window, () => sfx.unlock());
const game = new Game(input, sfx);
const renderer = new Renderer(canvas.getContext('2d')!);

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc += Math.min(now - last, MAX_FRAME_MS);
  last = now;
  while (acc >= STEP_MS) {
    input.poll();
    game.update();
    acc -= STEP_MS;
  }
  renderer.draw(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Debug hook for automated checks.
(window as unknown as { game: Game }).game = game;
