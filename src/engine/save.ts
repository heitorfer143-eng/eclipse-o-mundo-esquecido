/**
 * Versioned local save for Eclipse: settings plus a single adventure slot. Everything is one JSON
 * record so migration is trivial and corrupt data can fall back to defaults without crashing.
 */
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

const clamp01 = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback)

function parseGame(raw: unknown): GameSave | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  const position: [number, number, number] = Array.isArray(data.position) && data.position.length === 3
    ? [Number(data.position[0]) || 0, Number(data.position[1]) || 0, Number(data.position[2]) || 0]
    : [0, 40, 800]
  const progression = (data.progression ?? {}) as GameSave['progression']
  return {
    seed: typeof data.seed === 'number' && Number.isFinite(data.seed) ? data.seed : 20271117,
    position,
    facing: typeof data.facing === 'number' ? data.facing : 0,
    playtime: typeof data.playtime === 'number' && data.playtime >= 0 ? data.playtime : 0,
    timeOfDay: typeof data.timeOfDay === 'number' ? Math.min(0.999, Math.max(0, data.timeOfDay)) : 0.32,
    progression: {
      level: typeof progression.level === 'number' ? Math.max(1, Math.min(50, Math.round(progression.level))) : 1,
      xp: typeof progression.xp === 'number' ? Math.max(0, progression.xp) : 0,
      attributePoints: typeof progression.attributePoints === 'number' ? Math.max(0, Math.round(progression.attributePoints)) : 0,
      skillPoints: typeof progression.skillPoints === 'number' ? Math.max(0, Math.round(progression.skillPoints)) : 0,
      attributes: (progression.attributes ?? {}) as Record<string, number>,
    },
    inventory: (data.inventory ?? { stacks: [], equipment: {}, gold: 0 }) as GameSave['inventory'],
    skills: (data.skills ?? {}) as Record<string, number>,
    quests: (data.quests ?? { tracked: 'principal-01', states: {} }) as GameSave['quests'],
    discovered: Array.isArray(data.discovered) ? data.discovered.filter((id): id is string => typeof id === 'string') : [],
    openedChests: Array.isArray(data.openedChests) ? data.openedChests.filter((id): id is string => typeof id === 'string') : [],
    deaths: typeof data.deaths === 'number' ? Math.max(0, Math.round(data.deaths)) : 0,
    kills: typeof data.kills === 'number' ? Math.max(0, Math.round(data.kills)) : 0,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  }
}

/** Parse untrusted stored JSON into a valid SaveData. */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    data = parsed as Record<string, unknown>
  } catch {
    return base
  }
  if (data.version !== 2) return base
  const settingsRaw = (data.settings ?? {}) as Record<string, unknown>
  const settings: Settings = {
    musicVolume: clamp01(settingsRaw.musicVolume, base.settings.musicVolume),
    sfxVolume: clamp01(settingsRaw.sfxVolume, base.settings.sfxVolume),
    muted: settingsRaw.muted === true,
    sensitivity: typeof settingsRaw.sensitivity === 'number' && settingsRaw.sensitivity >= 0.2 && settingsRaw.sensitivity <= 3 ? settingsRaw.sensitivity : 1,
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
