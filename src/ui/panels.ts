import type { AttributeKey } from '../game/systems/stats'
import { ATTRIBUTE_DESCRIPTION, ATTRIBUTE_LABEL, MAX_LEVEL, type DerivedStats, type Progression } from '../game/systems/stats'
import { EQUIP_SLOTS, SLOT_LABEL, plusMultiplier, statLine, type EquipSlot, type Inventory, type Stack } from '../game/systems/inventory'
import { BRANCH_INFO, SKILL_NODES, type SkillBranch, type SkillTree } from '../game/systems/skills'
import type { QuestDef } from '../game/data/types'
import { itemById, RARITY_LABEL } from '../game/data/itemData'
import type { QuestLog } from '../game/systems/quests'
import { RECIPES } from '../game/data/recipeData'
import { STATION_LABEL, canCraft, shopFor, type Shop } from '../game/systems/economy'
import type { Poi } from '../game/world/poi'
import type { Settings } from '../engine/save'
import { itemIcon } from './icons'

export type PanelActions = {
  equip: (index: number) => void
  unequip: (slot: EquipSlot) => void
  useItem: (index: number) => void
  upgrade: (index: number) => void
  drop: (index: number) => void
  sell: (index: number) => void
  buy: (itemId: string) => void
  craft: (recipeId: string) => void
  spendPoint: (attribute: AttributeKey) => void
  rankSkill: (id: string) => void
  fastTravel: (poiId: string) => void
  trackQuest: (id: string) => void
  close: () => void
  save: () => void
  quit: () => void
  respawn: () => void
  settings: (patch: Partial<Settings>) => void
  dialogue: (index: number) => void
}

export type PanelContext = {
  inventory: Inventory
  progression: Progression
  skills: SkillTree
  quests: QuestLog
  stats: DerivedStats
  bonus: Record<string, number>
  pois: Poi[]
  player: { x: number; z: number; yaw: number }
  mapCanvas: HTMLCanvasElement | null
  settings: Settings
  actions: PanelActions
}

export type DialogueChoiceView = { text: string; kind?: 'quest' | 'shop' | 'heal' | 'normal' }

const fmt = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** Modal panels. One overlay at a time; every action is delegated back to the game. */
export class Panels {
  private readonly overlay = document.createElement('div')
  private readonly dialogueEl = document.createElement('div')
  private current: { kind: string; ctx: PanelContext; extra?: unknown } | null = null
  private selectedBag = 0
  private selectedEquip: EquipSlot | null = null
  private selectedQuest: string | null = null
  private selectedPoi: string | null = null
  private dialogueChoiceHandler?: (index: number) => void

  constructor(parent: HTMLElement) {
    this.overlay.className = 'overlay hidden'
    this.dialogueEl.className = 'dialogue hidden'
    parent.append(this.overlay, this.dialogueEl)
  }

  get isOpen(): boolean {
    return this.current !== null
  }

  get kind(): string | null {
    return this.current?.kind ?? null
  }

  get dialogueOpen(): boolean {
    return !this.dialogueEl.classList.contains('hidden')
  }

  close(): void {
    this.overlay.classList.add('hidden')
    this.overlay.innerHTML = ''
    this.current = null
  }

  refresh(): void {
    const current = this.current
    if (!current) return
    if (current.kind === 'inventario') this.openInventory(current.ctx)
    else if (current.kind === 'habilidades') this.openSkills(current.ctx)
    else if (current.kind === 'mapa') this.openMap(current.ctx)
    else if (current.kind === 'missoes') this.openQuests(current.ctx)
    else if (current.kind === 'forja') this.openCraft(current.ctx, current.extra as 'alquimia' | 'forja' | 'fogueira' | 'bancada')
    else if (current.kind === 'loja') this.openShop(current.ctx, current.extra as Shop)
    else if (current.kind === 'pausa') this.openPause(current.ctx)
  }

  private mount(panel: HTMLElement, kind: string, ctx: PanelContext, extra?: unknown): void {
    this.current = { kind, ctx, extra }
    this.overlay.innerHTML = ''
    this.overlay.appendChild(panel)
    this.overlay.classList.remove('hidden')
    const close = () => {
      this.close()
      ctx.actions.close()
    }
    panel.querySelectorAll<HTMLElement>('[data-close]').forEach(button => button.addEventListener('click', close))
    this.overlay.onclick = event => {
      if (event.target === this.overlay) close()
    }
  }

