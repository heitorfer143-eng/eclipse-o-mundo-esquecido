import type { SaveStore } from '../engine/save'
import { formatTime } from './panels'

export type TitleCallbacks = {
  onNew: () => void
  onContinue: (campaignId: string) => void
  onSettings: () => void
}

/** Tela inicial com uma identidade e uma única campanha ativa. */
export class TitleScreen {
  readonly root = document.createElement('div')
  private readonly continueButton: HTMLButtonElement
  private readonly newButton: HTMLButtonElement
  private readonly campaigns: HTMLDivElement
  private readonly meta: HTMLDivElement

  constructor(parent: HTMLElement, private readonly save: SaveStore, callbacks: TitleCallbacks) {
    this.root.className = 'title hidden'
    this.root.innerHTML = `
      <div>
        <div class="title__eyebrow">ARPG de mundo aberto · uma campanha, uma jornada</div>
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
    this.campaigns.setAttribute('aria-label', 'Campanha ativa')

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
    this.newButton.textContent = 'Criar personagem'
    this.newButton.addEventListener('click', () => callbacks.onNew())

    const settingsButton = document.createElement('button')
    settingsButton.type = 'button'
    settingsButton.className = 'btn btn--ghost'
    settingsButton.textContent = 'Configurações'
    settingsButton.addEventListener('click', () => callbacks.onSettings())
    menu.append(this.campaigns, this.continueButton, this.newButton, settingsButton)
    this.meta = this.root.querySelector<HTMLDivElement>('.title__meta')!
    parent.appendChild(this.root)
  }

  show(): void {
    const active = this.save.activeCampaign
    const game = active?.game ?? null
    const profile = active?.profile ?? this.save.data.profile
    const hasCampaign = Boolean(active)

    this.continueButton.classList.toggle('hidden', !active)
    this.continueButton.textContent = game ? 'Continuar campanha' : 'Iniciar jornada'
    this.newButton.disabled = hasCampaign
    this.newButton.textContent = hasCampaign ? 'Campanha única ativa' : 'Criar personagem'

    this.campaigns.replaceChildren()
    if (active) {
      const label = document.createElement('div')
      label.className = 'title__campaigns-label'
      label.textContent = 'Campanha ativa'
      this.campaigns.appendChild(label)

      const campaignName = active.profile.name || 'Personagem sem nome'
      const row = document.createElement('div')
      row.className = 'title__campaign'
      const details = document.createElement('div')
      details.className = 'title__campaign-info'
      const name = document.createElement('strong')
      name.textContent = campaignName
      const summary = document.createElement('small')
      summary.textContent = game
        ? `Nível ${game.progression.level} · ${formatTime(game.playtime)} de jornada`
        : `${active.profile.modelId === 'Survivor' ? 'Sobrevivente' : 'Personagem'} · jornada ainda não iniciada`
      details.append(name, summary)

      const actions = document.createElement('div')
      actions.className = 'title__campaign-actions'
      const deleteButton = document.createElement('button')
      deleteButton.type = 'button'
      deleteButton.className = 'btn btn--danger btn--sm title__campaign-action title__campaign-delete'
      deleteButton.textContent = 'Excluir save'
      deleteButton.dataset.deleteCampaign = active.id
      deleteButton.setAttribute('aria-label', `Excluir save de ${campaignName}`)
      deleteButton.addEventListener('click', () => {
        const level = game ? ` (nível ${game.progression.level})` : ''
        const confirmed = window.confirm(
          `Excluir permanentemente a única campanha de ${campaignName}${level}? A identidade e todo o progresso serão apagados; as configurações permanecerão. Para iniciar outra jornada, será necessário criar um novo personagem.`,
        )
        if (confirmed && this.save.deleteCampaign(active.id)) this.show()
      })
      actions.appendChild(deleteButton)
      row.append(details, actions)
      this.campaigns.appendChild(row)
    }

    this.meta.textContent = game
      ? `${profile.name || 'Personagem sem nome'} · nível ${game.progression.level} · ${formatTime(game.playtime)} de jornada · ${game.kills} criaturas derrotadas`
      : active
        ? `${profile.name || 'Personagem sem nome'} · identidade fixa · pronto para iniciar sua jornada`
        : 'Crie seu personagem. A identidade e o progresso ficarão fixos nesta única campanha.'
    this.root.classList.remove('hidden')
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
