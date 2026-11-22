import { LEGACY_CHARACTER_OPTIONS, type CharacterModelId, type LegacyCharacterModelId } from '../data/characterProfile'

export type KayKitCharacterId = Exclude<LegacyCharacterModelId, 'Survivor'>

const STORAGE_PATHS: Record<KayKitCharacterId, string> = {
  Barbarian: '/manus-storage/game/sha256/cefc311a0e10c7858b6141f5ada7e33268727564fb8ac1347aab97d000669cc6.glb',
  Knight: '/manus-storage/game/sha256/60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168.glb',
  Mage: '/manus-storage/game/sha256/cf898585da33fab50c724d31605fb931eb2912e6d2280092141e98ca81ad507d.glb',
  Rogue: '/manus-storage/game/sha256/e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d.glb',
  Rogue_Hooded: '/manus-storage/game/sha256/93e6e25213009952276d9cf34f5d96a243767334c66f280db0433ddfabb91545.glb',
}

const FILES: Record<KayKitCharacterId, string> = {
  Barbarian: 'Barbarian.glb',
  Knight: 'Knight.glb',
  Mage: 'Mage.glb',
  Rogue: 'Rogue.glb',
  Rogue_Hooded: 'Rogue_Hooded.glb',
}

export const KAYKIT_CHARACTER_IDS: readonly KayKitCharacterId[] = LEGACY_CHARACTER_OPTIONS
  .map(option => option.id)
  .filter((id): id is KayKitCharacterId => id !== 'Survivor')

export const QUATERNIUS_CHARACTER_ASSETS = {
  Soldier: {
    starting: 'assets/models/quaternius/characters/Casual_Male.gltf',
    armored: 'assets/models/quaternius/characters/Soldier_Male.gltf',
  },
  Paladin: {
    starting: 'assets/models/quaternius/characters/Soldier_Male.gltf',
    armored: 'assets/models/quaternius/characters/Knight_Golden_Male.gltf',
  },
} as const

/** Relative asset path for a profile. Legacy Survivor remains procedural; armor swaps only the new class look. */
export function characterModelPathFor(id: CharacterModelId, armorEquipped = false): string | null {
  if (id === 'Survivor') return null
  if (id === 'Soldier' || id === 'Paladin') {
    const assets = QUATERNIUS_CHARACTER_ASSETS[id]
    return armorEquipped ? assets.armored : assets.starting
  }
  const allowedId = KAYKIT_CHARACTER_IDS.find(candidate => candidate === id) ?? 'Knight'
  return `models/KayKitAdventurers/${FILES[allowedId]}`
}

/** Resolve bundled/allowlisted models without changing legacy saves or introducing remote runtime assets. */
export function characterModelUrlFor(id: CharacterModelId, armorEquipped = false): string {
  const path = characterModelPathFor(id, armorEquipped)
  if (!path) return ''
  const host = typeof window === 'undefined' ? '' : window.location.hostname
  const isManusHost = host.endsWith('.manus.computer')
    || host.endsWith('.manuspre.computer')
    || host.endsWith('.manus-asia.computer')
    || host.endsWith('.manusvm.computer')
    || host.endsWith('.manuscomputer.ai')
    || host.endsWith('.manus.game')
  if (KAYKIT_CHARACTER_IDS.includes(id as KayKitCharacterId) && isManusHost) return STORAGE_PATHS[id as KayKitCharacterId]
  if (typeof document === 'undefined') throw new Error('O carregamento de personagens requer um navegador')
  return new URL(path, document.baseURI).toString()
}
