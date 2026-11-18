import { clamp } from '../core/math'

export type AttributeKey = 'forca' | 'defesa' | 'agilidade' | 'inteligencia' | 'energia' | 'vitalidade'

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  forca: 'Força',
  defesa: 'Defesa',
  agilidade: 'Agilidade',
  inteligencia: 'Inteligência',
  energia: 'Energia',
  vitalidade: 'Vitalidade',
}

export const ATTRIBUTE_DESCRIPTION: Record<AttributeKey, string> = {
  forca: 'Aumenta o dano físico das armas.',
  defesa: 'Aumenta a armadura e a vida máxima.',
  agilidade: 'Aumenta crítico, velocidade de ataque e movimento.',
  inteligencia: 'Aumenta o poder mágico e a mana.',
  energia: 'Aumenta mana, regeneração e resistência à fadiga.',
  vitalidade: 'Aumenta vida e stamina.',
}

export type Attributes = Record<AttributeKey, number>

export type StatBonus = {
  ataque: number
  defesa: number
  vida: number
  mana: number
  stamina: number
  critico: number
  velocidade: number
  magia: number
  furtividade: number
  rouboDeVida: number
}

export const EMPTY_BONUS: StatBonus = { ataque: 0, defesa: 0, vida: 0, mana: 0, stamina: 0, critico: 0, velocidade: 0, magia: 0, furtividade: 0, rouboDeVida: 0 }

export type DerivedStats = {
  maxHealth: number
  maxMana: number
  maxStamina: number
  attack: number
  defense: number
  spellPower: number
  critChance: number
  moveSpeed: number
  attackSpeed: number
  lifesteal: number
  stealth: number
}

export const MAX_LEVEL = 50
export const POINTS_PER_LEVEL = 5

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(58 * level ** 1.42)
}

export function derivedStats(attributes: Attributes, level: number, bonus: StatBonus): DerivedStats {
  const a = attributes
  return {
    maxHealth: Math.round(92 + level * 9 + a.vitalidade * 11 + a.defesa * 4 + bonus.vida),
    maxMana: Math.round(42 + level * 3 + a.energia * 7 + a.inteligencia * 4 + bonus.mana),
    maxStamina: Math.round(92 + level * 2 + a.vitalidade * 2.6 + a.agilidade * 1.6 + bonus.stamina),
    attack: Math.round((7 + a.forca * 2.1 + level * 0.9 + bonus.ataque) * 10) / 10,
    defense: Math.round((a.defesa * 1.5 + level * 0.4 + bonus.defesa) * 10) / 10,
    spellPower: Math.round((6 + a.inteligencia * 2.2 + a.energia * 0.7 + level * 0.7 + bonus.magia) * 10) / 10,
    critChance: clamp(0.05 + a.agilidade * 0.0035 + bonus.critico / 100, 0, 0.65),
    moveSpeed: clamp(4.35 + a.agilidade * 0.012 + bonus.velocidade * 0.012, 3.6, 7.2),
    attackSpeed: clamp(1 + a.agilidade * 0.008 + bonus.velocidade * 0.004, 0.8, 1.8),
    lifesteal: clamp(bonus.rouboDeVida / 100, 0, 0.3),
    stealth: clamp(bonus.furtividade / 100, 0, 0.6),
  }
}

/** Mutable progression state saved with the character. */
export class Progression {
  level = 1
  xp = 0
  attributePoints = 0
  skillPoints = 0
  attributes: Attributes = { forca: 3, defesa: 3, agilidade: 3, inteligencia: 3, energia: 3, vitalidade: 3 }

  /** Back to a fresh level 1 character. */
  reset(): void {
    this.level = 1
    this.xp = 0
    this.attributePoints = 0
    this.skillPoints = 0
    this.attributes = { forca: 3, defesa: 3, agilidade: 3, inteligencia: 3, energia: 3, vitalidade: 3 }
  }

  get xpToNext(): number {
    return xpForLevel(this.level)
  }

  get xpRatio(): number {
    return this.level >= MAX_LEVEL ? 1 : clamp(this.xp / this.xpToNext, 0, 1)
  }

  /** Returns how many levels were gained. */
  addXp(amount: number): number {
    if (this.level >= MAX_LEVEL) return 0
    this.xp += Math.max(0, amount)
    let gained = 0
    while (this.level < MAX_LEVEL && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level += 1
      this.attributePoints += POINTS_PER_LEVEL
      this.skillPoints += 1
      gained += 1
    }
    if (this.level >= MAX_LEVEL) this.xp = 0
    return gained
  }

  spendPoint(attribute: AttributeKey): boolean {
    if (this.attributePoints <= 0) return false
    this.attributes[attribute] += 1
    this.attributePoints -= 1
    return true
  }

  toJSON(): { level: number; xp: number; attributePoints: number; skillPoints: number; attributes: Attributes } {
    return { level: this.level, xp: this.xp, attributePoints: this.attributePoints, skillPoints: this.skillPoints, attributes: { ...this.attributes } }
  }

  load(data: Partial<ReturnType<Progression['toJSON']>> | undefined): void {
    if (!data) return
    this.level = clamp(Math.round(data.level ?? 1), 1, MAX_LEVEL)
    this.xp = Math.max(0, data.xp ?? 0)
    this.attributePoints = Math.max(0, data.attributePoints ?? 0)
    this.skillPoints = Math.max(0, data.skillPoints ?? 0)
    const attrs = data.attributes
    if (attrs) {
      for (const key of Object.keys(this.attributes) as AttributeKey[]) {
        const value = attrs[key]
        if (typeof value === 'number' && Number.isFinite(value)) this.attributes[key] = clamp(Math.round(value), 1, 200)
      }
    }
  }
}
