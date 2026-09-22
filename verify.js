/* TrailBound verification harness (node, headless) — pack 2 edition.
   Loads game.html's <script> in a vm sandbox with stubbed DOM/canvas/audio,
   then runs structural + real-engine assertions over all 10 trails.
   Engine semantics tested: 'q' = pressure door (plateDoor circuit),
   'd' = lever door (leverDoor circuit) — the two are independent. */
const fs = require('fs');
const vm = require('vm');

// ---------- stubs ----------
function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, p) {
      if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => grad;
      if (p === 'measureText') return () => ({ width: 10 });
      return (...a) => {};
    },
    set() { return true; }
  });
}
const canvasStub = {
  width: 960, height: 640, style: {},
  getContext: () => makeCtx(), addEventListener() {}
};
const sandbox = {
  document: { getElementById: () => canvasStub, addEventListener() {} },
  window: { innerWidth: 960, innerHeight: 640, addEventListener() {},
            AudioContext: undefined, webkitAudioContext: undefined },
  requestAnimationFrame: () => {},
  performance: { now: () => 0 },
  console, Math
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let src = fs.readFileSync(require('path').join(__dirname, 'game.html'), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];
src += `\n;globalThis.TB = { LEVELS, loadLevel, update, draw, doAction, switchChar,
  whistle, gridSolid, platePressed, tileCenter, tileOf, keys,
  getG: function () { return G; } };`;
vm.runInContext(src, sandbox, { filename: 'game.js' });
const TB = sandbox.TB;
const LEVELS = TB.LEVELS;

// ---------- assertion infra ----------
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); console.log('FAIL:', label); }
}
function eq(a, b, label) { ok(a === b, label + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

// grid BFS replicating engine solidity (doors assumed openable, gates keyed)
function passable(ch, who, L) {
  if (ch === '#' || ch === 'T') return false;
  if (ch === 'W') return who === 'pip';
  if (ch === '=') return who === 'pip';
  if (ch === 'L') return who === 'theo';
  if (ch === 'd') return !!(L.leverDoor || L.plateDoor);
  if (ch === 'q') return !!L.plateDoor;
  return true; // . , S E F R k V o ~ D h (+ P p B C treated as . below)
}
function bfs(map, L, sx, sy, who, tx, ty) {
  const clean = map.map(r => r.replace(/[PpBC]/g, '.'));
  if (L.rope) clean[L.rope.ty] = clean[L.rope.ty].substring(0, L.rope.tx) + '.' + clean[L.rope.ty].substring(L.rope.tx + 1);
  const seen = new Set([sx + ',' + sy]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    if (x === tx && y === ty) return true;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= 20 || ny >= 12 || seen.has(k)) continue;
      if (!passable(clean[ny][nx], who, L)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return false;
}
function find(map, ch) {
  const out = [];
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x, y]); });
  return out;
}
function frames(n) { for (let i = 0; i < n; i++) TB.update(1 / 60); }
function setPos(c, tx, ty) { const [cx, cy] = TB.tileCenter(tx, ty); c.x = cx; c.y = cy; }

// ================= A. structure: all 10 levels =================
eq(LEVELS.length, 10, 'LEVELS has 10 trails');
LEVELS.forEach((L, i) => {
  const tag = 'L' + (i + 1) + ' ' + L.name;
  try { TB.loadLevel(i); ok(true, tag + ': loadLevel no-throw'); }
  catch (e) { ok(false, tag + ': loadLevel threw: ' + e.message); return; }
  eq(L.map.length, 12, tag + ': 12 rows');
  L.map.forEach((row, y) => eq(row.length, 20, tag + ': row ' + y + ' is 20 cols'));
  const borderOk = L.map[0] === '#'.repeat(20) && L.map[11] === '#'.repeat(20) &&
    L.map.every(r => r[0] === '#' && r[19] === '#');
  ok(borderOk, tag + ': # border');
  eq(find(L.map, 'P').length, 1, tag + ': one Theo start');
  eq(find(L.map, 'p').length, 1, tag + ': one Pip start');
  eq(find(L.map, 'E').length >= 1, true, tag + ': has exit');
  if (L.signs) for (const k of Object.keys(L.signs)) {
    const [x, y] = k.split(',').map(Number);
    eq(L.map[y][x], 'S', tag + ': sign at ' + k);
  }
  if (L.rope) {
    ok(L.rope.ax >= 0 && L.rope.ax < 20 && L.rope.ay >= 0 && L.rope.ay < 12, tag + ': rope anchor in bounds');
    ok(L.rope.tx >= 0 && L.rope.tx < 20 && L.rope.ty >= 0 && L.rope.ty < 12, tag + ': rope target in bounds');
  }
  ok(Array.isArray(L.solution) && L.solution.length > 0, tag + ': solution present');
  const P = find(L.map, 'P')[0], p = find(L.map, 'p')[0], E = find(L.map, 'E')[0];
  ok(bfs(L.map, L, P[0], P[1], 'theo', E[0], E[1]), tag + ': Theo can reach E (grid)');
  ok(bfs(L.map, L, p[0], p[1], 'pip', E[0], E[1]), tag + ': Pip can reach E (grid)');
});

