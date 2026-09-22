# TrailBound — Engine Spec (Pack 1 as built, 2026-09-22; Pack 2 addendum same day)

**Scope:** this is a spec only. No trails designed, no maps written, no edits to game.html. §6 documents the Pack 2 (Trails 6–10) engine changes; everything else below describes Pack 1 as built.

## 1. LEVELS array format

`const LEVELS` lives between `// __LEVELS_START__` / `// __LEVELS_END__` (game.html lines ~185–353). Each level is one object:

```js
{
  name: "Trail name",                 // shown in HUD + intro card
  intro: "One or two lines of story.",
  map: [ /* exactly 12 rows, each exactly 20 chars */ ],
  signs: { "x,y": "Hint text" },      // optional; S tiles looked up by grid coords
  rope: { ax, ay, tx, ty },           // OPTIONAL; anchor tile -> rope-drop target tile
  leverDoor: true|false,              // level has one V lever / d door pair
  plateDoor: true|false,              // level has a pressure circuit: o plates drive q doors (see §6)
  badgerFast: true|false,             // when true, badger chase speed is THEO_SPEED*1.15 (default *0.9)
  relic: true|false,                  // if true, Theo must grab R before exit counts
  solution: [ "...", ... ]            // REQUIRED: numbered walkthrough, traced against the map
}
```

- Grid: `TILE = 48`, `COLS = 20`, `ROWS = 12`; canvas 960x640 with a 64px HUD strip (`HUD_H`). Maps must be `#`-bordered.
- Parsing (in `loadLevel()`): `P`/`p`/`B`/`C` chars are extracted into entities (`G.theo`, `G.pip`, `G.badger`, `G.crates[]`) and their grid cells reset to `.`. Everything else stays in `G.grid`.
- Per-level runtime state on `G`: `controlled` ('theo'|'pip'), `pipFollow` (bool), `fireflyCount`, `hasKey`, `hasRelic`, `doorOpen`, `leverOn`, `ropeDown`, `dug {}` (mound keys), `revealedH {}` (scent keys), `stick`, `pipTarget`.

## 2. Tile legend

| Char | Name | Behavior |
|---|---|---|
| `#` | wall/cliff | solid for everyone (also the out-of-bounds fallback) |
| `.` | grass | walkable |
| `,` | dirt path | walkable (digged mound `D` becomes `,` after digging) |
| `T` | tree | solid for everyone; blocks badger line-of-sight |
| `W` | water | Pip only; Theo + badger blocked |
| `=` | tunnel | Pip only; Theo blocked |
| `L` | ladder | Theo only; Pip blocked |
| `A` | rope anchor | Theo + ACTION drops rope → target tile (`rope.tx,rope.ty`) becomes walkable |
| `C` | crate | dynamic entity (see §3); Theo pushes, solid for others |
| `D` | dig mound | Pip digs (ACTION) → key `k` pops to adjacent free tile |
| `k` | key | Theo walks over → picks up (HUD key icon) |
| `G` | locked gate | solid; Theo with key walks into it → becomes `.` (key consumed) |
| `V` | lever | ACTION by either char; opens the level's `d` door(s) permanently (lever circuit) |
| `d` | stone door | solid until `G.doorOpen` (set by lever; never by plates) |
| `q` | copper door | solid until `G.plateOpen` (set while ≥1 `o` plate is pressed; Pack 2, see §6) |
| `B` | badger | spawns badger entity; cell becomes `.` |
| `R` | relic/compass | Theo walks over → picks up; required for exit when `relic:true` |
| `F` | firefly | either char walks over → collected; count only |
| `S` | signpost | Theo ACTION → shows `signs["x,y"]` hint bubble (4s) |
| `E` | campsite exit | level completes when Theo AND Pip both stand on E (and `hasRelic` if required) |
| `P` | Theo start | extracted, cell → `.` |
| `p` | Pip start | extracted, cell → `.` |
| `h` | hidden scent | invisible until Pip is within 3 tiles → paw prints shown (visual clue only) |
| `o` | pressure plate | walkable for everyone; pressed while a crate sits on it OR Theo OR Pip stands on it; with `plateDoor:true`, the level's `q` door(s) are open only while >=1 plate is pressed (re-close on release) |
| `~` | ice | walkable; Theo slides in his movement direction until non-ice, a solid block, or new input (overrides); Pip is sure-footed, no sliding |

