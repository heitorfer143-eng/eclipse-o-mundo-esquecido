/**
 * Versioned local save for Eclipse: settings plus a single adventure slot. Everything is one JSON
 * record so migration is trivial and corrupt data can fall back to defaults without crashing.
 */
import { ITEMS } from '../game/data/itemData'
import { QUESTS } from '../game/data/questData'
import { SKILL_NODES } from '../game/systems/skills'

export type Quality = 'low' | 'medium' | 'high'
export type Settings = {
  musicVolume: number
  sfxVolume: number
  muted: boolean
  sensitivity: number
  invertY: boolean
  quality: Quality
  reducedMotion: boolean
  /** Always pt-BR for this game; kept for forward compatibility. */
  language: 'pt-BR'
}
export type GameSave = {
  seed: number
  position: [number, number, number]
  facing: number
  playtime: number
  timeOfDay: number
  progression: { level: number; xp: number; attributePoints: number; skillPoints: number; attributes: Record<string, number> }
  inventory: { stacks: { id: string; count: number; plus: number }[]; equipment: Record<string, { id: string; count: number; plus: number } | null>; gold: number }
  skills: Record<string, number>
  quests: { tracked: string | null; states: Record<string, { status: 'ativa' | 'concluida'; progress: Record<string, number> }> }
  discovered: string[]
  openedChests: string[]
  deaths: number
  kills: number
  createdAt: number
  updatedAt: number
}
export type SaveData = {
  version: 2
  settings: Settings
  game: GameSave | null
}
export const SAVE_KEY = 'eclipse.o-mundo-esquecido.v2'
const DEFAULT_POSITION: [number, number, number] = [0, 40, 800]
const ATTRIBUTE_KEYS = ['forca', 'defesa', 'agilidade', 'inteligencia', 'energia', 'vitalidade'] as const
const EQUIPMENT_KINDS = {
  arma: 'arma',
  armadura: 'armadura',
  capacete: 'capacete',
  botas: 'botas',
  anel1: 'anel',
  anel2: 'anel',
  reliquia: 'reliquia',
} as const
const MAX_COORDINATE = 100_000
const MAX_COUNTER = 1_000_000_000
const MAX_GOLD = 1_000_000_000
const MAX_STACKS = 42
const MAX_RAW_STACK_ENTRIES = 256
const MAX_STACK_COUNT = 99
const MAX_TIMESTAMP = 8_640_000_000_000_000
const ITEMS_BY_ID = new Map(ITEMS.map(item => [item.id, item]))
const QUESTS_BY_ID = new Map(QUESTS.map(quest => [quest.id, quest]))
const SKILLS_BY_ID = new Map(SKILL_NODES.map(skill => [skill.id, skill]))

