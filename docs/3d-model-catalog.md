# Catálogo de modelos 3D — Eclipse: O Mundo Esquecido

Este catálogo distingue modelos incluídos no repositório, modelos carregados por URL e fontes que ainda estão sendo avaliadas. Um asset “gratuito para baixar” não é automaticamente autorizado para redistribuição no GitHub Pages.

## Personagens KayKit já incluídos

Os arquivos `public/models/KayKitAdventurers/*.glb` são cinco aparências do **KayKit Adventurers Character Pack 1.0**, cuja licença local declara **CC0** e permite uso pessoal, educacional e comercial (`public/models/KayKitAdventurers/LICENSE.txt`). Todos contêm 76 clips, incluindo `Idle`, `Walking_A/B/C`, `Running_A/B`, `Death_A/B`, `Hit_A/B` e as quatro esquivas direcionais. `ExternalCharacter` seleciona clips por nome, remove movimento de raiz e mantém uma animação procedural de fallback para rigs sem o clip esperado.

- `Barbarian.glb` — aparência de aventureiro bárbaro; aceita saves antigos que escolheram `Barbarian`.
- `Knight.glb` — aparência de cavaleiro com armadura; mantida para campanhas antigas com identidade imutável.
- `Mage.glb` — aparência de maga; mantida para saves antigos.
- `Rogue.glb` — aparência de ladina; mantida para saves antigos.
- `Rogue_Hooded.glb` — aparência de ladina encapuzada; mantida para saves antigos.

Campanhas novas oferecem apenas **Sobrevivente**. Esse visual usa o rig procedural do jogo e começa sem armadura, capacete ou botas; a armadura passa a aparecer quando equipada. Os cinco GLBs acima não são opções de criação para uma campanha nova, mas seus saves antigos continuam compatíveis.

## Casas estáticas CC0

Os três GLBs de `public/assets/models/houses/` são creditados como **CC0-1.0** no arquivo `public/assets/models/houses/SOURCES.md`. Eles entram como variações visuais de casas em sítios povoados; cada casa escolhe um modelo disponível e escala-o ao espaço gerado. As colisões preservam uma abertura na frente. Como são modelos estáticos, nenhum possui clips. Se um GLB falhar ao carregar, a casa procedural continua como fallback.

- `low-poly-medieval-house.glb` — casa medieval compacta: [página de origem](https://www.innerscene.com/tools/library/3d-parts/low-poly-medieval-house-cb233936).
- `low-poly-city-house-building-low.glb` — casa urbana: [página de origem](https://www.innerscene.com/tools/library/3d-parts/low-poly-city-house-building-low-77087adb).
- `gable-house.glb` — casa com telhado de duas águas: [página de origem](https://www.innerscene.com/tools/library/3d-parts/gable-house-3f8bdef0).

## Modelos remotos de personagens e fauna

Os caminhos em `src/game/entities/externalModels.ts` e `src/game/world/chunks.ts` são URLs remotas, não arquivos empacotados em `public/`. O navegador busca esses modelos durante o jogo; portanto, a disponibilidade depende da rede e dos termos da fonte. O jogo mapeia clips glTF quando disponíveis e possui fallback de movimento/morte para rigs sem um clip compatível.

**Personagens e criaturas humanoides referenciados:**

- `player` → `HeavyWarrior.glb` (avatar externo legado; o novo Sobrevivente usa o rig procedural).
- `guard` → `Footman.glb`; `merchant` → `MarketVendor.glb`; `blacksmith` → `BloodironSmith.glb`; `mage`/`witch` → `NightWitch.glb`.
- `villager` → `PeasantMilitia.glb`; `king` → `King.glb`; `archer` → `Archer.glb`.
- `orc` → `OrcLegionary.glb`; `brute` → `OrcChainBrute.glb`; `knight` → `BloodironKnight.glb`.
- `ghost` → `SheetGhost.glb`; `mummy` → `TombMummy.glb`; `vampire` → `VampireCountess.glb`; `werewolf` → `WerewolfCaptain.glb`.

**Fauna referenciada por chunks e bioma:** `Doe.glb` (corça), `Fox.glb` (raposa), `Hare.glb` (lebre), `Squirrel.glb` (esquilo), `WildBoar.glb` (javali), `PalominoHorse.glb` (cavalo), `Goat.glb` (cabra) e `Sheep.glb` (ovelha). A fauna ambienta o mundo, caminha e foge do jogador; os mobs de combate usam o ciclo próprio de dano e morte.

O uso remoto e a permissão de redistribuição desses modelos permanecem condicionados à confirmação dos termos publicados pela fonte. Eles não devem ser copiados para o repositório até essa confirmação.

## Fragmento de Aether

`public/assets/models/espirito-aether.glb` permanece preservado no repositório, mas não é carregado: é um modelo estático sem animações e sua silhueta antiga parecia um ovo. A praça agora usa um fragmento/cristal angular procedural com pequenas lascas; o modelo anterior não participa do cenário.

## Fontes enviadas para avaliação

Estes endereços foram indicados pelo jogador. Páginas de catálogo, bibliotecas de texturas e fontes tipográficas não são arquivos de modelo; cada pacote específico precisa ser selecionado e ter seus termos conferidos antes de entrar no jogo.

**Andamento da auditoria:** 13 das 18 fontes tiveram a análise concluída. Ainda faltam Poly Haven, ambientCG e as fontes Cinzel, Alegreya SC e MedievalSharp do Google Fonts. Não baixar nem empacotar arquivos das fontes pendentes apenas por serem gratuitos; aguardar confirmação dos termos aplicáveis.

- [Monsters Basics Free — Munchkin Jonesy](https://munchkin-jonesy.itch.io/monsters-basics-free)
- [Dungeon Starter Blockimagine — 1camou](https://1camou.itch.io/dungeon-starter-blockimagine)
- [Animated Voxel Creatures Pack — Tersco](https://tersco.itch.io/animated-voxel-creatures-pack)
- [Polyfork assets](https://polyfork.dev/assets)
- [Gobkit freebies](https://gobkit.com/freebies)
- [Shuriken Studio Fantasy kits](https://shuriken.studio/kits/fantasy)
- [Quaternius](https://quaternius.com/)
- [Medieval Basics Free — Munchkin Jonesy](https://munchkin-jonesy.itch.io/medieval-basics-free)
- [Low Poly Medieval Square Pack — Reodesuxz](https://reodesuxz.itch.io/low-poly-medieval-square-pack)
- [PSX Medieval Village Kit Free — HeyHeyThere](https://heyheythere.itch.io/psx-medieval-village-kit-free)
- [Mini Dungeon — Kenney](https://kenney.nl/assets/mini-dungeon)
- [Dungeon Basics Free — Munchkin Jonesy](https://munchkin-jonesy.itch.io/dungeon-basics-free)
- [Shuriken Studio kits](https://shuriken.studio/kits)
- [Poly Haven](https://polyhaven.com/)
- [ambientCG](https://ambientcg.com/)
- [Cinzel — Google Fonts](https://fonts.google.com/specimen/Cinzel)
- [Alegreya SC — Google Fonts](https://fonts.google.com/specimen/Alegreya+SC)
- [MedievalSharp — Google Fonts](https://fonts.google.com/specimen/MedievalSharp)

**Status da avaliação:** confirmar licença e redistribuição para cada pacote antes de baixar; depois selecionar apenas os modelos que cobrem um papel útil e coerente com o visual do jogo. A integração final deve registrar no mesmo commit a fonte/licença e a função no gameplay.