**Used by Pack 2** (no longer free): `o` (plate), `~` (ice), `q` (copper door). Remaining free single chars: lowercase `a b c e f g i j l m n r s t u v w x y z` (only `d h k p` used); uppercase `H I J K M N O Q U X Y Z`; symbols `* + ^ : ; @`. Note `S` is signpost (uppercase S ≠ unused).

## 3. Movement rules

- **Free pixel movement, grid collision.** Characters have float pixel `x,y` and radius 13; each frame `moveChar()` tries X then Y separately via `boxCollides(px,py,r,who)`, which checks overlapped tiles against `solidAt(tx,ty,who)`. Partial axis moves are allowed (slide along walls).
- **Speeds:** Theo 152 px/s, Pip 196 px/s, badger 118 px/s, chase speed `THEO_SPEED*0.9` ≈ 137 px/s.
- **`gridSolid(tx,ty,who)`** — who is `'theo' | 'pip' | 'badger'`: `W`/`=` pass only Pip; `L` passes only Theo; `G` always solid (unlock rewrites grid); `d` solid until `G.doorOpen`; `q` solid until `G.plateOpen`; rope target tile solid until `G.ropeDown`; `#`,`T` always solid. Badger moves with `who='badger'` (blocked by W, =, L).
- **Crates** are grid-aligned entities in `G.crates`. Theo pushes: `tryPushCrate()` fires when Theo is blocked; crate moves 1 tile if destination is in-bounds, `gridSolid(tx,ty,'theo')`-free, crate-free, and not occupied by either character's current tile. Pip cannot push. Crates are solid for everyone in `solidAt()`.
- **Lever/door:** `flipLever()` sets `G.doorOpen=true`, `G.leverOn=true` (permanent; one pair per level via `leverDoor` flag). Either character can flip with ACTION when adjacent. Levers never touch the pressure circuit (see §6).
- **Keys/gates:** Theo picks up `k` by walking over (`checkPickups()`); unlock happens automatically in `moveChar()` when blocked and `G.hasKey` — the `G` tile becomes `.`, key consumed.
- **Badger AI** (`updateBadger()`): states `nap → chase → return → nap`, plus `curious → sniff → return`. Wakes if Theo within 2.5 tiles with clear line-of-sight (Bresenham `losClear()`; `#`/`T` block). Chase: BFS repath every 0.4s, gives up if unreachable or Theo > 7 tiles for 2s. On catch (dist < 0.75 tiles): Theo teleports back to level start `G.P` (keeps key/relic/fireflies), screen flash, badger returns home. Pip's ACTION = bark: within 5 tiles, badger switches to `curious`, BFS-paths to Pip's tile, then `sniff` for 6s (ignores Theo), then `return`. While curious/sniff/return the badger ignores Theo.
- **Water:** Pip-only via `gridSolid`; entering water triggers splash particles + sound. Theo blocked.
- **Tunnels:** Pip-only tiles; Pip walks through them freely (no teleport — they're just passable corridors).
- **Rope:** Theo stands on anchor tile `A` and presses ACTION → `dropRope()` sets `G.ropeDown`; target tile becomes walkable (`gridSolid` checks `L.rope.tx/ty`). Rope is drawn hanging on target tile.
- **Switching:** `switchChar()` (Tab / SWITCH button) flips `G.controlled` instantly; the other character idles. **Pip autonomy (only while Theo is controlled):** if stick thrown → fetch target; else if `pipFollow` → follow within 2.2 tiles (hysteresis 1.5); else sit/stay. Theo never auto-follows.
- **Stick throw:** Theo (X key / STICK button) throws up to 4 tiles along dominant facing direction (stops at Pip-blocked tiles); Pip auto-fetches (manual Pip movement cancels the fetch).
- **Exit:** `checkExit()` — both on `E` and (`!L.relic || G.hasRelic`) → `G.mode='win'`.

## 4. Registering a new tile type

Given a new map char (e.g. `o` for pressure plate, `~` for ice), touch these four places:

1. **Collision — `gridSolid(tx,ty,who)`:** add the rule (solid for whom? state-dependent like `d`/`rope`?). Crates-like entities instead go into `G.crates`-style list in `loadLevel()` and `solidAt()`.
2. **Rendering — `drawTile(tx,ty)`:** add an `else if (ch === 'X')` branch with canvas-primitive art. If the tile is invisible until revealed (like `h`), gate on `G.revealedH`-style state.
3. **Interaction — `doAction()`:** add the adjacent-tile ACTION branch (dig/bark/lever model), or pickup model (`checkPickups()`), or movement-triggered model (`digMound` is ACTION-triggered).
4. **Update — `update(dt)`:** if the tile has ongoing behavior (scent reveal loop, water splash check), add a per-frame scan or hook into the existing char-tile checks.
5. Supporting: `loadLevel()` entity extraction (if the char becomes a dynamic entity), HUD icons (if it grants an item like `k`/`R`), `G` state fields (`leverDoor`/`rope`-style flags), and the README legend (`How to add / edit a trail`, step 3).

## 5. How pack 1 was tested

- **Manual playthrough (Pack 1):** README §"How to add / edit a trail" step 6: "Test: open game.html, play the trail end-to-end with both keyboard and (if you can) touch. Check the console for errors."
- **Automated headless harness (Pack 2, covers all 10 trails):** `verify.js` (node) extracts the `<script>` from `game.html`, runs it in a `vm` sandbox with stubbed DOM/canvas/audio, and asserts: 12×20 `#`-bordered maps, one P/p each, signs on `S` tiles, grid-BFS exit reachability for both characters, 5–20 sim-second update+draw soaks, and real-engine mechanic checks (plate hold/re-close, Theo crate-push vs Pip-can't, ice slide landings + relic pickup, badger bark→curious→sniff→return with Theo ignored, chase-speed fast-vs-normal, lever/plate circuit independence, rope drop). 282 assertions green as of 2026-09-22.
- **Solution-first discipline:** every level ships a `solution` array that must be written first and traced step-by-step against the map; DESIGN.md: "If a puzzle step can't be traced on the map, the map is wrong — fix the map."
- **Done criteria** (DESIGN.md): five completable trails, instant switching, touch + keyboard, HUD, win/completion screens, synthesized SFX, **zero console errors**.

## 6. Pack 2 addendum — the two door circuits (2026-09-22)

Pack 2's Trail 9 ("The Long Climb") needs a permanent lever door AND a pressure-held door in the same map, so the single shared `G.doorOpen` mechanism was split into two independent circuits:

- **Lever circuit:** `V` lever → `d` stone door. `flipLever()` sets `G.doorOpen=true` (permanent latch). `d` tiles check only `G.doorOpen` in `gridSolid()`.
- **Pressure circuit:** `o` plate → `q` copper door (new tile). Every frame, `update()` scans all `o` tiles; if ≥1 is pressed (crate on it, or Theo/Pip standing on it), `G.plateOpen=true`, else `false`. `q` tiles check only `G.plateOpen`. Re-closes the moment the last plate is released.
- The circuits never cross: a lever cannot open a `q` door, plates cannot open a `d` door. Trail 9 sets both `leverDoor:true` and `plateDoor:true` and relies on the independence (verified in `verify.js`).
- Rendering: `q` draws as a copper/amber slab door (distinct from the grey `d` stone door); `o` draws as a stone plate that sinks/glows while pressed.
- Pack 1 behavior is unchanged: no Pack 1 map contains `q`, and no Pack 1 level sets `plateDoor:true`, so the split is invisible to the original five trails.
- Ending text updated for the 10-trail arc: the final screen now reads **"The Map Is Finished!"** with Grandfather's-marker story payoff.
