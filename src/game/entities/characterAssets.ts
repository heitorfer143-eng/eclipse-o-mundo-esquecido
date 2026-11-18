import { CHARACTER_OPTIONS, type CharacterModelId } from '../data/characterProfile'

export type KayKitCharacterId = CharacterModelId

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

export const KAYKIT_CHARACTER_IDS: readonly KayKitCharacterId[] = CHARACTER_OPTIONS.map(option => option.id)

/** Resolve only allowlisted KayKit models; never accept arbitrary local or remote URLs. */
export function characterModelUrlFor(id: KayKitCharacterId): string {
  const allowedId = CHARACTER_OPTIONS.find(option => option.id === id)?.id ?? 'Knight'
  const host = typeof window === 'undefined' ? '' : window.location.hostname
  const isManusHost = host.endsWith('.manus.computer')
    || host.endsWith('.manuspre.computer')
    || host.endsWith('.manus-asia.computer')
    || host.endsWith('.manusvm.computer')
    || host.endsWith('.manuscomputer.ai')
    || host.endsWith('.manus.game')
  if (isManusHost) return STORAGE_PATHS[allowedId]
  if (typeof document === 'undefined') throw new Error('O carregamento de personagens requer um navegador')
  return new URL(`models/KayKitAdventurers/${FILES[allowedId]}`, document.baseURI).toString()
}