// ================= B. runtime soak: update+draw, no input =================
LEVELS.forEach((L, i) => {
  const tag = 'L' + (i + 1) + ' ' + L.name;
  try {
    TB.loadLevel(i);
    TB.getG().mode = 'play';
    frames(i === 7 ? 1200 : 300); // badger level gets a longer soak
    TB.draw();
    ok(true, tag + ': 5-20 sim-seconds + draw, no errors');
  } catch (e) { ok(false, tag + ': soak threw: ' + e.message); }
});

// ================= C. Trail 6: plates + crate (real engine) =================
{
  TB.loadLevel(5); const g = TB.getG(); g.mode = 'play';
  eq(TB.gridSolid(10, 6, 'theo'), true, 'T6: copper door closed at start');
  g.crates[0].tx = 9; g.crates[0].ty = 4; // crate pushed onto plate
  frames(5);
  eq(g.plateOpen, true, 'T6: plateOpen when crate on plate');
  eq(TB.gridSolid(10, 6, 'theo'), false, 'T6: copper door opens');
  eq(TB.gridSolid(10, 6, 'pip'), false, 'T6: copper door opens for Pip too');
  g.crates[0].tx = 11; g.crates[0].ty = 4; // crate off
  frames(5);
  eq(g.plateOpen, false, 'T6: plateOpen clears when crate leaves');
  eq(TB.gridSolid(10, 6, 'theo'), true, 'T6: door re-closes (hold-to-open)');
  ok(bfs(LEVELS[5].map, LEVELS[5], 12, 4, 'theo', 9, 4), 'T6: push lane to plate is walkable');
}
{
  // C2. real crate push via held key (not teleport): Theo pushes, Pip can't
  TB.loadLevel(5); const g = TB.getG(); g.mode = 'play';
  setPos(g.theo, 12, 4); setPos(g.pip, 2, 2);
  TB.keys['a'] = true;
  for (let i = 0; i < 90 && !(g.crates[0].tx === 9 && g.crates[0].ty === 4); i++) TB.update(1 / 60);
  TB.keys['a'] = false;
  eq(g.crates[0].tx + ',' + g.crates[0].ty, '9,4', 'T6: holding push key drives crate onto the plate');
  frames(5);
  eq(g.plateOpen, true, 'T6: pushed crate holds the door open');
  // Pip cannot push
  TB.loadLevel(5); const g2 = TB.getG(); g2.mode = 'play';
  setPos(g2.pip, 12, 4); g2.controlled = 'pip'; setPos(g2.theo, 2, 2);
  TB.keys['a'] = true; frames(40); TB.keys['a'] = false;
  eq(g2.crates[0].tx + ',' + g2.crates[0].ty, '11,4', 'T6: Pip cannot push crates');
}

// ================= D. Trail 7: ice slides (real engine) =================
{
  TB.loadLevel(6); const g = TB.getG(); g.mode = 'play';
  setPos(g.theo, 5, 3);
  TB.keys['s'] = true; frames(10); TB.keys['s'] = false; // step onto ice, release
  frames(150); // slide with no input
  let t = TB.tileOf(g.theo.x, g.theo.y);
  eq(t[0] + ',' + t[1], '5,8', 'T7: slide down column 5 lands on south shore (5,8)');
  eq(g.slide, null, 'T7: slide stops on shore');
  // island approach: column 12 from the south shore
  setPos(g.theo, 12, 8);
  TB.keys['w'] = true; frames(10); TB.keys['w'] = false;
  frames(150);
  t = TB.tileOf(g.theo.x, g.theo.y);
  eq(t[0] + ',' + t[1], '12,5', 'T7: slide up column 12 stops on the island (12,5)');
  eq(g.hasRelic, true, 'T7: island slide picks up the trail marker');
  eq(LEVELS[6].map[4][12], 'T', 'T7: tree blocks the one-slide shortcut');
}

