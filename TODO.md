# Eclipse: O Mundo Esquecido — TODO

## 1. Núcleo e mundo procedural
- [ ] RNG determinístico por seed, ruído fractal, utilidades matemáticas
- [ ] Terreno em chunks com biomas (floresta, montanha nevada, deserto, pântano, vulcão, ashlands, oceano, ilha)
- [ ] Água (oceano, lagos, cachoeiras), céu com ciclo dia/noite, estrelas, nuvens
- [ ] Clima dinâmico: chuva, tempestade com raios, neblina, neve, tempestade de areia
- [ ] Pontos de interesse por seed: vilas, cidade grande, castelo, masmorras, templos, ruínas, acampamentos, santuários, ilhas secretas
- [ ] Colisão de terreno/props, escalada, natação, planagem

## 2. Personagem e combate
- [ ] Personagem procedural com membros animados e equipamentos visíveis
- [ ] Movimento: andar, correr, pular, rolar/esquivar, escalar, nadar, planar
- [ ] 7 armas com movimentos, alcance, velocidade e habilidades próprias
- [ ] Combos, ataque carregado, bloqueio, parry, crítico, dano elemental
- [ ] 6 elementos com 18 habilidades desbloqueáveis e reações entre elementos
- [ ] Efeitos visuais, números de dano, hitstop, tremor de câmera

## 3. Inimigos e chefes
- [ ] 30 tipos de inimigos com IA (melee, carga, à distância, caster, voador, bruto, assassino, invocador)
- [ ] 10 chefes com fases, telegrafias, ataques especiais, barra própria e recompensas raras

## 4. Progressão, itens e economia
- [ ] Níveis, XP, atributos, árvore de habilidades
- [ ] Inventário, equipamentos (arma, armadura, capacete, botas, 2 anéis, relíquia), raridades
- [ ] Lojas, compra/venda, ferreiro com aprimoramento
- [ ] Coleta (minério, madeira, ervas, pesca), crafting de poções/armas/armaduras, cozinha

## 5. Missões, NPCs e história
- [ ] Campanha principal em capítulos com reviravoltas
- [ ] Missões secundárias, caçadas, enigmas de templo, tesouros e segredos
- [ ] NPCs com rotinas, diálogos ramificados e lojas
- [ ] Eventos aleatórios no mundo

## 6. Interface, áudio e salvamento
- [ ] HUD premium: vida, mana, stamina, nível, minimapa, rastreador de missões, barra de chefe
- [ ] Menus funcionais: inventário, equipamentos, habilidades, mapa, missões, crafting, loja, diálogo, pausa/configurações
- [ ] Controles por teclado/mouse, gamepad e toque
- [ ] Áudio: ambiência, música dinâmica, tema de chefe, SFX de armas/magias
- [ ] Salvamento automático completo (nível, XP, itens, missões, posição, história)

## 7. Entrega
- [ ] Testes unitários dos módulos puros e smoke test do jogo real
- [ ] Build, favicon/OG, checkpoint e publicação

---

## Estado atual (retomar daqui)

### Pronto
- Dados: `data/types.ts`, `itemData.ts` (87 itens), `enemyData.ts` (30), `bossData.ts` (10),
  `questData.ts` (30 missões), `npcData.ts` (16 NPCs), `recipeData.ts` (26 receitas).
- Mundo: `world/terrain.ts`, `chunks.ts`, `collision.ts`, `props.ts`, `biomes.ts`, `structures.ts`,
  `poi.ts`, `sky.ts`, `water.ts`, `weather.ts`, `world.ts`.
- Entidades: `character.ts`, `player.ts`, `enemyModels.ts`, `enemy.ts`, `boss.ts`, `npc.ts`,
  `spawner.ts`, `population.ts`.
- Sistemas: `stats.ts`, `inventory.ts`, `skills.ts`, `quests.ts`, `dialogue.ts`, `economy.ts`,
  `loot.ts`; `combat/weapons.ts`, `damage.ts`, `abilities.ts`, `effects.ts`, `projectiles.ts`;
  `camera.ts`; `engine/save.ts` (SaveStore v2).
- UI: `styles/main.css`, `ui/icons.ts`, `ui/hud.ts`, `ui/panels.ts`.

### Falta
1. `ui/title.ts` — tela de título (nova aventura / continuar / opções) sobre `SaveStore`.
2. `ui/map.ts` — `generateWorldMap(world): HTMLCanvasElement` amostrando biomas/altitudes.
3. `ui/touch.ts` — joystick + botões (substituir o antigo).
4. `ui/ui.ts` — fachada HUD + Panels + título + toque.
5. `engine/audio.ts` — SFX (espada, magia, arco, morte, level up, moeda) + música procedural.
6. `game/game.ts` — orquestrador completo (combate, XP/loot, quests, NPCs, baús, portais, chefes,
   morte, vitória, autosave, snapshot HUD).
7. `main.ts` — boot, loading, título, loop 60 Hz, resize, pointer lock, atalhos.
8. Ajustes: pool fixo de marcadores de POI na bússola do HUD; revisar `projectiles.ts`.
9. `tests/*.test.ts`, `scripts/smoke.mjs`, `public/favicon.svg`, `game-sharing.json`.
10. `pnpm typecheck`, `pnpm test`, `pnpm build`, smoke com Playwright, checkpoint.

### Controles
WASD mover · mouse olhar · Shift correr · Espaço pular/planar · Ctrl rolar · clique esq./J atacar
(segurar carrega) · clique dir./Q bloquear · E interagir · 1-6 elemento · Z/X/C habilidades ·
H poção · Tab inventário · K habilidades · M mapa · L missões · Esc pausa.

### Convenções
- Texto de jogo em pt-BR com acentos; sem `any`; strict TS; sem dependências novas.
- `World.groundAt(x,z,feetY)` para superfície; `world.collidersNear(x,z)` para colisão.
- `Player.step(dt, intent, yaw, events)`; `Enemy.update(dt, ctx, events)`; `Boss.update(dt, ctx, events)`.
- UI recebe `HudSnapshot` por frame e `PanelContext` ao abrir painéis.

## Ciclo atual: experiência móvel (solicitado em 18 nov 2026)
- [ ] Remover conflitos entre a zona de câmera, botões de combate e habilidades do HUD.
- [ ] Ajustar joystick, áreas de toque, safe areas e feedback visual dos controles.
- [ ] Revisar a hierarquia compacta do HUD em retrato e paisagem.
- [ ] Validar viewports pequenos, rodar testes/typecheck/build e atualizar a publicação do GitHub Pages.
