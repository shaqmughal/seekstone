#!/usr/bin/env python3
"""Generate the Product Hunt payload-benchmark graphic (1270x760) as HTML+SVG.

Data source: README.md head-to-head table (packages/harness baseline reports).
Brand tokens: seekstone.dev src/styles/ds/colors.css.

Usage: python3 payload-benchmark-ph.gen.py, then render the HTML it prints
with headless Chrome (exact command printed at the end).
"""
import math
import os

W, H = 1270, 760

# bytes per query at 1k / 5k / 10k notes (decimal, from README table)
SERIES = [
    ("seekstone",           [1600, 1800, 2000],          ["1.6 KB", "1.8 KB", "2.0 KB"], True),
    ("mcpvault",            [1700, 1900, 2200],          ["1.7 KB", "1.9 KB", "2.2 KB"], False),
    ("obsidian-mcp-server", [55000, 47000, 47000],       ["55 KB", "47 KB", "47 KB"],   False),
    ("obsidian-mcp-pro",    [25000, 84000, 114000],      ["25 KB", "84 KB", "114 KB"],  False),
    ("obsidian-mcp",        [18000, 105000, 201000],     ["18 KB", "105 KB", "201 KB"], False),
    ("mcp-obsidian",        [9.8e6, 45e6, 95e6],         ["9.8 MB", "45 MB", "95 MB"],  False),
]

# brand tokens
BG        = "#110f18"   # neutral-925 page background
GRID      = "#2a2540"   # neutral-800 hairline
INK       = "#f1eefb"   # neutral-50 primary text
INK2      = "#a9a2c0"   # neutral-300 secondary text
MUTED     = "#8b84a3"   # neutral-400 muted text
VIOLET    = "#9a7dff"   # violet-400 — seekstone line (>=3:1 on BG, validated)
VIOLET_HI = "#b8a6ff"   # violet-300 — seekstone label text
AMBER     = "#fbbf24"   # amber-400 — secondary accent (hero stat)
GRAY_LINE = "#8b84a3"   # competitor lines (>=3:1 on BG, validated)

# plot geometry
X0, X1 = 150, 850            # plot x-range
YT, YB = 208, 645            # plot y-range: log10 8.0 (100 MB) .. 3.0 (1 KB)
LOG_TOP, LOG_BOT = 8.0, 3.0
NOTES = [1000, 5000, 10000]

def x_at(n):
    return X0 + (n - 1000) / 9000 * (X1 - X0)

def y_at(v):
    return YT + (LOG_TOP - math.log10(v)) / (LOG_TOP - LOG_BOT) * (YB - YT)

svg = []

