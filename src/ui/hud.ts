import * as THREE from 'three'
import type { BiomeId, ElementId } from '../game/data/types'
import { ELEMENTS } from '../game/combat/damage'
import { abilityGlyph, elementIcon } from './icons'

export type HudAbility = { id: string; name: string; element: ElementId; tier: number; cooldown: number; total: number; mana: number; locked: boolean; key: string }
export type HudQuest = { name: string; objectives: { label: string; current: number; count: number; done: boolean }[] }
export type HudBoss = { name: string; title: string; healthRatio: number; phase: string; phases: number }
export type HudTarget = { name: string; level: number; healthRatio: number; status: string; elite: boolean }
export type HudPoi = { x: number; z: number; kind: string; name: string; discovered: boolean; boss: boolean }
export type HudSnapshot = {
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  stamina: number
  maxStamina: number
  level: number
  playerName: string
  xpRatio: number
  gold: number
  abilities: HudAbility[]
  element: ElementId
  potions: number
  quest?: HudQuest
  boss?: HudBoss
  target?: HudTarget
  prompt?: string
  location: string
  region: string
  weather: string
  clock: string
  night: boolean
  buffs: { name: string; seconds: number }[]
  fps: number
  yaw: number
  player: { x: number; z: number }
  pois: HudPoi[]
  sample: (x: number, z: number) => { height: number; biome: BiomeId }
  enemies: { x: number; z: number }[]
}

type DamageNumber = { el: HTMLDivElement; position: THREE.Vector3; life: number; maxLife: number; drift: number }

const ELEMENT_ORDER: ElementId[] = ['fogo', 'gelo', 'raio', 'terra', 'vento', 'sombra']
const BIOME_COLOR: Record<BiomeId, string> = {
  oceano: '#16394a',
  praia: '#c8b184',
  planicie: '#6f8f52',
  floresta: '#4c6f45',
  'floresta-densa': '#35543a',
  pantano: '#4a5a3f',
  deserto: '#b99a62',
  neve: '#cfd8dc',
  montanha: '#77726a',
  vulcanico: '#4a3029',
  cinzas: '#3b3540',
  ilha: '#8a9a5a',
}

/** The always-on HUD: vitals, compass, quest tracker, abilities, minimap and floating numbers. */
export class Hud {
  readonly root = document.createElement('div')
  private readonly nameEl = document.createElement('span')
  private readonly levelEl = document.createElement('span')
  private readonly xpFill = document.createElement('i')
  private readonly healthFill = document.createElement('i')
  private readonly manaFill = document.createElement('i')
  private readonly staminaFill = document.createElement('i')
  private readonly healthText = document.createElement('span')
  private readonly manaText = document.createElement('span')
  private readonly staminaText = document.createElement('span')
  private readonly goldEl = document.createElement('span')
  private readonly buffsEl = document.createElement('div')
  private readonly compassEl = document.createElement('div')
  private readonly locationEl = document.createElement('div')
  private readonly metaEl = document.createElement('div')
  private readonly questEl = document.createElement('div')
  private readonly bossEl = document.createElement('div')
  private readonly bossName = document.createElement('div')
  private readonly bossTitle = document.createElement('div')
  private readonly bossFill = document.createElement('div')
  private readonly bossPhases = document.createElement('div')
  private readonly targetEl = document.createElement('div')
  private readonly targetName = document.createElement('div')
  private readonly targetFill = document.createElement('i')
  private readonly targetMeta = document.createElement('div')
  private readonly promptEl = document.createElement('div')
  private readonly subtitleEl = document.createElement('div')
  private readonly toastsEl = document.createElement('div')
  private readonly damageLayer = document.createElement('div')
  private readonly vignette = document.createElement('div')
  private readonly minimap = document.createElement('canvas')
  private readonly elementsEl = document.createElement('div')
  private readonly abilitiesEl = document.createElement('div')
  private readonly potionEl = document.createElement('div')
  private readonly fpsEl = document.createElement('div')
  private readonly crosshair = document.createElement('div')
  private readonly damageNumbers: DamageNumber[] = []
  private subtitleTimer = 0
  private minimapTimer = 0
  private lastSignature = ''
  private onElement?: (element: ElementId) => void
  private onAbility?: (index: number) => void
  private onPotion?: () => void

