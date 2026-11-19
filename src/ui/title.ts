import { MAX_CAMPAIGNS, type SaveStore } from '../engine/save'
import { formatTime } from './panels'

export type TitleCallbacks = {
  onNew: () => void
  onContinue: (campaignId: string) => void
  onSettings: () => void
  onCustomize: () => void
}

/** Tela inicial com slots independentes de personagem e campanha. */
export class TitleScreen {
  readonly root = document.createElement('div')
  private readonly continueButton: HTMLButtonElement
  private readonly newButton: HTMLButtonElement
  private readonly customizeButton: HTMLButtonElement
  private readonly campaigns: HTMLDivElement
  private readonly meta: HTMLDivElement
  private readonly continueCampaign: (campaignId: string) => void

  constructor(parent: HTMLElement, private readonly save: SaveStore, callbacks: TitleCallbacks) {
    this.continueCampaign = callbacks.onContinue
    this.root.className = 'title hidden'
    this.root.innerHTML = `
      <div>
        <div class="title__eyebrow">ARPG de mundo aberto · campanha em 10 capítulos</div>
        <h1 class="title__name">Eclipse<br><span class="gold">O Mundo Esquecido</span></h1>
        <p class="title__tag">Há setecentos anos, o Eclipse partiu Aetherion e apagou o sol. Cristais antigos mantêm as regiões vivas; algo no coração da Cicatriz está acordando. Você carrega a marca que pode fechá-la.</p>
      </div>
      <div class="title__menu"></div>
      <div class="title__foot">
        <div class="title__controls--keyboard"><kbd>WASD</kbd> mover · <kbd>Espaço</kbd> pular · <kbd>Clique</kbd> atacar · <kbd>E</kbd> interagir</div>
        <div class="title__controls--touch">Joystick à esquerda para mover · arraste à direita para olhar · botões para atacar, esquivar e pausar.</div>
        <div class="title__meta"></div>
      </div>`
    const menu = this.root.querySelector<HTMLElement>('.title__menu')!
    this.campaigns = document.createElement('div')
    this.campaigns.className = 'title__campaigns'
    this.campaigns.setAttribute('aria-label', 'Campanhas salvas')

    this.continueButton = document.createElement('button')
    this.continueButton.type = 'button'
    this.continueButton.className = 'btn btn--primary'
    this.continueButton.textContent = 'Continuar campanha'
    this.continueButton.addEventListener('click', () => {
      const active = this.save.activeCampaign
      if (active) callbacks.onContinue(active.id)
    })

    this.newButton = document.createElement('button')
    this.newButton.type = 'button'
    this.newButton.className = 'btn'
    this.newButton.textContent = 'Nova campanha'
    this.newButton.addEventListener('click', () => callbacks.onNew())

    this.customizeButton = document.createElement('button')
    this.customizeButton.type = 'button'
    this.customizeButton.className = 'btn btn--ghost'
    this.customizeButton.textContent = 'Editar aparência'
    this.customizeButton.addEventListener('click', () => callbacks.onCustomize())

    const settingsButton = document.createElement('button')
    settingsButton.type = 'button'
    settingsButton.className = 'btn btn--ghost'
    settingsButton.textContent = 'Configurações'
    settingsButton.addEventListener('click', () => callbacks.onSettings())
    menu.append(this.campaigns, this.continueButton, this.newButton, this.customizeButton, settingsButton)
    this.meta = this.root.querySelector<HTMLDivElement>('.title__meta')!
    parent.appendChild(this.root)
  }

  show(): void {
    const game = this.save.data.game
    const profile = this.save.data.profile
    const hasCharacter = profile.name.length >= 2
    const activeId = this.save.data.activeCampaignId
    this.continueButton.classList.toggle('hidden', !game)
    this.newButton.disabled = this.save.data.campaigns.length >= MAX_CAMPAIGNS
    this.newButton.textContent = this.newButton.disabled ? 'Limite de campanhas alcançado' : 'Nova campanha'
    this.customizeButton.classList.toggle('hidden', !hasCharacter)

    this.campaigns.replaceChildren()
    const otherCampaigns = this.save.data.campaigns.filter(campaign => campaign.game && campaign.id !== activeId)
    if (otherCampaigns.length) {
      const label = document.createElement('div')
      label.className = 'title__campaigns-label'
      label.textContent = 'Outras campanhas salvas'
      this.campaigns.appendChild(label)
      for (const campaign of otherCampaigns) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'btn btn--ghost title__campaign'
        button.textContent = `${campaign.profile.name || 'Sem nome'} · Nv. ${campaign.game!.progression.level} · Retomar`
        button.setAttribute('aria-label', `Retomar ${campaign.profile.name || 'campanha sem nome'}, nível ${campaign.game!.progression.level}`)
        button.addEventListener('click', () => this.onContinueCampaign(campaign.id))
        this.campaigns.appendChild(button)
      }
    }

    this.meta.textContent = game
      ? `${profile.name || 'Personagem sem nome'} · Nível ${game.progression.level} · ${formatTime(game.playtime)} de jornada · ${game.kills} criaturas derrotadas · ${this.save.data.campaigns.length} campanha(s) salva(s)`
      : hasCharacter
        ? `${profile.name} · pronto para iniciar outra campanha · ${this.save.data.campaigns.length} campanha(s) salva(s)`
        : this.save.data.campaigns.length >= MAX_CAMPAIGNS
          ? `Limite de ${MAX_CAMPAIGNS} campanhas atingido. Seus saves continuam preservados neste dispositivo.`
          : 'Crie um personagem para cada campanha. Seus nomes e progressos ficam salvos neste dispositivo.'
    this.root.classList.remove('hidden')
  }

  private onContinueCampaign(id: string): void {
    this.continueCampaign(id)
  }

  hide(): void {
    this.root.classList.add('hidden')
  }

  get newCampaignTrigger(): HTMLButtonElement {
    return this.newButton
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }
}
