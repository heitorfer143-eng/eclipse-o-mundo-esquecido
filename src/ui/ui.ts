import * as THREE from 'three'
import type { SaveStore, Settings } from '../engine/save'
import type { ElementId } from '../game/data/types'
import { DEFAULT_CHARACTER_PROFILE, isCharacterNameValid, type CharacterProfile } from '../game/data/characterProfile'
import { Hud, type HudSnapshot } from './hud'
import { Panels, type DialogueChoiceView, type PanelContext } from './panels'
import { TitleScreen } from './title'
import { CharacterCustomizer } from './characterCustomizer'
import { CampaignIntro } from './campaignIntro'
import { OpeningIntro } from './openingIntro'
import { TouchControls, type TouchAction } from './touch'

export type UiCallbacks = {
  onNewGame: (profile: CharacterProfile) => void
  onContinue: (campaignId: string) => void
  onOpeningPlay: () => void
  onOpeningStop: () => void
  onSettingsChanged?: (settings: Settings) => void
  onCharacterProfileChanged?: (profile: CharacterProfile) => void
}

/** Single entry point for every screen: HUD, modal panels, dialogue, title and touch. */
export class Ui {
  readonly hud: Hud
  readonly panels: Panels
  readonly title: TitleScreen
  readonly touch: TouchControls
  private readonly settingsOverlay = document.createElement('div')
  private readonly characterCustomizer: CharacterCustomizer
  private readonly campaignIntro: CampaignIntro
  private readonly openingIntro: OpeningIntro
  private readonly save: SaveStore
  private readonly onSettingsChanged?: (settings: Settings) => void
  private readonly onCharacterProfileChanged?: (profile: CharacterProfile) => void

  constructor(root: HTMLElement, save: SaveStore, callbacks: UiCallbacks) {
    this.save = save
    this.hud = new Hud(root)
    this.panels = new Panels(root)
    this.onSettingsChanged = callbacks.onSettingsChanged
    this.onCharacterProfileChanged = callbacks.onCharacterProfileChanged
    this.touch = new TouchControls(root)
    document.documentElement.classList.toggle('touch-capable', TouchControls.supported)
    this.characterCustomizer = new CharacterCustomizer(root, () => this.syncTouch())
    this.campaignIntro = new CampaignIntro(root, {
      onStart: () => {
        this.campaignIntro.close(false)
        this.createCharacter(callbacks.onNewGame, this.title.newCampaignTrigger)
      },
      onClose: () => this.syncTouch(),
    })
    this.title = new TitleScreen(root, save, {
      onNew: () => {
        this.openingIntro.open(true)
        this.syncTouch()
      },
      onContinue: campaignId => this.continueCampaign(campaignId, callbacks.onContinue),
      onIntro: () => {
        this.title.hide()
        this.openingIntro.open()
        this.syncTouch()
      },
      onSettings: () => this.openSettings(),
    })
    this.openingIntro = new OpeningIntro(root, {
      onPlay: callbacks.onOpeningPlay,
      onStop: callbacks.onOpeningStop,
      onClose: continueToCampaign => {
        if (continueToCampaign) this.campaignIntro.open()
        else this.title.show()
        this.syncTouch()
      },
    })
    this.settingsOverlay.className = 'overlay hidden'
    root.appendChild(this.settingsOverlay)
    this.syncTouch()
  }

  get blocking(): boolean {
    return this.panels.isOpen || this.panels.dialogueOpen || this.title.visible || this.campaignIntro.visible || this.openingIntro.visible || !this.settingsOverlay.classList.contains('hidden') || this.characterCustomizer.visible
  }

  get characterCustomizationVisible(): boolean {
    return this.characterCustomizer.visible
  }

  showTitle(): void {
    this.hud.show(false)
    this.openingIntro.close(false)
    this.campaignIntro.close(false)
    this.title.show()
    this.syncTouch()
  }

  showGame(): void {
    this.openingIntro.close(false)
    this.campaignIntro.close(false)
    this.title.hide()
    this.hud.show(true)
    this.syncTouch()
  }

  renderHud(snapshot: HudSnapshot, dt: number, camera: THREE.PerspectiveCamera, width: number, height: number): void {
    this.hud.render(snapshot, dt)
    this.hud.updateDamage(dt, camera, width, height)
  }

  openInventory(ctx: PanelContext): void { this.panels.openInventory(ctx); this.syncTouch() }
  openSkills(ctx: PanelContext): void { this.panels.openSkills(ctx); this.syncTouch() }
  openMap(ctx: PanelContext): void { this.panels.openMap(ctx); this.syncTouch() }
  openQuests(ctx: PanelContext): void { this.panels.openQuests(ctx); this.syncTouch() }
  openCraft(ctx: PanelContext, station: 'alquimia' | 'forja' | 'fogueira' | 'bancada'): void { this.panels.openCraft(ctx, station); this.syncTouch() }
  openShop(ctx: PanelContext, shop: Parameters<Panels['openShop']>[1]): void { this.panels.openShop(ctx, shop); this.syncTouch() }
  openPause(ctx: PanelContext): void { this.panels.openPause(ctx); this.syncTouch() }
  closePanels(): void { this.panels.close(); this.syncTouch() }
  refreshPanels(): void { this.panels.refresh() }

