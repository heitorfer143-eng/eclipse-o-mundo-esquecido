/**
 * Shared data contracts for every content table in the game. Content files (`enemyData.ts`,
 * `bossData.ts`, `itemData.ts`, `questData.ts`, `npcData.ts`) are pure data and must satisfy
 * these types; runtime code owns all behaviour.
 */

export type ElementId = 'fogo' | 'gelo' | 'raio' | 'terra' | 'vento' | 'sombra'

export type BiomeId =
  | 'oceano'
  | 'praia'
  | 'planicie'
  | 'floresta'
  | 'floresta-densa'
  | 'pantano'
  | 'deserto'
  | 'neve'
  | 'montanha'
  | 'vulcanico'
  | 'cinzas'
  | 'ilha'

/** Body shapes the procedural character factory can build. */
export type EnemyModel =
  | 'lobo'
  | 'esqueleto'
  | 'goblin'
  | 'golem'
  | 'dragao'
  | 'cavaleiro'
  | 'gigante'
  | 'espectro'
  | 'aranha'
  | 'slime'
  | 'harpia'
  | 'troll'
  | 'elemental'
  | 'escorpiao'
  | 'morcego'
  | 'treant'
  | 'serpente'
  | 'diabrete'
  | 'mumia'
  | 'yeti'

export type EnemyBehavior =
  | 'corpo-a-corpo'
  | 'investida'
  | 'distancia'
  | 'conjurador'
  | 'voador'
  | 'bruto'
  | 'assassino'
  | 'invocador'

export type LootEntry = { itemId: string; chance: number; min?: number; max?: number }

export type EnemyColors = { body: string; accent: string; glow?: string }

export type EnemyType = {
  id: string
  /** Player-facing Portuguese name. */
  name: string
  model: EnemyModel
  behavior: EnemyBehavior
  biomes: BiomeId[]
  /** Level window in which this creature spawns naturally. */
  minLevel: number
  maxLevel: number
  /** Base values at level 1; runtime scales them with level. */
  health: number
  damage: number
  defense: number
  /** Metres per second while chasing. */
  speed: number
  attackRange: number
  attackCooldown: number
  aggroRange: number
  xp: number
  /** Visual scale multiplier (1 = human sized). */
  scale: number
  colors: EnemyColors
  element?: ElementId
  /** Night-only spawns (e.g. spectres) and day-only spawns. */
  nocturnal?: boolean
  loot: LootEntry[]
  lore: string
}

export type BossAttackKind =
  | 'impacto'
  | 'varredura'
  | 'projetil'
  | 'leque'
  | 'raio'
  | 'investida'
  | 'invocacao'
  | 'area'
  | 'meteoro'

export type BossAttack = {
  id: string
  name: string
  kind: BossAttackKind
  damage: number
  /** Effect radius in metres (0 for single-target projectiles). */
  radius: number
  range: number
  /** Seconds of telegraphed wind-up before the hit lands. */
  windup: number
  cooldown: number
  /** Short Portuguese description of how the player should react. */
  telegraph: string
  element?: ElementId
  /** How many projectiles for fan/volley attacks. */
  count?: number
}

export type BossPhase = {
  /** Fraction of maximum health at which this phase begins (1 = full, 0.5 = half). */
  threshold: number
  name: string
  /** Ids from `BossType.attacks` available in this phase. */
  attacks: string[]
  /** Movement/attack speed multiplier for the phase. */
  speed: number
  /** Short Portuguese line the boss says when the phase starts. */
  line: string
}

export type BossArena =
  | 'ruinas'
  | 'castelo'
  | 'cratera'
  | 'templo'
  | 'geleira'
  | 'deserto'
  | 'pantano'
  | 'vulcao'
  | 'ilha'
  | 'masmorra'

export type BossType = {
  id: string
  name: string
  /** Epithet shown under the name, e.g. "O Guardião Caído". */
  title: string
  model: EnemyModel
  arena: BossArena
  biome: BiomeId
  /** Recommended player level. */
  level: number
  health: number
  damage: number
  defense: number
  scale: number
  colors: EnemyColors
  element?: ElementId
  phases: BossPhase[]
  attacks: BossAttack[]
  rewardXp: number
  rewardGold: number
  rewardItems: LootEntry[]
  /** Main-quest chapter that unlocks the encounter (0 = optional world boss). */
  chapter: number
  lore: string
}

export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico'

