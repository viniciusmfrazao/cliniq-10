from PIL import Image, ImageDraw
import os

ANDROID_RES = "android/app/src/main/res"
RESOURCES = "resources"

legacy_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fg_sizes = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

icon = Image.open(f"{RESOURCES}/icon.png").convert("RGBA")
fg = Image.open(f"{RESOURCES}/icon-foreground.png").convert("RGBA")

def circle_mask(img):
    size = img.size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0], size[1]), fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out

for density, size in legacy_sizes.items():
    resized = icon.resize((size, size), Image.LANCZOS)
    resized.convert("RGB").save(f"{ANDROID_RES}/mipmap-{density}/ic_launcher.png")
    round_icon = circle_mask(resized)
    round_icon.save(f"{ANDROID_RES}/mipmap-{density}/ic_launcher_round.png")
    print(f"legacy {density}: {size}x{size}")

for density, size in fg_sizes.items():
    resized = fg.resize((size, size), Image.LANCZOS)
    resized.save(f"{ANDROID_RES}/mipmap-{density}/ic_launcher_foreground.png")
    print(f"foreground {density}: {size}x{size}")

# Solid brand color for adaptive icon background (matches gradient's mid tone)
with open(f"{ANDROID_RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#7C3AED</color>\n</resources>\n')

print("done")
