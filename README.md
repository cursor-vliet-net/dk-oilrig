# Rig Kong — Offshore Rescue

A single-level Donkey Kong-style game set on an offshore oil rig at night.
TypeScript + Vite + HTML5 canvas, no framework, no image assets (everything is drawn procedurally).

## Run

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

## Code layout

- `src/main.ts` fixed-timestep (60 Hz) loop
- `src/game.ts` state machine, player / barrel / boss simulation, collisions, scoring
- `src/level.ts` girder & ladder geometry
- `src/render.ts` procedural renderer (sky, sea, flare stack, sprites, HUD)
- `src/input.ts` keyboard with edge detection
- `src/audio.ts` WebAudio beeps