export type ItemKind = 'arma' | 'armadura' | 'capacete' | 'botas' | 'anel' | 'reliquia' | 'pocao' | 'material' | 'comida'

export type WeaponKind = 'espada' | 'espadao' | 'adaga' | 'lanca' | 'arco' | 'cajado' | 'machado'

export type StatKey =
  | 'ataque'
  | 'defesa'
  | 'vida'
  | 'mana'
  | 'stamina'
  | 'critico'
  | 'velocidade'
  | 'magia'
  | 'furtividade'
  | 'rouboDeVida'

export type ItemStats = Partial<Record<StatKey, number>>

export type ItemDef = {
  id: string
  name: string
  kind: ItemKind
  rarity: Rarity
  /** Base shop value in gold. */
  value: number
  description: string
  stats?: ItemStats
  weapon?: WeaponKind
  element?: ElementId
  /** Potion / food effect. */
  heal?: number
  manaRestore?: number
  staminaRestore?: number
  /** Buff duration in seconds for food. */
  buffSeconds?: number
  /** Maximum stack size; 1 for equipment. */
  stack?: number
  /** Minimum player level required to equip. */
  level?: number
  /** Armour set id, used by set bonuses. */
  set?: string
  /** Flavour text shown in the inventory tooltip. */
  lore?: string
}

export type ObjectiveKind = 'matar' | 'coletar' | 'falar' | 'chegar' | 'chefe' | 'interagir' | 'fabricar' | 'nivel'

export type Objective = {
  id: string
  kind: ObjectiveKind
  /** Enemy id, item id, npc id, POI id, recipe id or boss id depending on `kind`. */
  target: string
  count: number
  /** Player-facing objective line. */
  label: string
}

export type QuestReward = {
  xp: number
  gold: number
  items?: { itemId: string; count: number }[]
}

export type QuestType = 'principal' | 'secundaria' | 'cacada'

export type QuestDef = {
  id: string
  name: string
  type: QuestType
  /** Main-quest chapter number (1-based); omit for side quests. */
  chapter?: number
  /** NPC id that offers the quest. */
  giver: string
  summary: string
  description: string
  objectives: Objective[]
  rewards: QuestReward
  /** Quest id that unlocks after this one completes. */
  next?: string
  /** Quest ids that must be completed first. */
  requires?: string[]
  minLevel?: number
  /** Marks a POI id on the map while active. */
  marker?: string
}

export type DialogueAction =
  | 'aceitar'
  | 'concluir'
  | 'loja'
  | 'curar'
  | 'forja'
  | 'fechar'
  | 'abrir-mapa'
  | 'aprender'

export type DialogueChoice = {
  text: string
  /** Node id to continue to; omit to close the dialogue. */
  next?: string
  action?: DialogueAction
  /** Quest id bound to the accept/complete action. */
  quest?: string
}

export type DialogueNode = {
  id: string
  text: string
  choices?: DialogueChoice[]
  /** Continue automatically to this node when there are no choices. */
  next?: string
}

export type NpcRole = 'ferreiro' | 'mercador' | 'alquimista' | 'taverneiro' | 'anciao' | 'guarda' | 'mago' | 'pescador' | 'campones' | 'crianca' | 'cacador' | 'sacerdote'

export type ShopId = 'ferreiro' | 'geral' | 'alquimista' | 'comida' | 'magia'

export type NpcDef = {
  id: string
  name: string
  role: NpcRole
  /** Which settlement kind this NPC belongs to; placement uses the world's POIs. */
  home: 'vila' | 'cidade' | 'acampamento' | 'templo' | 'porto'
  shop?: ShopId
  /** Idle routine behaviour. */
  routine: 'forja' | 'vender' | 'caminhar' | 'vigiar' | 'pescar' | 'orar' | 'sentar'
  colors: EnemyColors
  /** Root dialogue node id inside `nodes`. */
  root: string
  nodes: Record<string, DialogueNode>
  /** Ambient lines spoken when the player walks past. */
  barks?: string[]
}

export type RecipeDef = {
  id: string
  name: string
  /** Result item and count. */
  output: { itemId: string; count: number }
  /** Required materials. */
  inputs: { itemId: string; count: number }[]
  /** Gold cost paid at the station. */
  gold: number
  /** Station required: alchemy bench, forge, campfire or workbench. */
  station: 'alquimia' | 'forja' | 'fogueira' | 'bancada'
  minLevel?: number
}

export type CodexEntry = { id: string; title: string; text: string }
