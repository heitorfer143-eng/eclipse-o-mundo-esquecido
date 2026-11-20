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

## 8. Escala e personalização de personagem (18 nov 2026)
- [x] Manter a escala visual reduzida do branch público e normalizar os modelos selecionáveis ao mesmo alvo, sem alterar física nem hitboxes.
- [x] Disponibilizar os cinco modelos KayKit CC0 e seis cores de aura em uma tela acessível no título e no menu de pausa.
- [x] Aplicar a aparência apenas como cosmético e salvar o perfil com allowlist, preservando saves antigos, aventura e atributos.
- [x] Manter fallback, cache/lazy-load de rigs, alinhamento de pés/frente e transições assíncronas sem root motion.
- [x] Validar a integração nesta branch, rodar testes/build mobile e publicar o checkpoint em GitHub Pages.

## Ciclo atual: experiência móvel (solicitado em 18 nov 2026)
- [x] Remover conflitos entre a zona de câmera, botões de combate e habilidades do HUD.
- [x] Ajustar joystick, áreas de toque, safe areas e feedback visual dos controles.
- [x] Revisar a hierarquia compacta do HUD em retrato e paisagem.
- [x] Validar viewports pequenos, rodar testes/typecheck/build e atualizar a publicação do GitHub Pages.

## Ciclo atual: campanha e proporções dos personagens (19 nov 2026)
- [x] Apresentar o prólogo do capítulo 1 ao iniciar a campanha, reutilizando os textos oficiais da missão, e manter a tela de carregamento visível com lore.
- [x] Exigir nome na criação do protagonista, guardar o perfil no save local e reutilizá-lo ao continuar; saves antigos continuam carregando e só pedem nome se ainda não houver um.
- [x] Corrigir a escala-base dos NPCs e limitar a altura visual de mobs, elites e chefes sem aumentar hitboxes; chefes também ficam legíveis na câmera.
- [x] Atualizar o smoke test para percorrer prólogo, criação nominal, diálogo/aceite da missão, retomada e save antigo.

## Correções do início da campanha (19 nov 2026)
- [x] Ao iniciar uma campanha sem O Despertar aceito, posicionar o protagonista em Brumal e apresentar um diálogo de Iara que ofereça a missão; saves antigos sem essa missão são direcionados à conversa sem apagar inventário ou progresso.
- [x] Não mostrar objetivos de O Despertar antes do aceite; depois que o jogador aceitar, mostrar o rastreador e persistir o estado da missão.
- [x] Indicar NPCs com missão disponível ou pronta para entrega, permitir falar/interagir com eles e manter o diálogo rolável e dentro da tela em retrato, paisagem e viewports baixos.
- [x] Impedir que mobs comuns/elite e chefes preencham a tela; manter inimigos iniciais afastados do ponto de chegada e encurtar a câmera antes que atravesse colisores do mundo.

## Ciclo atual: jogo jogável e múltiplas campanhas (19 nov 2026)
- [x] Limitar a altura visual dos dez chefes a 2,45 m para que nenhum monstro ocupe quase toda a tela; validar cada definição de chefe em teste automatizado.
- [x] Reduzir a Aranha Tecelã para cerca de 0,3 m de altura e no máximo 0,6 m de largura/profundidade, contando o volume das patas.
- [x] (Decisão anterior, substituída pelo pedido mais recente) Permitir criar até oito campanhas sem sobrescrever as anteriores; cada slot mantém nome, aparência, seed e progresso próprios, oferece retomada por seleção e migra o save antigo de campanha única sem apagá-lo.
- [x] Validar no smoke a criação de um segundo personagem/campanha, a troca de volta para a campanha original com nível e ouro preservados, além de retrato e paisagem mobile; build e 15 testes unitários passaram.
- [x] Posicionar a NPC inicial à frente do protagonista, fora do eixo entre câmera e jogador; cobrir distância de conversa e lado da câmera no smoke mobile.
- [ ] Integrar login Google real, sem autenticação Manus, e sincronizar campanhas/personagens no backend por UID, preservando os slots locais; depende de configurar projeto/provedor e suas credenciais públicas de app.

## Continuação solicitada: campanha, vida do mundo e interiores (19 nov 2026)
- [x] Manter apenas uma campanha ativa: a identidade (nome/modelo/aura) e o progresso são fixos; ao existir save, oferecer Continuar e não criar outra campanha; conservar a exclusão confirmada do único save e a migração dos formatos antigos priorizando a campanha ativa.
- [x] Após o prólogo/aceite de missão, não reabrir automaticamente introduções já vistas; usar flags persistentes de história para Iara e chefes e retomar diálogos em falas contextuais sem repetir a apresentação inicial.
- [x] Fazer NPCs e fauna apresentarem locomoção visível (clips glTF reais quando houver, fallback de rig procedural quando não houver), sem root motion; mostrar uma queda/desaparecimento legível ao morrer, sem congelar o modelo de pé.
- [x] Remover a silhueta de “ovo” da praça sem eliminar o Fragmento de Aether: manter um cristal angular/fragmentado, ancorado ao terreno e visualmente distinto de um objeto oval.
- [x] Permitir entrar por portas de casas carregadas, percorrer um interior simples com colisões, sair pela porta e persistir a casa de retorno ao salvar/reabrir o jogo.
- [x] Começar com o protagonista em aparência simples, sem armadura/capacete/botas; manter a identidade fixa e permitir obter/equipar armadura pela progressão e crafting sem deixar a campanha inicial visualmente de cavaleiro.

## Novos modelos 3D indicados pelo jogador (19 nov 2026)
- [ ] Auditar individualmente as fontes fornecidas: 13/18 auditorias concluídas; faltam Poly Haven, ambientCG e as fontes Google Fonts Cinzel, Alegreya SC e MedievalSharp. Confirmar termos, licença e permissão de uso/redistribuição antes de baixar modelos; não tratar “grátis para baixar” como autorização automática para incluir arquivos no repositório.
- [ ] Integrar apenas assets licenciados e úteis ao jogo; documentar nome, função no gameplay, procedência/licença, escala, clips disponíveis, mapeamento de animação e fallback, mantendo a bundle e o streaming dentro de limites.

## Próxima rodada: fechar e polir o primeiro ciclo (19 nov 2026)
- [x] Confirmar que o commit `fcd572d` passou build/smoke e deploy do Pages; o bundle público `assets/index-fE5_OR4S.js` responde HTTP 200.
- [ ] Fechar o primeiro ciclo de `O Despertar`: deixar claro o próximo alvo/local e como interagir; permitir progredir matando 3 lobos sombrios, coletando 3 ervas, falando com Velho Thom e derrotando o Guardião; entregar a missão a Iara e mostrar recompensa de 120 XP, 60 ouro, 2 poções e 3 pães, com progresso salvo.
- [ ] Melhorar controles touch em celular: joystick/câmera distinguíveis e responsivos, botões sem sobrepor outras zonas ou cortar safe areas, multi-toque sem perder ações e layout legível em retrato/paisagem curtos, mantendo desempenho leve.
- [ ] Tornar legíveis as animações do protagonista ao andar, correr, atacar, esquivar/rolar, receber dano e morrer; manter poses coerentes no modelo selecionado e sem root motion que desloque colisões.
- [ ] Conferir proporções dos 30 mobs e 10 chefes contra o protagonista e ajustar escala quando necessário; deixar windups/áreas de ataque dos inimigos visíveis a tempo de esquivar e sem discrepância entre aviso e acerto.
