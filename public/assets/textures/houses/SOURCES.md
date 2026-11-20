# Texturas originais das casas

Quatro mapas albedo originais, gerados para o projeto Eclipse e otimizados para uso em casas 3D de baixa poligonagem:

- `wood-planks.webp` — tábuas de carvalho envelhecido.
- `stone-blocks.webp` — blocos de pedra e argamassa.
- `plaster.webp` — reboco medieval claro.
- `roof-shingles.webp` — telhas de terracota.

Os arquivos distribuídos têm 512 × 512 pixels em WebP para reduzir banda e memória de GPU em celulares. São carregados uma vez e compartilhados pelos modelos; os GLBs originais permanecem intactos. A rotina de integração gera UVs planares por face somente nos modelos Shuriken sem UVs e preserva mapas preexistentes dos modelos CC0 alternativos.
