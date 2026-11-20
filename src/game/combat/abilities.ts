import type { ElementId } from '../data/types'
import type { StatusKind } from './damage'

export type AbilityKind = 'projetil' | 'area' | 'cone' | 'buff' | 'mobilidade'

export type AbilityDef = {
  id: string
  name: string
  element: ElementId
  /** 1, 2 or 3 — mapped to the Z, X and C slots. */
  tier: 1 | 2 | 3
  kind: AbilityKind
  mana: number
  cooldown: number
  /** Damage multiplier applied to spell power. */
  power: number
  radius: number
  range: number
  /** Half-angle for cone abilities. */
  arc: number
  /** Buff/dash duration in seconds. */
  duration: number
  status?: StatusKind
  statusSeconds: number
  /** Fraction of damage returned as health. */
  heal: number
  /** Temporary multipliers for buffs. */
  defenseBonus: number
  speedBonus: number
  critBonus: number
  stealthBonus: number
  description: string
  /** Short hint shown in the ability bar tooltip. */
  hint: string
  level: number
}

const BASE = {
  radius: 0,
  range: 0,
  arc: 0,
  duration: 0,
  statusSeconds: 0,
  heal: 0,
  defenseBonus: 0,
  speedBonus: 0,
  critBonus: 0,
  stealthBonus: 0,
  level: 1,
}

