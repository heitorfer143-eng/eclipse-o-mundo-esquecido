# Biblioteca de modelos 3D do Eclipse

Esta biblioteca documenta os modelos GLB efetivamente ligados ao carregador do jogo. Os modelos de personagens são carregados sob demanda pelo `ExternalCharacter`, clonados com `SkeletonUtils.clone` e normalizados para a altura do rig do jogo. Se um download falhar, o modelo procedural original continua visível.

## Personagens e NPCs

| Papel | Modelo GLB |
|---|---|
| Jogador / guerreiro | [HeavyWarrior](https://gobkit.com/freebies/human003/HeavyWarrior.glb) |
| Guarda | [Footman](https://gobkit.com/freebies/human003/Footman.glb) |
| Capitão da guarda | [KnightCaptain](https://gobkit.com/freebies/human003/KnightCaptain.glb) |
| Ferreiro | [BloodironSmith](https://gobkit.com/freebies/human010/BloodironSmith.glb) |
| Mercador | [MarketVendor](https://gobkit.com/freebies/human017/MarketVendor.glb) |
| Taverneiro | [Bartender](https://gobkit.com/freebies/human021/Bartender.glb) |
| Alquimista / mago | [NightWitch](https://gobkit.com/freebies/human011/NightWitch.glb) |
| Sacerdote | [Priestess](https://gobkit.com/freebies/human003/Priestess.glb) |
| Ancião | [King](https://gobkit.com/freebies/human003/King.glb) |
| Caçadora | [Archer](https://gobkit.com/freebies/human003/Archer.glb) |
| Camponês | [FarmHand](https://gobkit.com/freebies/human017/FarmHand.glb) |
| Aldeão | [PeasantMilitia](https://gobkit.com/freebies/human003/PeasantMilitia.glb) |

## Inimigos e chefes

| Tipo | Modelo GLB |
|---|---|
| Goblin batedor | [OrcLegionary](https://gobkit.com/freebies/human006/OrcLegionary.glb) |
| Xamã goblin | [OrcWarShaman](https://gobkit.com/freebies/human006/OrcWarShaman.glb) |
| Campeão goblin / chefe Tharwyn | [OrcWarbandChampion](https://gobkit.com/freebies/human006/OrcWarbandChampion.glb) |
| Bandido | [Scout](https://gobkit.com/freebies/human003/Scout.glb) |
| Cavaleiro corrompido | [BloodironKnight](https://gobkit.com/freebies/human010/BloodironKnight.glb) |
| Cavaleiro do vazio / chefe Hrimgar | [BloodironJuggernaut](https://gobkit.com/freebies/human010/BloodironJuggernaut.glb) |
| Múmia / esqueleto | [TombMummy](https://gobkit.com/freebies/human011/TombMummy.glb) |
| Espectro | [SheetGhost](https://gobkit.com/freebies/human011/SheetGhost.glb) |
| Bruxa do lodo | [NightWitch](https://gobkit.com/freebies/human011/NightWitch.glb) |
| Diabrete de magma / xamã ígneo | [OrcPyromancer](https://gobkit.com/freebies/human010/OrcPyromancer.glb) |
| Yeti | [WerewolfCaptain](https://gobkit.com/freebies/human011/WerewolfCaptain.glb) |
| Chefe vampírico Sarkhys | [VampireCountess](https://gobkit.com/freebies/human011/VampireCountess.glb) |
| Bruto | [OrcChainBrute](https://gobkit.com/freebies/human010/OrcChainBrute.glb) |

Criaturas com silhuetas não humanoides — dragão, lobo, aranha, slime, golem, serpente, harpia, morcego, escorpião e treant — continuam usando seus rigs procedurais especializados. Não foram substituídas por humanoides.

## Arquitetura, mundo e efeitos

O projeto mantém três modelos GLB Shuriken em `public/assets/models/houses/`: cottage para casas comuns, taverna para hospedaria e oficina de ferreiro para edifícios da forja. Três casas CC0 da Innerscene permanecem como alternativas/fallback. Os modelos são estáticos, compartilhados entre instâncias e limitados por bounds medidos; os colliders mantêm uma abertura de entrada. As construções procuram uma posição próxima mais plana e os pontos funcionais do ferreiro acompanham o deslocamento. Os créditos e limites de redistribuição estão em [`SOURCES.md`](../public/assets/models/houses/SOURCES.md). Castelos, torres, ruínas, cavernas, templos, portos e dungeons usam a biblioteca procedural compartilhada em `src/game/world/structures.ts`, com materiais regionais por bioma e geometria mesclada para limitar draw calls.

## Fontes da interface

Cinzel variável é usada na hierarquia serifada; Alegreya SC Regular/Bold aparece em pequenos cabeçalhos e metadados. Os três arquivos locais ficam em `src/assets/fonts/`, são empacotados pelo Vite com URLs relativas e mantêm as licenças SIL OFL 1.1 em `licenses/`. MedievalSharp foi auditada, mas não foi incluída por não acrescentar papel funcional necessário nesta rodada.

Fontes para próximas expansões (não são dependências runtime até serem integradas e testadas):
- [Shuriken Fantasy — 31 GLBs](https://shuriken.studio/kits/fantasy): goblin, slime, torre arcana, árvore-casa, arena de boss, armas, poções, runas e VFX.
- [Shuriken Medieval Village — 26 GLBs](https://shuriken.studio/kits/medieval-village): taverna, moinho, portão de castelo, casas, estábulo, oficina de ferreiro, fontes, barracas e muralhas.
- [Shuriken Combat VFX Mesh Set](https://shuriken.studio/models/effects/combat-vfx-mesh-set): arco de corte, onda de choque, espiral de energia e explosão de espinhos.

## Licenças

Os modelos Gobkit listados acima pertencem à biblioteca gratuita CC0 1.0, com uso comercial permitido e sem atribuição obrigatória: https://creativecommons.org/publicdomain/zero/1.0/

Os kits Shuriken têm licença própria para os modelos gratuitos: https://shuriken.studio/legal/models. É permitido incorporá-los em jogos, inclusive comerciais; não redistribuir os arquivos GLB isoladamente como pack.

## Notas de desempenho

- GLBs são carregados somente quando uma entidade precisa deles.
- Cacheia-se a promessa de download por URL; cada entidade recebe clone com esqueleto independente.
- Altura do modelo externo usa a altura final do rig de combate, evitando dupla escala.
- Meshes recebem sombra, mas não recebem sombras extras por padrão.
- Falha de rede mantém o rig procedural como fallback.
- Modelos grandes não devem ser adicionados todos ao início do jogo; usar carregamento por proximidade e limites de entidades visíveis.
