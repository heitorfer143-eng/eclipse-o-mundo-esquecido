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
- [x] Auditar individualmente as 18 fontes indicadas, separando permissão de download, uso no jogo e redistribuição; manter fora do build arquivos pagos, restritos ou com termos ambíguos.
- [x] Integrar somente assets úteis e compatíveis: três casas Shuriken incorporadas no jogo (não como pack autônomo) e fontes Cinzel/Alegreya SC com os avisos OFL; documentar créditos, papéis, animações estáticas e fallbacks.
- [x] Validar typecheck, 37 testes, build/check-size, smoke desktop/mobile sem erros de navegador; confirmar GLBs de casas no cenário e entrada/retomada do interior.
- [x] Confirmar workflow `Eclipse - Build e testes` concluído com sucesso no commit `0370d067f752f02d96361ddcdb427b0cf85600b2`, deployment `github-pages` para o mesmo SHA e HTTP 200 da página, bundles JS/CSS e três GLBs publicados.

## Próxima rodada: fechar e polir o primeiro ciclo (19 nov 2026)
- [x] Confirmar que o commit `fcd572d` passou build/smoke e deploy do Pages; o bundle público `assets/index-fE5_OR4S.js` responde HTTP 200.
- [ ] Fechar o primeiro ciclo de `O Despertar`: deixar claro o próximo alvo/local e como interagir; permitir progredir matando 3 lobos sombrios, coletando 3 ervas, falando com Velho Thom e derrotando o Guardião; entregar a missão a Iara e mostrar recompensa de 120 XP, 60 ouro, 2 poções e 3 pães, com progresso salvo.
- [ ] Melhorar controles touch em celular: joystick/câmera distinguíveis e responsivos, botões sem sobrepor outras zonas ou cortar safe areas, multi-toque sem perder ações e layout legível em retrato/paisagem curtos, mantendo desempenho leve.
- [ ] Tornar legíveis as animações do protagonista ao andar, correr, atacar, esquivar/rolar, receber dano e morrer; manter poses coerentes no modelo selecionado e sem root motion que desloque colisões.
- [ ] Conferir proporções dos 30 mobs e 10 chefes contra o protagonista e ajustar escala quando necessário; deixar windups/áreas de ataque dos inimigos visíveis a tempo de esquivar e sem discrepância entre aviso e acerto.

## Casas 3D e orientação de exploração (20 nov 2026)
- [x] Mostrar casas GLB por função (cottage, taverna e ferreiro), manter alternativas/fallback e posicioná-las numa área próxima mais plana do terreno.
- [x] Manter a posição de NPCs, forja e elementos funcionais ligados às casas quando o ajuste de terreno deslocar a construção.
- [x] Quando não houver missão principal rastreada, indicar no HUD/mapa o próximo capítulo principal habilitado pela cadeia de pré-requisitos.
- [x] Conferir em smoke visual os modelos 3D de casas em Brumal/Aster e validar abertura/retomada do interior; testes cobrem papéis cottage/taverna/ferreiro e realocação da forja com NPC/estação alinhados.
- [x] Verificar que a indicação do próximo capítulo respeita pré-requisitos, nomeia Aster após a etapa inicial e mostra preparação de nível quando aplicável.

## Texturas e navegação de NPCs (20 nov 2026)
- [x] Aplicar mapas leves de madeira, pedra, reboco e telhas aos materiais sem textura dos GLBs Shuriken; preservar mapas originais e fallbacks, gerar UVs ausentes e validar os quatro tipos em 2.352 materiais carregados no smoke mobile/desktop.
- [x] Manter NPCs fora das casas ao iniciar e durante a rotina autônoma, usando exclusões por POI e colisores locais; validar caminhada simulada sem entrada em casa e confirmar no smoke que jogador ainda abre, retoma e sai do interior.

