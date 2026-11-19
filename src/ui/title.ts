import type { SaveStore } from '../engine/save'
import { formatTime } from './panels'

export type TitleCallbacks = {
  onNew: () => void
  onContinue: () => void
  onSettings: () => void
  onCustomize: () => void
}

/** Tela inicial com fluxo explícito para a campanha salva do jogador. */
export class TitleScreen {
  readonly root = document.createElement('div')
  private readonly continueButton: HTMLButtonElement
  private readonly newButton: HTMLButtonElement
  private readonly customizeButton: HTMLButtonElement
  private readonly meta: HTMLDivElement

  constructor(parent: HTMLElement, private readonly save: SaveStore, callbacks: TitleCallbacks) {
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
    this.continueButton = document.createElement('button')
    this.continueButton.type = 'button'
    this.continueButton.className = 'btn btn--primary'
    this.continueButton.textContent = 'Continuar campanha'
    this.continueButton.addEventListener('click', () => callbacks.onContinue())

    this.newButton = document.createElement('button')
    this.newButton.type = 'button'
    this.newButton.className = 'btn'
    this.newButton.addEventListener('click', () => {
      if (save.hasGame && !window.confirm('Começar uma nova campanha apagará o progresso atual. Seu personagem será mantido. Continuar?')) return
      callbacks.onNew()
    })

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
    menu.append(this.continueButton, this.newButton, this.customizeButton, settingsButton)
    this.meta = this.root.querySelector<HTMLDivElement>('.title__meta')!
    parent.appendChild(this.root)
  }

  show(): void {
    const game = this.save.data.game
    const profile = this.save.data.profile
    const hasCharacter = profile.name.length >= 2
    this.continueButton.classList.toggle('hidden', !game)
    this.newButton.classList.toggle('btn--primary', !game)
    this.newButton.textContent = game ? 'Nova campanha' : hasCharacter ? 'Iniciar campanha' : 'Criar personagem · campanha'
    this.customizeButton.classList.toggle('hidden', !hasCharacter)
    this.meta.textContent = game
      ? `${profile.name || 'Personagem sem nome'} · Nível ${game.progression.level} · ${formatTime(game.playtime)} de jornada · ${game.kills} criaturas derrotadas`
      : hasCharacter
        ? `${profile.name} · pronto para iniciar a campanha principal`
        : 'Crie seu personagem uma vez e acompanhe a história pelos 10 capítulos.'
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
