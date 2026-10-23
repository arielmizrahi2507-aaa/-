# -*- coding: utf-8 -*-
"""Creates the logo images used by the site from tools/logo/logo-master.webp (the club's logo, circle only).

    python3 tools/make_logo_assets.py          (needs Pillow)

Writes into docs/assets/img: logo-128.png (sidebar and footer), logo-192.png (favicon and fallback), logo-800.webp (hero),
favicon-32.png and apple-touch-icon.png. To change the logo, replace the master (a square image with a transparent
background outside the circle) and run the script again. og-image.jpg (share preview) is a separate, ready-made file."""
import os
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "tools" / "logo" / "logo-master.webp"
OUT = ROOT / "docs" / "assets" / "img"

master = Image.open(MASTER).convert("RGBA")


def sized(n, sharpen=True):
    im = master.resize((n, n), Image.LANCZOS)
    if sharpen and n <= 512:
        alpha = im.getchannel("A")
        im = im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.8, percent=70, threshold=2)).convert("RGBA")
        im.putalpha(alpha)
    return im


OUT.mkdir(parents=True, exist_ok=True)
sized(128).save(OUT / "logo-128.png", optimize=True)
sized(192).save(OUT / "logo-192.png", optimize=True)
sized(800, sharpen=False).save(OUT / "logo-800.webp", "WEBP", quality=84, method=6, alpha_quality=100)
sized(32).save(OUT / "favicon-32.png", optimize=True)
bg = Image.new("RGB", (180, 180), (247, 244, 241))     # iOS fills transparent areas with black, so give it a plain background
icon = sized(150)
bg.paste(icon, (15, 15), icon)
bg.save(OUT / "apple-touch-icon.png", optimize=True)
for name in ("logo-128.png", "logo-192.png", "logo-800.webp", "favicon-32.png", "apple-touch-icon.png"):
    print(f"{name:22s}{os.path.getsize(OUT / name) / 1024:7.1f} KB")
