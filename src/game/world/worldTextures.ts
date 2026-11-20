import * as THREE from 'three'
import { applyChunkTextures, type ChunkTextureSet } from './chunks'
import { STRUCTURE_MATERIALS, type MaterialKey } from './structures'

const STONE_MATERIALS: MaterialKey[] = ['pedra', 'pedra-escura', 'pedra-areia', 'pedra-gelo', 'pedra-obsidiana']
const WOOD_MATERIALS: MaterialKey[] = ['madeira', 'madeira-clara', 'madeira-envelhecida']
const LEAF_MATERIALS: MaterialKey[] = ['folha', 'folha-seca']

/** Applies supplied, mobile-sized maps to shared world materials before chunk generation. */
export function applyWorldTextures(textures: ChunkTextureSet): void {
  applyChunkTextures(textures)
  for (const key of STONE_MATERIALS) setMap(key, textures.stone)
  for (const key of WOOD_MATERIALS) setMap(key, textures.bark)
  for (const key of LEAF_MATERIALS) setMap(key, textures.leaves)
}

function setMap(key: MaterialKey, texture: THREE.Texture): void {
  const material = STRUCTURE_MATERIALS[key]
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  material.map = texture
  material.needsUpdate = true
}
