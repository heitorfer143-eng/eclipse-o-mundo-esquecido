export const CHARACTER_OPTIONS = [
  { id: 'Knight', label: 'Cavaleiro', description: 'Armadura clássica de Aetherion' },
  { id: 'Barbarian', label: 'Bárbaro', description: 'Visual robusto de aventureiro' },
  { id: 'Mage', label: 'Maga', description: 'Túnica arcana e silhueta leve' },
  { id: 'Rogue', label: 'Andarilha', description: 'Equipamento discreto para explorar' },
  { id: 'Rogue_Hooded', label: 'Andarilha encapuzada', description: 'Manto de viajante furtivo' },
] as const

export type CharacterModelId = (typeof CHARACTER_OPTIONS)[number]['id']

export const AURA_OPTIONS = [
  { id: 'lunar', label: 'Luar', color: '#7fe3ff' },
  { id: 'ambar', label: 'Âmbar', color: '#ffcc70' },
  { id: 'brasa', label: 'Brasa', color: '#ff785f' },
  { id: 'arcano', label: 'Arcano', color: '#c094ff' },
  { id: 'floresta', label: 'Floresta', color: '#8ee18a' },
  { id: 'eclipse', label: 'Eclipse', color: '#a1a4ff' },
] as const

export type AuraColor = (typeof AURA_OPTIONS)[number]['color']
export type CharacterProfile = { name: string; modelId: CharacterModelId; auraColor: AuraColor }

export const DEFAULT_CHARACTER_PROFILE: CharacterProfile = {
  name: '',
  modelId: 'Knight',
  auraColor: '#7fe3ff',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function normalizeCharacterName(value: string): string {
  return [...value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ')].slice(0, 24).join('')
}

export function isCharacterNameValid(value: string): boolean {
  return normalizeCharacterName(value).trim().length >= 2
}

/** Treat local-storage profile data as untrusted and accept only bundled cosmetic choices. */
export function parseCharacterProfile(value: unknown): CharacterProfile {
  const raw = isRecord(value) ? value : {}
  const name = typeof raw.name === 'string' ? normalizeCharacterName(raw.name).trim() : ''
  const modelId = CHARACTER_OPTIONS.find(option => option.id === raw.modelId)?.id
    ?? DEFAULT_CHARACTER_PROFILE.modelId
  const auraColor = AURA_OPTIONS.find(option => option.color === raw.auraColor)?.color
    ?? DEFAULT_CHARACTER_PROFILE.auraColor
  return { name, modelId, auraColor }
}