  private createCharacter(onComplete: (profile: CharacterProfile) => void, returnFocus?: HTMLElement): void {
    this.characterCustomizer.open(DEFAULT_CHARACTER_PROFILE, profile => {
      this.onCharacterProfileChanged?.(profile)
    }, {
      returnFocus,
      onConfirm: onComplete,
    })
    this.syncTouch()
  }

  private continueCampaign(campaignId: string, onComplete: (campaignId: string) => void): void {
    const campaign = this.save.data.campaigns.find(entry => entry.id === campaignId)
    if (!campaign) return
    if (isCharacterNameValid(campaign.profile.name)) {
      onComplete(campaignId)
      return
    }
    this.characterCustomizer.open(campaign.profile, profile => {
      this.onCharacterProfileChanged?.(profile)
    }, {
      onConfirm: profile => {
        const saved = this.save.updateCampaignProfile(campaignId, profile)
        if (!saved) return
        this.onCharacterProfileChanged?.(saved)
        onComplete(campaignId)
      },
    })
    this.syncTouch()
  }

  showDialogue(speaker: string, role: string, text: string, choices: DialogueChoiceView[], onSelect: (index: number) => void): void {
    this.panels.showDialogue(speaker, role, text, choices, onSelect)
    this.syncTouch()
  }

  hideDialogue(): void { this.panels.hideDialogue(); this.syncTouch() }

  showDeath(kills: number, level: number, onRespawn: () => void): void {
    this.panels.onDeathRespawn = onRespawn
    this.panels.openDeath(kills, level)
    this.syncTouch()
  }

  showVictory(stats: { level: number; kills: number; deaths: number; playtime: number }, onContinue: () => void): void {
    this.panels.onVictoryContinue = onContinue
    this.panels.openVictory(stats)
    this.syncTouch()
  }

  toast(text: string, kind?: 'info' | 'item' | 'quest' | 'warn' | 'level'): void { this.hud.toast(text, kind) }
  subtitle(speaker: string, text: string, seconds?: number): void { this.hud.subtitle(speaker, text, seconds) }
  popDamage(position: THREE.Vector3, text: string, kind?: 'hit' | 'crit' | 'heal' | 'hurt' | 'magic'): void { this.hud.popDamage(position, text, kind) }
  setVignette(on: boolean): void { this.hud.setVignette(on) }
  flashAbility(index: number): void { this.hud.flashAbility(index) }
  bindHud(element: (element: ElementId) => void, ability: (index: number) => void, potion: () => void, openQuests: () => void): void { this.hud.bind(element, ability, potion, openQuests) }

  consumeTouch(action: TouchAction): boolean { return this.touch.consume(action) }
  heldTouch(action: TouchAction): boolean { return this.touch.held(action) }
  consumeTouchLook(): { x: number; y: number } { return this.touch.consumeLook() }

  openSettings(): void {
    const settings = this.save.data.settings
    const card = document.createElement('div')
    card.className = 'panel pause-card'
    card.innerHTML = `
      <div class="panel__head"><div><h2 class="panel__title">Configurações</h2><div class="panel__sub">Som, imagem e controle</div></div><button class="panel__close" data-close type="button" aria-label="Fechar">✕</button></div>
      <div class="panel__body">
        ${slider('musicVolume', 'Música', settings.musicVolume)}
        ${slider('sfxVolume', 'Efeitos', settings.sfxVolume)}
        ${slider('sensitivity', 'Sensibilidade', settings.sensitivity, 0.3, 2.5, 0.1)}
        <div class="setting"><span>Qualidade</span><select data-setting="quality">${['low', 'medium', 'high'].map(quality => `<option value="${quality}" ${settings.quality === quality ? 'selected' : ''}>${quality === 'low' ? 'Baixa' : quality === 'medium' ? 'Média' : 'Alta'}</option>`).join('')}</select></div>
        <div class="setting"><span>Reduzir movimento</span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></div>
        <div class="setting"><span>Inverter eixo Y</span><input type="checkbox" data-setting="invertY" ${settings.invertY ? 'checked' : ''}></div>
        <button class="btn btn--primary" data-close type="button">Voltar</button>
      </div>`
    this.settingsOverlay.innerHTML = ''
    this.settingsOverlay.appendChild(card)
    this.settingsOverlay.classList.remove('hidden')
    this.syncTouch()
    const close = (): void => {
      this.settingsOverlay.classList.add('hidden')
      this.settingsOverlay.innerHTML = ''
      this.syncTouch()
    }
    card.querySelectorAll<HTMLElement>('[data-close]').forEach(button => button.addEventListener('click', close))
    this.settingsOverlay.onclick = event => {
      if (event.target === this.settingsOverlay) close()
    }
    card.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.setting as keyof Settings
        const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value
        this.save.updateSettings({ [key]: value } as Partial<Settings>)
        this.onSettingsChanged?.(this.save.data.settings)
      })
    })
  }

  private syncTouch(): void {
    this.touch.show(TouchControls.supported && !this.blocking)
  }
}

function slider(key: string, label: string, value: number, min = 0, max = 1, step = 0.05): string {
  return `<div class="setting"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${key}"></div>`
}
