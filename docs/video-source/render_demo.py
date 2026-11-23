#!/usr/bin/env python3
"""Render a 12-second, truthful CyberVPN UI Preview from captured screens."""
from PIL import Image
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent
OUT = ROOT / "docs" / "videos"
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 720, 1280, 30
DURATION = 12
BG = (244, 248, 252)
shots = [Image.open(SRC / n).convert("RGB") for n in ("home.png", "firewall.png", "connections.png")]
prepared = []
for im in shots:
    im.thumbnail((590, H), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG)
    canvas.paste(im, ((W-im.width)//2, (H-im.height)//2))
    prepared.append(canvas)
cmd = ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT/"cybervpn-ui-demo.mp4")]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
frames = FPS * DURATION
fade = 10  # 333 ms
for i in range(frames):
    t = i/FPS
    idx = min(2, int(t/4))
    local = t - idx*4
    frame = prepared[idx]
    if idx < 2 and local >= 4-fade/FPS:
        alpha = (local - (4-fade/FPS)) / (fade/FPS)
        frame = Image.blend(frame, prepared[idx+1], max(0, min(1, alpha)))
    p.stdin.write(frame.tobytes())
p.stdin.close()
if p.wait() != 0:
    raise SystemExit("ffmpeg encode failed")
print(OUT/"cybervpn-ui-demo.mp4")
