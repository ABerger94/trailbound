#!/usr/bin/env python3
"""Build the deployable Trailbound Game Boy shell: inject game.html's JS into shell-template.html."""
import re, pathlib

base = pathlib.Path('/home/hatch/workspace/games/trailbound')
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

template = (base / 'shell-template.html').read_text()
assert '/*__GAME_JS__*/' in template
out = template.replace('/*__GAME_JS__*/', game_js, 1)

deploy = base / 'deploy'
deploy.mkdir(exist_ok=True)
(deploy / 'index.html').write_text(out)
print('wrote', deploy / 'index.html', len(out), 'bytes')
