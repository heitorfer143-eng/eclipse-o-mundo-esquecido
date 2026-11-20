import type { NpcDef } from '../data/types'
import type { ExternalMaterialPalette } from './externalModels'

export type NpcAppearance = {
  model: 'civilian' | 'soldier' | 'paladin'
  armored: boolean
  scale: number
  materials: ExternalMaterialPalette
}

const ROLE_DETAILS: Record<string, { skin: string; hair: string; leather: string }> = {
  ferreiro: { skin: '#bd8058', hair: '#35241d', leather: '#453024' },
  mercador: { skin: '#d8a47d', hair: '#65432b', leather: '#493827' },
  alquimista: { skin: '#e0b18e', hair: '#60442c', leather: '#403247' },
  taverneiro: { skin: '#d7a27d', hair: '#512c1f', leather: '#523626' },
  anciao: { skin: '#c89a76', hair: '#b9b8b3', leather: '#4b4037' },
  guarda: { skin: '#c98f63', hair: '#2a2024', leather: '#34383b' },
  mago: { skin: '#d8b090', hair: '#b0a8be', leather: '#342947' },
  pescador: { skin: '#c08050', hair: '#4a3a2a', leather: '#443527' },
  campones: { skin: '#d0a070', hair: '#5a4028', leather: '#4b3a26' },
  crianca: { skin: '#e8b898', hair: '#8a5a30', leather: '#4a3a48' },
  cacador: { skin: '#c08858', hair: '#3a2a1a', leather: '#3a2a1a' },
  sacerdote: { skin: '#e0b090', hair: '#a0a0a0', leather: '#756847' },
}

/** Give every NPC the protagonist's Quaternius low-poly presentation while keeping outfit and face colors distinct. */
export function npcAppearanceFor(def: NpcDef): NpcAppearance {
  const details = ROLE_DETAILS[def.role] ?? ROLE_DETAILS.campones
  const isCaptain = def.id === 'capitao-ronan'
  const isGuard = def.role === 'guarda'
  return {
    model: isCaptain ? 'paladin' : isGuard ? 'soldier' : 'civilian',
    armored: isGuard,
    scale: def.role === 'crianca' ? 0.72 : 1,
    materials: {
      skin: details.skin,
      face: details.skin,
      hair: details.hair,
      shirt: def.colors.body,
      pants: def.colors.accent,
      belt: details.leather,
      main: isCaptain ? '#6f5b28' : def.colors.body,
      black: details.leather,
      darkgreen: def.colors.accent,
      helmet: isCaptain ? '#d4b04b' : def.colors.accent,
      armor: isCaptain ? '#d4b04b' : def.colors.body,
      armorDark: details.leather,
      detail: def.colors.accent,
      red: def.colors.accent,
    },
  }
}
