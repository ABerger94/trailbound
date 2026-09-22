#!/usr/bin/env python3
"""Build the deployable Trailbound Game Boy shell: inject game.html's JS into shell-template.html."""
import re, pathlib

base = pathlib.Path(__file__).resolve().parent
game_html = (base / 'game.html').read_text()
m = re.search(r'<script>([\s\S]*)</script>', game_html)
assert m, 'no <script> block found in game.html'
game_js = m.group(1)

# The shell owns layout now: canvas fills its screen box via CSS.
old_fit = """// Fit canvas to screen preserving 3:2 aspect ratio.
function fitCanvas() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const scale = Math.min(ww / W, wh / H);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();"""
new_fit = """// Shell owns layout: the canvas fills its Game Boy screen box via CSS (width:100%).
function fitCanvas() { canvas.style.width = ''; canvas.style.height = ''; }"""
assert old_fit in game_js, 'fitCanvas block not found - game.html changed?'
game_js = game_js.replace(old_fit, new_fit)

# GB shell build: the shell's analog joystick writes the game's joy vector,
# so strip the on-canvas touch buttons and floating joystick from the
# deployed build to avoid double input.
# (game.html keeps them for standalone desktop play; verify.js is unaffected.)
game_js = game_js.replace('"use strict";', '"use strict";\nconst GB_SHELL = true;', 1)
old_touch = """  if (!isPlay()) return;
  if (hitCircle(p, BTN_ACTION)) { doAction(); return; }
  if (hitCircle(p, BTN_SWITCH)) { switchChar(); return; }
  if (hitCircle(p, BTN_WHISTLE)) { whistle(); return; }
  if (hitCircle(p, BTN_STICK)) { throwStick(); return; }
  if (p.x < W / 2 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = p.x; joy.oy = p.y; joy.dx = 0; joy.dy = 0;
  }"""
new_touch = """  if (!isPlay()) return;
  if (GB_SHELL) return; // shell buttons handle all play input (tap still advances intro/win/final)"""
assert old_touch in game_js, 'touch input block not found - game.html changed?'
game_js = game_js.replace(old_touch, new_touch)
old_draw = "if (G.mode === 'play') drawTouch();"
assert old_draw in game_js, 'drawTouch call not found - game.html changed?'
game_js = game_js.replace(old_draw, "if (G.mode === 'play' && !GB_SHELL) drawTouch();")

template = (base / 'shell-template.html').read_text()
assert '/*__GAME_JS__*/' in template
out = template.replace('/*__GAME_JS__*/', game_js, 1)

deploy = base / 'deploy'
deploy.mkdir(exist_ok=True)
(deploy / 'index.html').write_text(out)
print('wrote', deploy / 'index.html', len(out), 'bytes')
