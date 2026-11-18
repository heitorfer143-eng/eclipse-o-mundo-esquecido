export type SkillBranch = 'lamina' | 'arcano' | 'sombra'

export type SkillNode = {
  id: string
  branch: SkillBranch
  name: string
  description: string
  maxRank: number
  /** Bonus per rank, applied to the matching SkillEffects field. */
  perRank: number
  effect: keyof SkillEffects
  requires?: string
  /** Minimum character level to put the first point in. */
  level: number
}

export type SkillEffects = {
  /** Multiplicative bonus to physical damage (0.08 = +8%). */
  physicalDamage: number
  magicDamage: number
  critBonus: number
  staminaBonus: number
  defenseBonus: number
  attackSpeedBonus: number
  executeBonus: number
  manaBonus: number
  manaRegen: number
  manaCostReduction: number
  doubleCastChance: number
  statusDuration: number
  stealth: number
  lifesteal: number
  moveSpeed: number
  dodgeReduction: number
  statusDamage: number
  lootBonus: number
}

export const EMPTY_SKILL_EFFECTS: SkillEffects = {
  physicalDamage: 0,
  magicDamage: 0,
  critBonus: 0,
  staminaBonus: 0,
  defenseBonus: 0,
  attackSpeedBonus: 0,
  executeBonus: 0,
  manaBonus: 0,
  manaRegen: 0,
  manaCostReduction: 0,
  doubleCastChance: 0,
  statusDuration: 0,
  stealth: 0,
  lifesteal: 0,
  moveSpeed: 0,
  dodgeReduction: 0,
  statusDamage: 0,
  lootBonus: 0,
}

export const BRANCH_INFO: Record<SkillBranch, { name: string; color: string; description: string }> = {
  lamina: { name: 'Lâmina', color: '#e8b04a', description: 'A arte do aço: dano físico, resistência e combos.' },
  arcano: { name: 'Arcano', color: '#7fb8ff', description: 'O domínio dos elementos e da mana.' },
  sombra: { name: 'Sombra', color: '#b58cff', description: 'Furtividade, velocidade e a fome do Eclipse.' },
}

