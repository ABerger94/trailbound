# Trailbound

A 2D top-down puzzle-adventure: switch between Theo (boy explorer) and Pip (his dog) to solve each trail and find Grandfather's compass. Single self-contained file — just open `game.html` in a browser (desktop or mobile).

## Controls

**Keyboard**
| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Space | Action (context: push happens by walking; dig, bark, lever, rope, signpost) |
| Tab | Switch character |
| F | Whistle — toggle Pip follow / stay |
| X | Throw stick (as Theo — sends Pip to that spot) |

**Touch**
- Left thumb: virtual joystick (dynamic origin — touch anywhere left half)
- Right side: ACTION (big), SWITCH (big, amber), WHISTLE (small), STICK (small)

## The rules in short
- **Theo:** ladders, crates, keys, gates, levers, signposts, rope anchors, relics. Blocked by water and tunnels.
- **Pip:** tunnels, water, digging, barking, scent trails. Faster. Blocked by ladders. Can't carry keys or the relic.
- **Badgers** nap. Get too close as Theo and you'll get chased back to the trailhead. Bark as Pip to lure one away for 6 seconds.
- Finish a trail by getting **both** characters to the campsite (tent). If the trail has a relic, Theo must grab it first.

## Files
- `game.html` — the whole game (levels embedded as `const LEVELS` between `// __LEVELS_START__` / `// __LEVELS_END__` markers)
- `shell-template.html` — Game Boy-style shell (portrait + landscape) that the deploy build wraps around the game
- `build-gb.py` — builds the shell: `python3 build-gb.py` → writes `deploy/index.html`
- `verify.js` — headless test harness: `node verify.js` (game engine + shell markup assertions)
- `deploy/index.html` — the built, deployable file (what goes on Vercel)
- `DESIGN.md` — one-page design doc
- `SOLUTION.md` — step-by-step solution for each trail
- `README.md` — this file

## Game Boy shell build (deploy)
`deploy/index.html` is generated — never edit it by hand:
1. Edit `game.html` and/or `shell-template.html`.
2. Run `python3 build-gb.py` (repo-relative; works from any checkout).
3. Sanity: extract the script and `node --check` it, then `node verify.js` (must be all-pass).
4. Commit `game.html`, `shell-template.html`, `build-gb.py`, `verify.js`, **and** `deploy/index.html` together.

Shell controls: analog joystick (drag the knob — diagonals work, tilt controls speed) + A (action) / B (switch) / START (whistle) / SELECT (stick). Portrait shows the Game Boy Color shell; landscape phones get the GBA-style wide shell.

## How to add / edit a trail
1. Open `game.html`, find the `LEVELS` array.
2. Copy an existing level object. A level is:
   ```js
   {
     name: "Trail name",
     intro: "One or two lines of story.",
     map: [ "20 chars x", /* ... 12 rows total, each exactly 20 chars ... */ ],
     signs: { "x,y": "Hint text shown at that signpost." },
     rope: { ax: 8, ay: 5, tx: 8, ty: 6 },   // optional: anchor -> target tile
     leverDoor: true,                          // level has one V/d pair
     plateDoor: true,                          // plates drive the q pressure-door circuit
     badgerFast: true,                         // badger chases faster than Theo can run
     relic: true,                              // Theo must grab R before exit counts
     solution: [ "Step 1...", "Step 2..." ]    // REQUIRED: prove it's beatable
   }
   ```
3. Tile legend (single characters):
   - `#` wall/cliff (solid) · `.` grass · `,` dirt path · `T` tree (solid)
   - `W` water (Pip only) · `=` tunnel (Pip only) · `L` ladder (Theo only)
   - `A` rope anchor (Theo + ACTION drops rope to `rope.tx,rope.ty`)
   - `C` crate (Theo pushes) · `D` dig mound (Pip digs → key) · `k` key (Theo picks up)
   - `G` locked gate (Theo + key) · `V` lever / `d` stone door (lever circuit — latches open)
   - `q` copper door (pressure circuit — open only while a plate is held)
   - `o` pressure plate (held by Theo, Pip, or a crate) · `~` ice (Theo slides, Pip walks)
   - `B` badger · `R` relic (Theo) · `F` firefly · `S` signpost
   - `E` campsite exit · `P` Theo start · `p` Pip start · `h` hidden scent trail (Pip reveals)
4. Write the `solution` walkthrough FIRST, then trace every step against your map. If a step doesn't work on the map, the map is wrong.
5. Keep maps exactly 20 columns × 12 rows. Border should be `#` all around.
6. Test: open `game.html`, play the trail end-to-end with both keyboard and (if you can) touch. Check the console for errors.
