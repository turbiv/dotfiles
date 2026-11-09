#!/usr/bin/env python3
"""Spotify now-playing panel for the iTerm2 Toolbelt (stdlib + iterm2 only)."""
import json
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import iterm2

PORT = 8765
SEP = "\x1f"

STATE_SCRIPT = f"""
if application "Spotify" is running then
  tell application "Spotify"
    try
      set t to current track
      set s to (ASCII character 31)
      return (name of t) & s & (artist of t) & s & (album of t) & s & (artwork url of t) & s & (player state as text) & s & (player position as text) & s & ((duration of t) as text) & s & (shuffling as text) & s & (repeating as text) & s & (shuffling enabled as text) & s & (repeating enabled as text)
    end try
  end tell
end if
return ""
"""

COMMANDS = {
    "/playpause": 'tell application "Spotify" to playpause',
    "/next": 'tell application "Spotify" to next track',
    "/prev": 'tell application "Spotify" to previous track',
    "/shuffle": 'tell application "Spotify" to set shuffling to not shuffling',
    "/repeat": 'tell application "Spotify" to set repeating to not repeating',
    "/open": 'tell application "Spotify" to activate',
}


def osascript(script):
    r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=3)
    return r.stdout.strip()


def num(s):
    try:
        return float(s.replace(",", "."))  # player position may use a locale decimal comma
    except ValueError:
        return 0.0


def spotify_state():
    parts = osascript(STATE_SCRIPT).split(SEP)
    if len(parts) != 11:
        return {"running": False}
    name, artist, album, art, state, pos, dur, shuffle, repeat, can_shuffle, can_repeat = parts
    return {
        "running": True,
        "name": name,
        "artist": artist,
        "album": album,
        "art": art,
        "playing": state == "playing",
        "position": num(pos),
        "duration": num(dur) / 1000,
        "shuffle": shuffle == "true",
        "repeat": repeat == "true",
        "canShuffle": can_shuffle == "true",  # false for radio/autoplay contexts
        "canRepeat": can_repeat == "true",
    }


PAGE = """<!doctype html><html><head><meta charset="utf-8">
<style>
:root{--bg:#fff;--fg:#111;--muted:#666;--track:#ddd;--accent:#1db954}
@media (prefers-color-scheme:dark){:root{--bg:#1e1e1e;--fg:#eee;--muted:#999;--track:#444}}
body{margin:0;padding:10px;box-sizing:border-box;min-height:100vh;display:flex;background:var(--bg);color:var(--fg);font:13px -apple-system,sans-serif;user-select:none}
#on,#off{margin:auto}
#on{width:min(100%,max(120px,100vh - 150px))}
img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:var(--track);display:block;cursor:pointer}
.t{font-weight:600;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seek{padding:6px 0;margin-top:4px;cursor:pointer}
.bar{height:4px;background:var(--track);border-radius:2px;overflow:hidden}
.fill{height:100%;width:0;background:var(--accent)}
.time{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-top:3px;font-variant-numeric:tabular-nums}
.c{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:6px}
button{background:none;border:0;color:var(--fg);font-size:20px;cursor:pointer;padding:2px}
button:hover,button.on{color:var(--accent)}
button svg{display:block;width:15px;height:15px}
.tog{color:var(--muted)}
button:disabled{opacity:.35;cursor:default;color:var(--muted)}
#off{color:var(--muted);text-align:center;padding:20px 0}
</style></head><body>
<div id="off" hidden>Spotify is not running</div>
<div id="on" hidden>
<img id="art" alt="" title="Open Spotify">
<div class="t" id="name"></div><div class="a" id="artist"></div>
<div class="seek" id="seek"><div class="bar"><div class="fill" id="fill"></div></div></div>
<div class="time"><span id="cur">0:00</span><span id="dur">0:00</span></div>
<div class="c"><button data-cmd="shuffle" id="sh" class="tog" title="Shuffle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button><button data-cmd="prev">&#x23EE;&#xFE0E;</button><button data-cmd="playpause" id="pp">&#x25B6;&#xFE0E;</button><button data-cmd="next">&#x23ED;&#xFE0E;</button><button data-cmd="repeat" id="rp" class="tog" title="Repeat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg></button></div>
</div>
<script>
const $=id=>document.getElementById(id);
let s={running:false},syncedAt=0;
const fmt=x=>{x=Math.max(0,Math.floor(x));return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')};
async function poll(){
  try{s=await (await fetch('/state')).json();syncedAt=performance.now();}catch(e){s={running:false};}
  $('off').hidden=s.running;$('on').hidden=!s.running;
  if(!s.running)return;
  if($('art').src!==s.art)$('art').src=s.art;
  $('name').textContent=s.name;$('artist').textContent=s.artist+' — '+s.album;
  $('pp').innerHTML=s.playing?'&#x23F8;&#xFE0E;':'&#x25B6;&#xFE0E;';
  $('dur').textContent=fmt(s.duration);
  $('sh').classList.toggle('on',s.shuffle);$('rp').classList.toggle('on',s.repeat);
  $('sh').disabled=!s.canShuffle;$('rp').disabled=!s.canRepeat;
}
function tick(){
  if(s.running&&s.duration>0){
    const p=Math.min(s.duration,s.position+(s.playing?(performance.now()-syncedAt)/1000:0));
    $('fill').style.width=(100*p/s.duration)+'%';$('cur').textContent=fmt(p);
  }
  requestAnimationFrame(tick);
}
document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{
  await fetch('/'+b.dataset.cmd,{method:'POST'});setTimeout(poll,150);
});
$('art').onclick=()=>fetch('/open',{method:'POST'});
$('seek').onclick=e=>{
  if(!s.running||!(s.duration>0))return;
  const r=e.currentTarget.getBoundingClientRect();
  const t=s.duration*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
  s.position=t;syncedAt=performance.now();
  fetch('/seek?t='+t.toFixed(2),{method:'POST'});
};
setInterval(()=>{if(document.visibilityState==='visible')poll()},2000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll()});
poll();tick();
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/":
            self.send(200, PAGE, "text/html; charset=utf-8")
        elif self.path == "/state":
            self.send(200, json.dumps(spotify_state()), "application/json")
        else:
            self.send(404, "", "text/plain")

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path in COMMANDS:
            osascript(COMMANDS[url.path])
            self.send(204, "", "text/plain")
        elif url.path == "/seek":
            try:
                t = float(parse_qs(url.query)["t"][0])
            except (KeyError, ValueError):
                return self.send(400, "", "text/plain")
            osascript(f'tell application "Spotify" to set player position to {max(0.0, t)}')
            self.send(204, "", "text/plain")
        else:
            self.send(404, "", "text/plain")

    def log_message(self, *args):
        pass


async def main(connection):
    await iterm2.tool.async_register_web_view_tool(
        connection, "Spotify", "com.github.spotify-iterm2", False, f"http://127.0.0.1:{PORT}/"
    )


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    iterm2.run_forever(main)