export const ABILITIES: AbilityDef[] = [
  // Fogo
  { ...BASE, id: 'fogo-bola', name: 'Bola de Fogo', element: 'fogo', tier: 1, kind: 'projetil', mana: 14, cooldown: 3, power: 1.5, radius: 3.2, range: 30, status: 'queimando', statusSeconds: 4, level: 1, description: 'Uma esfera incandescente que explode no impacto.', hint: 'Projétil com explosão em área.' },
  { ...BASE, id: 'fogo-onda', name: 'Onda de Chamas', element: 'fogo', tier: 2, kind: 'cone', mana: 22, cooldown: 7, power: 1.9, range: 8.5, arc: 0.95, status: 'queimando', statusSeconds: 5, level: 14, description: 'Um leque de fogo vivo que avança à frente.', hint: 'Cone curto que queima tudo.' },
  { ...BASE, id: 'fogo-meteoro', name: 'Meteoro', element: 'fogo', tier: 3, kind: 'area', mana: 40, cooldown: 17, power: 3.4, radius: 6.5, range: 26, status: 'queimando', statusSeconds: 6, level: 22, description: 'Uma rocha em chamas cai do céu onde você apontar.', hint: 'Área devastadora com recarga longa.' },
  // Gelo
  { ...BASE, id: 'gelo-lanca', name: 'Lança de Gelo', element: 'gelo', tier: 1, kind: 'projetil', mana: 12, cooldown: 2.6, power: 1.35, radius: 0.6, range: 34, status: 'congelado', statusSeconds: 1.4, level: 1, description: 'Uma estaca de gelo que perfura e desacelera.', hint: 'Projétil rápido e congelante.' },
  { ...BASE, id: 'gelo-nova', name: 'Nova Congelante', element: 'gelo', tier: 2, kind: 'area', mana: 24, cooldown: 8, power: 1.6, radius: 7.5, status: 'congelado', statusSeconds: 2.2, level: 14, description: 'Uma explosão de frio ao seu redor.', hint: 'Área ao redor de você.' },
  { ...BASE, id: 'gelo-prisao', name: 'Prisão Glacial', element: 'gelo', tier: 3, kind: 'area', mana: 34, cooldown: 15, power: 2.3, radius: 4, range: 24, status: 'congelado', statusSeconds: 3.6, level: 22, description: 'Prende o alvo em um bloco de gelo antigo.', hint: 'Congela um alvo por vários segundos.' },
  // Raio
  { ...BASE, id: 'raio-faisca', name: 'Faísca', element: 'raio', tier: 1, kind: 'projetil', mana: 10, cooldown: 2.2, power: 1.2, radius: 0.5, range: 32, status: 'eletrificado', statusSeconds: 2, level: 1, description: 'Um dardo elétrico quase instantâneo.', hint: 'Projétil veloz e barato.' },
  { ...BASE, id: 'raio-cadeia', name: 'Cadeia Elétrica', element: 'raio', tier: 2, kind: 'cone', mana: 20, cooldown: 6.5, power: 1.7, range: 9, arc: 0.6, status: 'eletrificado', statusSeconds: 3, level: 14, description: 'O raio salta entre os inimigos à frente.', hint: 'Cone estreito e longo.' },
  { ...BASE, id: 'raio-tempestade', name: 'Tempestade', element: 'raio', tier: 3, kind: 'area', mana: 38, cooldown: 16, power: 3, radius: 7.5, range: 28, status: 'eletrificado', statusSeconds: 4, level: 22, description: 'Chama uma tempestade sobre a área marcada.', hint: 'Área grande com dano contínuo.' },
  // Terra
  { ...BASE, id: 'terra-pedra', name: 'Pedra Afiada', element: 'terra', tier: 1, kind: 'projetil', mana: 11, cooldown: 2.8, power: 1.3, radius: 0.7, range: 28, status: 'lento', statusSeconds: 3, level: 1, description: 'Uma lasca de rocha arrancada do chão.', hint: 'Projétil pesado que desacelera.' },
  { ...BASE, id: 'terra-terremoto', name: 'Terremoto', element: 'terra', tier: 2, kind: 'area', mana: 26, cooldown: 9, power: 2, radius: 8, status: 'lento', statusSeconds: 3, level: 14, description: 'O chão racha e engole os inimigos próximos.', hint: 'Área ampla que atordoa.' },
  { ...BASE, id: 'terra-muralha', name: 'Pele de Rocha', element: 'terra', tier: 3, kind: 'buff', mana: 28, cooldown: 20, power: 0, duration: 12, defenseBonus: 0.55, level: 22, description: 'Endurece a pele como granito por 12 segundos.', hint: '+55% de defesa por 12s.' },
  // Vento
  { ...BASE, id: 'vento-lamina', name: 'Lâmina de Vento', element: 'vento', tier: 1, kind: 'projetil', mana: 9, cooldown: 1.8, power: 1.15, radius: 0.6, range: 30, level: 1, description: 'Um corte de ar comprimido, invisível até atingir.', hint: 'Projétil rápido e barato.' },
  { ...BASE, id: 'vento-vendaval', name: 'Vendaval', element: 'vento', tier: 2, kind: 'cone', mana: 18, cooldown: 6, power: 1.4, range: 9.5, arc: 1.15, level: 14, description: 'Um empurrão de ar que lança inimigos longe.', hint: 'Cone amplo com empurrão.' },
  { ...BASE, id: 'vento-passo', name: 'Passo do Vento', element: 'vento', tier: 3, kind: 'mobilidade', mana: 20, cooldown: 10, power: 0, duration: 0.9, speedBonus: 0.9, level: 22, description: 'Desloca-se como uma rajada, ficando intangível.', hint: 'Dash com invulnerabilidade curta.' },
  // Sombra
  { ...BASE, id: 'sombra-dardo', name: 'Dardo Sombrio', element: 'sombra', tier: 1, kind: 'projetil', mana: 13, cooldown: 2.4, power: 1.3, radius: 0.5, range: 28, heal: 0.2, level: 1, description: 'Uma agulha de escuridão que devolve vida ao ferir.', hint: 'Projétil que rouba vida.' },
  { ...BASE, id: 'sombra-toque', name: 'Toque Vampírico', element: 'sombra', tier: 2, kind: 'area', mana: 24, cooldown: 8, power: 1.7, radius: 5.5, heal: 0.35, level: 14, description: 'Drena a força vital de tudo ao redor.', hint: 'Área ao redor que cura você.' },
  { ...BASE, id: 'sombra-manto', name: 'Manto Noturno', element: 'sombra', tier: 3, kind: 'buff', mana: 26, cooldown: 18, power: 0, duration: 10, critBonus: 0.2, stealthBonus: 0.65, level: 22, description: 'A escuridão o cobre: crítico e furtividade aumentados.', hint: '+20% crítico e furtividade por 10s.' },
]

export const ABILITY_BY_ID = new Map(ABILITIES.map(ability => [ability.id, ability]))

export function abilityById(id: string): AbilityDef | undefined {
  return ABILITY_BY_ID.get(id)
}

/** The three abilities bound to an element, ordered by tier. */
export function abilitiesFor(element: ElementId): AbilityDef[] {
  return ABILITIES.filter(ability => ability.element === element).sort((a, b) => a.tier - b.tier)
}

export function abilityUnlocked(ability: AbilityDef, level: number): boolean {
  return level >= ability.level
}

export const ELEMENTAL_MASTERY_LEVEL = 40
