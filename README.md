# RInkey Ding — Offshore Rescue

A single-level Donkey Kong-style game set on an offshore oil rig at night.
TypeScript + Vite + HTML5 canvas, no framework, no image assets (everything is drawn procedurally).

## Play

- Online: https://cursor-vliet-net.github.io/dk-oilrig/ (GitHub Pages, served from `docs/`)
- Offline, no npm: download `rinkey-ding.html` and open it in a browser. It is a single file with the game script inlined.

## Run from source

    npm install
    npm run dev      # http://localhost:5174
    npm run build    # type-check + static build in dist/

## Controls

| Key | Action |
| --- | --- |
| ← → / A D | walk |
| ↑ ↓ / W S | climb ladders |
| Space | jump |
| Enter | start / restart |
| P | pause |
| M | mute |

## Rebuild the single-file version

The standalone page is the Vite `index.html` with the bundled game script inlined:

    npx esbuild src/main.ts --bundle --minify --format=iife --target=es2020 --outfile=/tmp/game.js
    # inline /tmp/game.js into index.html in place of the <script type="module"> tag,
    # then save the result as rinkey-ding.html and copy it to docs/index.html

## Code layout

- `src/main.ts` fixed-timestep (60 Hz) loop
- `src/game.ts` state machine, player / barrel / boss simulation, collisions, scoring
- `src/level.ts` girder & ladder geometry
- `src/render.ts` procedural renderer (sky, sea, flare stack, sprites, HUD)
- `src/input.ts` keyboard with edge detection
- `src/audio.ts` WebAudio beeps
- `rinkey-ding.html` standalone build, `docs/index.html` is the same file for GitHub Pages
