import { questById } from '../game/data/questData'
import { handleModalKeydown } from './modalFocus'

export type CampaignIntroCallbacks = {
  onStart: () => void
  onClose: () => void
}

/** Apresenta a abertura da campanha a partir do texto já usado no diário da missão principal. */
export class CampaignIntro {
  readonly root = document.createElement('div')
  private returnFocus?: HTMLElement
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.visible) handleModalKeydown(event, this.root, () => this.close())
  }

  constructor(parent: HTMLElement, private readonly callbacks: CampaignIntroCallbacks) {
    const chapter = questById('principal-01')
    this.root.className = 'overlay campaign-intro hidden'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'campaign-intro-title')
    this.root.innerHTML = `
      <section class="campaign-intro__panel">
        <div class="campaign-intro__eyebrow">Campanha principal · capítulo ${chapter?.chapter ?? 1}</div>
        <h2 class="campaign-intro__title" id="campaign-intro-title"></h2>
        <p class="campaign-intro__summary"></p>
        <div class="campaign-intro__divider" aria-hidden="true"></div>
        <p class="campaign-intro__description"></p>
        <div class="campaign-intro__footer">
          <button class="btn btn--ghost" data-back type="button">Voltar</button>
          <button class="btn btn--primary" data-start type="button">Iniciar campanha</button>
        </div>
      </section>`
    this.root.querySelector<HTMLElement>('.campaign-intro__title')!.textContent = chapter?.name ?? 'O Despertar'
    this.root.querySelector<HTMLElement>('.campaign-intro__summary')!.textContent = chapter?.summary ?? ''
    this.root.querySelector<HTMLElement>('.campaign-intro__description')!.textContent = chapter?.description ?? ''
    this.root.querySelector<HTMLButtonElement>('[data-back]')!.addEventListener('click', () => this.close())
    this.root.querySelector<HTMLButtonElement>('[data-start]')!.addEventListener('click', () => this.callbacks.onStart())
    this.root.addEventListener('click', event => {
      if (event.target === this.root) this.close()
    })
    document.addEventListener('keydown', this.handleKeydown, true)
    parent.appendChild(this.root)
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }

  open(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    this.root.classList.remove('hidden')
    this.root.querySelector<HTMLButtonElement>('[data-start]')?.focus()
  }

  close(restoreFocus = true): void {
    if (!this.visible) return
    this.root.classList.add('hidden')
    if (restoreFocus) this.returnFocus?.focus()
    this.returnFocus = undefined
    this.callbacks.onClose()
  }
}
