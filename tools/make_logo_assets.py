# -*- coding: utf-8 -*-
"""Creates the small raster logo files (icons) from the club's logo.

    python3 tools/make_logo_assets.py          (needs Pillow)

The logo itself is docs/assets/img/logo.svg: the page uses it directly (sidebar, footer, home page). Browsers need
PNG files for the tab icon and the phone home-screen icon, so this script writes, into docs/assets/img:
logo-192.png, favicon-32.png and apple-touch-icon.png, from tools/logo/logo-master.png (a 2048px PNG export of the
SVG, transparent outside the circle). If the cairosvg package is installed the master is first re-exported from the SVG.

To change the logo: replace logo.svg (keep it a square, circle-filled viewBox), export it again to
tools/logo/logo-master.png (or install cairosvg) and run this script. og-image.jpg (the share preview) is a separate,
ready-made file that contains the logo, the name, the address and the phone."""
import os
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "docs" / "assets" / "img" / "logo.svg"
MASTER = ROOT / "tools" / "logo" / "logo-master.png"
OUT = ROOT / "docs" / "assets" / "img"

try:
    import cairosvg
    cairosvg.svg2png(url=str(SVG), write_to=str(MASTER), output_width=2048, output_height=2048)
    print("master re-exported from logo.svg")
except ImportError:
    pass

master = Image.open(MASTER).convert("RGBA")


def sized(n):
    im = master.resize((n, n), Image.LANCZOS)
    if n <= 256:                                   # small sizes get a light sharpening
        alpha = im.getchannel("A")
        im = im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.7, percent=60, threshold=2)).convert("RGBA")
        im.putalpha(alpha)
    return im


OUT.mkdir(parents=True, exist_ok=True)
sized(192).save(OUT / "logo-192.png", optimize=True)
sized(32).save(OUT / "favicon-32.png", optimize=True)
bg = Image.new("RGB", (180, 180), (247, 244, 241))     # iOS fills transparent areas with black, so give it a plain background
icon = sized(150)
bg.paste(icon, (15, 15), icon)
bg.save(OUT / "apple-touch-icon.png", optimize=True)
for name in ("logo-192.png", "favicon-32.png", "apple-touch-icon.png"):
    print(f"{name:22s}{os.path.getsize(OUT / name) / 1024:7.1f} KB")
