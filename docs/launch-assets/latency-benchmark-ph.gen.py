#!/usr/bin/env python3
"""Generate the PH latency-benchmark graphic (1270x760) as HTML+SVG.

Data source: README.md "Search latency" table (packages/harness baseline reports).
Brand tokens: seekstone.dev src/styles/ds/colors.css.

Usage: python3 latency-benchmark-ph.gen.py, then render the HTML it prints
with headless Chrome (exact command printed at the end).
"""
import math
import os

W, H = 1270, 760

# warm median ms at 1k / 5k / 10k notes (README latency table)
# (name, values, label_y_override_at_10k)
SERIES = [
    ("seekstone",           [1.1, 3.1, 6.2],    "6.2 ms",   True),
    ("obsidian-mcp-pro",    [46, 213, 430],     "430 ms",   False),
    ("obsidian-mcp-server", [82, 356, 732],     "732 ms",   False),
    ("obsidian-mcp",        [82, 405, 811],     "811 ms",   False),
    ("mcpvault",            [96, 467, 958],     "958 ms",   False),
    ("mcp-obsidian",        [164, 740, 1550],   "1,550 ms", False),
]

BG        = "#110f18"
GRID      = "#2a2540"
INK       = "#f1eefb"
INK2      = "#a9a2c0"
MUTED     = "#8b84a3"
VIOLET    = "#9a7dff"
VIOLET_HI = "#b8a6ff"
AMBER     = "#fbbf24"
GRAY_LINE = "#8b84a3"

X0, X1 = 150, 850
YT, YB = 208, 645
LOG_TOP, LOG_BOT = math.log10(2000), 0.0   # 2,000 ms .. 1 ms
NOTES = [1000, 5000, 10000]

def x_at(n):
    return X0 + (n - 1000) / 9000 * (X1 - X0)

def y_at(v):
    return YT + (LOG_TOP - math.log10(v)) / (LOG_TOP - LOG_BOT) * (YB - YT)

svg = []

DECADES = [(1, "1 ms"), (10, "10 ms"), (100, "100 ms"), (1000, "1 s")]
for v, lab in DECADES:
    y = y_at(v)
    svg.append(f'<line x1="{X0}" y1="{y:.1f}" x2="{X1}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
    svg.append(f'<text x="{X0-14}" y="{y:.1f}" dy="4" text-anchor="end" fill="{MUTED}" font-size="13">{lab}</text>')

for n, lab in zip(NOTES, ["1,000 notes", "5,000 notes", "10,000 notes"]):
    svg.append(f'<text x="{x_at(n):.1f}" y="{YB+30}" text-anchor="middle" fill="{MUTED}" font-size="13">{lab}</text>')

svg.append(f'<text x="{X0-14}" y="{YT-24}" text-anchor="start" fill="{MUTED}" font-size="12.5">warm median search latency (log scale)</text>')

def polyline(vals):
    return " ".join(f"{x_at(n):.1f},{y_at(v):.1f}" for n, v in zip(NOTES, vals))

for name, vals, fmt, is_hero in SERIES:
    if is_hero:
        continue
    svg.append(f'<polyline points="{polyline(vals)}" fill="none" stroke="{GRAY_LINE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    for n, v in zip(NOTES, vals):
        svg.append(f'<circle cx="{x_at(n):.1f}" cy="{y_at(v):.1f}" r="4.5" fill="{GRAY_LINE}" stroke="{BG}" stroke-width="2"/>')

hero = SERIES[0]
svg.append(f'<polyline points="{polyline(hero[1])}" fill="none" stroke="{VIOLET}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
for n, v in zip(NOTES, hero[1]):
    svg.append(f'<circle cx="{x_at(n):.1f}" cy="{y_at(v):.1f}" r="5.5" fill="{VIOLET}" stroke="{BG}" stroke-width="2"/>')

# end labels — competitors clump at the top, so spread label rows manually
LABEL_Y = {
    "mcp-obsidian":        y_at(1550),
    "mcpvault":            y_at(958) - 6,
    "obsidian-mcp":        y_at(811) + 12,
    "obsidian-mcp-server": y_at(732) + 26,
    "obsidian-mcp-pro":    y_at(430) + 22,
    "seekstone":           y_at(6.2),
}
for name, vals, fmt, is_hero in SERIES:
    y_end = LABEL_Y[name] + 4
    if is_hero:
        svg.append(f'<text x="{X1+18}" y="{y_end:.1f}" fill="{VIOLET_HI}" font-size="15" font-weight="700">{name} · {fmt}</text>')
    else:
        svg.append(f'<text x="{X1+18}" y="{y_end:.1f}" fill="{INK2}" font-size="13">{name} <tspan fill="{MUTED}">· {fmt}</tspan></text>')

# annotations
svg.append(f'<text x="{(x_at(5000)+x_at(10000))/2:.0f}" y="{y_at(6.2)+78:.0f}" text-anchor="middle" fill="{VIOLET_HI}" font-size="14" font-weight="600">in-process index — no subprocess, no HTTP round-trip</text>')
svg.append(f'<text x="{(x_at(1000)+x_at(5000))/2 + 30:.0f}" y="{y_at(40):.0f}" text-anchor="middle" fill="{MUTED}" font-size="13">every other server spawns a process or</text>')
svg.append(f'<text x="{(x_at(1000)+x_at(5000))/2 + 30:.0f}" y="{y_at(40)+19:.0f}" text-anchor="middle" fill="{MUTED}" font-size="13">makes HTTP calls — and slows 8–10× as the vault grows</text>')

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
  .stat .cap {{ color:{MUTED}; font-size:13.5px; margin-top:4px; max-width:300px; line-height:1.35; }}
  .footer {{ position:absolute; left:56px; right:56px; bottom:28px; border-top:1px solid {GRID};
    padding-top:14px; color:{MUTED}; font-size:12.5px; display:flex; justify-content:space-between; }}
</style></head>
<body>
  <div class="wordmark"><div class="gem"></div><div class="name">seekstone</div></div>
  <h1>Single-digit milliseconds</h1>
  <div class="sub">Warm median search latency · same six servers · identical queries · 20 runs each</div>
  <div class="stat">
    <div class="num">70–250×</div>
    <div class="cap">faster than every alternative at 10,000 notes<br>6.2&#8202;ms vs 430–1,550&#8202;ms</div>
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

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "latency-benchmark-ph.html")
with open(out, "w") as f:
    f.write(html)
print("wrote", out)
print("render with:")
print('  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \\')
print(f'    --screenshot=latency-benchmark-ph.png --window-size={W},{H} \\')
print(f'    --force-device-scale-factor=2 --hide-scrollbars "file://{out}"')