  private basePanel(title: string, subtitle: string): { panel: HTMLDivElement; body: HTMLDivElement; foot: HTMLDivElement } {
    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.innerHTML = `
      <div class="panel__head">
        <div><h2 class="panel__title">${title}</h2><div class="panel__sub">${subtitle}</div></div>
        <button class="panel__close" data-close type="button" aria-label="Fechar">✕</button>
      </div>`
    const body = document.createElement('div')
    body.className = 'panel__body'
    const foot = document.createElement('div')
    foot.className = 'panel__foot'
    panel.append(body, foot)
    return { panel, body, foot }
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  openInventory(ctx: PanelContext): void {
    const { inventory, progression, stats } = ctx
    if (this.selectedBag >= inventory.stacks.length) this.selectedBag = Math.max(0, inventory.stacks.length - 1)
    const { panel, body, foot } = this.basePanel('Equipamento', 'Vista o que te mantém vivo')
    const left = document.createElement('div')
    left.className = 'col col--left scroll'
    left.innerHTML = `<div class="slot__label" style="margin-bottom:8px">Equipado</div><div class="slot-list">${EQUIP_SLOTS.map(slot => {
      const stack = inventory.equipment[slot]
      const def = stack ? itemById(stack.id) : undefined
      return `<div class="slot${this.selectedEquip === slot ? ' selected' : ''}" data-slot="${slot}">
        <div class="slot__icon ${def ? `border-${def.rarity}` : ''}" style="color:${def ? 'var(--parchment)' : '#5a5248'}">${def ? itemIcon(def) : '—'}</div>
        <div style="flex:1;min-width:0"><div class="slot__label">${SLOT_LABEL[slot]}</div>${def ? `<div class="slot__name ${'rarity-' + def.rarity}">${def.name}${stack && stack.plus ? ` +${stack.plus}` : ''}</div>` : '<div class="slot__empty">vazio</div>'}</div>
      </div>`
    }).join('')}</div>`

    const mid = document.createElement('div')
    mid.className = 'col col--mid scroll'
    const stack = inventory.stacks[this.selectedBag]
    const def = stack ? itemById(stack.id) : undefined
    mid.innerHTML = `
      <div class="slot__label" style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Mochila · ${inventory.totalItems()}/${inventory.capacity}</span><span>${inventory.stacks.length} espaços</span></div>
      <div class="bag-grid">
        ${Array.from({ length: Math.max(24, inventory.stacks.length + 6) }, (_, index) => {
          const entry = inventory.stacks[index]
          if (!entry) return '<div class="bag-cell bag-cell--empty"></div>'
          const itemDef = itemById(entry.id)
          if (!itemDef) return '<div class="bag-cell bag-cell--empty"></div>'
          return `<div class="bag-cell ${index === this.selectedBag ? 'selected' : ''} ${`border-${itemDef.rarity}`}" data-bag="${index}" title="${itemDef.name}" style="color:var(--parchment)">${itemIcon(itemDef)}${entry.count > 1 ? `<span class="bag-cell__count">${entry.count}</span>` : ''}${entry.plus ? `<span class="bag-cell__plus">+${entry.plus}</span>` : ''}</div>`
        }).join('')}
      </div>
      <div class="detail" style="margin-top:16px">
        ${def && stack ? `
          <div class="detail__name rarity-${def.rarity}">${def.name}${stack.plus ? ` +${stack.plus}` : ''}</div>
          <div class="detail__kind">${RARITY_LABEL[def.rarity]} · ${def.kind}${def.level ? ` · Nível ${def.level}` : ''}</div>
          <div class="detail__stats">${statLine(def, stack.plus).map(line => `<div class="detail__stat"><span>${line.replace(/^\+\d+%? /, '')}</span><span class="gold">${line.split(' ')[0]}</span></div>`).join('')}</div>
          <div class="detail__desc">${def.description}</div>
          ${def.lore ? `<div class="detail__lore">${def.lore}</div>` : ''}
          <div class="detail__actions">
            ${def.kind === 'arma' || def.kind === 'armadura' || def.kind === 'capacete' || def.kind === 'botas' || def.kind === 'anel' || def.kind === 'reliquia' ? '<button class="btn btn--primary" data-equip type="button">Equipar</button>' : ''}
            ${def.kind === 'pocao' || def.kind === 'comida' ? '<button class="btn btn--primary" data-use type="button">Usar</button>' : ''}
            <button class="btn" data-upgrade type="button">Aprimorar ${stack.plus < 5 ? `+${stack.plus + 1}` : '(máx)'}</button>
            <button class="btn btn--ghost" data-drop type="button">Descartar</button>
          </div>
          <div class="small muted">Valor de venda: ${Math.round(def.value * (0.45 + stack.plus * 0.08))} de ouro</div>
        ` : '<div class="muted">Mochila vazia. Explore, colete e saqueie para encher esta bolsa.</div>'}
      </div>`

    const right = document.createElement('div')
    right.className = 'col col--right scroll'
    const sets = inventory.setProgress().filter(set => set.equipped > 0)
    right.innerHTML = `
      <div class="slot__label" style="margin-bottom:8px">Atributos</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-box__label">Vida</div><div class="stat-box__value">${Math.round(stats.maxHealth)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Mana</div><div class="stat-box__value">${Math.round(stats.maxMana)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Stamina</div><div class="stat-box__value">${Math.round(stats.maxStamina)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Ataque</div><div class="stat-box__value">${fmt(stats.attack)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Defesa</div><div class="stat-box__value">${fmt(stats.defense)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Magia</div><div class="stat-box__value">${fmt(stats.spellPower)}</div></div>
        <div class="stat-box"><div class="stat-box__label">Crítico</div><div class="stat-box__value">${Math.round(stats.critChance * 100)}%</div></div>
        <div class="stat-box"><div class="stat-box__label">Velocidade</div><div class="stat-box__value">${fmt(stats.moveSpeed)}</div></div>
      </div>
      <div class="slot__label" style="margin:16px 0 8px">Pontos de atributo: <span class="gold">${progression.attributePoints}</span></div>
      ${(Object.keys(ATTRIBUTE_LABEL) as AttributeKey[]).map(key => `
        <div class="attr-row">
          <div><div class="attr-row__name">${ATTRIBUTE_LABEL[key]}</div><div class="attr-row__desc">${ATTRIBUTE_DESCRIPTION[key]}</div></div>
          <div style="display:flex;align-items:center;gap:6px"><span class="attr-row__value">${progression.attributes[key]}</span>${progression.attributePoints > 0 ? `<button class="btn btn--sm" data-attr="${key}" type="button">+</button>` : ''}</div>
        </div>`).join('')}
      ${sets.length ? `<div class="slot__label" style="margin:16px 0 8px">Conjuntos</div>${sets.map(set => `<div class="skill-node"><div class="skill-node__top"><span class="skill-node__name">${set.name}</span><span class="skill-node__rank">${set.equipped}/4</span></div>${set.bonuses.map(bonus => `<div class="skill-node__desc ${set.equipped >= bonus.pieces ? 'gold' : ''}">${bonus.pieces} peças: ${bonus.description}</div>`).join('')}</div>`).join('')}` : ''}
    `

    body.append(left, mid, right)
    foot.innerHTML = `<span>Ouro: <b class="gold">${inventory.gold}</b></span><span>Nível ${progression.level} · ${progression.xp}/${progression.xpToNext} XP</span>`

    left.querySelectorAll<HTMLElement>('[data-slot]').forEach(element => element.addEventListener('click', () => {
      this.selectedEquip = element.dataset.slot as EquipSlot
      this.openInventory(ctx)
    }))
    mid.querySelectorAll<HTMLElement>('[data-bag]').forEach(element => element.addEventListener('click', () => {
      this.selectedBag = Number(element.dataset.bag)
      this.openInventory(ctx)
    }))
    mid.querySelector('[data-equip]')?.addEventListener('click', () => ctx.actions.equip(this.selectedBag))
    mid.querySelector('[data-use]')?.addEventListener('click', () => ctx.actions.useItem(this.selectedBag))
    mid.querySelector('[data-upgrade]')?.addEventListener('click', () => ctx.actions.upgrade(this.selectedBag))
    mid.querySelector('[data-drop]')?.addEventListener('click', () => ctx.actions.drop(this.selectedBag))
    right.querySelectorAll<HTMLElement>('[data-attr]').forEach(element => element.addEventListener('click', () => ctx.actions.spendPoint(element.dataset.attr as AttributeKey)))
    this.mount(panel, 'inventario', ctx)
  }

  // ── Skills ───────────────────────────────────────────────────────────────
  openSkills(ctx: PanelContext): void {
    const { skills, progression } = ctx
    const { panel, body, foot } = this.basePanel('Habilidades', `Pontos disponíveis: ${progression.skillPoints}`)
    const branches: SkillBranch[] = ['lamina', 'arcano', 'sombra']
    for (const branch of branches) {
      const column = document.createElement('div')
      column.className = 'skill-branch scroll'
      const info = BRANCH_INFO[branch]
      column.innerHTML = `<div class="skill-branch__head" style="color:${info.color}">${info.name}</div><div class="skill-branch__desc">${info.description}</div>`
      for (const node of SKILL_NODES.filter(entry => entry.branch === branch)) {
        const rank = skills.rank(node.id)
        const error = skills.canRank(node.id, progression.skillPoints, progression.level)
        const nodeEl = document.createElement('div')
        nodeEl.className = `skill-node${rank >= node.maxRank ? ' maxed' : ''}${error && error !== 'Sem pontos de habilidade.' && error !== 'Nível máximo alcançado.' ? ' locked' : ''}`
        nodeEl.innerHTML = `
          <div class="skill-node__top"><span class="skill-node__name">${node.name}</span><span class="skill-node__rank">${rank}/${node.maxRank}</span></div>
          <div class="skill-node__desc">${node.description}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="small muted">Nível ${node.level}${node.requires ? ` · requer ${SKILL_NODES.find(entry => entry.id === node.requires)?.name}` : ''}</span>
            <button class="btn btn--sm" data-skill="${node.id}" type="button" ${error ? 'disabled' : ''}>${rank >= node.maxRank ? 'Máximo' : 'Aprender'}</button>
          </div>`
        column.appendChild(nodeEl)
      }
      body.appendChild(column)
    }
    const effects = skills.effects()
    foot.innerHTML = `<span>Dano físico +${Math.round(effects.physicalDamage * 100)}% · Dano mágico +${Math.round(effects.magicDamage * 100)}%</span><span>Crítico +${Math.round(effects.critBonus * 100)}% · Roubo de vida +${Math.round(effects.lifesteal * 100)}%</span>`
    body.querySelectorAll<HTMLElement>('[data-skill]').forEach(element => element.addEventListener('click', () => ctx.actions.rankSkill(element.dataset.skill!)))
    this.mount(panel, 'habilidades', ctx)
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  openMap(ctx: PanelContext): void {
    const { panel, body, foot } = this.basePanel('Mapa de Aetherion', 'O mundo conhecido e o que resta dele')
    const wrap = document.createElement('div')
    wrap.className = 'map-wrap'
    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'map-canvas'
    const canvas = document.createElement('canvas')
    canvas.width = 760
    canvas.height = 760
    if (ctx.mapCanvas) {
      const context = canvas.getContext('2d')!
      context.drawImage(ctx.mapCanvas, 0, 0, canvas.width, canvas.height)
      drawMapOverlay(context, canvas.width, ctx)
    }
    canvasWrap.appendChild(canvas)
    const list = document.createElement('div')
    list.className = 'poi-list scroll'
    const sorted = [...ctx.pois].sort((a, b) => Math.hypot(a.x - ctx.player.x, a.z - ctx.player.z) - Math.hypot(b.x - ctx.player.x, b.z - ctx.player.z))
    list.innerHTML = sorted.map(poi => {
      const distance = Math.round(Math.hypot(poi.x - ctx.player.x, poi.z - ctx.player.z))
      return `<div class="poi-item ${poi.discovered ? 'discovered' : 'unknown'}${this.selectedPoi === poi.id ? ' active' : ''}" data-poi="${poi.id}">
        <span>${poi.discovered ? poi.name : '??? '}${poi.bossId ? ' ◆' : ''}</span><span class="poi-item__dist">${poi.discovered ? `${distance} m` : '—'}</span>
      </div>`
    }).join('')
    wrap.append(canvasWrap, list)
    body.appendChild(wrap)
    const selected = ctx.pois.find(poi => poi.id === this.selectedPoi)
    foot.innerHTML = `<span>${selected ? `${selected.name} · ${selected.kind}${selected.bossId ? ' · chefe' : ''}` : 'Selecione um local'}</span>
      ${selected && selected.discovered ? `<button class="btn btn--sm btn--primary" data-travel type="button">Viajar para ${selected.name}</button>` : '<span class="muted">Viaje apenas para locais descobertos.</span>'}`
    list.querySelectorAll<HTMLElement>('[data-poi]').forEach(element => element.addEventListener('click', () => {
      this.selectedPoi = element.dataset.poi!
      this.openMap(ctx)
    }))
    foot.querySelector('[data-travel]')?.addEventListener('click', () => {
      if (this.selectedPoi) ctx.actions.fastTravel(this.selectedPoi)
    })
    this.mount(panel, 'mapa', ctx)
  }

  // ── Quests ───────────────────────────────────────────────────────────────
  openQuests(ctx: PanelContext): void {
    const { panel, body, foot } = this.basePanel('Diário', 'Missões, caçadas e rumores')
    const active = ctx.quests.active()
    const available = ctx.quests.available(ctx.progression.level)
    const completed = ctx.quests.completed()
    if (!this.selectedQuest) this.selectedQuest = ctx.quests.tracked ?? active[0]?.id ?? null
    const left = document.createElement('div')
    left.className = 'col col--left scroll'
    const section = (title: string, quests: QuestDef[], status: string): string => quests.length ? `<div class="slot__label" style="margin:10px 0 6px">${title}</div><div class="quest-list">${quests.map(quest => `<div class="quest-item${this.selectedQuest === quest.id ? ' active' : ''}" data-quest="${quest.id}"><div class="quest-item__type">${quest.type}${quest.chapter ? ` · cap. ${quest.chapter}` : ''}</div><div class="quest-item__name">${quest.name}</div><div class="quest-item__status">${status}</div></div>`).join('')}</div>` : ''
    left.innerHTML = section('Em andamento', active, 'ativa') + section('Disponíveis', available, `nível ${ctx.progression.level}`) + section('Concluídas', completed.slice(-8), 'concluída')
    const right = document.createElement('div')
    right.className = 'col col--mid scroll'
    const quest = this.selectedQuest ? [...active, ...available, ...completed].find(entry => entry.id === this.selectedQuest) : undefined
    if (quest) {
      const isActive = ctx.quests.state(quest.id)?.status === 'ativa'
      const ready = ctx.quests.ready(quest.id)
      right.innerHTML = `<div class="quest-detail">
        <div class="quest-item__type">${quest.type}${quest.chapter ? ` · capítulo ${quest.chapter}` : ''}</div>
        <h3>${quest.name}</h3>
        <div class="detail__desc">${quest.summary}</div>
        <p class="small" style="line-height:1.7;color:#c3b7a2">${quest.description}</p>
        <div class="slot__label" style="margin:12px 0 6px">Objetivos</div>
        ${quest.objectives.map(objective => {
          const current = Math.min(objective.count, ctx.quests.objectiveProgress(quest.id, objective.id))
          const done = current >= objective.count
          return `<div class="quest-detail__obj${done ? ' done' : ''}"><span class="check">${done ? '✓' : ''}</span><span>${objective.label}${objective.count > 1 ? ` — ${current}/${objective.count}` : ''}</span></div>`
        }).join('')}
        <div class="reward-row"><span>✦ ${quest.rewards.xp} XP</span><span>◈ ${quest.rewards.gold} de ouro</span>${(quest.rewards.items ?? []).map(item => `<span>${itemById(item.itemId)?.name ?? item.itemId} ×${item.count}</span>`).join('')}</div>
        ${ready ? '<div class="small gold" style="margin-top:10px">Pronta para entregar. Procure quem a ofereceu.</div>' : ''}
        ${!isActive && !ready ? '<div class="small muted" style="margin-top:10px">Fale com quem ofereceu esta missão para aceitá-la.</div>' : ''}
      </div>`
    } else {
      right.innerHTML = '<div class="muted">Nenhuma missão selecionada.</div>'
    }
    body.append(left, right)
    foot.innerHTML = `<span>${active.length} ativas · ${completed.length} concluídas</span>${quest && ctx.quests.state(quest.id)?.status === 'ativa' ? `<button class="btn btn--sm" data-track type="button">${ctx.quests.tracked === quest.id ? 'Rastreando' : 'Rastrear no HUD'}</button>` : ''}`
    left.querySelectorAll<HTMLElement>('[data-quest]').forEach(element => element.addEventListener('click', () => {
      this.selectedQuest = element.dataset.quest!
      this.openQuests(ctx)
    }))
    foot.querySelector('[data-track]')?.addEventListener('click', () => {
      if (quest) ctx.actions.trackQuest(quest.id)
    })
    this.mount(panel, 'missoes', ctx)
  }

  // ── Crafting ─────────────────────────────────────────────────────────────
  openCraft(ctx: PanelContext, station: 'alquimia' | 'forja' | 'fogueira' | 'bancada'): void {
    const { panel, body, foot } = this.basePanel(STATION_LABEL[station], 'Transforme o que você coleta em sobrevivência')
    const list = document.createElement('div')
    list.className = 'col col--mid scroll'
    const recipes = RECIPES.filter(recipe => recipe.station === station)
    list.innerHTML = recipes.map(recipe => {
      const error = canCraft(recipe, ctx.inventory, ctx.progression.level)
      const output = itemById(recipe.output.itemId)
      return `<div class="recipe${error ? '' : ' craftable'}">
        <div class="recipe__icon ${output ? `border-${output.rarity}` : ''}" style="color:var(--parchment)">${output ? itemIcon(output) : '?'}</div>
        <div class="recipe__body">
          <div class="recipe__name">${recipe.name} ${recipe.output.count > 1 ? `×${recipe.output.count}` : ''}</div>
          <div class="recipe__req">${recipe.inputs.map(input => {
            const def = itemById(input.itemId)
            const missing = ctx.inventory.count(input.itemId) < input.count
            return `<span class="${missing ? 'miss' : ''}">${def?.name ?? input.itemId} ${ctx.inventory.count(input.itemId)}/${input.count}</span>`
          }).join(' · ')}${recipe.gold ? ` · ${recipe.gold} de ouro` : ''}</div>
          ${error ? `<div class="small muted">${error}</div>` : ''}
        </div>
        <button class="btn btn--sm" data-craft="${recipe.id}" type="button" ${error ? 'disabled' : ''}>Criar</button>
      </div>`
    }).join('')
    body.appendChild(list)
    foot.innerHTML = `<span>Ouro: <b class="gold">${ctx.inventory.gold}</b></span><span>Materiais vêm de veios, ervas e criaturas.</span>`
    list.querySelectorAll<HTMLElement>('[data-craft]').forEach(element => element.addEventListener('click', () => ctx.actions.craft(element.dataset.craft!)))
    this.mount(panel, 'forja', ctx, station)
  }

  // ── Shop ─────────────────────────────────────────────────────────────────
  openShop(ctx: PanelContext, shop: Shop): void {
    const { panel, body, foot } = this.basePanel(shop.name, 'Compre, venda, negocie')
    const stock = document.createElement('div')
    stock.className = 'col col--mid scroll'
    stock.innerHTML = `<div class="slot__label" style="margin-bottom:8px">À venda</div><div class="shop-grid">${shop.stock.map(entry => {
      const def = itemById(entry.itemId)
      if (!def) return ''
      const affordable = ctx.inventory.gold >= entry.price
      return `<div class="shop-item ${`border-${def.rarity}`}">
        <div class="recipe__icon" style="color:var(--parchment)">${itemIcon(def)}</div>
        <div class="shop-item__body"><div class="shop-item__name ${'rarity-' + def.rarity}">${def.name}</div><div class="small muted">${RARITY_LABEL[def.rarity]}${def.level ? ` · Nv ${def.level}` : ''}</div></div>
        <div style="text-align:right"><div class="shop-item__price">${entry.price} ◈</div><button class="btn btn--sm" data-buy="${def.id}" type="button" ${affordable ? '' : 'disabled'}>Comprar</button></div>
      </div>`
    }).join('')}</div>`
    const sell = document.createElement('div')
    sell.className = 'col col--right scroll'
    sell.innerHTML = `<div class="slot__label" style="margin-bottom:8px">Vender</div>${ctx.inventory.stacks.map((stack, index) => {
      const def = itemById(stack.id)
      if (!def) return ''
      return `<div class="shop-item" style="margin-bottom:6px">
        <div class="recipe__icon" style="width:32px;height:32px;color:var(--parchment)">${itemIcon(def)}</div>
        <div class="shop-item__body"><div class="shop-item__name ${'rarity-' + def.rarity}">${def.name}${stack.count > 1 ? ` ×${stack.count}` : ''}</div><div class="small muted">${Math.round(def.value * (0.45 + stack.plus * 0.08))} ◈ cada</div></div>
        <button class="btn btn--sm" data-sell="${index}" type="button">Vender</button>
      </div>`
    }).join('')}`
    body.append(stock, sell)
    foot.innerHTML = `<span>Ouro: <b class="gold">${ctx.inventory.gold}</b></span><span>Preços variam com a raridade e o aprimoramento.</span>`
    stock.querySelectorAll<HTMLElement>('[data-buy]').forEach(element => element.addEventListener('click', () => ctx.actions.buy(element.dataset.buy!)))
    sell.querySelectorAll<HTMLElement>('[data-sell]').forEach(element => element.addEventListener('click', () => ctx.actions.sell(Number(element.dataset.sell))))
    this.mount(panel, 'loja', ctx, shop)
  }

  // ── Pause & settings ─────────────────────────────────────────────────────
  openPause(ctx: PanelContext): void {
    const panel = document.createElement('div')
    panel.className = 'panel pause-card'
    panel.innerHTML = `
      <div class="panel__head"><div><h2 class="panel__title">Pausa</h2><div class="panel__sub">O Eclipse espera</div></div><button class="panel__close" data-close type="button" aria-label="Fechar">✕</button></div>
      <div class="panel__body">
        <div class="setting"><span>Música</span><input type="range" min="0" max="1" step="0.05" value="${ctx.settings.musicVolume}" data-setting="musicVolume"></div>
        <div class="setting"><span>Efeitos</span><input type="range" min="0" max="1" step="0.05" value="${ctx.settings.sfxVolume}" data-setting="sfxVolume"></div>
        <div class="setting"><span>Sensibilidade</span><input type="range" min="0.3" max="2.5" step="0.1" value="${ctx.settings.sensitivity}" data-setting="sensitivity"></div>
        <div class="setting"><span>Qualidade</span>
          <select data-setting="quality">
            <option value="low" ${ctx.settings.quality === 'low' ? 'selected' : ''}>Baixa</option>
            <option value="medium" ${ctx.settings.quality === 'medium' ? 'selected' : ''}>Média</option>
            <option value="high" ${ctx.settings.quality === 'high' ? 'selected' : ''}>Alta</option>
          </select>
        </div>
        <div class="setting"><span>Reduzir movimento</span><input type="checkbox" data-setting="reducedMotion" ${ctx.settings.reducedMotion ? 'checked' : ''}></div>
        <div class="setting"><span>Inverter eixo Y</span><input type="checkbox" data-setting="invertY" ${ctx.settings.invertY ? 'checked' : ''}></div>
        <div class="pause-actions">
          <button class="btn btn--primary" data-close type="button">Continuar</button>
          <button class="btn" data-save type="button">Salvar agora</button>
          <button class="btn btn--danger" data-quit type="button">Sair para o título</button>
        </div>
        <div class="small muted" style="line-height:1.7">WASD mover · Mouse olhar · Shift correr · Espaço pular/planar · Ctrl rolar · Clique atacar · Direito bloquear · E interagir · 1-6 elemento · Z/X/C habilidades · H poção</div>
      </div>`
    panel.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.setting as keyof Settings
        const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value
        ctx.actions.settings({ [key]: value } as Partial<Settings>)
      })
    })
    panel.querySelector('[data-save]')?.addEventListener('click', () => ctx.actions.save())
    panel.querySelector('[data-quit]')?.addEventListener('click', () => ctx.actions.quit())
    this.mount(panel, 'pausa', ctx)
  }

  openDeath(kills: number, level: number): void {
    const el = document.createElement('div')
    el.className = 'death'
    el.innerHTML = `
      <h2 class="death__title">Você caiu</h2>
      <p class="death__sub">A marca na sua pele ainda pulsa. Aetherion não terminou com você — mas o Eclipse sentiu.</p>
      <div class="small muted">Nível ${level} · ${kills} criaturas derrotadas</div>
      <button class="btn btn--primary" data-respawn type="button">Levantar no último santuário</button>
      <div class="death__quote">“Todo fim é apenas uma sombra mal interpretada.” — Vekh, o Eremita</div>`
    this.overlay.innerHTML = ''
    this.overlay.appendChild(el)
    this.overlay.classList.remove('hidden')
    this.current = null
    el.querySelector('[data-respawn]')?.addEventListener('click', () => {
      this.overlay.classList.add('hidden')
      this.overlay.innerHTML = ''
      this.onDeathRespawn?.()
    })
  }

  onDeathRespawn?: () => void

  openVictory(stats: { level: number; kills: number; deaths: number; playtime: number }): void {
    const el = document.createElement('div')
    el.className = 'victory'
    el.innerHTML = `
      <div class="title__eyebrow">Capítulo final</div>
      <h2 class="victory__title">O Eclipse se fecha</h2>
      <p class="death__sub">Nyxharion caiu. A luz que restava volta a correr por Aetherion — e a marca no seu braço, enfim, apaga.</p>
      <div class="victory__stats"><span>Nível ${stats.level}</span><span>${stats.kills} criaturas</span><span>${stats.deaths} quedas</span><span>${formatTime(stats.playtime)}</span></div>
      <button class="btn btn--primary" data-continue type="button">Continuar explorando</button>`
    this.overlay.innerHTML = ''
    this.overlay.appendChild(el)
    this.overlay.classList.remove('hidden')
    el.querySelector('[data-continue]')?.addEventListener('click', () => {
      this.overlay.classList.add('hidden')
      this.overlay.innerHTML = ''
      this.onVictoryContinue?.()
    })
  }

  onVictoryContinue?: () => void

  // ── Dialogue ─────────────────────────────────────────────────────────────
  showDialogue(speaker: string, role: string, text: string, choices: DialogueChoiceView[], onSelect: (index: number) => void): void {
    this.dialogueChoiceHandler = onSelect
    const initials = speaker.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()
    this.dialogueEl.innerHTML = `
      <div class="dialogue__box">
        <div class="dialogue__who"><div class="dialogue__avatar">${initials}</div><div><div class="dialogue__name">${speaker}</div><div class="dialogue__role">${role}</div></div></div>
        <div class="dialogue__text">${text}</div>
        <div class="dialogue__choices">${choices.map((choice, index) => `<button class="dialogue__choice${choice.kind === 'quest' ? ' dialogue__choice--quest' : ''}" data-choice="${index}" type="button">${choice.text}</button>`).join('')}</div>
      </div>`
    this.dialogueEl.classList.remove('hidden')
    this.dialogueEl.querySelectorAll<HTMLElement>('[data-choice]').forEach(element => element.addEventListener('click', () => this.dialogueChoiceHandler?.(Number(element.dataset.choice))))
  }

  hideDialogue(): void {
    this.dialogueEl.classList.add('hidden')
    this.dialogueEl.innerHTML = ''
    this.dialogueChoiceHandler = undefined
  }
}

