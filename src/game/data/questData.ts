import type { QuestDef } from './types'

/**
 * Every quest in Eclipse: O Mundo Esquecido.
 *
 * `principal-01` .. `principal-10` form the main chain (one per chapter, each ending in a boss),
 * `secundaria-01` .. `secundaria-15` are optional stories spread over the world, and
 * `cacada-01` .. `cacada-08` are repeatable-feeling bounty hunts offered by hunters and guards.
 */
export const QUESTS: QuestDef[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Main chain — chapters 1 to 10
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'principal-01',
    name: 'O Despertar',
    type: 'principal',
    chapter: 1,
    giver: 'iara',
    minLevel: 1,
    marker: 'vila-brumal',
    summary:
      'Você acorda na Floresta de Brumal sem memória e com uma marca que arde no braço. Iara, a anciã da vila, quer saber o que você é antes que a floresta descubra sozinha.',
    description:
      'A chuva ainda escorre das folhas quando você abre os olhos, e a única coisa que lembra é o próprio nome. A marca no seu braço pulsa como um segundo coração, e cada lobo sombrio da clareira parece sentir o cheiro dela. Iara diz que sobreviver ao primeiro dia já é um sinal, mas sobreviver ao guardião da floresta seria uma resposta.',
    objectives: [
      { id: 'obj-p01-1', kind: 'matar', target: 'lobo-sombrio', count: 3, label: 'Clareira de Brumal: derrote 3 lobos sombrios' },
      { id: 'obj-p01-2', kind: 'coletar', target: 'mat-erva', count: 3, label: 'Bosque de Brumal: colha 3 ervas curativas para a vila' },
      { id: 'obj-p01-3', kind: 'falar', target: 'velho-thom', count: 1, label: 'Vila de Brumal: fale com Velho Thom sobre a marca' },
      { id: 'obj-p01-4', kind: 'chefe', target: 'guardiao-floresta-corrompido', count: 1, label: 'Clareira profunda: derrote o Guardião corrompido' },
    ],
    rewards: {
      xp: 120,
      gold: 60,
      items: [
        { itemId: 'pocao-vida-1', count: 2 },
        { itemId: 'comida-pao', count: 3 },
        { itemId: 'armadura-andarilho', count: 1 },
      ],
    },
    next: 'principal-02',
  },
  {
    id: 'principal-02',
    name: 'Lâminas na Estrada',
    type: 'principal',
    chapter: 2,
    giver: 'capitao-ronan',
    minLevel: 5,
    marker: 'cidade-aster',
    summary:
      'Os goblins desceram das colinas e estão cortando a estrada de Aster. O capitão Ronan precisa de alguém que ainda tenha joelhos inteiros.',
    description:
      'A cidade de Aster cheira a fumaça e a medo. Ronan conta que os batedores goblins estão testando as defesas há três semanas, e que o xamã por trás disso carrega um machado grande demais para o próprio corpo. A milícia está cansada; você não. Por enquanto.',
    objectives: [
      { id: 'obj-p02-1', kind: 'matar', target: 'goblin', count: 6, label: 'Dizimar os batedores goblins na estrada (6)' },
      { id: 'obj-p02-2', kind: 'coletar', target: 'mat-ferro', count: 4, label: 'Recolher minério de ferro para as lanças da milícia (4)' },
      { id: 'obj-p02-3', kind: 'falar', target: 'bruno-ferreiro', count: 1, label: 'Levar o minério ao ferreiro Bruno' },
      { id: 'obj-p02-4', kind: 'chefe', target: 'senhor-da-guerra-goblin', count: 1, label: 'Derrubar Grakk, o Senhor da Guerra Goblin' },
    ],
    rewards: {
      xp: 320,
      gold: 150,
      items: [
        { itemId: 'arma-espada-2', count: 1 },
        { itemId: 'pocao-vida-2', count: 2 },
      ],
    },
    next: 'principal-03',
    requires: ['principal-01'],
  },
  {
    id: 'principal-03',
    name: 'Ossos sob a Terra',
    type: 'principal',
    chapter: 3,
    giver: 'padre-anselmo',
    minLevel: 9,
    marker: 'masmorra-ossos',
    summary:
      'Os mortos de Aster não descansam mais. Padre Anselmo ouviu tambores vindos da masmorra antiga e pediu que você desça antes que algo suba.',
    description:
      'O sino da capela toca sozinho desde a lua passada, e o padre jura que os túmulos amanhecem com a terra revirada. Nas catacumbas, um rei sem carne recolhe ossos como quem coleciona moedas. Anselmo não vai dizer em voz alta, mas tem medo de que a coroa reconheça o seu braço.',
    objectives: [
      { id: 'obj-p03-1', kind: 'matar', target: 'esqueleto-guerreiro', count: 8, label: 'Silenciar os esqueletos guerreiros da catacumba (8)' },
      { id: 'obj-p03-2', kind: 'interagir', target: 'masmorra-ossos', count: 1, label: 'Examinar o altar de ossos no fundo da masmorra' },
      { id: 'obj-p03-3', kind: 'falar', target: 'marta-alquimista', count: 1, label: 'Pedir a Marta um preparo contra o pó das criptas' },
      { id: 'obj-p03-4', kind: 'chefe', target: 'rei-dos-ossos', count: 1, label: 'Enfrentar Morvath, o Rei dos Ossos' },
    ],
    rewards: {
      xp: 620,
      gold: 270,
      items: [
        { itemId: 'pocao-vida-2', count: 3 },
        { itemId: 'anel-safira', count: 1 },
      ],
    },
    next: 'principal-04',
    requires: ['principal-02'],
  },
  {
    id: 'principal-04',
    name: 'Sede de Areia',
    type: 'principal',
    chapter: 4,
    giver: 'sora-cacadora',
    minLevel: 14,
    marker: 'ruinas-kharun',
    summary:
      'Sora segue rastros de caravanas que somem nas dunas de Kharun. O que sobra delas não é sangue: é vidro derretido.',
    description:
      'Kharun foi uma cidade de bibliotecas antes de virar um forno de areia. Sora já perdeu dois clientes para o mesmo buraco que se move sob as dunas, e agora quer alguém ao lado dela quando for olhar de perto. As ruínas ainda guardam portas que abrem para baixo.',
    objectives: [
      { id: 'obj-p04-1', kind: 'matar', target: 'escorpiao-das-dunas', count: 6, label: 'Limpar os escorpiões das dunas no caminho (6)' },
      { id: 'obj-p04-2', kind: 'coletar', target: 'mat-osso', count: 5, label: 'Recolher ossos antigos para identificar as vítimas (5)' },
      { id: 'obj-p04-3', kind: 'chegar', target: 'ruinas-kharun', count: 1, label: 'Chegar às ruínas de Kharun' },
      { id: 'obj-p04-4', kind: 'chefe', target: 'verme-das-areias', count: 1, label: 'Matar Sarkhys, o Verme das Areias' },
    ],
    rewards: {
      xp: 1150,
      gold: 460,
      items: [
        { itemId: 'arma-arco-3', count: 1 },
        { itemId: 'pocao-stamina', count: 4 },
      ],
    },
    next: 'principal-05',
    requires: ['principal-03'],
  },
  {
    id: 'principal-05',
    name: 'O Silêncio da Geleira',
    type: 'principal',
    chapter: 5,
    giver: 'mago-eldrin',
    minLevel: 18,
    marker: 'geleira-skadi',
    summary:
      'Algo dorme sob o gelo de Skadi e o frio está subindo. Eldrin diz que o gelo não é clima: é uma respiração.',
    description:
      'Eldrin passou quarenta anos estudando as sete entidades e nunca viu uma delas respirar. Agora o gelo de Skadi avança alguns metros por noite, e os aldeões juram ouvir passos dentro da geleira. O eremita Vekh vive lá em cima e sabe mais do que admite.',
    objectives: [
      { id: 'obj-p05-1', kind: 'matar', target: 'elemental-de-gelo', count: 6, label: 'Dissipar os elementais de gelo da geleira (6)' },
      { id: 'obj-p05-2', kind: 'falar', target: 'eremita-vekh', count: 1, label: 'Encontrar o eremita Vekh nas cavernas de gelo' },
      { id: 'obj-p05-3', kind: 'interagir', target: 'geleira-skadi', count: 1, label: 'Tocar o núcleo azul no coração da geleira' },
      { id: 'obj-p05-4', kind: 'chefe', target: 'gigante-do-gelo', count: 1, label: 'Derrubar Hrimgar, o Gigante do Gelo' },
    ],
    rewards: {
      xp: 1750,
      gold: 700,
      items: [
        { itemId: 'armadura-sentinela', count: 1 },
        { itemId: 'pocao-vida-3', count: 2 },
      ],
    },
    next: 'principal-06',
    requires: ['principal-04'],
  },
  {
    id: 'principal-06',
    name: 'O Juramento Quebrado',
    type: 'principal',
    chapter: 6,
    giver: 'guarda-torv',
    minLevel: 22,
    marker: 'castelo-abandonado',
    summary:
      'Torv serviu no castelo abandonado quando ainda era um castelo. Ele quer que você entre e traga de volta o brasão do comandante — ou o que restou dele.',
    description:
      'A ordem que guardava o castelo jurou proteger Aetherion até o último homem, e cumpriu: ninguém saiu. Torv ainda limpa a armadura toda manhã, esperando ordens que não vêm há sete séculos. Lá dentro, alguém ainda marcha em formação.',
    objectives: [
      { id: 'obj-p06-1', kind: 'matar', target: 'cavaleiro-corrompido', count: 5, label: 'Libertar os cavaleiros corrompidos do castelo (5)' },
      { id: 'obj-p06-2', kind: 'coletar', target: 'mat-prata', count: 4, label: 'Recolher prata dos altares para a forja de Bruno (4)' },
      { id: 'obj-p06-3', kind: 'chefe', target: 'comandante-cavaleiro-corrompido', count: 1, label: 'Enfrentar Aldren, o Comandante Corrompido' },
    ],
    rewards: {
      xp: 2600,
      gold: 1050,
      items: [
        { itemId: 'botas-sentinela', count: 1 },
        { itemId: 'pocao-vida-3', count: 3 },
      ],
    },
    next: 'principal-07',
    requires: ['principal-05'],
  },
  {
    id: 'principal-07',
    name: 'Fogo na Montanha',
    type: 'principal',
    chapter: 7,
    giver: 'bruno-ferreiro',
    minLevel: 26,
    marker: 'vulcao-ignar',
    summary:
      'O vulcão Ignar acordou e o ar de Aster ficou amarelo. Bruno precisa de obsidiana fresca — e de alguém que sobreviva ao caminho até ela.',
    description:
      'Bruno bate o martelo no ferro com raiva desde que a forja começou a rachar com os tremores. Ele diz que obsidiana do Ignar faz lâminas que não quebram, e que uma lâmina assim vai ser necessária em breve. O problema é que o vulcão tem um dono alado.',
    objectives: [
      { id: 'obj-p07-1', kind: 'matar', target: 'diabrete-de-magma', count: 6, label: 'Expulsar os diabretes de magma das encostas (6)' },
      { id: 'obj-p07-2', kind: 'coletar', target: 'mat-obsidiana', count: 4, label: 'Quebrar obsidiana nas veias de lava (4)' },
      { id: 'obj-p07-3', kind: 'chefe', target: 'draco-vulcanico', count: 1, label: 'Abater Ignivar, o Draco Vulcânico' },
    ],
    rewards: {
      xp: 3600,
      gold: 1500,
      items: [
        { itemId: 'arma-machado-4', count: 1 },
        { itemId: 'mat-escama', count: 3 },
      ],
    },
    next: 'principal-08',
    requires: ['principal-06'],
  },
  {
    id: 'principal-08',
    name: 'O Culto do Eclipse',
    type: 'principal',
    chapter: 8,
    giver: 'curandeira-ysa',
    minLevel: 30,
    marker: 'templo-esquecido',
    summary:
      'Ysa está perdendo pacientes para uma febre que não é febre: eles sussurram um nome e apagam. O rastro leva ao templo esquecido.',
    description:
      'No acampamento, as pessoas adoecidas desenham o mesmo símbolo no chão antes de dormir. Ysa já queimou três colchões e nenhum sussurro. O templo esquecido foi erguido para as sete entidades, mas hoje só uma responde às preces — e ela cobra caro.',
    objectives: [
      { id: 'obj-p08-1', kind: 'matar', target: 'sacerdote-corrompido', count: 5, label: 'Interromper os sacerdotes corrompidos do ritual (5)' },
      { id: 'obj-p08-2', kind: 'coletar', target: 'mat-fragmento', count: 1, label: 'Recolher um fragmento do Eclipse do altar' },
      { id: 'obj-p08-3', kind: 'interagir', target: 'templo-esquecido', count: 1, label: 'Profanar o círculo de sangue no templo' },
      { id: 'obj-p08-4', kind: 'chefe', target: 'sacerdote-sombrio-do-eclipse', count: 1, label: 'Enfrentar Vaelith, o Sacerdote Sombrio' },
    ],
    rewards: {
      xp: 5000,
      gold: 2100,
      items: [
        { itemId: 'reliquia-olho', count: 1 },
        { itemId: 'elixir-eclipse', count: 1 },
      ],
    },
    next: 'principal-09',
    requires: ['principal-07'],
  },
  {
    id: 'principal-09',
    name: 'O Coração da Cratera',
    type: 'principal',
    chapter: 9,
    giver: 'mago-eldrin',
    minLevel: 34,
    marker: 'cratera-eclipse',
    summary:
      'A cratera do Eclipse nunca esfriou. Eldrin quer que você desça até o fundo, onde o mundo foi arrancado, e veja com os próprios olhos o que ficou no lugar.',
    description:
      'De cima, a cratera parece uma boca aberta no mapa. Lá embaixo não há escuridão: há uma luz que não ilumina nada. Eldrin avisa que o que guarda o fundo não é um monstro, é um pedaço do mundo tentando se levantar.',
    objectives: [
      { id: 'obj-p09-1', kind: 'matar', target: 'cavaleiro-do-vazio', count: 6, label: 'Deter os cavaleiros do vazio na descida (6)' },
      { id: 'obj-p09-2', kind: 'chegar', target: 'cratera-eclipse', count: 1, label: 'Chegar à borda da cratera do Eclipse' },
      { id: 'obj-p09-3', kind: 'chefe', target: 'colosso-da-cratera', count: 1, label: 'Derrubar o Colosso da Cratera' },
    ],
    rewards: {
      xp: 7000,
      gold: 3000,
      items: [
        { itemId: 'reliquia-brasao', count: 1 },
        { itemId: 'armadura-eclipse', count: 1 },
      ],
    },
    next: 'principal-10',
    requires: ['principal-08'],
  },
  {
    id: 'principal-10',
    name: 'O Soberano da Sombra',
    type: 'principal',
    chapter: 10,
    giver: 'iara',
    minLevel: 38,
    marker: 'ilha-secreta',
    summary:
      'Nyxharion, a entidade que traiu as outras seis, espera na ilha secreta. Iara diz que ninguém volta de lá — e que talvez você seja a primeira exceção em setecentos anos.',
    description:
      'A marca no seu braço arde sem parar desde a cratera, como se soubesse o caminho. Iara chora sem esconder o rosto pela primeira vez e pede que você lembre de quem era antes do Eclipse. Na ilha, o traidor veste a forma de tudo que você perdeu.',
    objectives: [
      { id: 'obj-p10-1', kind: 'matar', target: 'espectro-do-eclipse', count: 8, label: 'Atravessar os espectros que guardam a travessia (8)' },
      { id: 'obj-p10-2', kind: 'falar', target: 'eremita-vekh', count: 1, label: 'Receber a bênção final do eremita Vekh' },
      { id: 'obj-p10-3', kind: 'chegar', target: 'ilha-secreta', count: 1, label: 'Chegar à ilha secreta' },
      { id: 'obj-p10-4', kind: 'chefe', target: 'soberano-da-sombra', count: 1, label: 'Enfrentar Nyxharion, o Soberano da Sombra' },
    ],
    rewards: {
      xp: 9000,
      gold: 4000,
      items: [
        { itemId: 'reliquia-coracao', count: 1 },
        { itemId: 'elixir-eclipse', count: 2 },
      ],
    },
    requires: ['principal-09'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Side quests
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'secundaria-01',
    name: 'O Anel da Minha Falecida',
    type: 'secundaria',
    giver: 'velho-thom',
    minLevel: 3,
    marker: 'vila-brumal',
    summary:
      'Velho Thom perdeu o anel de casamento no bosque e tem vergonha de admitir que chorou. Ele jura que uma aranha brilhante levou a peça.',
    description:
      'Thom fala do anel como quem fala do joelho: com resignação e um pouco de raiva. A esposa morreu antes do Eclipse acabar de escurecer o céu, e o anel era a última coisa que ainda tinha o cheiro dela. Se você encontrar, não precisa contar a ninguém que ele chorou.',
    objectives: [
      { id: 'obj-s01-1', kind: 'matar', target: 'aranha-tecela', count: 2, label: 'Expulsar as aranhas do bosque onde o anel caiu (2)' },
      { id: 'obj-s01-2', kind: 'coletar', target: 'anel-andarilho', count: 1, label: 'Recuperar o anel de cobre no ninho' },
      { id: 'obj-s01-3', kind: 'falar', target: 'velho-thom', count: 1, label: 'Devolver o anel a Velho Thom' },
    ],
    rewards: {
      xp: 90,
      gold: 45,
      items: [{ itemId: 'comida-pao', count: 2 }],
    },
  },
  {
    id: 'secundaria-02',
    name: 'O Caldeirão Vazio',
    type: 'secundaria',
    giver: 'lena-taverna',
    minLevel: 5,
    marker: 'cidade-aster',
    summary:
      'A taverna de Lena virou enfermaria sem ela pedir. Ela precisa de ervas e de poções antes que os viajantes febris ocupem todas as mesas.',
    description:
      'Lena limpa canecas e testas na mesma toalha, e reclama dos dois com o mesmo carinho. O alambique emprestado de Marta fica no fundo da cozinha, entre panelas e um saco de ervas pela metade. Se você conseguir preparar as poções sem queimar as sobrancelhas, ela promete pagar em ouro e em sopa quente.',
    objectives: [
      { id: 'obj-s02-1', kind: 'coletar', target: 'mat-erva', count: 6, label: 'Colher erva curativa para o caldeirão (6)' },
      { id: 'obj-s02-2', kind: 'fabricar', target: 'receita-pocao-vida-2', count: 2, label: 'Preparar 2 Poções de Vida no alambique' },
      { id: 'obj-s02-3', kind: 'falar', target: 'lena-taverna', count: 1, label: 'Entregar as poções a Lena na taverna' },
    ],
    rewards: {
      xp: 160,
      gold: 80,
      items: [{ itemId: 'pocao-mana-1', count: 2 }],
    },
  },
  {
    id: 'secundaria-03',
    name: 'Linha, Paciência e Peixe',
    type: 'secundaria',
    giver: 'gil-pescador',
    minLevel: 6,
    marker: 'vila-brumal',
    summary:
      'Gil tem um problema simples: sem linha, sem peixe, sem jantar. E o lago está com um hóspede novo que ninguém convidou.',
    description:
      'Gil fala do mar como quem fala de um irmão difícil: com amor e queixa na mesma frase. Ele precisa de fibra para a linha e de coragem para tirar a serpente do lago, que anda engolindo as redes inteiras. Diz que o peixe do lago tem gosto de infância, e que ninguém deveria perder isso.',
    objectives: [
      { id: 'obj-s03-1', kind: 'coletar', target: 'mat-fibra', count: 6, label: 'Juntar fibra vegetal para as linhas de pesca (6)' },
      { id: 'obj-s03-2', kind: 'matar', target: 'serpente-do-pantano', count: 2, label: 'Afugentar as serpentes do lago (2)' },
      { id: 'obj-s03-3', kind: 'falar', target: 'gil-pescador', count: 1, label: 'Voltar a Gil com as linhas prontas' },
    ],
    rewards: {
      xp: 220,
      gold: 110,
      items: [
        { itemId: 'comida-peixe', count: 3 },
        { itemId: 'pocao-stamina', count: 1 },
      ],
    },
  },
  {
    id: 'secundaria-04',
    name: 'O Moinho que Geme',
    type: 'secundaria',
    giver: 'nina-crianca',
    minLevel: 8,
    marker: 'vila-brumal',
    summary:
      'Nina diz que tem um monstro no moinho velho e que ninguém acredita nela. Ela quer que você entre primeiro, porque ela tem apenas oito anos e planos melhores.',
    description:
      'Nina desenha o monstro no chão com um graveto: alto, sem rosto, com morcegos no lugar das mãos. Os adultos dizem que é imaginação, mas o moinho para de girar toda noite às mesmas horas. Se ela estiver certa, você vai precisar de mais do que um graveto.',
    objectives: [
      { id: 'obj-s04-1', kind: 'interagir', target: 'vila-brumal', count: 1, label: 'Entrar no moinho velho ao anoitecer' },
      { id: 'obj-s04-2', kind: 'matar', target: 'morcego-sombrio', count: 4, label: 'Expulsar os morcegos do telhado do moinho (4)' },
      { id: 'obj-s04-3', kind: 'matar', target: 'esqueleto-guerreiro', count: 3, label: 'Acabar com o que restou no porão (3)' },
      { id: 'obj-s04-4', kind: 'falar', target: 'nina-crianca', count: 1, label: 'Contar a Nina que o moinho está limpo' },
    ],
    rewards: {
      xp: 320,
      gold: 130,
      items: [{ itemId: 'comida-bolo', count: 1 }],
    },
  },
  {
    id: 'secundaria-05',
    name: 'A Ponte de Brumal',
    type: 'secundaria',
    giver: 'bruno-ferreiro',
    minLevel: 10,
    marker: 'vila-brumal',
    summary:
      'A ponte que liga a vila à estrada caiu com a última cheia. Bruno não pode sair da forja, mas pode mandar pregos e mau humor.',
    description:
      'Sem a ponte, a farinha não chega e o inverno chega de qualquer jeito. Bruno mede a madeira com os olhos e resmunga que qualquer um com dois braços conserta aquilo. Você tem dois braços. Ele também tem um martelo emprestado, se você prometer devolver.',
    objectives: [
      { id: 'obj-s05-1', kind: 'coletar', target: 'mat-madeira', count: 8, label: 'Cortar madeira de freixo para as vigas (8)' },
      { id: 'obj-s05-2', kind: 'coletar', target: 'mat-ferro', count: 4, label: 'Juntar minério de ferro para os pregos (4)' },
      { id: 'obj-s05-3', kind: 'falar', target: 'bruno-ferreiro', count: 1, label: 'Entregar o material a Bruno na forja' },
    ],
    rewards: {
      xp: 420,
      gold: 200,
      items: [{ itemId: 'botas-andarilho', count: 1 }],
    },
  },
  {
    id: 'secundaria-06',
    name: 'O Irmão que Não Voltou',
    type: 'secundaria',
    giver: 'gil-pescador',
    minLevel: 12,
    marker: 'ruinas-kharun',
    summary:
      'O irmão de Gil foi buscar sal nas ruínas de Kharun há dois meses. Gil não consegue ir, mas consegue implorar muito bem.',
    description:
      'Gil não dorme desde que o irmão partiu, e a rede dele continua pendurada na parede como se fosse voltar. Os rastros levam às ruínas, onde o vento assobia em intervalos estranhos. Talvez o irmão esteja vivo. Talvez você encontre apenas a mochila dele — mas alguém precisa saber.',
    objectives: [
      { id: 'obj-s06-1', kind: 'matar', target: 'mumia-errante', count: 3, label: 'Abrir caminho entre as múmias das ruínas (3)' },
      { id: 'obj-s06-2', kind: 'interagir', target: 'ruinas-kharun', count: 1, label: 'Procurar o acampamento do irmão nas ruínas' },
      { id: 'obj-s06-3', kind: 'falar', target: 'gil-pescador', count: 1, label: 'Levar notícias a Gil no porto' },
    ],
    rewards: {
      xp: 620,
      gold: 300,
      items: [{ itemId: 'anel-rubi', count: 1 }],
    },
    requires: ['secundaria-03'],
  },
  {
    id: 'secundaria-07',
    name: 'Escolta até Aster',
    type: 'secundaria',
    giver: 'mercador-jask',
    minLevel: 14,
    marker: 'cidade-aster',
    summary:
      'Jask comprou especiarias caras demais e agora precisa atravessar a estrada dos bandidos. Ele paga bem e fala ainda melhor.',
    description:
      'Jask tem uma carroça, três arcas e nenhuma espada. Ele oferece desconto vitalício na loja, o que, considerando os preços dele, é quase uma ameaça. A estrada tem emboscadas a cada curva, e os bandidos já sabem que a carroça dele está carregada.',
    objectives: [
      { id: 'obj-s07-1', kind: 'matar', target: 'bandido-emboscador', count: 5, label: 'Eliminar os bandidos da estrada (5)' },
      { id: 'obj-s07-2', kind: 'chegar', target: 'cidade-aster', count: 1, label: 'Escoltar a carroça até Aster' },
    ],
    rewards: {
      xp: 780,
      gold: 420,
      items: [{ itemId: 'pocao-vida-2', count: 3 }],
    },
  },
  {
    id: 'secundaria-08',
    name: 'A Presa Maior',
    type: 'secundaria',
    giver: 'sora-cacadora',
    minLevel: 16,
    marker: 'vila-brumal',
    summary:
      'Sora quer o urso que anda arrancando portas de celeiro. Não por vingança: por princípio profissional.',
    description:
      'Sora trata a caçada como um contrato e o urso como um cliente difícil. Ele já comeu três ovelhas, duas portas e a dignidade de um fazendeiro. Ela quer o couro, a vila quer a paz, e você quer não ser a terceira opção na fila do urso.',
    objectives: [
      { id: 'obj-s08-1', kind: 'matar', target: 'urso-das-cavernas', count: 3, label: 'Caçar os ursos das cavernas (3)' },
      { id: 'obj-s08-2', kind: 'coletar', target: 'mat-couro', count: 5, label: 'Recolher couro curtido para os celeiros (5)' },
      { id: 'obj-s08-3', kind: 'falar', target: 'sora-cacadora', count: 1, label: 'Fechar o contrato com Sora' },
    ],
    rewards: {
      xp: 900,
      gold: 480,
      items: [{ itemId: 'arma-arco-2', count: 1 }],
    },
  },
  {
    id: 'secundaria-09',
    name: 'O Guardião de Pedra',
    type: 'secundaria',
    giver: 'mago-eldrin',
    minLevel: 20,
    marker: 'templo-esquecido',
    summary:
      'Um golem de pedra acordou no templo esquecido e está desmontando o que sobrou dele. Eldrin quer os cacos — e, se possível, os símbolos gravados neles.',
    description:
      'Eldrin explica que o golem não é um monstro, é uma fechadura com pernas. Ele guarda uma câmara que ninguém abriu desde o Eclipse, e a chave, ironicamente, é quebrá-lo. O mago parece mais animado com a pesquisa do que com a sua segurança.',
    objectives: [
      { id: 'obj-s09-1', kind: 'matar', target: 'golem-de-pedra', count: 3, label: 'Desmontar os golems de pedra do templo (3)' },
      { id: 'obj-s09-2', kind: 'coletar', target: 'mat-cristal', count: 3, label: 'Recolher cristais de gelo do núcleo dos golems (3)' },
      { id: 'obj-s09-3', kind: 'interagir', target: 'templo-esquecido', count: 1, label: 'Abrir a câmara selada sob o templo' },
      { id: 'obj-s09-4', kind: 'falar', target: 'mago-eldrin', count: 1, label: 'Mostrar os símbolos a Eldrin' },
    ],
    rewards: {
      xp: 1200,
      gold: 620,
      items: [{ itemId: 'anel-cacador', count: 1 }],
    },
    requires: ['principal-05'],
  },
  {
    id: 'secundaria-10',
    name: 'Remédio para os Feridos',
    type: 'secundaria',
    giver: 'curandeira-ysa',
    minLevel: 24,
    marker: 'cratera-eclipse',
    summary:
      'O acampamento está cheio de feridos e Ysa está com as mãos vazias. Ela precisa de ervas, de poções e de alguém que não desmaie ao ver sangue.',
    description:
      'Ysa costura braços com a calma de quem já viu pior, mas hoje a voz dela falha ao falar dos estoques. Metade dos feridos veio da cratera e não deveria ter voltado. Ela não pergunta o que você viu lá; pergunta se você pode ajudar a manter alguém vivo até amanhã.',
    objectives: [
      { id: 'obj-s10-1', kind: 'coletar', target: 'mat-erva', count: 10, label: 'Colher erva curativa para os curativos (10)' },
      { id: 'obj-s10-2', kind: 'fabricar', target: 'receita-pocao-vida-3', count: 2, label: 'Preparar 2 Poções de Vida Maiores' },
      { id: 'obj-s10-3', kind: 'falar', target: 'curandeira-ysa', count: 1, label: 'Entregar os remédios a Ysa' },
    ],
    rewards: {
      xp: 1500,
      gold: 800,
      items: [
        { itemId: 'pocao-vida-3', count: 3 },
        { itemId: 'reliquia-pena', count: 1 },
      ],
    },
  },
  {
    id: 'secundaria-11',
    name: 'O Bardo Sem Voz',
    type: 'secundaria',
    giver: 'bardo-luan',
    minLevel: 28,
    marker: 'geleira-skadi',
    summary:
      'Luan perdeu o alaúde para harpias na geleira e, pior, perdeu a rima. Ele jura que sem o instrumento não consegue compor — e sem compor, não consegue viver.',
    description:
      'Luan dramatiza a própria tragédia com gestos largos e um cachecol ridículo. A verdade é que as harpias levaram o alaúde para o ninho, junto com metade do repertório dele. Ele oferece uma música em troca; você provavelmente vai aceitar só para ele parar de falar.',
    objectives: [
      { id: 'obj-s11-1', kind: 'matar', target: 'yeti-das-neves', count: 3, label: 'Afastar os yetis do caminho do ninho (3)' },
      { id: 'obj-s11-2', kind: 'coletar', target: 'mat-pena', count: 4, label: 'Recolher penas de harpia do ninho (4)' },
      { id: 'obj-s11-3', kind: 'falar', target: 'bardo-luan', count: 1, label: 'Devolver o alaúde a Luan' },
    ],
    rewards: {
      xp: 2000,
      gold: 1000,
      items: [{ itemId: 'comida-bolo', count: 3 }],
    },
  },
  {
    id: 'secundaria-12',
    name: 'O Último Segredo de Vekh',
    type: 'secundaria',
    giver: 'eremita-vekh',
    minLevel: 35,
    marker: 'templo-esquecido',
    summary:
      'Vekh passou a vida escondendo um fragmento do Eclipse. Agora que a ilha secreta apareceu no horizonte, ele quer se livrar dele — mas não sozinho.',
    description:
      'O eremita nunca diz o próprio nome sem hesitar, como se tivesse esquecido de propósito. Ele carrega um fragmento que não reflete luz e que sussurra nomes de entidades. Diz que guardou aquilo por medo e que, no fim, guardar também é uma forma de servir ao inimigo.',
    objectives: [
      { id: 'obj-s12-1', kind: 'matar', target: 'cavaleiro-do-vazio', count: 4, label: 'Deter os cavaleiros do vazio que seguem o fragmento (4)' },
      { id: 'obj-s12-2', kind: 'coletar', target: 'mat-fragmento', count: 2, label: 'Recolher fragmentos do Eclipse para o ritual (2)' },
      { id: 'obj-s12-3', kind: 'falar', target: 'eremita-vekh', count: 1, label: 'Assistir ao ritual de Vekh' },
    ],
    rewards: {
      xp: 2600,
      gold: 1400,
      items: [
        { itemId: 'reliquia-lagrima', count: 1 },
        { itemId: 'elixir-eclipse', count: 1 },
      ],
    },
    requires: ['principal-09'],
  },

  // Optional memory arc — Vekh's guilt, the protagonist's lost past, and a chosen duty.
  {
    id: 'secundaria-13',
    name: 'A Primeira Lembrança',
    type: 'secundaria',
    giver: 'eremita-vekh',
    minLevel: 18,
    marker: 'geleira-skadi',
    summary: 'O gelo devolve um eco à marca. Vekh pede que você o escute sem forçar a memória.',
    description:
      'Elementais de Skadi retêm ressonâncias do antigo selo. Dissipe três e leve o eco a Iara; depois, volte a Vekh. Uma lembrança pode ser só um começo.',
    objectives: [
      { id: 'obj-s13-1', kind: 'matar', target: 'elemental-de-gelo', count: 3, label: 'Dissipar elementais que guardam o eco (3)' },
      { id: 'obj-s13-2', kind: 'falar', target: 'iara', count: 1, label: 'Contar a Iara o que a marca revelou' },
    ],
    rewards: { xp: 500, gold: 220 },
    requires: ['principal-05'],
  },
  {
    id: 'secundaria-14',
    name: 'O Nome que Você Guardou',
    type: 'secundaria',
    giver: 'iara',
    minLevel: 30,
    marker: 'templo-esquecido',
    summary: 'Iara pede que Vekh conte o que a marca ainda esconde.',
    description:
      'Os ecos apontam para o templo e para a noite do Eclipse. Afaste os sacerdotes que rondam o selo e obrigue Vekh a dizer a verdade, não apenas metade dela.',
    objectives: [
      { id: 'obj-s14-1', kind: 'matar', target: 'sacerdote-corrompido', count: 2, label: 'Interromper os sacerdotes junto ao selo (2)' },
      { id: 'obj-s14-2', kind: 'falar', target: 'eremita-vekh', count: 1, label: 'Ouvir a confissão de Vekh' },
    ],
    rewards: { xp: 1500, gold: 700 },
    requires: ['secundaria-13', 'principal-08'],
  },
  {
    id: 'secundaria-15',
    name: 'A Dívida dos Nomes',
    type: 'secundaria',
    giver: 'eremita-vekh',
    minLevel: 34,
    marker: 'cratera-eclipse',
    summary: 'Vekh não pede perdão: pede ajuda para impedir que a velha culpa fira outros.',
    description:
      'Cavaleiros do vazio seguem os nomes que você protegeu. Derrote três, conte a Iara o que Vekh fez e retorne a ele. A escolha de como seguir pertence a você.',
    objectives: [
      { id: 'obj-s15-1', kind: 'matar', target: 'cavaleiro-do-vazio', count: 3, label: 'Deter os cavaleiros que farejam o selo (3)' },
      { id: 'obj-s15-2', kind: 'falar', target: 'iara', count: 1, label: 'Deixar Iara conhecer toda a verdade' },
    ],
    rewards: { xp: 3000, gold: 1500 },
    requires: ['secundaria-14', 'principal-09'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Hunts — one kill objective each, paid in gold
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'cacada-01',
    name: 'Cães da Névoa',
    type: 'cacada',
    giver: 'sora-cacadora',
    minLevel: 4,
    marker: 'vila-brumal',
    summary: 'Lobos sombrios estão cercando os pastos de Brumal. Sora paga por rabo, e não pergunta como você conseguiu.',
    description:
      'A matilha aprendeu a esperar o pastor virar as costas. Sora já marcou o território no mapa com carvão e um desenho de lobo bastante ofensivo. Traga seis e ela talvez sorria.',
    objectives: [{ id: 'obj-c01-1', kind: 'matar', target: 'lobo-sombrio', count: 6, label: 'Abater lobos sombrios (6)' }],
    rewards: { xp: 80, gold: 90 },
  },
  {
    id: 'cacada-02',
    name: 'Batedores na Estrada',
    type: 'cacada',
    giver: 'capitao-ronan',
    minLevel: 7,
    marker: 'cidade-aster',
    summary: 'A milícia não tem homens para patrulhar a estrada. Ronan tem ouro e uma expressão de quem não dorme há dias.',
    description:
      'Os goblins estão testando a paciência de Aster em pequenos grupos, sempre ao amanhecer. Ronan quer oito batedores a menos antes que o conselho pergunte por que a estrada está fechada. Ele não vai dizer obrigado, mas vai pagar.',
    objectives: [{ id: 'obj-c02-1', kind: 'matar', target: 'goblin', count: 8, label: 'Abater batedores goblins (8)' }],
    rewards: { xp: 150, gold: 140 },
  },
  {
    id: 'cacada-03',
    name: 'Patas nas Cavernas',
    type: 'cacada',
    giver: 'sora-cacadora',
    minLevel: 10,
    marker: 'castelo-abandonado',
    summary: 'Um urso grande demais para o próprio território está descendo das cavernas. Sora quer o couro antes que ele chegue aos celeiros.',
    description:
      'Os caçadores dizem que este urso não foge de tocha nem de cão. Ele já virou duas carroças e uma cerca inteira. Sora sugere lança; você pode sugerir bom senso, mas ela não vai ouvir.',
    objectives: [{ id: 'obj-c03-1', kind: 'matar', target: 'urso-das-cavernas', count: 4, label: 'Caçar ursos das cavernas (4)' }],
    rewards: { xp: 300, gold: 220, items: [{ itemId: 'mat-couro', count: 3 }] },
  },
  {
    id: 'cacada-04',
    name: 'O Que Sobe do Poço',
    type: 'cacada',
    giver: 'guarda-torv',
    minLevel: 15,
    marker: 'masmorra-ossos',
    summary: 'Torv ouve arranhões nos túneis sob a guarda. Ele não pode abandonar o posto, mas pode pagar quem desça.',
    description:
      'Os túmulos do castelo têm raízes que se mexem sozinhas, e Torv jura que ouviu uma múmia tossir. Ele fala disso com a seriedade de um soldado e o medo de um homem que já viu demais. Três múmias a menos e o posto volta a ser silencioso.',
    objectives: [{ id: 'obj-c04-1', kind: 'matar', target: 'mumia-errante', count: 5, label: 'Destruir múmias errantes (5)' }],
    rewards: { xp: 480, gold: 360 },
  },
  {
    id: 'cacada-05',
    name: 'Calor nas Veias',
    type: 'cacada',
    giver: 'marta-alquimista',
    minLevel: 19,
    marker: 'vulcao-ignar',
    summary: 'Marta paga bem pelo núcleo de um golem de magma, e paga ainda melhor por quatro. Ela não explica para que quer aquilo.',
    description:
      'Ninguém caça golems de magma por prazer: eles não deixam couro, não deixam carne, só uma pedra quente que vale ouro em Aster. Marta quer os núcleos inteiros, embrulhados em pano de linho, e avisa que não aceita nada rachado. O segredo, dizem os caçadores, é bater nas pernas e não ficar parado.',
    objectives: [{ id: 'obj-c05-1', kind: 'matar', target: 'golem-de-magma', count: 4, label: 'Destruir golems de magma (4)' }],
    rewards: { xp: 720, gold: 520, items: [{ itemId: 'mat-obsidiana', count: 2 }] },
  },
  {
    id: 'cacada-06',
    name: 'Pegadas na Neve',
    type: 'cacada',
    giver: 'sora-cacadora',
    minLevel: 26,
    marker: 'geleira-skadi',
    summary: 'Os yetis desceram da geleira e estão atacando as trilhas de caça. Sora quer quatro antes que o inverno feche as passagens.',
    description:
      'A neve de Skadi apaga rastros em minutos, e os yetis sabem disso melhor que qualquer caçador. Sora perdeu um cão na última subida e não fala do assunto. Se você voltar com quatro peles, ela vai dividir o pagamento sem discutir.',
    objectives: [{ id: 'obj-c06-1', kind: 'matar', target: 'yeti-das-neves', count: 4, label: 'Caçar yetis das neves (4)' }],
    rewards: { xp: 1100, gold: 900, items: [{ itemId: 'pocao-vida-3', count: 2 }] },
  },
  {
    id: 'cacada-07',
    name: 'Passos de Titã',
    type: 'cacada',
    giver: 'mago-eldrin',
    minLevel: 30,
    marker: 'cratera-eclipse',
    summary: 'Um gigante antigo atravessou a cratera e caminha para o sul. Eldrin quer saber para onde ele vai — e que ele pare de ir.',
    description:
      'Eldrin calcula que o gigante tem idade suficiente para ter visto o Eclipse de perto. Isso significa que ele pode estar carregando algo, ou seguindo alguém. O mago pede três gigantes e, se possível, um pedaço de inscrição na pele deles.',
    objectives: [{ id: 'obj-c07-1', kind: 'matar', target: 'gigante-antigo', count: 3, label: 'Derrubar gigantes antigos (3)' }],
    rewards: { xp: 1600, gold: 1200, items: [{ itemId: 'reliquia-olho', count: 1 }] },
  },
  {
    id: 'cacada-08',
    name: 'Asas do Eclipse',
    type: 'cacada',
    giver: 'sora-cacadora',
    minLevel: 36,
    marker: 'ilha-secreta',
    summary: 'Dragões do Eclipse foram vistos sobre a costa. Sora não vai mentir: este contrato é grande demais para ela sozinha.',
    description:
      'É a primeira vez que Sora admite que precisa de ajuda, e ela odeia cada palavra. Três dragões, escamas que valem mais que uma casa e um céu que não reflete luz nenhuma. Se você aceitar, ela vai ao seu lado até o fim.',
    objectives: [{ id: 'obj-c08-1', kind: 'matar', target: 'dragao-do-eclipse', count: 3, label: 'Abater dragões do Eclipse (3)' }],
    rewards: {
      xp: 2400,
      gold: 1800,
      items: [
        { itemId: 'mat-escama', count: 4 },
        { itemId: 'elixir-eclipse', count: 1 },
      ],
    },
  },
]

const BY_ID = new Map(QUESTS.map(quest => [quest.id, quest]))

export function questById(id: string): QuestDef | undefined {
  return BY_ID.get(id)
}

/** The ten chapters of the main story, in order. */
export const MAIN_QUESTS: QuestDef[] = QUESTS.filter(quest => quest.type === 'principal')

/** Optional stories offered around the world. */
export const SIDE_QUESTS: QuestDef[] = QUESTS.filter(quest => quest.type === 'secundaria')

/** Bounty hunts: one target, one purse. */
export const HUNTS: QuestDef[] = QUESTS.filter(quest => quest.type === 'cacada')
