# Nature texture assets

Selected from the user-provided Stylized Nature MegaKit [Standard] ZIP, `glTF/` directory. The pack is CC0 (see `License_Standard.txt`); the source PNG atlases are retained outside `public/` in `assets/nature-source/`, while optimized WebP maps are shipped.

- `Bark_NormalTree.png` → `bark-tree.webp` (1024 px, WebP); applied to procedural tree trunks.
- `Bark_NormalTree_Normal.png` → `bark-tree-normal.webp` (1024 px, lossless WebP); applied as the matching trunk normal map.
- `Grass.png` → `grass-atlas.webp` and green-band crop `grass-blades.webp`; the crop is used only on small procedural grass tufts. The existing meadow tile remains on the large terrain surface because this source is an atlas, not a seamless ground texture.
- `Leaves_NormalTree_C.png` → `leaves-atlas.webp`; individual transparent leaf islands are UV-mapped onto instanced cards in oak canopies, avoiding stretching the whole atlas across a solid canopy mesh.
- `Rocks_Diffuse.png` → optimized `rocks-atlas.webp` and a mirrored 128 px `rock-detail-tile.webp` swatch from a visibly mottled grey-and-moss rock face. The seamless derivative is assigned to procedural rock meshes; the full atlas itself is not applied to geometry with unrelated UVs.

Regenerate the optimized and derived WebP files with `python3 scripts/process-nature-textures.py` (Pillow required). All other materials retain their original fallback maps if an optional nature map fails to load.
