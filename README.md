# Eclipse: O Mundo Esquecido

Um ARPG de mundo aberto em 3D, jogável no navegador, feito com **Three.js**, **TypeScript** e **Vite**.
Há setecentos anos, o Eclipse partiu Aetherion e apagou o sol. Cristais antigos mantêm as regiões vivas;
algo no coração da Cicatriz está acordando. Você carrega a marca que pode fechá-la.

## O que o jogo tem

- **Mundo aberto procedural e determinístico** (seed aleatória por save, preservada ao continuar): continente de ~4 km, biomas de floresta,
  floresta densa, planície, pântano, deserto, neve, montanha, vulcão, cinzas, praia, ilha e oceano,
  com chunks em streaming, água animada, ciclo dia/noite, estrelas, nuvens e clima dinâmico
  (chuva, tempestade com raios, neblina, neve, tempestade de areia, chuva de cinzas).
- **13 pontos de interesse fixos** — vila, cidade, porto, castelo, masmorra, templos, ruínas,
  acampamentos, cratera e ilha secreta — mais assentamentos gerados pela seed, cada um com
  construções, NPCs, baús, veios de minério, ervas, estações de ofício e santuários.
- **Combate action**: 7 famílias de arma com alcance, ritmo, combos e ataques carregados; bloqueio,
  aparo (parry), esquiva com invulnerabilidade, críticos, roubo de vida, projéteis e reações
  elementais entre fogo, gelo, raio, terra, vento e sombra.
- **18 habilidades** (3 por elemento) com custo de mana, recarga e efeitos próprios, mais uma árvore
  de habilidades com três ramos (Lâmina, Arcano, Sombra) e 30 nós.
- **30 tipos de criaturas** com oito comportamentos de IA (melee, investida, à distância, conjurador,
  voador, bruto, assassino, invocador) e **10 chefes** com três fases, telegrafias no chão e
  conjuntos de ataques próprios.
- **12 animais Quaternius animados** por bioma (alpaca, touro, vaca, cervos, burro, raposa, cavalos,
  husky, shiba e lobo): animações de repouso, caminhada, galope e morte; podem ser caçados e dão
  carne, couro, XP e ouro usando o combate e a mochila existentes.
- **Progressão completa**: níveis até 50, atributos, pontos de habilidade, inventário com 7
  equipamentos, 6 raridades, conjuntos com bônus, aprimoramento no ferreiro, lojas, coleta e
  crafting (forja, alquimia, cozinha, bancada).
- **Campanha principal em 10 capítulos, 15 missões secundárias e 8 caçadas**, com prólogo narrativo no início,
  criação única de personagem com nome salvo e diálogos ramificados sobre as entidades, a memória perdida
  e o passado de Aetherion, além de 16 NPCs e lojas por especialidade.
- **Interface em português**: HUD com vida/mana/stamina, bússola, minimapa, rastreador de missões,
  barra de chefe, números de dano; painéis de inventário, habilidades, mapa, diário, crafting,
  loja, diálogo, pausa e configurações; controles por teclado/mouse e por toque.
- **Salvamento local** automático (progresso, posição, itens, missões, chefes derrotados, baús abertos,
  hora do mundo e nome do protagonista) com um único slot versionado; a campanha continua sem criar
  outro personagem a cada sessão.

## Como jogar

Jogue diretamente no [GitHub Pages](https://heitorfer143-eng.github.io/eclipse-o-mundo-esquecido/). O workflow compila o jogo e publica os arquivos de `dist/` automaticamente quando uma alteração chega ao branch `main`; esta versão estática não exige login.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + build de produção em dist/
pnpm preview
```

### Controles

| Ação | Teclado / mouse |
| --- | --- |
| Mover | `W` `A` `S` `D` |
| Olhar | mouse (clique para capturar) |
| Correr | `Shift` |
| Pular / planar | `Espaço` (segure no ar) |
| Rolar (esquiva) | `F` |
| Atacar (carregar) | clique esquerdo / `J` |
| Bloquear / aparar | clique direito / `Q` |
| Interagir | `E` |
| Elemento | `1` a `6` |
| Habilidades | `Z` `X` `C` |
| Poção | `H` |
| Inventário | `Tab` |
| Habilidades | `K` |
| Mapa | `M` |
| Diário | `L` |
| Pausa | `Esc` |

Em celulares e tablets aparecem joystick, área de olhar e botões de ação automaticamente.

## Estrutura

```
src/
  engine/        # save versionado, áudio sintetizado, input unificado
  game/
    core/        # RNG determinístico, ruído, matemática
    data/        # itens, criaturas, chefes, missões, NPCs, receitas, tipos
    world/       # terreno, chunks, props, estruturas, POIs, céu, água, clima
    entities/    # personagem, jogador, inimigos, chefes, NPCs, spawner, população
    combat/      # armas, dano elemental, habilidades, projéteis, efeitos
    systems/     # atributos, inventário, habilidades, missões, diálogo, economia, loot
    game.ts      # orquestrador da simulação
  ui/            # HUD, painéis, mapa, título, controles de toque, ícones SVG
  styles/        # design system em CSS
scripts/         # smoke test com Playwright
docs/            # arquitetura e capturas
```

## Estado

O jogo está em desenvolvimento iterativo, com mundo explorável, combate, progressão, missões,
inventário, diálogos e salvamento. Narrativa, controles móveis, desempenho e balanceamento seguem em
polimento; consulte `TODO.md` para o estado de cada parte.

Terreno, estruturas, personagens e efeitos visuais são gerados proceduralmente; música e efeitos sonoros
são sintetizados no navegador. Fontes e ícone da interface acompanham o projeto em `public/`.
