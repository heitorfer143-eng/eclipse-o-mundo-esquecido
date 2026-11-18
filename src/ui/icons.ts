import type { ElementId, ItemDef } from '../game/data/types'

const wrap = (paths: string, viewBox = '0 0 24 24'): string =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export function elementIcon(element: ElementId): string {
  switch (element) {
    case 'fogo':
      return wrap('<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2.5-5C10 9 11 10 11 12c1.5-2 1-5 1-9Z"/>')
    case 'gelo':
      return wrap('<path d="M12 2v20M4 6l16 12M20 6 4 18M12 6l-3-3M12 6l3-3M12 18l-3 3M12 18l3 3"/>')
    case 'raio':
      return wrap('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>')
    case 'terra':
      return wrap('<path d="M3 19h18M5 19l5-9 3 5 2-3 4 7"/><path d="M10 10l2-3 3 5"/>')
    case 'vento':
      return wrap('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>')
    case 'sombra':
      return wrap('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>')
  }
}

export function itemIcon(item: ItemDef): string {
  if (item.kind === 'arma') {
    switch (item.weapon) {
      case 'arco':
        return wrap('<path d="M5 3a16 16 0 0 1 0 18"/><path d="M5 3 19 12 5 21"/><path d="M12 12h7"/>')
      case 'cajado':
        return wrap('<path d="M7 21 15 5"/><circle cx="17" cy="4" r="2.4"/><path d="M5 21h4"/>')
      case 'machado':
        return wrap('<path d="M6 21 14 6"/><path d="M12 8c3-3 7-3 9-1-1 3-4 5-8 5"/><path d="M11 4l4 8"/>')
      case 'lanca':
        return wrap('<path d="M4 20 19 5"/><path d="M15 4h5v5"/><path d="M4 20l3-1-2-2-1 3Z"/>')
      case 'adaga':
        return wrap('<path d="M5 19 17 7"/><path d="M14 4h6v6"/><path d="M4 16l4 4"/>')
      case 'espadao':
        return wrap('<path d="M4 20 18 6"/><path d="M13 4h7v7"/><path d="M4 20l1-4 3 3-4 1Z"/><path d="M9 13l3 3"/>')
      default:
        return wrap('<path d="M5 19 19 5"/><path d="M14 4h6v6"/><path d="M4 16l4 4"/><path d="M8 12l4 4"/>')
    }
  }
  switch (item.kind) {
    case 'armadura':
      return wrap('<path d="M8 4 5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-3-2"/><path d="M9 4c0 2 1 3 3 3s3-1 3-3"/>')
    case 'capacete':
      return wrap('<path d="M5 13a7 7 0 0 1 14 0v5l-3 2-2-3-2 3-2-3-2 3-3-2v-5Z"/><path d="M9 12h6"/>')
    case 'botas':
      return wrap('<path d="M7 3v10l-3 5v3h10v-4l-4-3V3"/><path d="M4 18h10"/>')
    case 'anel':
      return wrap('<circle cx="12" cy="14" r="5"/><path d="M9 8l3-4 3 4"/><path d="M12 9v3"/>')
    case 'reliquia':
      return wrap('<path d="M12 2 4 9l8 13 8-13-8-7Z"/><path d="M4 9h16M12 2v20"/>')
    case 'pocao':
      return wrap('<path d="M9 3h6M10 3v5l-4 8a3 3 0 0 0 2.7 4.5h6.6A3 3 0 0 0 18 16l-4-8V3"/><path d="M7.5 14h9"/>')
    case 'comida':
      return wrap('<path d="M4 14c0-4 3.6-7 8-7s8 3 8 7"/><path d="M3 14h18v3H3z"/><path d="M8 10V7M12 9V6M16 10V7"/>')
    default:
      return wrap('<path d="M4 18 9 7l4 7 3-5 4 9H4Z"/><path d="M7 18v-3M17 18v-2"/>')
  }
}

export function rarityClass(rarity: string): string {
  return `rarity-${rarity}`
}

export function borderClass(rarity: string): string {
  return `border-${rarity}`
}

export const COIN_ICON = wrap('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h5M9.5 14h5"/>')

export function abilityGlyph(element: ElementId, tier: number): string {
  const inner = elementIcon(element)
  const marks = ['', '<circle cx="21" cy="3" r="1.4" fill="currentColor" stroke="none"/>', '<circle cx="21" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="21" cy="7" r="1.4" fill="currentColor" stroke="none"/>', '<circle cx="21" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="21" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="21" cy="11" r="1.4" fill="currentColor" stroke="none"/>']
  return inner.replace('</svg>', `${marks[Math.min(3, Math.max(0, tier))]}</svg>`)
}