export function defaultSettings(): Settings {
  return {
    musicVolume: 0.55,
    sfxVolume: 0.8,
    muted: false,
    sensitivity: 1,
    invertY: false,
    quality: 'high',
    reducedMotion: false,
    language: 'pt-BR',
  }
}
export function defaultSave(): SaveData {
  return { version: 2, settings: defaultSettings(), game: null }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
const clampInteger = (value: unknown, fallback: number, min: number, max: number): number =>
  Math.round(clampNumber(value, fallback, min, max))
const clamp01 = (value: unknown, fallback: number): number => clampNumber(value, fallback, 0, 1)
function parseStack(raw: unknown, equipped = false): GameSave['inventory']['stacks'][number] | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  const item = ITEMS_BY_ID.get(raw.id)
  if (!item) return null
  return {
    id: raw.id,
    count: equipped ? 1 : clampInteger(raw.count, 1, 1, MAX_STACK_COUNT),
    plus: clampInteger(raw.plus, 0, 0, 5),
  }
}
function parseInventory(raw: unknown): GameSave['inventory'] {
  const data = isRecord(raw) ? raw : {}
  const stacks: GameSave['inventory']['stacks'] = []
  if (Array.isArray(data.stacks)) {
    for (const entry of data.stacks.slice(0, MAX_RAW_STACK_ENTRIES)) {
      const stack = parseStack(entry)
      if (!stack) continue
      stacks.push(stack)
      if (stacks.length === MAX_STACKS) break
    }
  }
  const equipment: GameSave['inventory']['equipment'] = {
    arma: null,
    armadura: null,
    capacete: null,
    botas: null,
    anel1: null,
    anel2: null,
    reliquia: null,
  }
  if (isRecord(data.equipment)) {
    for (const [slot, kind] of Object.entries(EQUIPMENT_KINDS) as [keyof typeof EQUIPMENT_KINDS, string][]) {
      const stack = parseStack(data.equipment[slot], true)
      if (stack && ITEMS_BY_ID.get(stack.id)?.kind === kind) equipment[slot] = stack
    }
  }
  return { stacks, equipment, gold: clampInteger(data.gold, 0, 0, MAX_GOLD) }
}
function parseSkills(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {}
  const skills: Record<string, number> = {}
  for (const [id, rank] of Object.entries(raw)) {
    const node = SKILLS_BY_ID.get(id)
    if (!node || typeof rank !== 'number' || !Number.isFinite(rank)) continue
    const safeRank = clampInteger(rank, 0, 0, node.maxRank)
    if (safeRank > 0) skills[id] = safeRank
  }
  return skills
}
function parseQuests(raw: unknown): GameSave['quests'] {
  const data = isRecord(raw) ? raw : {}
  const tracked = data.tracked === null
    ? null
    : typeof data.tracked === 'string' && QUESTS_BY_ID.has(data.tracked)
      ? data.tracked
      : 'principal-01'
  const states: GameSave['quests']['states'] = {}
  if (isRecord(data.states)) {
    for (const [id, rawState] of Object.entries(data.states)) {
      const quest = QUESTS_BY_ID.get(id)
      if (!quest || !isRecord(rawState)) continue
      if (rawState.status !== 'ativa' && rawState.status !== 'concluida') continue
      const progress: Record<string, number> = {}
      if (isRecord(rawState.progress)) {
        if (rawState.progress.notified === 1) progress.notified = 1
        for (const objective of quest.objectives) {
          const value = rawState.progress[objective.id]
          if (typeof value !== 'number' || !Number.isFinite(value)) continue
          const count = Math.floor(clampNumber(value, 0, 0, objective.count))
          if (count > 0) progress[objective.id] = count
        }
      }
      states[id] = { status: rawState.status, progress }
    }
  }
  return { tracked, states }
}
function parseGame(raw: unknown): GameSave | null {
  if (!isRecord(raw)) return null
  const positionRaw = raw.position
  const position: [number, number, number] = Array.isArray(positionRaw) && positionRaw.length === 3
    ? [0, 1, 2].map(index => clampNumber(positionRaw[index], DEFAULT_POSITION[index], -MAX_COORDINATE, MAX_COORDINATE)) as [number, number, number]
    : [...DEFAULT_POSITION]
  const progressionRaw = isRecord(raw.progression) ? raw.progression : {}
  const attributesRaw = isRecord(progressionRaw.attributes) ? progressionRaw.attributes : {}
  const attributes: Record<string, number> = {}
  for (const key of ATTRIBUTE_KEYS) attributes[key] = clampInteger(attributesRaw[key], 3, 1, 200)
  return {
    seed: clampInteger(raw.seed, 20271117, 0, 4_294_967_295),
    position,
    facing: clampNumber(raw.facing, 0, -1_000_000, 1_000_000),
    playtime: clampNumber(raw.playtime, 0, 0, MAX_COUNTER),
    timeOfDay: clampNumber(raw.timeOfDay, 0.32, 0, 0.999),
    progression: {
      level: clampInteger(progressionRaw.level, 1, 1, 50),
      xp: clampNumber(progressionRaw.xp, 0, 0, MAX_COUNTER),
      attributePoints: clampInteger(progressionRaw.attributePoints, 0, 0, 250),
      skillPoints: clampInteger(progressionRaw.skillPoints, 0, 0, 50),
      attributes,
    },
    inventory: parseInventory(raw.inventory),
    skills: parseSkills(raw.skills),
    quests: parseQuests(raw.quests),
    discovered: Array.isArray(raw.discovered) ? raw.discovered.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256) : [],
    openedChests: Array.isArray(raw.openedChests) ? raw.openedChests.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256) : [],
    deaths: clampInteger(raw.deaths, 0, 0, MAX_COUNTER),
    kills: clampInteger(raw.kills, 0, 0, MAX_COUNTER),
    createdAt: clampNumber(raw.createdAt, Date.now(), 0, MAX_TIMESTAMP),
    updatedAt: clampNumber(raw.updatedAt, Date.now(), 0, MAX_TIMESTAMP),
  }
}
/** Parse untrusted stored JSON into a valid SaveData. */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return base
    data = parsed
  } catch {
    return base
  }
  if (data.version !== 2) return base
  const settingsRaw = isRecord(data.settings) ? data.settings : {}
  const settings: Settings = {
    musicVolume: clamp01(settingsRaw.musicVolume, base.settings.musicVolume),
    sfxVolume: clamp01(settingsRaw.sfxVolume, base.settings.sfxVolume),
    muted: settingsRaw.muted === true,
    sensitivity: clampNumber(settingsRaw.sensitivity, 1, 0.2, 3),
    invertY: settingsRaw.invertY === true,
    quality: settingsRaw.quality === 'low' || settingsRaw.quality === 'medium' || settingsRaw.quality === 'high' ? settingsRaw.quality : 'high',
    reducedMotion: settingsRaw.reducedMotion === true,
    language: 'pt-BR',
  }
  return { version: 2, settings, game: parseGame(data.game) }
}
export class SaveStore {
  data: SaveData
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = safeStorage()) {
    let raw: string | null = null
    try {
      raw = this.storage?.getItem(SAVE_KEY) ?? null
    } catch {
      raw = null
    }
    this.data = parseSave(raw)
  }
  private persist(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      // Private browsing or quota: the session keeps working in memory.
    }
  }
  updateSettings(patch: Partial<Settings>): void {
    this.data = { ...this.data, settings: { ...this.data.settings, ...patch } }
    this.persist()
  }
  saveGame(game: GameSave): void {
    this.data = { ...this.data, game: { ...game, updatedAt: Date.now() } }
    this.persist()
  }
  clearGame(): void {
    this.data = { ...this.data, game: null }
    this.persist()
  }
  get hasGame(): boolean {
    return this.data.game !== null
  }
}
function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