## Roupa, noite e contagem de lobos (20 nov 2026)
- [x] Iniciar como Sobrevivente sem armadura, capacete ou botas, usando roupa simples de tecido; tornar o equipamento modular e visualmente evidente ao obter a primeira armadura pela progressão, preservando o mesmo protagonista/rig.
- [x] Entregar o Manto do Andarilho ao concluir O Despertar, permitir equipá-lo no nível 1 e equipá-lo automaticamente como primeira armadura; validar a troca visual sem mudar a identidade da campanha.
- [x] Clarear a iluminação ambiente e a névoa da noite, mantendo o céu noturno escuro/azulado e os níveis do meio-dia; validar dia/noite em browser.
- [x] Contar mortes de lobos sombrios em objetivos ativos, atualizar o diário e os marcadores de NPC e persistir o progresso do abate; validar um lobo real no smoke.
- [x] Passar `pnpm typecheck`, 42 testes, `pnpm build` e o smoke desktop/mobile sem erros de navegador.

## Texturas do mundo
- [x] Aplicar grama ao terreno e às touceiras, folhas à copa, madeira ao tronco e pedra às rochas/estruturas; criar UVs ausentes e manter fallback de materiais.
- [x] Otimizar as três imagens originais em WebP sem sobrescrever os PNGs: grama, folhas e pedra ficam em torno de 161–273 KB cada; reaproveitar a textura de madeira já existente para casca.

## Fauna, especialização, coleta e acabamento visual (20 nov 2026)
- [x] Remover inimigos finalizados antes de verificar o limite de população e repor guardas de POI em cerca de 22 segundos, removendo-os ao descarregar a área.
- [x] Texturizar terreno, touceiras, árvores, rochas e materiais de estruturas; otimizar mapas para WebP e preservar os PNGs originais.
- [x] Fixar o elemento escolhido na criação da campanha única, ocultar os outros elementos e bloquear troca; habilidades nos níveis 1, 14 e 22 e +20% de poder mágico como maestria no nível 40.
- [x] Elevar as casas pela maior altura da fundação e usar apoios de pedra nos cantos baixos para reduzir paredes enterradas.
- [x] Permitir caçar cervos, javalis, cavalos, vacas e outras espécies; conceder carne, couro, XP e ouro, com retorno dos animais após intervalo.
- [x] Vender machado e picareta no ferreiro, exigir a ferramenta correta para madeira/minérios/pedra e reutilizar o inventário e ouro existentes.
- [x] Corrigir a prioridade visual do diálogo sobre o HUD, para manter as opções de missão clicáveis durante conversas.

## Modelos Quaternius indicados (20 nov 2026)
- [x] Integrar localmente os 12 animais do Ultimate Animated Animal Pack; selecionar espécies conforme bioma, mapear clips reais de repouso/caminhada/galope/morte e manter caça, recompensas, inventário e respawn existentes.
- [x] Registrar a procedência e a licença CC0 específica dos modelos animais e validar os 12 arquivos e clips em testes.
- [x] Integrar Casual_Male como roupa civil inicial e Soldier_Male/Knight_Golden_Male como visuais armados do Soldado/Paladino, preservando a campanha única e acionando a troca pelo equipamento do inventário; aproveitar rig e clips Quaternius, registrar licença CC0 e validar typecheck, 48 testes, build e smoke desktop/mobile sem erros.

## NPCs Quaternius e abertura cinematográfica (20 nov 2026)
- [x] Usar modelos locais Quaternius (Casual_Male, Soldier_Male, Knight_Golden_Male) e KayKit (Barbarian, Mage, Rogue, Rogue_Hooded) por papel de NPC, mantendo paletas próprias e guardas/capitão armados; remover a aura do protagonista e dos NPCs em todos os estados.
- [x] Conduzir a nova campanha pela introdução cinematográfica de quatro quadros com trilha original, CTA para pular direto à criação e continuidade até o prólogo; iniciar a faixa pelo gesto do jogador e retomar a música ambiente ao fim.
- [x] Aplicar a textura clara `stone-blocks.webp` às rochas separadamente das muralhas, mantendo UVs e tons legíveis; aumentar o spawn para 2–3 animais por chunk habitável.
- [x] Validar modelos, aura, textura de rochas, fauna e fluxo da campanha; `pnpm typecheck`, 51 testes, `pnpm build` e smoke desktop/mobile sem erros de navegador.