# gridlines + y tick labels (decades)
DECADES = [(1e3, "1 KB"), (1e4, "10 KB"), (1e5, "100 KB"), (1e6, "1 MB"), (1e7, "10 MB"), (1e8, "100 MB")]
for v, lab in DECADES:
    y = y_at(v)
    svg.append(f'<line x1="{X0}" y1="{y:.1f}" x2="{X1}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
    svg.append(f'<text x="{X0-14}" y="{y:.1f}" dy="4" text-anchor="end" fill="{MUTED}" font-size="13">{lab}</text>')

# x tick labels
for n, lab in zip(NOTES, ["1,000 notes", "5,000 notes", "10,000 notes"]):
    x = x_at(n)
    svg.append(f'<text x="{x:.1f}" y="{YB+30}" text-anchor="middle" fill="{MUTED}" font-size="13">{lab}</text>')

# axis title
svg.append(f'<text x="{X0-14}" y="{YT-24}" text-anchor="start" fill="{MUTED}" font-size="12.5">search payload per query (log scale)</text>')

# competitor lines first (recessive), seekstone last (on top)
def polyline(vals):
    return " ".join(f"{x_at(n):.1f},{y_at(v):.1f}" for n, v in zip(NOTES, vals))

for name, vals, fmts, is_hero in SERIES:
    if is_hero:
        continue
    svg.append(f'<polyline points="{polyline(vals)}" fill="none" stroke="{GRAY_LINE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    for n, v in zip(NOTES, vals):
        svg.append(f'<circle cx="{x_at(n):.1f}" cy="{y_at(v):.1f}" r="4.5" fill="{GRAY_LINE}" stroke="{BG}" stroke-width="2"/>')

# seekstone hero line
hero = SERIES[0]
svg.append(f'<polyline points="{polyline(hero[1])}" fill="none" stroke="{VIOLET}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
for n, v in zip(NOTES, hero[1]):
    svg.append(f'<circle cx="{x_at(n):.1f}" cy="{y_at(v):.1f}" r="5.5" fill="{VIOLET}" stroke="{BG}" stroke-width="2"/>')

# direct end labels (identity channel — every series)
# manual y to resolve the seekstone/mcpvault overlap at the bottom
END_LABELS = {
    "mcp-obsidian":        None,   # computed
    "obsidian-mcp":        None,
    "obsidian-mcp-pro":    None,
    "obsidian-mcp-server": None,
    "mcpvault":            y_at(2200) - 16,
    "seekstone":           y_at(2000) + 22,
}
for name, vals, fmts, is_hero in SERIES:
    y_end = END_LABELS.get(name)
    if y_end is None:
        y_end = y_at(vals[-1]) + 4
    else:
        y_end += 4
    if is_hero:
        svg.append(f'<text x="{X1+18}" y="{y_end:.1f}" fill="{VIOLET_HI}" font-size="15" font-weight="700">{name} · {fmts[-1]}</text>')
    else:
        svg.append(f'<text x="{X1+18}" y="{y_end:.1f}" fill="{INK2}" font-size="13">{name} <tspan fill="{MUTED}">· {fmts[-1]}</tspan></text>')

# annotations
svg.append(f'<text x="{(x_at(5000)+x_at(10000))/2:.0f}" y="{y_at(3300):.0f}" text-anchor="middle" fill="{VIOLET_HI}" font-size="14" font-weight="600">ranked excerpts — stays ~2 KB flat</text>')
svg.append(f'<text x="{(x_at(1000)+x_at(5000))/2 + 30:.0f}" y="{y_at(4.2e6):.0f}" text-anchor="middle" fill="{MUTED}" font-size="13">full note content for every hit —</text>')
svg.append(f'<text x="{(x_at(1000)+x_at(5000))/2 + 30:.0f}" y="{y_at(4.2e6)+19:.0f}" text-anchor="middle" fill="{MUTED}" font-size="13">payload grows with the vault</text>')

svg_body = "\n    ".join(svg)

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * {{ margin:0; padding:0; }}
  html,body {{ width:{W}px; height:{H}px; background:{BG}; overflow:hidden;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }}
  .wordmark {{ position:absolute; left:56px; top:44px; display:flex; align-items:center; gap:9px; }}
  .wordmark .gem {{ width:16px; height:16px; background:#7c5cff; transform:rotate(45deg); border-radius:3px; }}
  .wordmark .name {{ color:#ece8ff; font-size:17px; font-weight:650; letter-spacing:.01em; }}
  h1 {{ position:absolute; left:56px; top:78px; color:{INK}; font-size:40px; font-weight:750; letter-spacing:-0.015em; }}
  .sub {{ position:absolute; left:56px; top:132px; color:{INK2}; font-size:16.5px; max-width:660px; line-height:1.4; }}
  .stat {{ position:absolute; right:56px; top:52px; text-align:right; }}
  .stat .num {{ color:{AMBER}; font-size:46px; font-weight:750; letter-spacing:-0.01em; }}
  .stat .cap {{ color:{MUTED}; font-size:13.5px; margin-top:4px; max-width:290px; line-height:1.35; }}
  .footer {{ position:absolute; left:56px; right:56px; bottom:28px; border-top:1px solid {GRID};
    padding-top:14px; color:{MUTED}; font-size:12.5px; display:flex; justify-content:space-between; }}
</style></head>
<body>
  <div class="wordmark"><div class="gem"></div><div class="name">seekstone</div></div>
  <h1>The context tax</h1>
  <div class="sub">Six Obsidian MCP servers · identical queries · three vault sizes · 20 runs each</div>
  <div class="stat">
    <div class="num">≈47,000×</div>
    <div class="cap">smaller search payload at 10,000 notes<br>2&#8202;KB vs 95&#8202;MB per query</div>
  </div>
  <svg width="{W}" height="{H}" style="position:absolute; left:0; top:0;">
    {svg_body}
  </svg>
  <div class="footer">
    <span>Synthetic vaults committed to the repo — clone &amp; reproduce</span>
    <span>github.com/shaqmughal/seekstone · MIT</span>
  </div>
</body></html>
"""

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "payload-benchmark-ph.html")
with open(out, "w") as f:
    f.write(html)
print("wrote", out)
print("render with:")
print('  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \\')
print(f'    --screenshot=payload-benchmark-ph.png --window-size={W},{H} \\')
print(f'    --force-device-scale-factor=2 --hide-scrollbars "file://{out}"')