// ================= E. Trail 8: fast badger bark (real engine) =================
{
  TB.loadLevel(7); const g = TB.getG(); g.mode = 'play';
  eq(LEVELS[7].badgerFast, true, 'T8: badgerFast flag set');
  setPos(g.pip, 6, 4); g.controlled = 'pip';
  const d = Math.hypot(g.pip.x - g.badger.x, g.pip.y - g.badger.y) / 48;
  ok(d <= 5, 'T8: bark spot (6,4) within 5 tiles of badger (d=' + d.toFixed(2) + ')');
  TB.doAction();
  eq(g.badger.state, 'curious', 'T8: bark makes badger curious');
  const seen = new Set();
  for (let i = 0; i < 700; i++) { TB.update(1 / 60); seen.add(g.badger.state); }
  ok(seen.has('sniff'), 'T8: badger reaches sniff state');
  ok(seen.has('return') || seen.has('nap'), 'T8: badger returns after sniff');
  // Theo standing in wake range during sniff/return is ignored (no catch)
  TB.loadLevel(7); const g2 = TB.getG(); g2.mode = 'play';
  setPos(g2.pip, 6, 4); g2.controlled = 'pip'; TB.doAction();
  frames(120); // badger en route / sniffing
  setPos(g2.theo, 8, 5); // within 2.5 tiles of badger home
  const before = TB.tileOf(g2.theo.x, g2.theo.y).join(',');
  frames(120);
  const after = TB.tileOf(g2.theo.x, g2.theo.y).join(',');
  eq(after, before, 'T8: distracted badger ignores Theo (no catch/teleport)');
}
// E2. chase-speed: fast ~175px/s vs normal ~137px/s
{
  function chaseSpeed(fastFlag) {
    TB.loadLevel(7); const g = TB.getG(); g.mode = 'play';
    const L = TB.LEVELS[7], saved = L.badgerFast; L.badgerFast = fastFlag;
    const b = g.badger;
    const [cx, cy] = TB.tileCenter(b.homeTx + 2, b.homeTy);
    g.theo.x = cx; g.theo.y = cy;
    frames(5);
    const woke = b.state === 'chase';
    const bx0 = b.x, by0 = b.y;
    frames(15);
    const pxs = Math.hypot(b.x - bx0, b.y - by0) * 4;
    L.badgerFast = saved;
    return woke ? pxs : -1;
  }
  const slow = chaseSpeed(false), fast = chaseSpeed(true);
  console.log('  measured chase px/s: slow=' + slow.toFixed(1) + ' fast=' + fast.toFixed(1));
  ok(slow > 100 && slow < 160, 'T8: normal chase speed ~137px/s');
  ok(fast > slow + 20, 'T8: badgerFast is meaningfully faster than normal');
}

// ================= F. Trail 9: lever + plates independent circuits =================
{
  TB.loadLevel(8); const g = TB.getG(); g.mode = 'play';
  eq(LEVELS[8].leverDoor, true, 'T9: leverDoor flag set');
  eq(LEVELS[8].plateDoor, true, 'T9: plateDoor flag set');
  const p = find(LEVELS[8].map, 'p')[0], V = find(LEVELS[8].map, 'V')[0];
  ok(bfs(LEVELS[8].map, LEVELS[8], p[0], p[1], 'pip', V[0], V[1]), 'T9: Pip can tunnel to the lever');
  // lever opens the STONE door only
  setPos(g.pip, 13, 7); g.controlled = 'pip'; TB.doAction();
  eq(g.doorOpen, true, 'T9: lever latches stone door open');
  eq(TB.gridSolid(5, 6, 'theo'), false, 'T9: stone door d walkable after lever');
  eq(g.plateOpen, false, 'T9: plates circuit untouched by lever');
  eq(TB.gridSolid(14, 10, 'theo'), true, 'T9: copper door q still closed (circuits independent)');
  // crate on plate opens the COPPER door only
  g.crates[0].tx = 8; g.crates[0].ty = 10; frames(5);
  eq(g.plateOpen, true, 'T9: plateOpen when crate on plate');
  eq(TB.gridSolid(14, 10, 'theo'), false, 'T9: copper door q opens');
  // rope
  setPos(g.theo, 10, 7); g.controlled = 'theo'; TB.doAction();
  eq(g.ropeDown, true, 'T9: rope drops from anchor');
  eq(TB.gridSolid(10, 8, 'theo'), false, 'T9: rope target walkable after drop');
  eq(TB.gridSolid(10, 8, 'pip'), false, 'T9: rope target walkable for Pip too');
}