function drawMapOverlay(ctx: CanvasRenderingContext2D, size: number, context: PanelContext): void {
  const scale = size / 4200
  const toX = (x: number): number => size / 2 + x * scale
  const toY = (z: number): number => size / 2 + z * scale
  ctx.save()
  for (const poi of context.pois) {
    if (!poi.discovered) continue
    const x = toX(poi.x)
    const y = toY(poi.z)
    ctx.fillStyle = poi.bossId ? '#ffb347' : poi.kind === 'cidade' ? '#ffe9b8' : '#d6b46e'
    ctx.beginPath()
    ctx.arc(x, y, poi.bossId ? 7 : 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(8,7,12,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(240,229,207,0.92)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(poi.name, x, y - 12)
  }
  // Player marker
  const px = toX(context.player.x)
  const py = toY(context.player.z)
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(-context.player.yaw)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(7, 8)
  ctx.lineTo(0, 3)
  ctx.lineTo(-7, 8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.restore()
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}

export function equipmentSummary(inventory: Inventory): string {
  const weapon = inventory.equippedDef('arma')
  const armor = inventory.equippedDef('armadura')
  return `${weapon?.name ?? 'Sem arma'} · ${armor?.name ?? 'Sem armadura'}`
}

export function stackLabel(stack: Stack): string {
  const def = itemById(stack.id)
  return `${def?.name ?? stack.id}${stack.plus ? ` +${stack.plus}` : ''} (${Math.round(plusMultiplier(stack.plus) * 100)}%)`
}

export { MAX_LEVEL, shopFor }
