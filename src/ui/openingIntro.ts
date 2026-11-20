import { handleModalKeydown } from './modalFocus'

const OPENING_BEATS = [
  { eyebrow: 'Aetherion · há 700 anos', title: 'O amanhecer foi partido.', text: 'Por séculos, sete entidades mantiveram o mundo inteiro. Então uma delas abriu a mão.' },
  { eyebrow: 'A cicatriz no céu', title: 'O Eclipse mudou tudo.', text: 'Aetherion se fragmentou. A luz enfraqueceu, e as memórias começaram a desaparecer.' },
  { eyebrow: 'Brumal · agora', title: 'Algo despertou.', text: 'Nas florestas, criaturas voltaram a rondar as aldeias. No coração da Cicatriz, uma presença se move.' },
  { eyebrow: 'Sua jornada começa', title: 'Você carrega a marca.', text: 'Você acorda sem lembrar quem é. Encontre a Anciã Iara — e descubra por que o Eclipse se lembra de você.' },
]

export type OpeningIntroCallbacks = {
  onPlay: () => void
  onStop: () => void
  onClose: (continueToCampaign: boolean) => void
}

/** Short, skippable story opening paired with the game's original title cue. */
export class OpeningIntro {
  readonly root = document.createElement('div')
  private readonly eyebrow: HTMLElement
  private readonly title: HTMLElement
  private readonly text: HTMLElement
  private readonly skipButton: HTMLButtonElement
  private returnFocus?: HTMLElement
  private beatIndex = 0
  private timer = 0
  private continueToCampaign = false
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.visible) handleModalKeydown(event, this.root, () => this.close())
  }

  constructor(parent: HTMLElement, private readonly callbacks: OpeningIntroCallbacks) {
    this.root.className = 'opening-intro hidden'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'opening-intro-title')
    this.root.innerHTML = `
      <div class="opening-intro__sky" aria-hidden="true">
        <div class="opening-intro__eclipse"><i></i></div>
        <div class="opening-intro__horizon"></div>
      </div>
      <div class="opening-intro__brand" aria-hidden="true">ECLIPSE <span>O MUNDO ESQUECIDO</span></div>
      <section class="opening-intro__story" aria-live="polite">
        <div class="opening-intro__eyebrow"></div>
        <h2 class="opening-intro__title" id="opening-intro-title"></h2>
        <p class="opening-intro__text"></p>
      </section>
      <div class="opening-intro__footer">
        <div class="opening-intro__music"><span class="opening-intro__equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span> Trilha original · Eclipse</div>
        <button class="btn btn--ghost opening-intro__skip" type="button">Pular introdução</button>
      </div>`
    this.eyebrow = this.root.querySelector<HTMLElement>('.opening-intro__eyebrow')!
    this.title = this.root.querySelector<HTMLElement>('.opening-intro__title')!
    this.text = this.root.querySelector<HTMLElement>('.opening-intro__text')!
    this.skipButton = this.root.querySelector<HTMLButtonElement>('.opening-intro__skip')!
    this.skipButton.addEventListener('click', () => this.close())
    this.root.addEventListener('click', event => {
      if (event.target === this.root) this.close()
    })
    document.addEventListener('keydown', this.handleKeydown, true)
    parent.appendChild(this.root)
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }

  open(continueToCampaign = false): void {
    if (this.visible) return
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    this.beatIndex = 0
    this.continueToCampaign = continueToCampaign
    this.root.classList.remove('hidden')
    this.root.classList.add('opening-intro--playing')
    this.skipButton.textContent = continueToCampaign ? 'Pular para criar personagem' : 'Pular introdução'
    this.renderBeat()
    this.callbacks.onPlay()
    this.skipButton.focus()
    this.scheduleBeat()
  }

  close(restoreFocus = true): void {
    if (!this.visible) return
    const continueToCampaign = this.continueToCampaign
    this.continueToCampaign = false
    window.clearTimeout(this.timer)
    this.root.classList.add('hidden')
    this.root.classList.remove('opening-intro--playing')
    this.callbacks.onStop()
    this.callbacks.onClose(continueToCampaign)
    if (restoreFocus && !continueToCampaign) this.returnFocus?.focus()
    this.returnFocus = undefined
  }

  private renderBeat(): void {
    const beat = OPENING_BEATS[this.beatIndex]
    this.root.classList.add('opening-intro__transition')
    this.eyebrow.textContent = beat.eyebrow
    this.title.textContent = beat.title
    this.text.textContent = beat.text
    requestAnimationFrame(() => this.root.classList.remove('opening-intro__transition'))
    if (this.beatIndex === OPENING_BEATS.length - 1) {
      this.skipButton.textContent = this.continueToCampaign ? 'Continuar para criar personagem' : 'Voltar ao menu'
    }
  }

  private scheduleBeat(): void {
    if (this.beatIndex >= OPENING_BEATS.length - 1) return
    this.timer = window.setTimeout(() => {
      this.beatIndex += 1
      this.renderBeat()
      this.scheduleBeat()
    }, 6500)
  }
}