  constructor(parent: HTMLElement) {
    this.root.className = 'hud'
    parent.appendChild(this.root)

    const topLeft = document.createElement('div')
    topLeft.className = 'hud__topleft'
    const nameRow = document.createElement('div')
    nameRow.className = 'hud__name'
    this.levelEl.className = 'hud__level'
    this.levelEl.textContent = 'Nv 1'
    this.nameEl.className = 'hud__title'
    this.nameEl.textContent = 'O Marcado'
    nameRow.append(this.levelEl, this.nameEl)
    const xp = document.createElement('div')
    xp.className = 'hud__xp'
    xp.appendChild(this.xpFill)
    topLeft.append(nameRow, xp)
    topLeft.append(
      this.makeBar('vida', 'Vida', this.healthFill, this.healthText),
      this.makeBar('mana', 'Mana', this.manaFill, this.manaText),
      this.makeBar('stamina', 'Stamina', this.staminaFill, this.staminaText),
    )
    this.buffsEl.className = 'hud__buffs'
    topLeft.appendChild(this.buffsEl)

    const topCenter = document.createElement('div')
    topCenter.className = 'hud__topcenter'
    const compass = document.createElement('div')
    compass.className = 'compass'
    this.compassEl.className = 'compass__strip'
    compass.appendChild(this.compassEl)
    const needle = document.createElement('div')
    needle.className = 'compass__needle'
    compass.appendChild(needle)
    this.locationEl.className = 'hud__location'
    this.metaEl.className = 'hud__meta'
    topCenter.append(compass, this.locationEl, this.metaEl)

    const topRight = document.createElement('div')
    topRight.className = 'hud__topright'
    const gold = document.createElement('div')
    gold.className = 'hud__gold'
    gold.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h5M9.5 14h5"/></svg>'
    gold.appendChild(this.goldEl)
    this.questEl.className = 'quest'
    topRight.append(gold, this.questEl)

    this.bossEl.className = 'bossbar hidden'
    this.bossName.className = 'bossbar__name'
    this.bossTitle.className = 'bossbar__title'
    const bossTrack = document.createElement('div')
    bossTrack.className = 'bossbar__track'
    this.bossFill.className = 'bossbar__fill'
    bossTrack.appendChild(this.bossFill)
    this.bossPhases.className = 'bossbar__phases'
    this.bossEl.append(this.bossName, this.bossTitle, bossTrack, this.bossPhases)

    this.targetEl.className = 'target hidden'
    this.targetName.className = 'target__name'
    const targetTrack = document.createElement('div')
    targetTrack.className = 'target__bar'
    targetTrack.appendChild(this.targetFill)
    this.targetMeta.className = 'target__meta'
    this.targetEl.append(this.targetName, targetTrack, this.targetMeta)

    this.crosshair.className = 'crosshair'

    const bottomLeft = document.createElement('div')
    bottomLeft.className = 'hud__bottomleft'
    const mapWrap = document.createElement('div')
    mapWrap.className = 'minimap'
    this.minimap.width = 276
    this.minimap.height = 276
    const ring = document.createElement('div')
    ring.className = 'minimap__ring'
    const north = document.createElement('div')
    north.className = 'minimap__n'
    north.textContent = 'N'
    mapWrap.append(this.minimap, ring, north)
    const hint = document.createElement('div')
    hint.className = 'hud__hint'
    hint.innerHTML = '<kbd>Tab</kbd> inventário · <kbd>M</kbd> mapa · <kbd>L</kbd> missões<br><kbd>E</kbd> interagir · <kbd>Esc</kbd> pausa'
    bottomLeft.append(mapWrap, hint)

    const bottomCenter = document.createElement('div')
    bottomCenter.className = 'hud__bottomcenter'
    this.elementsEl.className = 'elements'
    this.abilitiesEl.className = 'abilities'
    bottomCenter.append(this.elementsEl, this.abilitiesEl)

    const bottomRight = document.createElement('div')
    bottomRight.className = 'hud__bottomright'
    this.fpsEl.textContent = ''
    bottomRight.appendChild(this.fpsEl)

    this.promptEl.className = 'prompt hidden'
    this.subtitleEl.className = 'subtitle hidden'
    this.toastsEl.className = 'toasts'
    this.damageLayer.className = 'damage-layer'
    this.vignette.className = 'vignette'

    this.root.append(topLeft, topCenter, topRight, this.bossEl, this.targetEl, this.crosshair, bottomLeft, bottomCenter, bottomRight, this.promptEl, this.subtitleEl, this.toastsEl, this.damageLayer, this.vignette)

    for (let i = 0; i < 6; i += 1) {
      const element = ELEMENT_ORDER[i]
      const button = document.createElement('button')
      button.className = 'element'
      button.type = 'button'
      button.style.color = ELEMENTS[element].color
      button.innerHTML = `${elementIcon(element)}<span class="element__key">${i + 1}</span>`
      button.title = `${ELEMENTS[element].name} — ${ELEMENTS[element].description}`
      button.addEventListener('click', () => this.onElement?.(element))
      this.elementsEl.appendChild(button)
    }
    this.buildCompass()
  }

