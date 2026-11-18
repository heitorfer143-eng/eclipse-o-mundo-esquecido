import type { WeaponKind } from '../data/types'

export type WeaponProfile = {
  id: WeaponKind
  name: string
  /** Seconds per swing. */
  duration: number
  /** Number of chained hits in the base combo. */
  combo: number
  reach: number
  /** Half-angle of the hit cone in radians. */
  arc: number
  /** Damage multipliers per combo step. */
  multipliers: number[]
  stamina: number
  knockback: number
  ranged: 'nenhum' | 'flecha' | 'energia'
  /** Extra critical chance while using this family. */
  critBonus: number
  /** Short description of the family's feel. */
  feel: string
  special: string
}

export const WEAPON_PROFILES: Record<WeaponKind, WeaponProfile> = {
  espada: {
    id: 'espada', name: 'Espada', duration: 0.42, combo: 3, reach: 2.7, arc: 0.95, multipliers: [1, 1.1, 1.4], stamina: 8, knockback: 1.2,
    ranged: 'nenhum', critBonus: 0.03, feel: 'Equilibrada e versátil', special: 'Corte Ascendente: o terceiro golpe lança o inimigo ao ar.',
  },
  espadao: {
    id: 'espadao', name: 'Espadão', duration: 0.7, combo: 2, reach: 3.3, arc: 1.45, multipliers: [1.7, 2.1], stamina: 16, knockback: 3,
    ranged: 'nenhum', critBonus: 0, feel: 'Lenta e devastadora', special: 'Golpe Sísmico: ataque carregado cria uma onda de choque.',
  },
  adaga: {
    id: 'adaga', name: 'Adaga', duration: 0.26, combo: 4, reach: 1.9, arc: 0.75, multipliers: [0.6, 0.65, 0.72, 1.05], stamina: 5, knockback: 0.5,
    ranged: 'nenhum', critBonus: 0.12, feel: 'Rápida e letal pelas costas', special: 'Golpe Sombrio: dano crítico garantido ao atacar pelas costas.',
  },
  lanca: {
    id: 'lanca', name: 'Lança', duration: 0.48, combo: 3, reach: 3.9, arc: 0.5, multipliers: [1, 1.05, 1.3], stamina: 9, knockback: 1,
    ranged: 'nenhum', critBonus: 0.04, feel: 'Alcance longo e preciso', special: 'Estocada Perfurante: ignora parte da armadura.',
  },
  arco: {
    id: 'arco', name: 'Arco', duration: 0.5, combo: 1, reach: 60, arc: 0.1, multipliers: [0.95], stamina: 6, knockback: 0.4,
    ranged: 'flecha', critBonus: 0.06, feel: 'Combate à distância', special: 'Tiro Carregado: dobra o dano e perfura inimigos.',
  },
  cajado: {
    id: 'cajado', name: 'Cajado', duration: 0.45, combo: 1, reach: 42, arc: 0.1, multipliers: [0.85], stamina: 4, knockback: 0.6,
    ranged: 'energia', critBonus: 0.02, feel: 'Canaliza magia pura', special: 'Conjuração: cada golpe é um projétil elemental.',
  },
  machado: {
    id: 'machado', name: 'Machado de Batalha', duration: 0.62, combo: 3, reach: 2.9, arc: 1.6, multipliers: [1.25, 1.35, 1.65], stamina: 14, knockback: 2.5,
    ranged: 'nenhum', critBonus: 0, feel: 'Amplo e brutal', special: 'Redemoinho: o ataque carregado atinge tudo ao redor.',
  },
}

export function weaponProfile(kind: WeaponKind | undefined): WeaponProfile {
  return WEAPON_PROFILES[kind ?? 'espada']
}

/** Attack duration adjusted by the character's attack speed. */
export function attackDuration(profile: WeaponProfile, attackSpeed: number, comboIndex: number): number {
  const comboScale = 1 + comboIndex * 0.06
  return (profile.duration * comboScale) / Math.max(0.5, attackSpeed)
}

/** Damage multiplier for a combo step, including the charged bonus. */
export function comboMultiplier(profile: WeaponProfile, comboIndex: number, charged: boolean): number {
  const base = profile.multipliers[comboIndex % profile.multipliers.length]
  return base * (charged ? 1.9 : 1)
}