// ================= G. Trail 10: co-op plate hold =================
{
  TB.loadLevel(9); const g = TB.getG(); g.mode = 'play';
  setPos(g.pip, 6, 6); g.pipFollow = false; // Pip holds plate o1 (stay)
  frames(5);
  eq(g.plateOpen, true, 'T10: Pip holding plate opens copper door');
  eq(TB.gridSolid(9, 7, 'theo'), false, 'T10: door q walkable while Pip holds');
  // crate takes over on the far plate, Pip released
  g.crates[0].tx = 14; g.crates[0].ty = 8;
  setPos(g.pip, 6, 5); frames(5);
  eq(g.plateOpen, true, 'T10: crate on far plate holds door after Pip steps off');
  eq(LEVELS[9].relic, true, "T10: relic required (Grandfather's marker)");
  ok(bfs(LEVELS[9].map, LEVELS[9], 10, 8, 'theo', 14, 8), 'T10: push lane to far plate walkable');
}

// ================= H. Shell analog joystick =================
{
  const shellHtml = fs.readFileSync(require('path').join(__dirname, 'deploy', 'index.html'), 'utf8');
  // Joystick markup: portrait + landscape bases with knobs
  ok(/id="joyBase"/.test(shellHtml), 'H: portrait joystick base present');
  ok(/id="joyNub"/.test(shellHtml), 'H: portrait joystick knob present');
  ok(/id="lJoyBase"/.test(shellHtml), 'H: landscape joystick base present');
  ok(/id="lJoyNub"/.test(shellHtml), 'H: landscape joystick knob present');
  // Old discrete arrow buttons must be gone from both shells
  ['btnUp', 'btnDown', 'btnLeft', 'btnRight', 'lUp', 'lDown', 'lLeft', 'lRight']
    .forEach(id => ok(!new RegExp('id="' + id + '"').test(shellHtml), 'H: arrow button ' + id + ' removed'));
  // Wiring: analog joystick drives the game's joy vector
  ok(/function bindJoystick/.test(shellHtml), 'H: bindJoystick defined');
  ok(/bindJoystick\('joyBase',\s*'joyNub'\)/.test(shellHtml), 'H: portrait joystick wired');
  ok(/bindJoystick\('lJoyBase',\s*'lJoyNub'\)/.test(shellHtml), 'H: landscape joystick wired');
  ok(/joy\.dx\s*=/.test(shellHtml) && /joy\.dy\s*=/.test(shellHtml), 'H: joystick writes joy.dx/joy.dy');
  ok(/setPointerCapture/.test(shellHtml), 'H: pointer capture for multitouch drag');
  ok(/maxR\s*\*\s*0\.18/.test(shellHtml), 'H: dead zone on travel radius');
  ok(/lostpointercapture/.test(shellHtml), 'H: reset on lost pointer capture');
  ok(/visibilitychange/.test(shellHtml) && /orientationchange/.test(shellHtml), 'H: reset on hide/rotate');
  // Engine still merges analog joy with keyboard and normalizes (diagonals full speed)
  const eng = fs.readFileSync(require('path').join(__dirname, 'game.html'), 'utf8');
  ok(/joy\.id!==null\)\s*\{\s*mx\s*\+=\s*joy\.dx;\s*my\s*\+=\s*joy\.dy/.test(eng) ||
     /if\s*\(\s*joy\.id\s*!==\s*null\s*\)\s*\{\s*mx\s*\+=\s*joy\.dx;\s*my\s*\+=\s*joy\.dy/.test(eng),
     'H: engine merges joy vector into movement');
  // Landscape canvas must be width-capped (aspect-safe), never height-capped:
  // width:100% + height:auto + max-height squishes the 3:2 picture.
  ok(!/#landScreenBox #game\{\s*max-height/.test(shellHtml), 'H: no height-clamp on landscape canvas (aspect would break)');
  ok(/#landScreenBox #game\{\s*max-width:\s*calc\(\(100dvh - 210px\) \* 1\.5\)/.test(shellHtml),
     'H: landscape canvas width-capped at 3:2 of the vertical budget');
  ok(/#landScreenBox #game\{\s*max-width:\s*calc\(\(100dvh - 150px\) \* 1\.5\)/.test(shellHtml),
     'H: compact landscape canvas width-capped at 3:2 of the vertical budget');
  // Action buttons / captions unchanged
  ok(/id="btnA"/.test(shellHtml) && /id="lStart"/.test(shellHtml), 'H: A/B/START/SELECT buttons kept');
  ok(/>whistle</.test(shellHtml) && />stick</.test(shellHtml), 'H: whistle/stick captions kept');
}

// ================= summary =================
console.log('\n==== RESULT: ' + pass + ' passed, ' + fail + ' failed ====');
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log(' - ' + f)); }
process.exit(fail ? 1 : 0);