## Melhorias de exploração, NPCs, combate e fauna (20 nov 2026)
- [x] Tornar a próxima missão difícil de perder: destacar o objetivo atual, mostrar marcador no mapa e no mundo e indicar claramente para onde ir; smoke confirma destino real da missão no mapa/localizador e marcador 3D até cerca de 1.200 m, incluindo alvo de coleta na erva física.
- [x] Dar mais vida aos NPCs: falas curtas quando o jogador passar perto, rotinas diárias e reações ao clima ou ao horário; rotinas e seletores de fala cobertos por testes unitários, com integração ao subtitle da HUD.
- [x] Melhorar o combate com avisos visuais antes dos ataques inimigos, dando tempo para esquivar ou bloquear; windup/indicadores cobertos por testes unitários e integrados ao ciclo de combate.
- [x] Dar mais utilidade aos animais: permitir montar alguns e encontrar animais raros em regiões específicas; smoke desktop/mobile completa montar/desmontar e valida retenção do animal no mundo, com regras por habitat/raridade cobertas por testes.
- [x] Criar destinos de exploração — masmorras pequenas e ruínas com recompensas que incentivem sair da vila; Ruínas da Vigília e baús/recompensa extra cobertos por testes de estruturas e integração do mundo.

## Próximo ciclo: prioridades 1 a 6 escolhidas (20 nov 2026)
- [x] Fechar “O Despertar” de ponta a ponta: contar 3 lobos sombrios derrotados e 3 ervas coletadas; permitir falar com Velho Thom, derrotar o Guardião e entregar a missão a Iara; exibir e salvar a recompensa de 120 XP, 60 ouro, 2 poções e 3 pães.
- [x] Polir as animações do protagonista: transições naturais entre andar, correr, atacar, esquivar/rolar, receber dano e morrer, mantendo poses coerentes e sem root motion que desloque colisões.
- [x] Aprofundar o combate: diferenciar padrões de inimigos e melhorar impacto de golpes, bloqueios e acertos, preservando avisos prévios justos e consistentes com as áreas reais de ataque.
- [x] Distribuir progressão por níveis: habilidades, equipamentos e desafios devem desbloquear-se gradualmente e comunicar claramente requisitos e recompensas; preservar a escolha fixa de elemento da campanha.
- [x] Expandir exploração com ao menos uma área única adicional, como caverna ou acampamento, com inimigos e recompensas próprios, mantendo geração, terreno e rotas existentes.
- [x] Melhorar inventário e crafting: explicar requisitos de ferramenta/receita, materiais que faltam e alterações de atributos dos equipamentos antes de equipar ou fabricar.

### Validação deste ciclo
- `pnpm typecheck`, `pnpm test` (62/62) e `pnpm build` passaram; `pnpm smoke` desktop/mobile passou sem erros de navegador.
- Smoke percorreu o ciclo da missão e confirmou deltas salvos de +120 XP, +60 ouro, +2 poções e +3 pães, missão concluída e Manto do Andarilho equipado após reload.
- Retrato curto 360×640: botão Missões dentro da tela e sem sobreposição com joystick/botões; noite verificada visualmente em captura e com luz ambiente 1,4, hemisférica 1,8 e fog 0,0021.
- Mantido o escopo estrito nas prioridades 1–6; nenhuma prioridade 7–10 implementada.

## Correção da integração visual do pacote de natureza (22 nov 2026)
- [x] Integrar visivelmente mapas CC0 do Stylized Nature MegaKit a elementos compatíveis do mundo; não deixar texturas apenas armazenadas sem referência nos materiais.
- [x] Aplicar grama nas touceiras, folhas recortadas em copas de árvores e casca + normal nos troncos; preservar a textura de chão existente e fallbacks.
- [x] Usar o atlas de rochas de modo compatível com as UVs procedurais, otimizar assets para web/mobile, registrar fonte/licença e validar a cena em build/smoke.
- Validação: `pnpm typecheck`, 62 testes unitários, `pnpm build` e smoke Playwright no preview de produção passaram; o smoke confirmou os URLs dos cinco mapas em materiais de meshes visíveis da cena.
- O atlas de rochas é UV e não um tile; foi usado um recorte cinza/musgo espelhado como tile leve, mantendo o atlas otimizado arquivado e fallback de material se o mapa opcional falhar.
