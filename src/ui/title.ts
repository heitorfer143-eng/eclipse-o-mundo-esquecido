import type { SaveStore } from '../engine/save'
import { formatTime } from './panels'

export type TitleCallbacks = {
  onNew: () => void
  onContinue: () => void
  onSettings: () => void
  onCustomize: () => void
}

/** Front-end screen shown before and after a run. */
export class TitleScreen {
  readonly root = document.createElement('div')
  private readonly continueButton: HTMLButtonElement
  private readonly meta: HTMLDivElement

  constructor(parent: HTMLElement, private readonly save: SaveStore, callbacks: TitleCallbacks) {
    this.root.className = 'title hidden'
    this.root.innerHTML = `
      <div>
        <div class="title__eyebrow">Um ARPG de mundo aberto</div>
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
    this.continueButton.textContent = 'Continuar aventura'
    this.continueButton.addEventListener('click', () => callbacks.onContinue())
    const newButton = document.createElement('button')
    newButton.type = 'button'
    newButton.className = 'btn'
    newButton.textContent = 'Nova aventura'
    newButton.addEventListener('click', () => {
      if (save.hasGame && !window.confirm('Começar de novo apaga o progresso atual. Continuar?')) return
      callbacks.onNew()
    })
    const customizeButton = document.createElement('button')
    customizeButton.type = 'button'
    customizeButton.className = 'btn btn--ghost'
    customizeButton.textContent = 'Personalizar personagem'
    customizeButton.addEventListener('click', () => callbacks.onCustomize())
    const settingsButton = document.createElement('button')
    settingsButton.type = 'button'
    settingsButton.className = 'btn btn--ghost'
    settingsButton.textContent = 'Configurações'
    settingsButton.addEventListener('click', () => callbacks.onSettings())
    menu.append(this.continueButton, newButton, customizeButton, settingsButton)
    this.meta = this.root.querySelector<HTMLDivElement>('.title__meta')!
    parent.appendChild(this.root)
  }

  show(): void {
    const game = this.save.data.game
    this.continueButton.classList.toggle('hidden', !game)
    this.meta.textContent = game
      ? `Nível ${game.progression.level} · ${formatTime(game.playtime)} de jornada · ${game.kills} criaturas derrotadas`
      : 'Nenhuma jornada salva'
    this.root.classList.remove('hidden')
  }

  hide(): void {
    this.root.classList.add('hidden')
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }
}
