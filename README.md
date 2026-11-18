# Eclipse: O Mundo Esquecido

Um ARPG de mundo aberto em 3D, jogável no navegador, feito com **Three.js**, **TypeScript** e **Vite**.
O sol não nasce há trezentos anos: Aetherion sobrevive sob a luz de cristais antigos, e algo no coração
da Cicatriz está acordando. Você carrega a marca que pode fechá-la.

## O que o jogo tem

- **Mundo aberto procedural e determinístico** (seed fixa): continente de ~4 km, biomas de floresta,
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
- **Progressão completa**: níveis até 50, atributos, pontos de habilidade, inventário com 7
  equipamentos, 6 raridades, conjuntos com bônus, aprimoramento no ferreiro, lojas, coleta e
  crafting (forja, alquimia, cozinha, bancada).
- **Campanha em 8 capítulos**, missões secundárias, caçadas, diálogos ramificados com 16 NPCs e
  lojas por especialidade.
- **Interface em português**: HUD com vida/mana/stamina, bússola, minimapa, rastreador de missões,
  barra de chefe, números de dano; painéis de inventário, habilidades, mapa, diário, crafting,
  loja, diálogo, pausa e configurações; controles por teclado/mouse e por toque.
- **Salvamento local** automático (posição, nível, itens, missões, chefes derrotados, baús abertos,
  hora do mundo) com um único slot versionado.

## Como jogar

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

O jogo está jogável de ponta a ponta: criar personagem, explorar, lutar, aceitar missões, comprar,
craftar, enfrentar chefes e salvar. O balanceamento e a otimização continuam em ajuste — veja
`TODO.md` para o que falta.

Todo o conteúdo (modelos, texturas, sons, música) é gerado proceduralmente no navegador: não há
assets externos, então o jogo carrega rápido e funciona offline depois do primeiro acesso.
