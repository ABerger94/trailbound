# Trailbound

A cozy 2D puzzle-adventure starring **Theo** (boy explorer) and **Pip** (his dog), wrapped in a Game Boy-style shell. Switch between the two — every puzzle needs both.

## Play

- **Desktop:** open `index.html` in any browser. Move with WASD/arrows, Space to act, Tab to switch character, F to whistle, X to throw a stick.
- **Mobile:** open the deployed site on your phone. Portrait shows a Game Boy Color-style shell; rotate to landscape for a Game Boy Advance-style layout. The on-device buttons do everything:
  - Joystick — drag to move (diagonals work; tilt controls speed)
  - A — act / advance
  - B — switch Theo ⇄ Pip
  - START — whistle
  - SELECT — throw stick

## Deploy

This is a static single-file site. On [Vercel](https://vercel.com): import this repo, no build step, no framework — deploy as-is.

## Build

`index.html` is generated from the game source plus the shell template:

```
python3 ../build-gb.py
```

Game logic lives in `../game.html` (verified with `node ../verify.js` — 282 assertions); the shell is `../shell-template.html`.
