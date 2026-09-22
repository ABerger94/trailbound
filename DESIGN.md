# Trailbound — Design Doc

**Pitch:** A 2D top-down puzzle-adventure about Theo, a boy explorer, and Pip, his dog, searching the wilds for his grandfather's lost compass. You control **one** of them at a time and **switch instantly** — every puzzle needs both.

## Core loop
Explore a hand-built zone → read the situation → switch to whoever has the right body for the job → pull off the maneuver → reunite at the campsite and move on. Collect fireflies along the way.

## Asymmetric abilities (the whole game)
| Theo (boy) | Pip (dog) |
|---|---|
| Climbs ladders | Squeezes through tunnels |
| Pushes heavy crates | Digs up buried items |
| Picks up / uses tools (keys, relic) | Swims (Theo can't) |
| Reads signposts, flips levers | Sniffs out hidden scent trails |
| Drops ropes from anchors | Barks to distract creatures |
| Throws a stick to send Pip somewhere | Runs faster than Theo |

**Switching:** one keypress (Tab / S) or one big touch button. The other character idles. Pip auto-follows Theo unless whistled to stay (F).

## Rules of the world
- Bodies are keys: a ladder might as well be a locked door if you're the dog.
- No fail state with teeth: the badger only ever scares Theo back to the trailhead. Keep it cozy.
- Every level is completable — verified with a solution walkthrough, not vibes.

## The five trails
1. **First Steps** — meadow. Learn to walk, switch, whistle, follow. No relic; just get both to camp.
2. **The Old Burrow** — Pip crawls a tunnel to flip a lever that opens Theo's gate.
3. **High Ledge** — Theo climbs to a plateau and drops a rope so Pip can join him at the high camp.
4. **Badger's Nap** — a badger naps in the only passage. Pip barks to lure it off; Theo sneaks through and grabs the relic. (Plus a pond only Pip can swim, with a firefly on it.)
5. **The Compass Vault** — the finale: dig up the rusty key, unlock the ruins, tunnel to the vault lever, bark past the badger, climb + rope to the compass itself.

## Story spine (light)
Theo's grandfather was an explorer. His compass went missing in the wilds years ago. Theo and Pip are going to bring it home. Each trail's intro is one or two lines; the ending is the payoff, not a twist.

## Art & sound direction
Warm storybook: soft greens, honeyed dirt, parchment UI, round soft characters. Everything drawn in code (canvas primitives) — no assets. Sound is synthesized WebAudio: barks, chimes, clunks, splashes. No recorded audio, no files.

## Pack 2 — The Grey Peaks (Trails 6–10)

**Premise:** the compass Theo found in Trail 5 doesn't point north — it points *up*, to the Grey Peaks, where Grandfather's old survey markers are still waiting. Five harder trails, same duo, no new characters: Theo and Pip, further and higher. Harder than Pack 1, but fair — every step traced, no pixel-perfect anything.

**New mechanics (all engine-supported before Pack 2 was mapped):**
- **Pressure plates (`o`) + copper doors (`q`):** a plate holds its door open only while something heavy sits on it — Theo, Pip, or a pushed crate. Step off and it shuts. Lever doors (`d`) are a separate circuit: levers latch, plates hold.
- **Crates:** Theo pushes them one tile at a time; Pip can't. The classic use: park a crate on a plate so both friends can move on.
- **Ice (`~`):** Theo can't walk on it — he slides in a straight line until shore, island, or solid ground. Pip is sure-footed. Each slide must be planned; entering the ice from the wrong side strands the line.
- **Fast badger (`badgerFast`):** one badger in the peaks outruns Theo. No more racing it — bark, distract, sneak.

**The five trails:**
6. **Stone and Weight** — the co-op tutorial: plates, a pushable crate, a copper door. Learn that weight is a tool.
7. **The Frozen Path** — ice. Slide Theo across the lake, then thread a single-column slide onto an island for Grandfather's trail marker.
8. **The Peak Badger** — the fast badger guards the only pass. Bark it away as Pip, sneak Theo through for the relic.
9. **The Long Climb** — the gauntlet: ice crossing, Pip's tunnel to a lever, Theo's rope down a grate, crate-on-plate for the copper door. Everything combined.
10. **The Last Campsite** — the warm ending: a two-character door (Pip holds the plate while Theo passes, then a crate takes over), Grandfather's marker, his last signpost, and the finished map.

**Ending:** "The Map Is Finished!" — the compass led home after all. Pip curls up by the fire; the map Theo drew is complete.

## What "done" means
Five completable trails, instant switching, touch + keyboard, HUD, win/completion screens, synthesized SFX, zero console errors. If a puzzle step can't be traced on the map, the map is wrong — fix the map.

**Pack 2 done:** Trails 6–10 completable and traced, the two door circuits verified independent, 282 headless assertions green (`verify.js`).
