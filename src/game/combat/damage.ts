import type { ElementId } from '../data/types'
import { clamp } from '../core/math'

export type ElementInfo = {
  id: ElementId
  name: string
  color: string
  glow: string
  opposite: ElementId
  description: string
}

export const ELEMENTS: Record<ElementId, ElementInfo> = {
  fogo: { id: 'fogo', name: 'Fogo', color: '#ff6a3d', glow: '#ffb347', opposite: 'gelo', description: 'Explosões e queimadura contínua.' },
  gelo: { id: 'gelo', name: 'Gelo', color: '#7fd8ff', glow: '#c9f2ff', opposite: 'fogo', description: 'Congela e controla o campo.' },
  raio: { id: 'raio', name: 'Raio', color: '#ffe066', glow: '#fff7b0', opposite: 'terra', description: 'Velocidade e correntes elétricas.' },
  terra: { id: 'terra', name: 'Terra', color: '#c08a4a', glow: '#e8c07a', opposite: 'raio', description: 'Defesa e terremotos.' },
  vento: { id: 'vento', name: 'Vento', color: '#9dffcf', glow: '#d8fff0', opposite: 'sombra', description: 'Mobilidade e cortes rápidos.' },
  sombra: { id: 'sombra', name: 'Sombra', color: '#a06bff', glow: '#d3b6ff', opposite: 'vento', description: 'Teletransporte e dano sombrio.' },
}

export const ELEMENT_LIST = Object.values(ELEMENTS)

/** Classic armour mitigation curve: defence has diminishing returns. */
export function damageAfterDefense(raw: number, defense: number): number {
  return Math.max(1, raw * (100 / (100 + Math.max(0, defense) * 1.45)))
}

/** Elements are strong against their opposite and weak against their own. */
export function elementalMultiplier(attack: ElementId | undefined, defender: ElementId | undefined): number {
  if (!attack) return 1
  if (!defender) return 1
  if (attack === defender) return 0.45
  if (ELEMENTS[attack].opposite === defender) return 1.6
  if (ELEMENTS[defender].opposite === attack) return 0.7
  return 1
}

export function rollCritical(critChance: number, bonus = 0): boolean {
  return Math.random() < clamp(critChance + bonus, 0, 0.95)
}

export function criticalDamage(raw: number, crit: boolean): number {
  return crit ? raw * 1.85 : raw
}

export type StatusKind = 'queimando' | 'congelado' | 'molhado' | 'eletrificado' | 'lento' | 'sangrando' | 'enfraquecido'

export type StatusEffect = { kind: StatusKind; seconds: number; power: number }

export type Reaction = { id: string; name: string; damageMultiplier: number; status?: StatusKind; seconds?: number; description: string }

const REACTIONS: { a: ElementId; b: ElementId | 'molhado'; reaction: Reaction }[] = [
  { a: 'fogo', b: 'gelo', reaction: { id: 'vapor', name: 'Vapor Escaldante', damageMultiplier: 1.5, status: 'enfraquecido', seconds: 4, description: 'O vapor cega e queima a pele.' } },
  { a: 'raio', b: 'gelo', reaction: { id: 'supercondutor', name: 'Supercondutor', damageMultiplier: 1.6, status: 'eletrificado', seconds: 3, description: 'O gelo conduz a corrente por toda a área.' } },
  { a: 'fogo', b: 'vento', reaction: { id: 'combustao', name: 'Combustão', damageMultiplier: 1.45, status: 'queimando', seconds: 6, description: 'O vento alimenta as chamas.' } },
  { a: 'terra', b: 'fogo', reaction: { id: 'magma', name: 'Magma', damageMultiplier: 1.5, status: 'queimando', seconds: 8, description: 'A rocha derrete sob o inimigo.' } },
  { a: 'sombra', b: 'gelo', reaction: { id: 'fratura', name: 'Fratura Sombria', damageMultiplier: 1.55, status: 'sangrando', seconds: 5, description: 'A escuridão racha o gelo por dentro.' } },
  { a: 'raio', b: 'molhado', reaction: { id: 'choque', name: 'Choque Condutivo', damageMultiplier: 1.7, status: 'eletrificado', seconds: 2.5, description: 'Água e raio não perdoam.' } },
  { a: 'vento', b: 'terra', reaction: { id: 'tempestade', name: 'Tempestade de Pó', damageMultiplier: 1.35, status: 'lento', seconds: 4, description: 'Areia nos olhos e nos pulmões.' } },
  { a: 'fogo', b: 'sombra', reaction: { id: 'abismo', name: 'Chama do Abismo', damageMultiplier: 1.4, status: 'enfraquecido', seconds: 5, description: 'Uma chama que não ilumina nada.' } },
]

/** Look up the reaction produced by applying `incoming` on a target with `existing` status. */
export function reactionFor(incoming: ElementId, existing: ElementId | 'molhado' | undefined): Reaction | undefined {
  if (!existing) return undefined
  return REACTIONS.find(r => (r.a === incoming && r.b === existing) || (r.b === incoming && r.a === existing))?.reaction
}
