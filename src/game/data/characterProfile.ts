import type { ElementId } from './types'

export const CHARACTER_OPTIONS = [
  { id: 'Soldier', label: 'Soldado', description: 'Começa com roupa simples; conquista a armadura de soldado durante a jornada.' },
  { id: 'Paladin', label: 'Paladino', description: 'Começa com roupa simples; conquista a armadura dourada de paladino durante a jornada.' },
] as const

/** IDs antigos continuam válidos apenas para saves já criados; não são oferecidos em campanhas novas. */
export const LEGACY_CHARACTER_OPTIONS = [
  { id: 'Survivor', label: 'Sobrevivente', description: 'Aparência legada de campanha antiga.' },
  { id: 'Knight', label: 'Cavaleiro', description: 'Armadura clássica de Aetherion' },
  { id: 'Barbarian', label: 'Bárbaro', description: 'Visual robusto de aventureiro' },
  { id: 'Mage', label: 'Maga', description: 'Túnica arcana e silhueta leve' },
  { id: 'Rogue', label: 'Andarilha', description: 'Equipamento discreto para explorar' },
  { id: 'Rogue_Hooded', label: 'Andarilha encapuzada', description: 'Manto de viajante furtivo' },
] as const

export const ALL_CHARACTER_OPTIONS = [...CHARACTER_OPTIONS, ...LEGACY_CHARACTER_OPTIONS] as const
export type CharacterModelId = (typeof ALL_CHARACTER_OPTIONS)[number]['id']
export type LegacyCharacterModelId = (typeof LEGACY_CHARACTER_OPTIONS)[number]['id']

export const AURA_OPTIONS = [
  { id: 'lunar', label: 'Luar', color: '#7fe3ff' },
  { id: 'ambar', label: 'Âmbar', color: '#ffcc70' },
  { id: 'brasa', label: 'Brasa', color: '#ff785f' },
  { id: 'arcano', label: 'Arcano', color: '#c094ff' },
  { id: 'floresta', label: 'Floresta', color: '#8ee18a' },
  { id: 'eclipse', label: 'Eclipse', color: '#a1a4ff' },
] as const

export const ELEMENT_OPTIONS: { id: ElementId; label: string; color: string; description: string }[] = [
  { id: 'fogo', label: 'Fogo', color: '#ff785f', description: 'Chamas e explosões.' },
  { id: 'gelo', label: 'Gelo', color: '#7fd8ff', description: 'Frio e controle.' },
  { id: 'raio', label: 'Raio', color: '#ffe16b', description: 'Velocidade e eletricidade.' },
  { id: 'terra', label: 'Terra', color: '#b99569', description: 'Resistência e impacto.' },
  { id: 'vento', label: 'Vento', color: '#a8e5c0', description: 'Mobilidade e alcance.' },
  { id: 'sombra', label: 'Sombra', color: '#c094ff', description: 'Drenagem e furtividade.' },
]

export type AuraColor = (typeof AURA_OPTIONS)[number]['color']
export type CharacterProfile = { name: string; modelId: CharacterModelId; auraColor: AuraColor; element: ElementId }

export const DEFAULT_CHARACTER_PROFILE: CharacterProfile = {
  name: '',
  modelId: 'Soldier',
  auraColor: '#7fe3ff',
  element: 'fogo',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function normalizeCharacterName(value: string): string {
  return [...value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ')].slice(0, 24).join('')
}

export function isCharacterNameValid(value: string): boolean {
  return normalizeCharacterName(value).trim().length >= 2
}

/** Accept legacy looks when loading old campaigns, but only expose Soldier and Paladin for a new campaign. */
export function parseCharacterProfile(value: unknown): CharacterProfile {
  const raw = isRecord(value) ? value : {}
  const name = typeof raw.name === 'string' ? normalizeCharacterName(raw.name).trim() : ''
  const modelId = ALL_CHARACTER_OPTIONS.find(option => option.id === raw.modelId)?.id
    ?? DEFAULT_CHARACTER_PROFILE.modelId
  const auraColor = AURA_OPTIONS.find(option => option.color === raw.auraColor)?.color
    ?? DEFAULT_CHARACTER_PROFILE.auraColor
  const element = ELEMENT_OPTIONS.find(option => option.id === raw.element)?.id ?? DEFAULT_CHARACTER_PROFILE.element
  return { name, modelId, auraColor, element }
}
