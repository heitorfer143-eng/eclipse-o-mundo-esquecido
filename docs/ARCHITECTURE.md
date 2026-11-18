# Eclipse: O Mundo Esquecido — arquitetura

Jogo 3D (Three.js + TS/Vite) em pt-BR. Projeto: `/home/ubuntu/eclipse`. Blueprint aprovado
(`assetProduction: ai_generated_fast`, `riggingAndAnimation: true`, sem integrações online).

## Decisões técnicas

- Sem Rapier: o mundo usa heightmap + colisores AABB/círculo próprios (`world/collision.ts`).
  O starter `src/engine/physics.ts` permanece no repositório mas não é usado pelo jogo.
- Mundo finito de ~2050 m de raio, streaming de chunks de 80 m, biomas por ruído (seed do save).
- POIs determinísticos: 13 fixos (história) + grade de 460 m para vilas/acampamentos/ruínas.
- Personagens e inimigos são construídos por primitivas (sem GLB), com animação procedural por
  juntas. Isso evita dependência de assets externos e mantém o bundle pequeno.
- Interface em HTML/CSS (não canvas), fontes ManusCC0 + pilha serifada para títulos.

## Módulos existentes

- `src/game/core/rng.ts` — mulberry32, hash2/3, valueNoise2, fbm2, ridged2, pick/range/intRange.
- `src/game/core/math.ts` — clamp, lerp, damp, dampAngle, wrapAngle, smoothstep, easings.
- `src/game/data/types.ts` — contratos (EnemyType, BossType, ItemDef, QuestDef, NpcDef, RecipeDef…).
- `src/game/data/itemData.ts` — ~87 itens (`ITEMS`, `itemById`, `ITEM_IDS`, `RARITY_LABEL/COLOR`).
- `src/game/data/enemyData.ts` — 30 inimigos (`ENEMIES`, `enemyById`).
- `src/game/data/bossData.ts` — 10 chefes (`BOSSES`, `bossById`).
- `src/game/world/biomes.ts` — `BIOMES`, `BiomeDef`.
- `src/game/world/terrain.ts` — `Terrain` (`heightAt`, `slopeAt`, `biomeFrom`, `vertexColor`), `SEA_LEVEL=0`, `WORLD_RADIUS=2050`.
- `src/game/world/chunks.ts` — `Chunk`, `ChunkManager` (streaming, props instanciados, colisores).
- `src/game/world/collision.ts` — `Collider`, `resolveCircle`, `supportHeight`, `collidersNearPoint`.
- `src/game/world/props.ts` — geometrias de árvores/rochas/grama e material compartilhado.
- `src/game/world/structures.ts` — `StructureBuilder` + `buildVillage/City/Castle/Dungeon/Temple/Ruins/Camp/Shrine/Tower/Port/Cave/IslandSite` → `{group, colliders, spots}`.
- `src/game/world/poi.ts` — `PoiManager` (`pois`, `update`, `isBlocked`, `collidersNear`, `spotsOf`, `at`, `nearest`), `SPAWN_POINT`.
- `src/game/world/sky.ts` — `Sky` (ciclo dia/noite, sol/lua/estrelas/nuvens, `night`, `horizonColor`, `setWeather`).
- `src/game/world/water.ts` — `Water` (oceano/lagos animados).
- `src/game/world/weather.ts` — `Weather` (chuva/tempestade/neve/areia/cinzas/neblina, `fog`, `tintColor`, `wetness`, `label`).
- `src/game/world/world.ts` — `World` (`spawn`, `heightAt`, `groundAt`, `collidersNear`, `update`, `biomeAt`, `poiAt`).
- `src/game/entities/character.ts` — `CharacterModel` (juntas, equipamento visível, `animate(dt, AnimState)`, `buildWeapon`).
- `src/game/entities/player.ts` — `Player` (locomoção, escalada, natação, planagem, combate, stamina/mana/vida, `PlayerEvent`).
- `src/game/entities/enemyModels.ts` — `buildEnemyVisual(model, colors, scale)` para 20 arquétipos.
- `src/game/entities/enemy.ts` — `Enemy` (IA, status, barra de vida, `EnemyEvent`).
- `src/game/entities/boss.ts` — `Boss` (fases, telegrafias, `BossEvent`).
- `src/game/combat/weapons.ts` — `WEAPON_PROFILES`, `attackDuration`, `comboMultiplier`.
- `src/game/combat/damage.ts` — `ELEMENTS`, `damageAfterDefense`, `elementalMultiplier`, `reactionFor`.
- `src/game/systems/stats.ts` — `Progression`, `derivedStats`, `Attributes`, `StatBonus`, `MAX_LEVEL`.
- `src/game/camera.ts` — `CameraRig` (yaw/pitch, zoom, shake, `update`).

## Ainda falta implementar

1. `systems/inventory.ts` — itens empilhados, equipamento (arma/armadura/capacete/botas/2 anéis/relíquia), bônus, sets, aprimoramento (+1..+5), venda/compra.
2. `systems/skills.ts` — árvore de 3 ramos e nós desbloqueáveis.
3. `combat/abilities.ts` — 18 habilidades (6 elementos × 3), custos de mana, efeitos, reações.
4. `combat/projectiles.ts` — projéteis, AoE, cones, números de dano.
5. `combat/effects.ts` — partículas (faíscas, explosões, cura, level up), decals.
6. `systems/crafting.ts`, `systems/shops.ts` — receitas e lojas.
7. `systems/quests.ts`, `systems/dialogue.ts` — runtime de missões e diálogos.
8. `entities/npc.ts` — NPC com rotina, interação e loja.
9. `entities/spawner.ts` — spawn por bioma/noite, cap de inimigos, chefes por POI.
10. `systems/saveGame.ts` — serialização completa.
11. `ui/*` — HUD, inventário, equipamentos, habilidades, mapa, missões, crafting, loja, diálogo, pausa, título, toque.
12. `game.ts` — orquestrador (input → player/inimigos → combate → missões → UI → áudio).
13. `main.ts` — boot, loading, menus, autosave.
14. `engine/audio.ts` — estender com música dinâmica, ambiência e SFX de armas/magias.
15. `engine/i18n.ts` + `src/i18n/pt-BR.json` — idioma único pt-BR.
16. Testes (`tests/*.test.ts`), `scripts/smoke.mjs`, favicon/OG (`game-sharing.json`), checkpoint.

## Controles definidos

WASD mover, mouse olhar, Shift correr, Espaço pular (segurar planar), Ctrl rolar, clique esquerdo/J atacar (segurar carregar), clique direito/Q bloquear/aparar, E interagir, 1-6 elemento, Z/X/C habilidades, H poção, Tab inventário, M mapa, K habilidades, L missões, Esc pausa.

## API esperada pelo `game.ts`

- `World`: `spawn`, `scene`, `update(dt, camera, playerPos)`, `groundAt`, `collidersNear`, `heightAt`, `biomeAt`, `pois`, `sky`, `weather`.
- `Player`: `step(dt, intent, yaw, events)`, `render(dt)`, `position`, `health/mana/stamina`, `stats`, `takeDamage`, `setStats`, `setWeapon`.
- `Enemy`: `update(dt, ctx, events)`, `render(dt, camera)`, `takeDamage`, `root`, `position`, `xp`, `def`.
- `Boss`: `update(dt, ctx, events)`, `render(dt, camera)`, `takeDamage`, `def`, `healthRatio`.
