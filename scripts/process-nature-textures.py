from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'nature-source'
OUTPUT = ROOT / 'public' / 'assets' / 'textures' / 'world' / 'nature'
OUTPUT.mkdir(parents=True, exist_ok=True)

# Keep source atlases out of `public`; only these optimized maps are shipped to the browser.
grass = Image.open(SOURCE / 'Grass.png').convert('RGB')
grass.save(OUTPUT / 'grass-atlas.webp', 'WEBP', quality=88, method=6)

leaves = Image.open(SOURCE / 'Leaves_NormalTree_C.png').convert('RGBA')
leaves.save(OUTPUT / 'leaves-atlas.webp', 'WEBP', lossless=True, method=6)

rocks = Image.open(SOURCE / 'Rocks_Diffuse.png').convert('RGB')
rocks.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
rocks.save(OUTPUT / 'rocks-atlas.webp', 'WEBP', quality=84, method=6)

# Grass.png is a material atlas, not a ground tiling texture. Isolate its two green blade bands
# for the small procedural tufts; the existing meadow map remains on the terrain.
grass_blades = Image.new('RGB', (64, 512))
dark_green = grass.crop((29, 0, 54, 512)).resize((32, 512), Image.Resampling.LANCZOS)
light_green = grass.crop((87, 0, 112, 512)).resize((32, 512), Image.Resampling.LANCZOS)
grass_blades.paste(dark_green, (0, 0))
grass_blades.paste(light_green, (32, 0))
grass_blades.save(OUTPUT / 'grass-blades.webp', 'WEBP', quality=88, method=6)

# Rocks_Diffuse is a UV atlas for the pack's own meshes, not a tile. Extract a visibly mottled
# grey-and-moss rock face, mirror it into a seamless 128px detail map, and use it on game rocks.
rock_face = Image.open(SOURCE / 'Rocks_Diffuse.png').convert('RGB').crop((630, 590, 694, 654))
rock_tile = Image.new('RGB', (128, 128))
rock_tile.paste(rock_face, (0, 0))
rock_tile.paste(ImageOps.mirror(rock_face), (64, 0))
rock_tile.paste(ImageOps.flip(rock_face), (0, 64))
rock_tile.paste(ImageOps.flip(ImageOps.mirror(rock_face)), (64, 64))
rock_tile.save(OUTPUT / 'rock-detail-tile.webp', 'WEBP', quality=84, method=6)

for path in sorted(OUTPUT.glob('*.webp')):
    with Image.open(path) as image:
        print(f'{path.name}: {image.width}x{image.height}, {path.stat().st_size // 1024} KiB')
