#!/usr/bin/env python3
"""Generate the PH "what you get" card (1270x760) as HTML.

Tool list source: README.md tools tables (17 tools: 9 read + 8 write).
Brand tokens: seekstone.dev src/styles/ds/colors.css.

Usage: python3 tools-overview-ph.gen.py, then render the HTML it prints
with headless Chrome (exact command printed at the end).
"""
import os

W, H = 1270, 760

READ_TOOLS = [
    ("search", "ranked excerpts, ~2 KB"),
    ("query_notes", "frontmatter predicates"),
    ("read_note", "section / block / range"),
    ("list_notes", "by folder or tag"),
    ("list_tags", "usage-ranked"),
    ("outline_note", "structure, no content"),
    ("get_backlinks", "who links here"),
    ("get_links", "outgoing links"),
    ("get_periodic_note", "daily/weekly/…"),
]
WRITE_TOOLS = [
    ("create_note", "frontmatter + body"),
    ("append_note", "body only, FM untouched"),
    ("patch_frontmatter", "keys kept in order"),
    ("patch_note", "insert after heading"),
    ("replace_in_note", "targeted replace"),
    ("move_note", "rename / relocate"),
    ("delete_note", "explicit, never implicit"),
    ("append_periodic_note", "template-aware"),
]

BG     = "#110f18"
PANEL  = "#1a1726"
BORDER = "rgba(180,166,255,0.12)"
GRID   = "#2a2540"
INK    = "#f1eefb"
INK2   = "#a9a2c0"
MUTED  = "#8b84a3"
VIOLET = "#9a7dff"
VIOLET_HI = "#b8a6ff"
AMBER  = "#fbbf24"
GREEN  = "#34d399"

def chips(tools):
    out = []
    for name, hint in tools:
        out.append(
            f'<div class="chip"><code>{name}</code><span>{hint}</span></div>'
        )
    return "\n      ".join(out)

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html,body {{ width:{W}px; height:{H}px; background:{BG}; overflow:hidden;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }}
  .wordmark {{ position:absolute; left:56px; top:44px; display:flex; align-items:center; gap:9px; }}
  .wordmark .gem {{ width:16px; height:16px; background:#7c5cff; transform:rotate(45deg); border-radius:3px; }}
  .wordmark .name {{ color:#ece8ff; font-size:17px; font-weight:650; letter-spacing:.01em; }}
  h1 {{ position:absolute; left:56px; top:78px; color:{INK}; font-size:40px; font-weight:750; letter-spacing:-0.015em; }}
  .sub {{ position:absolute; left:56px; top:132px; color:{INK2}; font-size:16.5px; }}
  .install {{ position:absolute; right:56px; top:64px; text-align:right; }}
  .install .cmd {{ display:inline-block; background:#0c0a12; border:1px solid {BORDER}; border-radius:10px;
    padding:12px 18px; color:{VIOLET_HI}; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:16px; }}
  .install .cap {{ color:{MUTED}; font-size:12.5px; margin-top:7px; }}
  .cols {{ position:absolute; left:56px; right:56px; top:178px; display:flex; gap:20px; }}
  .panel {{ flex:1; background:{PANEL}; border:1px solid {BORDER}; border-radius:14px; padding:18px 20px 14px; }}
  .panel h2 {{ font-size:13px; letter-spacing:.08em; color:{MUTED}; font-weight:650; margin-bottom:12px; }}
  .panel h2 b {{ color:{INK}; font-weight:750; }}
  .chip {{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:11px 0;
    border-bottom:1px solid rgba(180,166,255,0.06); }}
  .chip:last-child {{ border-bottom:none; }}
  .chip code {{ color:{VIOLET_HI}; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14.5px; }}
  .chip span {{ color:{MUTED}; font-size:12.5px; text-align:right; }}
  .claims {{ position:absolute; left:56px; right:56px; bottom:66px; display:flex; gap:20px; }}
  .claim {{ flex:1; border:1px solid {BORDER}; border-radius:14px; padding:14px 18px; background:rgba(124,92,255,0.06); }}
  .claim .big {{ color:{INK}; font-size:19px; font-weight:750; }}
  .claim .big em {{ color:{AMBER}; font-style:normal; }}
  .claim .small {{ color:{MUTED}; font-size:12.5px; margin-top:3px; line-height:1.35; }}
  .footer {{ position:absolute; left:56px; right:56px; bottom:24px; border-top:1px solid {GRID};
    padding-top:12px; color:{MUTED}; font-size:12.5px; display:flex; justify-content:space-between; }}
</style></head>
<body>
  <div class="wordmark"><div class="gem"></div><div class="name">seekstone</div></div>
  <h1>17 tools. No plugin. Nothing running.</h1>
  <div class="sub">Filesystem-direct MCP server for your Obsidian vault — works with Obsidian closed</div>
  <div class="install">
    <div class="cmd">npx -y seekstone init</div>
    <div class="cap">or one-click .mcpb install for Claude Desktop</div>
  </div>

  <div class="cols">
    <div class="panel">
      <h2><b>READ</b> · 9 TOOLS</h2>
      {chips(READ_TOOLS)}
    </div>
    <div class="panel">
      <h2><b>WRITE</b> · 8 TOOLS · BYTE-IDENTICAL FRONTMATTER ROUND-TRIPS</h2>
      {chips(WRITE_TOOLS)}
    </div>
  </div>

  <div class="claims">
    <div class="claim">
      <div class="big">~2&#8202;KB <em>searches</em></div>
      <div class="small">ranked excerpts, flat as your vault grows</div>
    </div>
    <div class="claim">
      <div class="big">6&#8202;ms <em>warm</em></div>
      <div class="small">in-process index — no subprocess, no HTTP</div>
    </div>
    <div class="claim">
      <div class="big">100% <em>local</em></div>
      <div class="small">MIT · no network calls · no telemetry</div>
    </div>
  </div>

  <div class="footer">
    <span>Claude Desktop · Claude Code · Cursor · VS Code — guided install for each</span>
    <span>github.com/shaqmughal/seekstone · seekstone.dev</span>
  </div>
</body></html>
"""

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools-overview-ph.html")
with open(out, "w") as f:
    f.write(html)
print("wrote", out)
print("render with:")
print('  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \\')
print(f'    --screenshot=tools-overview-ph.png --window-size={W},{H} \\')
print(f'    --force-device-scale-factor=2 --hide-scrollbars "file://{out}"')
