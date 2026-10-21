#!/usr/bin/env python3
"""تولید آیکون‌های PWA (بدون فونت — فقط شکل هندسی)"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
os.makedirs(OUT, exist_ok=True)

BG = (9, 13, 22)
BLUE = (29, 78, 216)
DOT = (255, 255, 255)


def make(size: int, pad_ratio: float = 0.0) -> Image.Image:
    S = 8  # supersample
    n = size * S
    img = Image.new("RGB", (n, n), BG)
    d = ImageDraw.Draw(img)

    pad = int(n * pad_ratio)
    box = (pad, pad, n - pad, n - pad)
    d.rounded_rectangle(box, radius=int(n * 0.22), fill=BLUE)

    inner = n - 2 * pad
    grid = inner * 0.56
    start = (n - grid) / 2
    step = grid / 4
    r = inner * 0.042
    for i in range(5):
        for j in range(5):
            cx = start + i * step
            cy = start + j * step
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=DOT)

    return img.resize((size, size), Image.LANCZOS)


for size, pad in ((192, 0.0), (512, 0.0), (512, 0.14)):
    name = f"icon-{size}x{size}.png" if pad == 0 else "icon-maskable-512x512.png"
    path = os.path.join(OUT, name)
    make(size, pad).save(path, "PNG", optimize=True)
    print("✔", os.path.relpath(path, ROOT), f"{os.path.getsize(path)//1024} KB")