export const SKILL_NODES: SkillNode[] = [
  { id: 'lamina-forca', branch: 'lamina', name: 'Força Bruta', description: '+8% de dano físico por ponto.', maxRank: 3, perRank: 0.08, effect: 'physicalDamage', level: 1 },
  { id: 'lamina-critico', branch: 'lamina', name: 'Olho do Caçador', description: '+5% de chance crítica por ponto.', maxRank: 3, perRank: 0.05, effect: 'critBonus', level: 3, requires: 'lamina-forca' },
  { id: 'lamina-vigor', branch: 'lamina', name: 'Vigor de Ferro', description: '+15 de stamina máxima por ponto.', maxRank: 3, perRank: 15, effect: 'staminaBonus', level: 5 },
  { id: 'lamina-guarda', branch: 'lamina', name: 'Guarda Alta', description: '+6 de defesa por ponto.', maxRank: 3, perRank: 6, effect: 'defenseBonus', level: 8, requires: 'lamina-vigor' },
  { id: 'lamina-combo', branch: 'lamina', name: 'Ritmo de Combate', description: '+6% de velocidade de ataque por ponto.', maxRank: 3, perRank: 0.06, effect: 'attackSpeedBonus', level: 12, requires: 'lamina-critico' },
  { id: 'lamina-execucao', branch: 'lamina', name: 'Execução', description: '+20% de dano contra inimigos com menos de 30% de vida.', maxRank: 3, perRank: 0.2, effect: 'executeBonus', level: 18, requires: 'lamina-combo' },

  { id: 'arcano-poder', branch: 'arcano', name: 'Poder Arcano', description: '+8% de dano mágico por ponto.', maxRank: 3, perRank: 0.08, effect: 'magicDamage', level: 1 },
  { id: 'arcano-mana', branch: 'arcano', name: 'Poço de Mana', description: '+20 de mana máxima por ponto.', maxRank: 3, perRank: 20, effect: 'manaBonus', level: 3 },
  { id: 'arcano-regeneracao', branch: 'arcano', name: 'Fluxo Constante', description: '+0,8 de mana por segundo por ponto.', maxRank: 3, perRank: 0.8, effect: 'manaRegen', level: 6, requires: 'arcano-mana' },
  { id: 'arcano-foco', branch: 'arcano', name: 'Foco Absoluto', description: '-6% de custo de mana por ponto.', maxRank: 3, perRank: 0.06, effect: 'manaCostReduction', level: 10, requires: 'arcano-poder' },
  { id: 'arcano-eco', branch: 'arcano', name: 'Eco Arcano', description: '+12% de chance de conjurar duas vezes por ponto.', maxRank: 2, perRank: 0.12, effect: 'doubleCastChance', level: 16, requires: 'arcano-foco' },
  { id: 'arcano-ressonancia', branch: 'arcano', name: 'Ressonância', description: '+10% de duração dos efeitos elementais por ponto.', maxRank: 3, perRank: 0.1, effect: 'statusDuration', level: 22, requires: 'arcano-eco' },

  { id: 'sombra-furtiva', branch: 'sombra', name: 'Passo Silencioso', description: '-8% de detecção inimiga por ponto.', maxRank: 3, perRank: 0.08, effect: 'stealth', level: 1 },
  { id: 'sombra-sanguessuga', branch: 'sombra', name: 'Sanguessuga', description: '+3% de roubo de vida por ponto.', maxRank: 3, perRank: 0.03, effect: 'lifesteal', level: 4, requires: 'sombra-furtiva' },
  { id: 'sombra-agil', branch: 'sombra', name: 'Passos de Vento', description: '+4% de velocidade de movimento por ponto.', maxRank: 3, perRank: 0.04, effect: 'moveSpeed', level: 7 },
  { id: 'sombra-esquiva', branch: 'sombra', name: 'Esquiva Fantasma', description: '-6% de dano recebido durante rolamentos por ponto.', maxRank: 3, perRank: 0.06, effect: 'dodgeReduction', level: 11, requires: 'sombra-agil' },
  { id: 'sombra-veneno', branch: 'sombra', name: 'Toxina Antiga', description: '+15% de dano de status por ponto.', maxRank: 3, perRank: 0.15, effect: 'statusDamage', level: 15, requires: 'sombra-sanguessuga' },
  { id: 'sombra-sorte', branch: 'sombra', name: 'Sorte do Abismo', description: '+8% de ouro e chance de loot por ponto.', maxRank: 3, perRank: 0.08, effect: 'lootBonus', level: 20, requires: 'sombra-veneno' },
]

export const SKILL_BY_ID = new Map(SKILL_NODES.map(node => [node.id, node]))

/** Learned ranks and their aggregated bonuses. */
export class SkillTree {
  ranks = new Map<string, number>()

  rank(id: string): number {
    return this.ranks.get(id) ?? 0
  }

  spent(): number {
    let total = 0
    for (const value of this.ranks.values()) total += value
    return total
  }

  canRank(id: string, availablePoints: number, level: number): string | null {
    const node = SKILL_BY_ID.get(id)
    if (!node) return 'Habilidade desconhecida.'
    if (availablePoints <= 0) return 'Sem pontos de habilidade.'
    if (level < node.level) return `Requer nível ${node.level}.`
    if (this.rank(id) >= node.maxRank) return 'Nível máximo alcançado.'
    if (node.requires && this.rank(node.requires) === 0) return `Requer ${SKILL_BY_ID.get(node.requires)?.name ?? node.requires}.`
    return null
  }

  rankUp(id: string): boolean {
    const node = SKILL_BY_ID.get(id)
    if (!node) return false
    if (this.rank(id) >= node.maxRank) return false
    this.ranks.set(id, this.rank(id) + 1)
    return true
  }

  reset(): void {
    this.ranks.clear()
  }

  effects(): SkillEffects {
    const effects: SkillEffects = { ...EMPTY_SKILL_EFFECTS }
    for (const [id, rank] of this.ranks) {
      const node = SKILL_BY_ID.get(id)
      if (!node) continue
      effects[node.effect] += node.perRank * rank
    }
    return effects
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.ranks)
  }

  load(data: Record<string, number> | undefined): void {
    this.ranks.clear()
    if (!data) return
    for (const [id, rank] of Object.entries(data)) {
      const node = SKILL_BY_ID.get(id)
      if (!node) continue
      const value = Math.max(0, Math.min(node.maxRank, Math.round(rank)))
      if (value > 0) this.ranks.set(id, value)
    }
  }
}