  private makeBar(kind: string, label: string, fill: HTMLElement, text: HTMLElement): HTMLDivElement {
    const bar = document.createElement('div')
    bar.className = `bar bar--${kind}`
    fill.style.width = '100%'
    text.innerHTML = `<span>${label}</span><span>0 / 0</span>`
    bar.append(fill, text)
    return bar
  }

  private buildCompass(): void {
    const marks: { label: string; bearing: number; kind: string }[] = []
    const cardinals = [
      { label: 'N', bearing: 0 },
      { label: 'NE', bearing: Math.PI / 4 },
      { label: 'L', bearing: Math.PI / 2 },
      { label: 'SE', bearing: (3 * Math.PI) / 4 },
      { label: 'S', bearing: Math.PI },
      { label: 'SO', bearing: (5 * Math.PI) / 4 },
      { label: 'O', bearing: (3 * Math.PI) / 2 },
      { label: 'NO', bearing: (7 * Math.PI) / 4 },
    ]
    for (const cardinal of cardinals) marks.push({ ...cardinal, kind: 'cardinal' })
    for (const mark of marks) {
      const el = document.createElement('div')
      el.className = `compass__mark compass__mark--${mark.kind}`
      el.textContent = mark.label
      el.dataset.bearing = String(mark.bearing)
      this.compassEl.appendChild(el)
    }
  }

