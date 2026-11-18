import type { BiomeId } from '../data/types'

export type BiomeDef = {
  id: BiomeId
  name: string
  /** Ground colours blended by slope and height. */
  grass: string
  rock: string
  accent: string
  /** Trees per chunk (0 disables trees). */
  treeDensity: number
  treeKind: 'pinheiro' | 'carvalho' | 'morto' | 'palmeira' | 'cacto' | 'cogumelo' | 'nenhum'
  rockDensity: number
  /** Grass tufts per chunk. */
  grassDensity: number
  /** Weather most common in this biome. */
  weather: 'chuva' | 'neve' | 'areia' | 'neblina' | 'cinzas' | 'limpo'
  /** Ambient tint for fog at dusk. */
  fog: string
  /** Music/ambience bed. */
  ambience: 'floresta' | 'montanha' | 'deserto' | 'pantano' | 'oceano' | 'vulcao' | 'planicie' | 'ruinas'
  enemyLevelBonus: number
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  oceano: {
    id: 'oceano', name: 'Mar de Aetherion', grass: '#1d4a58', rock: '#16323c', accent: '#2e7d8f',
    treeDensity: 0, treeKind: 'nenhum', rockDensity: 0, grassDensity: 0, weather: 'limpo', fog: '#6f97a8', ambience: 'oceano', enemyLevelBonus: 4,
  },
  praia: {
    id: 'praia', name: 'Costa Dourada', grass: '#d9c79a', rock: '#b7a37a', accent: '#f0e3bd',
    treeDensity: 2, treeKind: 'palmeira', rockDensity: 2, grassDensity: 4, weather: 'limpo', fog: '#e6d8b8', ambience: 'oceano', enemyLevelBonus: 0,
  },
  planicie: {
    id: 'planicie', name: 'Planícies de Aster', grass: '#7aa54e', rock: '#8b8a76', accent: '#a8c46a',
    treeDensity: 3, treeKind: 'carvalho', rockDensity: 3, grassDensity: 26, weather: 'chuva', fog: '#c8d6bb', ambience: 'planicie', enemyLevelBonus: 0,
  },
  floresta: {
    id: 'floresta', name: 'Floresta de Vael', grass: '#5d8c3f', rock: '#6f7261', accent: '#8fb95a',
    treeDensity: 14, treeKind: 'carvalho', rockDensity: 3, grassDensity: 30, weather: 'chuva', fog: '#9fb79a', ambience: 'floresta', enemyLevelBonus: 1,
  },
  'floresta-densa': {
    id: 'floresta-densa', name: 'Mata Sombria', grass: '#41682f', rock: '#5a5f4c', accent: '#6f9b45',
    treeDensity: 22, treeKind: 'pinheiro', rockDensity: 2, grassDensity: 22, weather: 'neblina', fog: '#7e9382', ambience: 'floresta', enemyLevelBonus: 3,
  },
  pantano: {
    id: 'pantano', name: 'Pântano de Mirel', grass: '#5f6b39', rock: '#4f5342', accent: '#87925a',
    treeDensity: 8, treeKind: 'morto', rockDensity: 3, grassDensity: 24, weather: 'neblina', fog: '#8b9a7a', ambience: 'pantano', enemyLevelBonus: 2,
  },
  deserto: {
    id: 'deserto', name: 'Deserto de Kharun', grass: '#d8b878', rock: '#b08f5c', accent: '#f0d79b',
    treeDensity: 1, treeKind: 'cacto', rockDensity: 5, grassDensity: 3, weather: 'areia', fog: '#e8cf9b', ambience: 'deserto', enemyLevelBonus: 3,
  },
  neve: {
    id: 'neve', name: 'Geleiras de Skadi', grass: '#e6eef5', rock: '#9fb0c0', accent: '#c9e4f5',
    treeDensity: 5, treeKind: 'pinheiro', rockDensity: 6, grassDensity: 2, weather: 'neve', fog: '#dbe8f2', ambience: 'montanha', enemyLevelBonus: 4,
  },
  montanha: {
    id: 'montanha', name: 'Picos Partidos', grass: '#7d7f88', rock: '#6a6c76', accent: '#9aa0ab',
    treeDensity: 1, treeKind: 'pinheiro', rockDensity: 9, grassDensity: 3, weather: 'neblina', fog: '#b9c0c9', ambience: 'montanha', enemyLevelBonus: 5,
  },
  vulcanico: {
    id: 'vulcanico', name: 'Fornalha de Ignar', grass: '#4a3a3a', rock: '#3a2f2f', accent: '#c9502a',
    treeDensity: 1, treeKind: 'morto', rockDensity: 8, grassDensity: 2, weather: 'cinzas', fog: '#8a5a48', ambience: 'vulcao', enemyLevelBonus: 6,
  },
  cinzas: {
    id: 'cinzas', name: 'Cicatriz do Eclipse', grass: '#4a4550', rock: '#3a3644', accent: '#7b6a9c',
    treeDensity: 2, treeKind: 'morto', rockDensity: 7, grassDensity: 4, weather: 'cinzas', fog: '#6a6070', ambience: 'ruinas', enemyLevelBonus: 7,
  },
  ilha: {
    id: 'ilha', name: 'Ilhas Esquecidas', grass: '#7aa86a', rock: '#8a8f7d', accent: '#a9c98c',
    treeDensity: 7, treeKind: 'palmeira', rockDensity: 4, grassDensity: 14, weather: 'limpo', fog: '#c9dfd2', ambience: 'oceano', enemyLevelBonus: 5,
  },
}

export const BIOME_LIST = Object.values(BIOMES)
