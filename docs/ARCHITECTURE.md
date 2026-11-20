# Eclipse: O Mundo Esquecido — arquitetura atual

Jogo de ação/RPG 3D em Three.js, TypeScript e Vite, com interface HTML/CSS em pt-BR. A campanha e as opções ficam no armazenamento local do navegador; o save admite uma única campanha ativa. O catálogo, a função e a procedência dos modelos ficam em [Catálogo de modelos 3D](3d-model-catalog.md).

## Sistemas centrais

- `src/game/world/terrain.ts` e `biomes.ts` — altura do terreno, regiões, biomas e paletas.
- `src/game/world/chunks.ts` — streaming de chunks, vegetação, props e fauna ambient; a fauna atualiza movimento e animações por frame.
- `src/game/world/structures.ts` e `poi.ts` — construção de sítios, casas procedural/GLB, portas interativas, POIs e colisões.
- `src/game/world/world.ts` — coordenação de terreno, streaming, colisões, iluminação, Aether e o estado externo/interior.
- `src/game/world/interior.ts` — cômodo simples, mobiliário, limites e pontos de entrada/saída usados pelas casas.
- `src/game/entities/character.ts` — rig procedural, animação e visual de equipamento.
- `src/game/entities/externalModels.ts` — carregamento glTF, clonagem de rigs, escolha de clips, remoção de movimento de raiz e fallback procedimental quando um clip não existe.
- `src/game/entities/npc.ts` — rotinas, deslocamento e diálogo dos habitantes.
- `src/game/entities/enemy.ts` e `enemyModels.ts` — IA, combate, arquétipos e animação de morte dos inimigos.
- `src/game/game.ts` — loop de jogo, input, interação, combate, missões, flags de história, interior e serialização do estado atual.
- `src/engine/save.ts` — parser com validação/migração, campanha única, identidade de personagem e progresso persistente.
- `src/ui/title.ts`, `characterCustomizer.ts`, `panels.ts` e `ui.ts` — criação/continuação da campanha, HUD, diálogos, inventário e pausa.

## Modelos e animação

Uma campanha nova usa o **Sobrevivente**, criado pelo rig procedural e sem armadura, capacete ou botas no início. O equipamento é aplicado visualmente quando equipado. Aparências KayKit antigas continuam carregáveis por campanhas que já as salvaram; não aparecem como novas opções de identidade.

Três casas CC0 são usadas como variações estáticas nos povoados, com colisão que deixa a entrada livre. As casas procedurais são fallback. A entrada leva a um interior simples e separado do cenário externo; salvar dentro de uma casa preserva o identificador da casa para restaurar a sessão. A relíquia antiga em forma oval permanece guardada, mas fora da cena; a praça mostra um Fragmento de Aether de forma cristalina.

Modelos humanoides e animais que ainda vêm por URL são descritos no catálogo. Quando há clips apropriados, o jogo usa `AnimationMixer`; quando faltam, aplica movimento de juntas e queda procedurais. O movimento não usa deslocamento acumulado do root do glTF, evitando que a animação se afaste da posição física da entidade.

## Campanha e persistência

O perfil (nome, aparência e aura) é fixado ao criar a campanha. O save v4 mantém progresso, missões e flags de história, incluindo a apresentação da Iara; diálogos de retorno partem de nós contextuais, sem reapresentar o primeiro encontro. A exclusão do único save exige confirmação. Saves mais antigos são normalizados pelo parser e migrados sem criar campanhas paralelas.

## Limites conhecidos

- O login Google e a sincronização online ainda não estão configurados; o progresso continua local.
- Assets remotos dependem de rede e da disponibilidade/termos do fornecedor. As fontes indicadas pelo jogador estão sendo avaliadas antes de qualquer cópia para o repositório.
- Os interiores são instâncias simples compartilhadas entre casas; não são interiores artísticos exclusivos por edifício.

## Verificação do projeto

`pnpm test -- --run` executa a suíte Vitest; `pnpm build` verifica TypeScript, produz o site e aplica o limite de tamanho do bundle; `scripts/smoke.mjs` cobre a criação/continuação da campanha, diálogo inicial, diário/localizador de missão, casas, persistência, pausa e dispositivos móveis.