  bind(onElement: (element: ElementId) => void, onAbility: (index: number) => void, onPotion: () => void): void {
    this.onElement = onElement
    this.onAbility = onAbility
    this.onPotion = onPotion
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible)
  }

  render(snapshot: HudSnapshot, dt: number): void {
    this.levelEl.textContent = `Nv ${snapshot.level}`
    this.nameEl.textContent = snapshot.playerName || 'O Marcado'
    this.xpFill.style.width = `${Math.round(snapshot.xpRatio * 100)}%`
    this.healthFill.style.width = `${(snapshot.health / snapshot.maxHealth) * 100}%`
    this.manaFill.style.width = `${(snapshot.mana / snapshot.maxMana) * 100}%`
    this.staminaFill.style.width = `${(snapshot.stamina / snapshot.maxStamina) * 100}%`
    this.healthText.innerHTML = `<span>Vida</span><span>${Math.ceil(snapshot.health)} / ${Math.round(snapshot.maxHealth)}</span>`
    this.manaText.innerHTML = `<span>Mana</span><span>${Math.floor(snapshot.mana)} / ${Math.round(snapshot.maxMana)}</span>`
    this.staminaText.innerHTML = `<span>Stamina</span><span>${Math.floor(snapshot.stamina)} / ${Math.round(snapshot.maxStamina)}</span>`
    this.goldEl.textContent = `${snapshot.gold} de ouro`

    const signature = `${snapshot.buffs.map(b => b.name).join(',')}|${snapshot.abilities.map(a => `${a.id}:${a.locked}:${a.cooldown > 0}`).join(',')}|${snapshot.element}`
    if (signature !== this.lastSignature) {
      this.lastSignature = signature
      this.renderBuffs(snapshot)
      this.renderAbilities(snapshot)
    } else {
      this.updateCooldowns(snapshot)
    }

    this.locationEl.textContent = snapshot.location
    this.metaEl.textContent = `${snapshot.region} · ${snapshot.weather} · ${snapshot.clock}`

    // Quest tracker
    if (snapshot.quest) {
      const objectives = snapshot.quest.objectives.map(objective => `<div class="quest__obj${objective.done ? ' done' : ''}">${objective.label} ${objective.count > 1 ? `(${objective.current}/${objective.count})` : ''}</div>`).join('')
      this.questEl.innerHTML = `<div class="quest__name">${snapshot.quest.name}</div>${objectives}`
      this.questEl.classList.remove('hidden')
    } else {
      this.questEl.classList.add('hidden')
    }

    // Boss bar
    if (snapshot.boss) {
      this.bossEl.classList.remove('hidden')
      this.bossName.textContent = snapshot.boss.name
      this.bossTitle.textContent = `${snapshot.boss.title} · ${snapshot.boss.phase}`
      this.bossFill.style.width = `${Math.max(0, snapshot.boss.healthRatio) * 100}%`
      this.bossPhases.innerHTML = `<span>Fase ${Math.min(snapshot.boss.phases, 1)}</span><span>${Math.round(snapshot.boss.healthRatio * 100)}%</span><span>Fase ${snapshot.boss.phases}</span>`
    } else {
      this.bossEl.classList.add('hidden')
    }

    // Target
    if (snapshot.target) {
      this.targetEl.classList.remove('hidden')
      this.targetName.textContent = `${snapshot.target.name} · Nv ${snapshot.target.level}`
      this.targetFill.style.width = `${snapshot.target.healthRatio * 100}%`
      this.targetMeta.textContent = `${snapshot.target.status}${snapshot.target.elite ? ' · Elite' : ''}`
      this.crosshair.classList.add('hot')
    } else {
      this.targetEl.classList.add('hidden')
      this.crosshair.classList.remove('hot')
    }

    // Prompt
    if (snapshot.prompt) {
      this.promptEl.classList.remove('hidden')
      this.promptEl.innerHTML = `<kbd>E</kbd> ${snapshot.prompt}`
    } else {
      this.promptEl.classList.add('hidden')
    }

    this.fpsEl.textContent = `${snapshot.fps} FPS`

    // Compass: rotate the cardinal marks and add POI markers.
    const pxPerRad = 190
    for (const child of Array.from(this.compassEl.children) as HTMLElement[]) {
      const bearing = Number(child.dataset.bearing)
      if (Number.isNaN(bearing)) continue
      const delta = normalizeAngle(bearing - snapshot.yaw)
      const x = delta * pxPerRad
      child.style.position = 'absolute'
      child.style.left = '50%'
      child.style.transform = `translateX(${x}px)`
      child.style.opacity = Math.abs(x) > 250 ? '0' : '1'
    }
    for (const poi of snapshot.pois) {
      if (!poi.discovered && !poi.boss) continue
      const bearing = Math.atan2(poi.x - snapshot.player.x, -(poi.z - snapshot.player.z))
      const delta = normalizeAngle(bearing - snapshot.yaw)
      const x = delta * pxPerRad
      if (Math.abs(x) > 250) continue
      const el = document.createElement('div')
      el.className = 'compass__mark compass__mark--poi'
      el.style.position = 'absolute'
      el.style.left = '50%'
      el.style.transform = `translateX(${x}px)`
      el.textContent = poi.boss ? `◆ ${poi.name}` : poi.name
      this.compassEl.appendChild(el)
      window.setTimeout(() => el.remove(), 90)
    }

    // Subtitle timer
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt
      if (this.subtitleTimer <= 0) this.subtitleEl.classList.add('hidden')
    }

    // Minimap redraw at 3 Hz.
    this.minimapTimer -= dt
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.33
      this.drawMinimap(snapshot)
    }
  }

  private renderBuffs(snapshot: HudSnapshot): void {
    this.buffsEl.innerHTML = snapshot.buffs.map(buff => `<span class="buff">${buff.name} ${Math.ceil(buff.seconds)}s</span>`).join('')
  }

  private renderAbilities(snapshot: HudSnapshot): void {
    this.abilitiesEl.innerHTML = ''
    for (const element of ELEMENT_ORDER) {
      ;(this.elementsEl.children[ELEMENT_ORDER.indexOf(element)] as HTMLElement).classList.toggle('active', element === snapshot.element)
    }
    snapshot.abilities.forEach((ability, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `ability${ability.locked ? ' locked' : ''}`
      button.dataset.id = ability.id
      button.title = `${ability.name} — ${ability.mana} de mana`
      button.style.color = ELEMENTS[ability.element].color
      button.innerHTML = `<span class="ability__key">${ability.key}</span>${abilityGlyph(ability.element, ability.tier)}<span class="ability__cost">${ability.mana}</span>`
      button.addEventListener('click', () => this.onAbility?.(index))
      this.abilitiesEl.appendChild(button)
    })
    this.potionEl.className = 'ability ability--potion'
    this.potionEl.innerHTML = `<span class="ability__key">H</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3h6M10 3v5l-4 8a3 3 0 0 0 2.7 4.5h6.6A3 3 0 0 0 18 16l-4-8V3"/><path d="M7.5 14h9"/></svg><span class="ability__cost">${snapshot.potions}</span>`
    this.potionEl.addEventListener('click', () => this.onPotion?.())
    this.abilitiesEl.appendChild(this.potionEl)
    this.updateCooldowns(snapshot)
  }

  private updateCooldowns(snapshot: HudSnapshot): void {
    snapshot.abilities.forEach((ability, index) => {
      const button = this.abilitiesEl.querySelectorAll<HTMLElement>('.ability')[index]
      if (!button) return
      const existing = button.querySelector<HTMLElement>('.ability__cd')
      if (ability.cooldown > 0.05) {
        if (existing) existing.textContent = ability.cooldown.toFixed(1)
        else {
          const overlay = document.createElement('div')
          overlay.className = 'ability__cd'
          overlay.textContent = ability.cooldown.toFixed(1)
          button.appendChild(overlay)
        }
      } else if (existing) {
        existing.remove()
      }
      button.classList.toggle('locked', ability.locked)
    })
    const cost = this.potionEl.querySelector('.ability__cost')
    if (cost) cost.textContent = String(snapshot.potions)
  }

  private drawMinimap(snapshot: HudSnapshot): void {
    const ctx = this.minimap.getContext('2d')
    if (!ctx) return
    const size = this.minimap.width
    const radiusMeters = 70
    const step = size / 46
    ctx.clearRect(0, 0, size, size)
    for (let y = 0; y < 46; y += 1) {
      for (let x = 0; x < 46; x += 1) {
        const wx = snapshot.player.x + (x - 23) * (radiusMeters / 23)
        const wz = snapshot.player.z + (y - 23) * (radiusMeters / 23)
        const sample = snapshot.sample(wx, wz)
        ctx.fillStyle = sample.height < 0 ? '#173a4c' : BIOME_COLOR[sample.biome]
        ctx.fillRect(x * step, y * step, step + 1, step + 1)
      }
    }
    const toMap = (x: number, z: number): [number, number] => [size / 2 + ((x - snapshot.player.x) / radiusMeters) * (size / 2), size / 2 + ((z - snapshot.player.z) / radiusMeters) * (size / 2)]
    for (const enemy of snapshot.enemies) {
      const [ex, ey] = toMap(enemy.x, enemy.z)
      if (ex < 0 || ey < 0 || ex > size || ey > size) continue
      ctx.fillStyle = '#e2705f'
      ctx.beginPath()
      ctx.arc(ex, ey, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const poi of snapshot.pois) {
      if (!poi.discovered) continue
      const [px, py] = toMap(poi.x, poi.z)
      if (px < 0 || py < 0 || px > size || py > size) continue
      ctx.fillStyle = poi.boss ? '#ffb347' : poi.kind === 'cidade' ? '#ffe9b8' : '#d6b46e'
      ctx.beginPath()
      ctx.arc(px, py, poi.boss ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(10,8,12,0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    // Player arrow
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.rotate(-snapshot.yaw)
    ctx.fillStyle = '#f4e9d2'
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(6, 7)
    ctx.lineTo(0, 3)
    ctx.lineTo(-6, 7)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // Ring shade
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.5)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(4,3,8,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  subtitle(speaker: string, text: string, seconds = 4): void {
    this.subtitleEl.classList.remove('hidden')
    this.subtitleEl.innerHTML = `<b>${speaker}</b> — ${text}`
    this.subtitleTimer = seconds
  }

  toast(text: string, kind: 'info' | 'item' | 'quest' | 'warn' | 'level' = 'info'): void {
    const el = document.createElement('div')
    el.className = `toast toast--${kind}`
    el.textContent = text
    this.toastsEl.appendChild(el)
    while (this.toastsEl.children.length > 5) this.toastsEl.firstElementChild?.remove()
    window.setTimeout(() => {
      el.style.opacity = '0'
      el.style.transition = 'opacity 0.4s ease'
      window.setTimeout(() => el.remove(), 400)
    }, 3800)
  }

  popDamage(position: THREE.Vector3, text: string, kind: 'hit' | 'crit' | 'heal' | 'hurt' | 'magic' = 'hit'): void {
    const el = document.createElement('div')
    el.className = `dmg${kind === 'crit' ? ' dmg--crit' : kind === 'heal' ? ' dmg--heal' : kind === 'hurt' ? ' dmg--hurt' : kind === 'magic' ? ' dmg--magic' : ''}`
    el.textContent = text
    this.damageLayer.appendChild(el)
    this.damageNumbers.push({ el, position: position.clone(), life: 1.15, maxLife: 1.15, drift: (Math.random() - 0.5) * 40 })
    if (this.damageNumbers.length > 40) {
      const oldest = this.damageNumbers.shift()
      oldest?.el.remove()
    }
  }

  updateDamage(dt: number, camera: THREE.PerspectiveCamera, width: number, height: number): void {
    for (let i = this.damageNumbers.length - 1; i >= 0; i -= 1) {
      const number = this.damageNumbers[i]
      number.life -= dt
      number.position.y += dt * 0.9
      if (number.life <= 0) {
        number.el.remove()
        this.damageNumbers.splice(i, 1)
        continue
      }
      const projected = number.position.clone().project(camera)
      if (projected.z > 1) {
        number.el.style.opacity = '0'
        continue
      }
      const x = (projected.x * 0.5 + 0.5) * width + number.drift * (1 - number.life / number.maxLife)
      const y = (-projected.y * 0.5 + 0.5) * height
      number.el.style.left = `${x}px`
      number.el.style.top = `${y}px`
      number.el.style.opacity = String(Math.min(1, number.life / 0.4))
      number.el.style.transform = `translate(-50%, -50%) scale(${0.8 + (1 - number.life / number.maxLife) * 0.35})`
    }
  }

  setVignette(on: boolean): void {
    this.vignette.classList.toggle('on', on)
  }

  flashAbility(index: number): void {
    const button = this.abilitiesEl.querySelectorAll<HTMLElement>('.ability')[index]
    if (!button) return
    button.classList.remove('flash')
    void button.offsetWidth
    button.classList.add('flash')
  }
}

function normalizeAngle(angle: number): number {
  let value = angle
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
