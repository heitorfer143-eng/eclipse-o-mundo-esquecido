import type { NpcDef } from './types'

/**
 * Every character the player can talk to. Dialogue nodes are pure data: runtime code reads
 * `root`, follows `next` / `choices[].next` and executes `choices[].action`.
 *
 * A choice without `next` closes the conversation.
 */
export const NPCS: NpcDef[] = [
  {
    id: 'iara',
    name: 'Iara, a Anciã',
    role: 'anciao',
    home: 'vila',
    routine: 'sentar',
    colors: { body: '#c9b79c', accent: '#7d5ba6', glow: '#e6d3a3' },
    root: 'raiz',
    barks: [
      'A floresta fala com você, criança. Eu ouço.',
      'Sente-se. Ninguém precisa correr hoje.',
      'A marca arde mais perto da cratera. Sempre.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Você voltou. Sente-se, que a idade não me deixa ficar de pé por educação. A marca no seu braço está mais quieta hoje — isso é bom ou é muito ruim.',
        choices: [
          { text: 'Quem sou eu?', next: 'marca' },
          { text: 'O que foi o Eclipse?', next: 'eclipse' },
          { text: 'O que a marca está tentando lembrar?', next: 'memoria' },
          { text: 'Tem algo que eu possa fazer?', next: 'trabalho' },
          { text: 'Agora não, anciã.' },
        ],
      },
      marca: {
        id: 'marca',
        text: 'Se eu soubesse, teria dormido nas últimas sete noites. A marca é da mesma cor do céu naquele dia, e ninguém que a carregou até hoje viveu para contar. A floresta, porém, não fugiu de você.',
        choices: [
          { text: 'Então eu ajudo a vila. Aceito.', action: 'aceitar', quest: 'principal-01' },
          { text: 'O que a marca faz?', next: 'sete' },
          { text: 'Preciso de tempo.' },
        ],
      },
      eclipse: {
        id: 'eclipse',
        text: 'Há setecentos anos o sol não nasce inteiro. Sete entidades seguravam o mundo com as próprias mãos, e uma delas abriu os dedos de propósito. Chamamos aquilo de Eclipse porque "traição" era uma palavra grande demais para uma criança entender.',
        choices: [
          { text: 'Uma delas traiu as outras?', next: 'sete' },
          { text: 'Chega de histórias por hoje.' },
        ],
      },
      sete: {
        id: 'sete',
        text: 'Nyxharion. O nome é guardado como se falar alto pudesse chamá-lo de volta. Ele aprendeu que memória é a única coisa que uma entidade não consegue devorar — e por isso a sua está faltando.',
        choices: [
          { text: 'Vou lembrar disso, custe o que custar.' },
          { text: 'Quero voltar a falar com você.', next: 'raiz' },
        ],
      },
      memoria: {
        id: 'memoria',
        text: 'O eco do gelo aponta para o templo. Vekh guarda a parte que falta; desta vez, ele precisa dizer em voz alta o que fez e o que você escolheu.',
        choices: [
          { text: 'Vou ao templo ouvir Vekh.', action: 'aceitar', quest: 'secundaria-14' },
          { text: 'Vekh contou a verdade. Agora ela é de todos.', action: 'concluir', quest: 'secundaria-14' },
          { text: 'Vou pensar antes de voltar ao templo.', next: 'raiz' },
        ],
      },
      trabalho: {
        id: 'trabalho',
        text: 'Sempre há. Os lobos estão descendo e a clareira já não é nossa. Depois, quando você estiver inteiro, existe uma ilha no horizonte que ninguém deveria enxergar.',
        choices: [
          { text: 'Aceito cuidar da floresta.', action: 'aceitar', quest: 'principal-01' },
          { text: 'A clareira está limpa, anciã.', action: 'concluir', quest: 'principal-01' },
          { text: 'Estou pronto para a ilha.', action: 'aceitar', quest: 'principal-10' },
          { text: 'Volto depois.' },
        ],
      },
    },
  },
  {
    id: 'bruno-ferreiro',
    name: 'Bruno, o Ferreiro',
    role: 'ferreiro',
    home: 'cidade',
    shop: 'ferreiro',
    routine: 'forja',
    colors: { body: '#8a5a3b', accent: '#3f3f46', glow: '#ff8a3d' },
    root: 'raiz',
    barks: [
      'Se não vai comprar, sai da frente do martelo.',
      'Ferro bom não mente. Gente mente.',
      'Mais um tremor desses e a forja racha no meio.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Fala rápido, que o ferro esfria. E não encosta nesse martelo, ele tem história e eu tenho paciência curta.',
        choices: [
          { text: 'Quero usar a forja.', action: 'forja' },
          { text: 'Mostre o que tem à venda.', action: 'loja' },
          { text: 'Precisa de uma mão?', next: 'servico' },
          { text: 'O que você sabe do castelo?', next: 'aco' },
        ],
      },
      servico: {
        id: 'servico',
        text: 'Preciso de obsidiana do Ignar e de uma ponte que não caia. Escolhe. A ponte é mais chata, a obsidiana é mais quente.',
        choices: [
          { text: 'Vou buscar a obsidiana.', action: 'aceitar', quest: 'principal-07' },
          { text: 'Eu conserto a ponte.', action: 'aceitar', quest: 'secundaria-05' },
          { text: 'A ponte está de pé de novo.', action: 'concluir', quest: 'secundaria-05' },
          { text: 'O dragão caiu. A obsidiana é sua.', action: 'concluir', quest: 'principal-07' },
        ],
      },
      aco: {
        id: 'aco',
        text: 'Dizem que o comandante do castelo usava uma armadura que não amassava. Setecentos anos batendo e ela continua de pé, marchando. Isso não é aço, é teimosia.',
        choices: [
          { text: 'Talvez eu traga um pedaço dela.', next: 'servico' },
          { text: 'Posso usar sua forja?', next: 'forja' },
          { text: 'Boa sorte com o martelo.' },
        ],
      },
      forja: {
        id: 'forja',
        text: 'A bigorna é minha, o carvão é seu, o resultado é seu também. Se quebrar, não fui eu.',
        choices: [{ text: 'Entendido.' }],
      },
    },
  },
  {
    id: 'marta-alquimista',
    name: 'Marta, a Alquimista',
    role: 'alquimista',
    home: 'cidade',
    shop: 'alquimista',
    routine: 'vender',
    colors: { body: '#6b4f8a', accent: '#b6e36a', glow: '#a6ff5c' },
    root: 'raiz',
    barks: [
      'Não respire perto do frasco verde.',
      'Sim, é inflamável. Não, não é brincadeira.',
      'Onde você achou esse núcleo? Não, não me diga.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Não toque em nada. Não, nem nisso. Principalmente nisso. O que você quer? Rápido, o frasco azul está prestes a decidir o próprio futuro.',
        choices: [
          { text: 'Quero comprar reagentes.', action: 'loja' },
          { text: 'Tem algum trabalho perigoso?', next: 'servico' },
          { text: 'O que há no frasco azul?', next: 'laboratorio' },
          { text: 'Vou sair antes que exploda.' },
        ],
      },
      servico: {
        id: 'servico',
        text: 'Perigoso? Sim. Golems de magma têm um núcleo que continua quente por décadas, e eu preciso de quatro inteiros. Não rachados. Já disse que não aceito rachado?',
        choices: [
          { text: 'Aceito trazer os núcleos.', action: 'aceitar', quest: 'cacada-05' },
          { text: 'Quatro núcleos, inteiros. Prontos.', action: 'concluir', quest: 'cacada-05' },
          { text: 'Prefiro não virar torrada.' },
        ],
      },
      laboratorio: {
        id: 'laboratorio',
        text: 'É uma tentativa de poção que cure a marca do Eclipse. Já tentei quarenta e três vezes. Na décima nona, a bancada virou pó. Hoje ele só ferve e me olha com desprezo.',
        choices: [
          { text: 'E se eu trouxer um fragmento do Eclipse?', next: 'servico' },
          { text: 'Me ensina alguma receita?', next: 'receitas' },
          { text: 'Boa sorte com o desprezo.' },
        ],
      },
      receitas: {
        id: 'receitas',
        text: 'Aprendi com um velho que dizia que alquimia é paciência com avental. Erva, cristal, fibra: com isso você já faz poção de vida. O resto é coragem e sobrancelhas.',
        choices: [{ text: 'Vou testar no alambique.' }],
      },
    },
  },
  {
    id: 'velho-thom',
    name: 'Velho Thom',
    role: 'anciao',
    home: 'vila',
    routine: 'caminhar',
    colors: { body: '#a89b83', accent: '#6f5b3e', glow: '#f0d9a8' },
    root: 'raiz',
    barks: [
      'No meu tempo, o céu era azul de manhã.',
      'Perdi alguma coisa no bosque. De novo.',
      'Cuidado com as aranhas, menino.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Ah, é você. Sentei aqui para descansar e acabei ficando três horas. A idade faz isso: o corpo senta e a cabeça continua andando.',
        choices: [
          { text: 'Você está bem, Thom?', next: 'anel' },
          { text: 'Como era o mundo antes?', next: 'passado' },
          { text: 'Alguma novidade na vila?', next: 'fofoca' },
          { text: 'Vou deixar você descansar.' },
        ],
      },
      anel: {
        id: 'anel',
        text: 'Bem? Estou velho, que é pior. Perdi o anel da minha falecida no bosque, e uma aranha brilhante levou para o ninho. Não conte a ninguém que eu chorei. Principalmente a ninguém.',
        choices: [
          { text: 'Eu vou buscar o anel.', action: 'aceitar', quest: 'secundaria-01' },
          { text: 'Aqui está o anel, Thom.', action: 'concluir', quest: 'secundaria-01' },
          { text: 'Anéis se perdem, velho.' },
        ],
      },
      passado: {
        id: 'passado',
        text: 'Antes? Antes a gente plantava sem rezar. Agora toda colheita é uma aposta. Mas o pão tem o mesmo gosto, e isso me deixa teimoso.',
        choices: [
          { text: 'Teimosia é um bom defeito.', next: 'raiz' },
          { text: 'Vou andando.' },
        ],
      },
      fofoca: {
        id: 'fofoca',
        text: 'A Nina jura que tem um monstro no moinho. Os adultos riem, mas o moinho para de girar toda noite às mesmas horas. Eu já vi coisa pior acontecer com gente rindo.',
        choices: [
          { text: 'Vou dar uma olhada no moinho.', next: 'anel' },
          { text: 'Crianças exageram.' },
        ],
      },
    },
  },
  {
    id: 'capitao-ronan',
    name: 'Capitão Ronan',
    role: 'guarda',
    home: 'cidade',
    routine: 'vigiar',
    colors: { body: '#4a5568', accent: '#b9c2cf', glow: '#ffcf6b' },
    root: 'raiz',
    barks: [
      'Estrada fechada depois do anoitecer. Ordem minha.',
      'Três semanas sem dormir. Estou ótimo.',
      'Se vir um goblin, não corra. Grite.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Você é o recém-chegado de que a anciã fala. Ótimo. Metade da minha guarda tem menos de vinte anos e a outra metade está enterrada.',
        choices: [
          { text: 'O que está acontecendo na estrada?', next: 'estrada' },
          { text: 'Precisa de espadas extras?', next: 'cacada' },
          { text: 'O que você acha de mim?', next: 'muralha' },
          { text: 'Boa guarda, capitão.' },
        ],
      },
      estrada: {
        id: 'estrada',
        text: 'Goblins. Batedores primeiro, depois um xamã com um machado grande demais para o corpo dele. Se a estrada cair, Aster passa fome em duas semanas. Eu não posso sair do portão.',
        choices: [
          { text: 'Eu limpo a estrada.', action: 'aceitar', quest: 'principal-02' },
          { text: 'O senhor da guerra caiu. A estrada é sua.', action: 'concluir', quest: 'principal-02' },
          { text: 'E se eu não voltar?', next: 'muralha' },
        ],
      },
      cacada: {
        id: 'cacada',
        text: 'Sempre. A milícia paga por batedor abatido, e paga em ouro, não em gratidão. Oito cabeças e eu assino o recibo sem perguntar como.',
        choices: [
          { text: 'Aceito o contrato.', action: 'aceitar', quest: 'cacada-02' },
          { text: 'Oito batedores. Feito.', action: 'concluir', quest: 'cacada-02' },
          { text: 'Vou pensar no recibo.' },
        ],
      },
      muralha: {
        id: 'muralha',
        text: 'Acho que você tem a marca que o conselho manda prender. Acho também que, se eu prendesse todo mundo que assusta o conselho, não sobraria ninguém para segurar a lança.',
        choices: [
          { text: 'Obrigado por não me prender.', next: 'estrada' },
          { text: 'Isso não é uma resposta.' },
        ],
      },
    },
  },
  {
    id: 'lena-taverna',
    name: 'Lena, da Taverna',
    role: 'taverneiro',
    home: 'cidade',
    shop: 'comida',
    routine: 'vender',
    colors: { body: '#b06a4f', accent: '#f2d6b3', glow: '#ffb15c' },
    root: 'raiz',
    barks: [
      'Sopa quente, pão duro, conversa fiada. Tudo incluído.',
      'Se for brigar, é lá fora.',
      'Você parece quem não come há três dias.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Senta onde quiser, menos naquela mesa. Aquela mesa tem um capitão dormindo em cima dela desde ontem. Quer comer alguma coisa ou só veio reclamar do preço?',
        choices: [
          { text: 'O que tem de comida?', action: 'loja' },
          { text: 'Precisa de ajuda na cozinha?', next: 'cozinha' },
          { text: 'Alguma fofoca boa?', next: 'fofoca' },
          { text: 'Só passei para ver a mesa.' },
        ],
      },
      cozinha: {
        id: 'cozinha',
        text: 'A taverna virou enfermaria sem eu pedir. Dois viajantes com febre, um com o braço costurado e um que só chora. Preciso de erva e de poções, e o alambique da Marta está aqui atrás, mudo.',
        choices: [
          { text: 'Eu preparo as poções.', action: 'aceitar', quest: 'secundaria-02' },
          { text: 'Duas poções, como você pediu.', action: 'concluir', quest: 'secundaria-02' },
          { text: 'Enfermagem não é comigo.' },
        ],
      },
      fofoca: {
        id: 'fofoca',
        text: 'A fofoca é que os feridos da cratera não deveriam ter voltado. Chegam andando, comem, agradecem e depois passam a noite sussurrando o mesmo nome. Eu já queimei três colchões.',
        choices: [
          { text: 'Qual nome?', next: 'cozinha' },
          { text: 'E aquela sopa que salva vidas?', next: 'sopa' },
          { text: 'Melhor não saber.' },
        ],
      },
      sopa: {
        id: 'sopa',
        text: 'Minha sopa salva mais gente que a guarda inteira, e ninguém escreve música sobre sopa. É o mundo que está errado, não eu.',
        choices: [{ text: 'Uma tigela, por favor.' }],
      },
    },
  },
  {
    id: 'padre-anselmo',
    name: 'Padre Anselmo',
    role: 'sacerdote',
    home: 'cidade',
    routine: 'orar',
    colors: { body: '#d8d2c4', accent: '#8c7a5c', glow: '#ffe9a8' },
    root: 'raiz',
    barks: [
      'Que os seis que restaram olhem por você.',
      'O sino tocou sozinho outra vez.',
      'Reze, mesmo sem saber para quem.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Entre, entre. A capela é pequena, mas o teto ainda segura. Venha pela luz, não pelo banco da frente: aquele range como alma penada.',
        choices: [
          { text: 'Pode me curar, padre?', action: 'curar' },
          { text: 'O que está acontecendo nas catacumbas?', next: 'cripta' },
          { text: 'Ainda vale a pena rezar?', next: 'fe' },
          { text: 'Só vim ver a capela.' },
        ],
      },
      cripta: {
        id: 'cripta',
        text: 'Os mortos de Aster não descansam. A terra amanhece revirada e há tambores vindos da masmorra antiga. Um rei sem carne recolhe ossos como quem conta moedas. Desça, e desça armado.',
        choices: [
          { text: 'Eu desço à masmorra.', action: 'aceitar', quest: 'principal-03' },
          { text: 'A coroa está quebrada. Ele não voltará.', action: 'concluir', quest: 'principal-03' },
          { text: 'E se ele reconhecer minha marca?', next: 'fe' },
        ],
      },
      fe: {
        id: 'fe',
        text: 'Rezar não é pedir. É lembrar em voz alta de quem nos segurou até aqui. Seis entidades ainda estão de pé, e uma delas, acredito, tem pena de nós. A outra tem fome.',
        choices: [
          { text: 'Isso não me consola.', next: 'raiz' },
          { text: 'Posso receber uma bênção?', next: 'bencao' },
          { text: 'Vou lembrar disso.' },
        ],
      },
      bencao: {
        id: 'bencao',
        text: 'A bênção é curta, o alívio também. Volte sempre que o sangue estiver mais para fora do que para dentro.',
        choices: [{ text: 'Obrigado, padre.' }],
      },
    },
  },
  {
    id: 'sora-cacadora',
    name: 'Sora, a Caçadora',
    role: 'cacador',
    home: 'cidade',
    routine: 'caminhar',
    colors: { body: '#5c6b3f', accent: '#c9a86a', glow: '#9be36a' },
    root: 'raiz',
    barks: [
      'Rastro fresco. Duas horas, no máximo.',
      'Não pise aí. Confie em mim.',
      'Contrato é contrato. Ouro é ouro.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Fica de lado, você está na direção do vento. Pronto. Agora sim. Você quer contrato, quer aprender ou quer só ocupar espaço?',
        choices: [
          { text: 'Quero um contrato.', next: 'contratos' },
          { text: 'Como se caça um urso?', next: 'urso' },
          { text: 'O que há nas dunas?', next: 'deserto' },
          { text: 'Só passei por aqui.' },
        ],
      },
      contratos: {
        id: 'contratos',
        text: 'Tenho três abertos e nenhuma paciência. Dunas de Kharun, ursos nos celeiros, lobos na névoa. Escolhe um e não me faça perguntas sobre o pagamento adiantado.',
        choices: [
          { text: 'Vou às dunas de Kharun.', action: 'aceitar', quest: 'principal-04' },
          { text: 'Aceito o contrato dos ursos.', action: 'aceitar', quest: 'secundaria-08' },
          { text: 'Aceito os lobos da névoa.', action: 'aceitar', quest: 'cacada-01' },
          { text: 'Os lobos da névoa foram abatidos.', action: 'concluir', quest: 'cacada-01' },
          { text: 'Os ursos dos celeiros estão resolvidos.', action: 'concluir', quest: 'secundaria-08' },
          { text: 'E os contratos maiores?', next: 'grandes' },
        ],
      },
      grandes: {
        id: 'grandes',
        text: 'Os grandes pagam melhor e doem mais. Ursos nas cavernas do castelo, yetis na subida de Skadi, dragões na costa. Não aceito desculpa de clima, entendeu?',
        choices: [
          { text: 'Vou atrás dos ursos das cavernas.', action: 'aceitar', quest: 'cacada-03' },
          { text: 'Aceito caçar os yetis.', action: 'aceitar', quest: 'cacada-06' },
          { text: 'Vou com você atrás dos dragões.', action: 'aceitar', quest: 'cacada-08' },
          { text: 'Já terminei alguns contratos.', next: 'pagamento' },
          { text: 'Agora não.' },
        ],
      },
      pagamento: {
        id: 'pagamento',
        text: 'Deixa eu ver. Contrato é contrato, e eu não discuto prova: se você diz que caiu, caiu. O ouro está na bolsa, ao lado da faca. Não confunda as duas.',
        choices: [
          { text: 'Os ursos das cavernas caíram.', action: 'concluir', quest: 'cacada-03' },
          { text: 'Os yetis não descem mais.', action: 'concluir', quest: 'cacada-06' },
          { text: 'Os dragões caíram. Os três.', action: 'concluir', quest: 'cacada-08' },
          { text: 'Ainda não terminei.' },
        ],
      },
      urso: {
        id: 'urso',
        text: 'Não corre. Urso corre mais que você e fica irritado com a corrida. Espera a patada, entra por baixo e acerta a pata da frente. Se errar, vira estatística.',
        choices: [
          { text: 'Vou tentar não virar estatística.', next: 'contratos' },
          { text: 'Prefiro arco e distância.' },
        ],
      },
      deserto: {
        id: 'deserto',
        text: 'Kharun era cidade de bibliotecas antes de virar forno. Perdi dois clientes para o mesmo buraco que se move sob as dunas. Não é areia que engole: é algo que respira embaixo dela.',
        choices: [
          { text: 'Vamos ver isso de perto.', next: 'contratos' },
          { text: 'Boa sorte com o buraco.' },
        ],
      },
    },
  },
  {
    id: 'nina-crianca',
    name: 'Nina',
    role: 'crianca',
    home: 'vila',
    routine: 'caminhar',
    colors: { body: '#e8c39e', accent: '#d05a7a', glow: '#ffe27a' },
    root: 'raiz',
    barks: [
      'Você tem uma luz no braço! Posso tocar?',
      'Eu não tenho medo do moinho. Só um pouco.',
      'A mamãe disse para não falar com estranhos. Você é estranho.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Você é o adulto novo! Eu desenhei o monstro do moinho no chão, quer ver? Ninguém acredita em mim porque eu tenho oito anos, mas eu contei direito, eu sei contar até cem.',
        choices: [
          { text: 'Me mostra o desenho do monstro.', next: 'desenho' },
          { text: 'Você tem medo do moinho?', next: 'moinho' },
          { text: 'Quer brincar de outra coisa?', next: 'brincadeira' },
          { text: 'Fica perto da sua mãe, Nina.' },
        ],
      },
      desenho: {
        id: 'desenho',
        text: 'É alto assim, ó. Não tem rosto, e nas mãos tem morcegos em vez de dedos. Ele fica na porta do moinho às mesmas horas. Meu irmão disse que é vento. Vento não tem morcego na mão.',
        choices: [
          { text: 'Vou ver o que é de verdade.', next: 'moinho' },
          { text: 'É um desenho bem assustador.' },
        ],
      },
      moinho: {
        id: 'moinho',
        text: 'Tenho um pouco. Mas eu entro primeiro se você entrar junto? Não, você entra primeiro, você é grande. Se for monstro mesmo, você grita e eu chamo a vila inteira.',
        choices: [
          { text: 'Eu entro no moinho.', action: 'aceitar', quest: 'secundaria-04' },
          { text: 'O moinho está limpo, Nina.', action: 'concluir', quest: 'secundaria-04' },
          { text: 'Monstros não gostam de barulho. Grite você.' },
        ],
      },
      brincadeira: {
        id: 'brincadeira',
        text: 'A gente pode brincar de Eclipse! Você fecha os olhos e eu escondo o sol. Mas eu não sei onde escondi, então você tem que procurar até achar. É assim que funciona, né?',
        choices: [
          { text: 'Acho que é exatamente assim.', next: 'moinho' },
          { text: 'Vou procurar o sol em outro lugar.' },
        ],
      },
    },
  },
  {
    id: 'gil-pescador',
    name: 'Gil, o Pescador',
    role: 'pescador',
    home: 'porto',
    routine: 'pescar',
    colors: { body: '#4f6f7a', accent: '#cfe3e8', glow: '#6fd6ff' },
    root: 'raiz',
    barks: [
      'O mar não está bravo hoje. Só irritado.',
      'Peixe bom morde antes do sol nascer.',
      'Meu irmão devia estar de volta.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Puxa essa corda, faz favor. Não, a outra. Pronto. O mar e eu temos um acordo: ele me dá peixe, eu finjo que não tenho medo dele.',
        choices: [
          { text: 'Precisa de linha nova?', next: 'linhas' },
          { text: 'Você está esperando alguém?', next: 'irmao' },
          { text: 'Como está o mar hoje?', next: 'mar' },
          { text: 'Boa pescaria, Gil.' },
        ],
      },
      linhas: {
        id: 'linhas',
        text: 'Preciso de fibra para as linhas e de coragem para tirar uma serpente do lago, que anda engolindo as redes inteiras. Sem rede, sem peixe, sem jantar. É uma cadeia de problemas bem simples.',
        choices: [
          { text: 'Eu resolvo a linha e a serpente.', action: 'aceitar', quest: 'secundaria-03' },
          { text: 'As linhas estão prontas, Gil.', action: 'concluir', quest: 'secundaria-03' },
          { text: 'Pesque com as mãos.' },
        ],
      },
      irmao: {
        id: 'irmao',
        text: 'Meu irmão foi buscar sal nas ruínas de Kharun há dois meses. A rede dele ainda está pendurada ali, como se fosse voltar. Eu não consigo ir. Você consegue?',
        choices: [
          { text: 'Eu vou procurar seu irmão.', action: 'aceitar', quest: 'secundaria-06' },
          { text: 'Encontrei o acampamento dele. Sinto muito.', action: 'concluir', quest: 'secundaria-06' },
          { text: 'As ruínas são um túmulo, Gil.' },
        ],
      },
      mar: {
        id: 'mar',
        text: 'Hoje está manso, mas tem uma coisa estranha: os peixes estão nadando para o sul, todos juntos. Peixe não faz isso. Peixe sabe de alguma coisa que a gente ainda não sabe.',
        choices: [
          { text: 'A ilha ao sul apareceu de novo?', next: 'irmao' },
          { text: 'Talvez seja só corrente.' },
        ],
      },
    },
  },
  {
    id: 'mago-eldrin',
    name: 'Mago Eldrin',
    role: 'mago',
    home: 'templo',
    shop: 'magia',
    routine: 'orar',
    colors: { body: '#2f3a6b', accent: '#8fd6ff', glow: '#7aa8ff' },
    root: 'raiz',
    barks: [
      'O gelo está respirando. Você ouve?',
      'Não toque no círculo. Ainda.',
      'Quarenta anos e ainda erro a terceira conta.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Entre, mas limpe os pés. Não por educação: as linhas do chão estão carregadas e a lama desalinha tudo. Quarenta anos de estudo e o maior inimigo da magia continua sendo barro.',
        choices: [
          { text: 'O que você vende?', action: 'loja' },
          { text: 'Precisa de um assistente?', next: 'servico' },
          { text: 'O que são as sete entidades?', next: 'entidades' },
          { text: 'O que há na geleira?', next: 'gelo' },
        ],
      },
      servico: {
        id: 'servico',
        text: 'Preciso de três coisas e odeio pedir qualquer uma delas: alguém que respire dentro da geleira de Skadi, alguém que desça na cratera do Eclipse, e alguém que desmonte os golems do templo sem quebrar as inscrições.',
        choices: [
          { text: 'Vou à geleira de Skadi.', action: 'aceitar', quest: 'principal-05' },
          { text: 'Vou descer na cratera.', action: 'aceitar', quest: 'principal-09' },
          { text: 'Eu cuido dos golems.', action: 'aceitar', quest: 'secundaria-09' },
          { text: 'Os símbolos estão aqui, Eldrin.', action: 'concluir', quest: 'secundaria-09' },
          { text: 'E os gigantes que atravessam a cratera?', next: 'cacada' },
        ],
      },
      cacada: {
        id: 'cacada',
        text: 'Três gigantes antigos caminham para o sul, e eu quero saber para onde vão antes que cheguem. Se precisar pará-los, que seja com cuidado: a pele deles pode ter inscrições do tempo do Eclipse.',
        choices: [
          { text: 'Aceito deter os gigantes.', action: 'aceitar', quest: 'cacada-07' },
          { text: 'Os três caíram. Trouxe as inscrições.', action: 'concluir', quest: 'cacada-07' },
          { text: 'Deixe que eles caminhem.' },
        ],
      },
      entidades: {
        id: 'entidades',
        text: 'Sete colunas sustentavam Aetherion: maré, raiz, osso, areia, gelo, chama e sombra. Uma delas descobriu que podia comer as outras em vez de sustentá-las. As seis que sobraram estão dormindo, e sonham com você.',
        choices: [
          { text: 'Por que comigo?', next: 'gelo' },
          { text: 'Anotei tudo.' },
        ],
      },
      gelo: {
        id: 'gelo',
        text: 'O frio de Skadi não é clima, é respiração. Ele avança metros por noite e os aldeões juram ouvir passos dentro do gelo. O eremita Vekh vive lá em cima e sabe mais do que admite. Vá com casaco e com desconfiança.',
        choices: [
          { text: 'Aceito subir a geleira.', action: 'aceitar', quest: 'principal-05' },
          { text: 'O gigante caiu. O gelo parou.', action: 'concluir', quest: 'principal-05' },
          { text: 'Preciso me preparar antes.' },
        ],
      },
    },
  },
  {
    id: 'guarda-torv',
    name: 'Guarda Torv',
    role: 'guarda',
    home: 'cidade',
    routine: 'vigiar',
    colors: { body: '#6b7280', accent: '#d1d5db', glow: '#ffd479' },
    root: 'raiz',
    barks: [
      'Posto mantido. Como sempre.',
      'A ordem é antiga, mas ainda vale.',
      'Você anda como um soldado. Curioso.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Alto lá. Nome e assunto. Não, espere: você é o da marca. Já ouvi falar. Fale rápido, que eu tenho um portão para olhar e uma ordem para cumprir.',
        choices: [
          { text: 'O que há no castelo abandonado?', next: 'castelo' },
          { text: 'Algo errado nos túneis?', next: 'tunel' },
          { text: 'Por que ainda monta guarda?', next: 'juramento' },
          { text: 'Só passando, guarda.' },
        ],
      },
      castelo: {
        id: 'castelo',
        text: 'Servi lá quando ainda era um castelo. A ordem jurou proteger Aetherion até o último homem e cumpriu: ninguém saiu. Quero o brasão do comandante de volta. Ou o que restou dele.',
        choices: [
          { text: 'Eu entro no castelo.', action: 'aceitar', quest: 'principal-06' },
          { text: 'O comandante caiu. Aqui está o brasão.', action: 'concluir', quest: 'principal-06' },
          { text: 'Ninguém deveria entrar ali.' },
        ],
      },
      tunel: {
        id: 'tunel',
        text: 'Arranhões. Toda noite, embaixo do posto. Já desci uma vez e voltei com a tocha apagada e a mão tremendo. A milícia paga por múmia destruída, se você tiver estômago.',
        choices: [
          { text: 'Aceito descer.', action: 'aceitar', quest: 'cacada-04' },
          { text: 'Cinco múmias. Os túneis estão quietos.', action: 'concluir', quest: 'cacada-04' },
          { text: 'Deixe os mortos em paz.' },
        ],
      },
      juramento: {
        id: 'juramento',
        text: 'Porque a ordem não foi revogada. Enquanto ninguém assinar o contrário, este portão é meu. Limpo a armadura toda manhã. Um dia alguém vem me render e eu posso dormir.',
        choices: [
          { text: 'Eu rendo você quando isso acabar.', next: 'castelo' },
          { text: 'Boa guarda, soldado.' },
        ],
      },
    },
  },
  {
    id: 'mercador-jask',
    name: 'Mercador Jask',
    role: 'mercador',
    home: 'vila',
    shop: 'geral',
    routine: 'vender',
    colors: { body: '#a2703c', accent: '#e8c86a', glow: '#ffd166' },
    root: 'raiz',
    barks: [
      'Preços justos! Justiça subjetiva, mas justa.',
      'Compro, vendo, escuto. Nessa ordem.',
      'Essa estrada vai me matar de lucro.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Ah, um cliente com braços! Bem-vindo, bem-vindo. Tenho tudo que você precisa e algumas coisas que você não sabia que precisava. Só não pergunte de onde vieram.',
        choices: [
          { text: 'Vamos ver a mercadoria.', action: 'loja' },
          { text: 'Precisa de escolta?', next: 'estrada' },
          { text: 'De onde vêm as coisas?', next: 'origem' },
          { text: 'Só olhando, Jask.' },
        ],
      },
      estrada: {
        id: 'estrada',
        text: 'Preciso, e preciso muito. Comprei especiarias caras demais e agora tenho uma carroça, três arcas e nenhuma espada. Os bandidos já sabem. Todo mundo já sabe, menos o meu sócio, que fugiu.',
        choices: [
          { text: 'Eu escolto você até Aster.', action: 'aceitar', quest: 'secundaria-07' },
          { text: 'A carroça chegou. Pode pagar.', action: 'concluir', quest: 'secundaria-07' },
          { text: 'E o desconto que você prometeu?', next: 'desconto' },
          { text: 'Contrate a guarda.' },
        ],
      },
      origem: {
        id: 'origem',
        text: 'De lugares honestos, com documentos honestos. Alguns documentos mais honestos que os lugares. Em Aetherion, mercadoria boa e mercadoria legal raramente viajam juntas.',
        choices: [
          { text: 'Vou fingir que acreditei.', next: 'raiz' },
          { text: 'Boa sorte com os documentos.' },
        ],
      },
      desconto: {
        id: 'desconto',
        text: 'Desconto vitalício, foi o que prometi. Considerando meus preços, isso é quase uma ameaça. Mas palavra é palavra, e eu sou um homem de palavras bem escolhidas.',
        choices: [{ text: 'Aceito a ameaça.' }],
      },
    },
  },
  {
    id: 'curandeira-ysa',
    name: 'Curandeira Ysa',
    role: 'sacerdote',
    home: 'acampamento',
    routine: 'orar',
    colors: { body: '#d9c7c0', accent: '#7fa88f', glow: '#a8ffcf' },
    root: 'raiz',
    barks: [
      'Sente aqui. A ferida está infeccionando.',
      'Mais um da cratera. Sempre mais um.',
      'Beba água. É o único conselho de graça.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Se veio ajudar, pegue a bacia. Se veio conversar, fale baixo. Se veio morrer, espere a minha vez, porque hoje já enterrei dois.',
        choices: [
          { text: 'Pode me curar?', action: 'curar' },
          { text: 'Por que tanta gente doente?', next: 'febre' },
          { text: 'Precisa de remédios?', next: 'remedio' },
          { text: 'Vou deixar você trabalhar.' },
        ],
      },
      febre: {
        id: 'febre',
        text: 'Não é febre. Febre sobe e desce. Estes desenham o mesmo símbolo no chão antes de dormir e apagam por horas. Metade deles veio da cratera e não deveria ter voltado. O rastro leva ao templo esquecido.',
        choices: [
          { text: 'Eu vou ao templo.', action: 'aceitar', quest: 'principal-08' },
          { text: 'O sacerdote caiu. O círculo está rompido.', action: 'concluir', quest: 'principal-08' },
          { text: 'E se não houver cura?', next: 'remedio' },
        ],
      },
      remedio: {
        id: 'remedio',
        text: 'Sempre preciso. Erva eu mesma colho, mas os feridos são muitos e minhas mãos são duas. Se você trouxer erva e souber preparar uma poção maior, metade destes dorme sem dor hoje.',
        choices: [
          { text: 'Eu trago os remédios.', action: 'aceitar', quest: 'secundaria-10' },
          { text: 'As poções estão prontas, Ysa.', action: 'concluir', quest: 'secundaria-10' },
          { text: 'Pode me curar antes de eu sair?', next: 'cura' },
          { text: 'Não sei preparar poções.' },
        ],
      },
      cura: {
        id: 'cura',
        text: 'Pronto. Não faça esforço hoje e beba água como se fosse ordens minhas, porque é. A marca no seu braço eu não sei curar. Ainda.',
        choices: [{ text: 'Obrigado, Ysa.' }],
      },
    },
  },
  {
    id: 'bardo-luan',
    name: 'Luan, o Bardo',
    role: 'campones',
    home: 'acampamento',
    routine: 'sentar',
    colors: { body: '#7a3f6b', accent: '#f0c46a', glow: '#ff9edb' },
    root: 'raiz',
    barks: [
      'Uma moeda e eu canto. Duas e eu paro.',
      'A rima fugiu com o meu alaúde.',
      'Ninguém aplaude mais. Que época a nossa.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Ah! Um rosto novo, e um rosto novo merece uma canção nova. O problema, meu caro, é que eu não tenho canção nova. Nem alaúde. Nem dignidade, se formos honestos.',
        choices: [
          { text: 'O que aconteceu com seu alaúde?', next: 'alaude' },
          { text: 'Cante algo antigo, então.', next: 'cancao' },
          { text: 'Por que ninguém aplaude?', next: 'publico' },
          { text: 'Boa sorte com a inspiração.' },
        ],
      },
      alaude: {
        id: 'alaude',
        text: 'Harpias. Na geleira. Levaram o alaúde para o ninho junto com metade do meu repertório e, sinceramente, com a minha vontade de viver. Três yetis guardam o caminho. Eu pago em música.',
        choices: [
          { text: 'Eu recupero seu alaúde.', action: 'aceitar', quest: 'secundaria-11' },
          { text: 'Aqui está. Levei um susto por você.', action: 'concluir', quest: 'secundaria-11' },
          { text: 'Aprenda a assobiar.' },
        ],
      },
      cancao: {
        id: 'cancao',
        text: 'Antigo eu canto de graça, e é por isso que ninguém paga. "Sete mãos seguravam o céu, uma mão quis o céu só seu." Bonito, não? Aprendi com um eremita que nunca me deu o nome.',
        choices: [
          { text: 'O eremita Vekh?', next: 'publico' },
          { text: 'É bonito. Vou guardar.' },
        ],
      },
      publico: {
        id: 'publico',
        text: 'Ninguém aplaude porque todos estão com medo, e medo não combina com refrão. Mas quando isso acabar, quando o sol nascer inteiro outra vez, eu quero estar no palco. Você vai estar na plateia?',
        choices: [
          { text: 'Na primeira fila.', next: 'alaude' },
          { text: 'Se você ensaiar até lá.' },
        ],
      },
    },
  },
  {
    id: 'eremita-vekh',
    name: 'Eremita Vekh',
    role: 'mago',
    home: 'templo',
    routine: 'orar',
    colors: { body: '#3b3b46', accent: '#8f8fa8', glow: '#b39dff' },
    root: 'raiz',
    barks: [
      'O gelo guarda o que o fogo esqueceu.',
      'Você carrega a marca. Eu carrego a culpa.',
      'Não me chame de sábio. Chame de sobrevivente.',
    ],
    nodes: {
      raiz: {
        id: 'raiz',
        text: 'Sente no chão, está frio mas é honesto. Você demorou. Eu já sabia que viria desde que o gelo começou a respirar mais fundo.',
        choices: [
          { text: 'O que você guarda aqui?', next: 'fragmento' },
          { text: 'Por que vive no gelo?', next: 'gelo' },
          { text: 'Você conheceu as entidades?', next: 'sete' },
          { text: 'A marca devolveu um eco.', next: 'eco' },
          { text: 'O que sua prece fez comigo?', next: 'confissao' },
          { text: 'Vim só perguntar o caminho.' },
        ],
      },
      fragmento: {
        id: 'fragmento',
        text: 'Um pedaço de céu quebrado. Não reflete luz, sussurra nomes, e eu o carrego há setecentos anos por medo. Guardar também é uma forma de servir ao inimigo, você sabe. Agora que a ilha apareceu, quero me livrar dele. Com você.',
        choices: [
          { text: 'Eu ajudo no ritual.', action: 'aceitar', quest: 'secundaria-12' },
          { text: 'O ritual está feito. Descanse, velho.', action: 'concluir', quest: 'secundaria-12' },
          { text: 'Fragmentos do Eclipse não se tocam.' },
        ],
      },
      gelo: {
        id: 'gelo',
        text: 'Porque aqui ninguém me pergunta o meu nome. E porque o gelo é o único lugar onde a voz de Nyxharion chega baixinho, como quem tem medo de acordar alguém. Eu escuto. É o meu castigo.',
        choices: [
          { text: 'O que ele diz?', next: 'sete' },
          { text: 'Castigo é uma escolha confortável.' },
        ],
      },
      sete: {
        id: 'sete',
        text: 'Conheci seis. A sétima eu vi de longe, e ela me viu de perto. Quando o Eclipse caiu, eu estava no templo e rezei para a entidade errada. Foi a única vez que uma prece minha foi atendida na hora.',
        choices: [
          { text: 'Então você sabe como derrotá-lo.', next: 'fragmento' },
          { text: 'O que sua prece fez comigo?', next: 'confissao' },
          { text: 'Me dê sua bênção, velho.', next: 'bencao' },
          { text: 'Sinto muito, Vekh.' },
        ],
      },
      eco: {
        id: 'eco',
        text: 'A marca respondeu ao gelo. Três elementais ainda guardam esse som. Dissipe-os, conte a Iara o que ouviu e volte: não quero completar sua lembrança por você.',
        choices: [
          { text: 'Vou buscar o eco.', action: 'aceitar', quest: 'secundaria-13' },
          { text: 'O eco voltou. Podemos conversar.', action: 'concluir', quest: 'secundaria-13' },
          { text: 'Preciso pensar.', next: 'raiz' },
        ],
      },
      confissao: {
        id: 'confissao',
        text: 'Na véspera do Eclipse, você era o guardião mortal dos nomes das seis entidades. Ofereceu suas lembranças para escondê-los de Nyxharion. Eu rezei à sombra pedindo proteção; aceitei o preço sem contar a você. Minha prece abriu a porta, sua escolha salvou os nomes. Chamei meu silêncio de vigilância por sete séculos.',
        choices: [
          { text: 'Eu precisava ouvir isso de você.', next: 'divida' },
          { text: 'Ainda não posso perdoar.', next: 'raiz' },
        ],
      },
      divida: {
        id: 'divida',
        text: 'Não peço absolvição. Os cavaleiros do vazio farejam os nomes que você protegeu. Detenha três, conte tudo a Iara e volte. Desta vez, não esconderei minha parte.',
        choices: [
          { text: 'Vou impedir que isso se repita.', action: 'aceitar', quest: 'secundaria-15' },
          { text: 'A dívida está paga. Siga em frente.', action: 'concluir', quest: 'secundaria-15' },
          { text: 'Falaremos quando eu estiver pronto.', next: 'raiz' },
        ],
      },
      bencao: {
        id: 'bencao',
        text: 'A bênção é simples: eu digo seu nome em voz alta e o mundo lembra que você existe. É tudo que eu tenho, e é mais do que a maioria recebe.',
        choices: [{ text: 'Obrigado.' }],
      },
    },
  },
]

const BY_ID = new Map(NPCS.map(npc => [npc.id, npc]))

export function npcById(id: string): NpcDef | undefined {
  return BY_ID.get(id)
}
