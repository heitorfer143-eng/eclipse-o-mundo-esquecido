import {
  AURA_OPTIONS,
  CHARACTER_OPTIONS,
  isCharacterNameValid,
  normalizeCharacterName,
  parseCharacterProfile,
  type CharacterProfile,
} from '../game/data/characterProfile'
import { handleModalKeydown } from './modalFocus'

export type CharacterCustomizerOptions = {
  onConfirm?: (profile: CharacterProfile) => void
  returnFocus?: HTMLElement
}

/** One-time character creation dialog; existing campaign identities cannot be edited here. */
export class CharacterCustomizer {
  readonly root = document.createElement('div')
  private profile!: CharacterProfile
  private initialProfile!: CharacterProfile
  private onChange?: (profile: CharacterProfile) => void
  private onConfirm?: (profile: CharacterProfile) => void
  private returnFocus?: HTMLElement
  private completed = false
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.visible) handleModalKeydown(event, this.root, () => this.close())
  }

  constructor(parent: HTMLElement, private readonly onClose: () => void) {
    this.root.className = 'overlay character-customizer hidden'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'character-customizer-title')
    this.root.addEventListener('click', event => {
      if (event.target === this.root) this.close()
    })
    document.addEventListener('keydown', this.handleKeydown, true)
    parent.appendChild(this.root)
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }

  open(
    profile: CharacterProfile,
    onChange: (profile: CharacterProfile) => void,
    options: CharacterCustomizerOptions = {},
  ): void {
    this.profile = parseCharacterProfile(profile)
    this.initialProfile = this.profile
    this.onChange = onChange
    this.onConfirm = options.onConfirm
    this.completed = false
    this.returnFocus = options.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
    this.render()
    this.root.classList.remove('hidden')
    this.root.querySelector<HTMLInputElement>('[data-player-name]')?.focus()
  }

  close(): void {
    if (!this.visible) return
    if (!this.completed) this.onChange?.(this.initialProfile)
    this.hide()
  }

  private hide(restoreFocus = true): void {
    this.root.classList.add('hidden')
    this.onChange = undefined
    this.onConfirm = undefined
    if (restoreFocus) this.returnFocus?.focus()
    this.returnFocus = undefined
    this.onClose()
  }

  private finish(): void {
    if (!isCharacterNameValid(this.profile.name)) {
      this.root.querySelector<HTMLInputElement>('[data-player-name]')?.focus()
      return
    }
    const profile = parseCharacterProfile(this.profile)
    const onConfirm = this.onConfirm
    this.completed = true
    this.hide(false)
    onConfirm?.(profile)
  }

  private update(patch: Partial<CharacterProfile>): void {
    this.profile = parseCharacterProfile({ ...this.profile, ...patch })
    this.onChange?.(this.profile)
    this.render()
  }

  private updateName(value: string): void {
    const name = normalizeCharacterName(value)
    this.profile = { ...this.profile, name }
    const input = this.root.querySelector<HTMLInputElement>('[data-player-name]')
    if (input && input.value !== name) input.value = name
    this.onChange?.(this.profile)
    const finish = this.root.querySelector<HTMLButtonElement>('[data-finish]')
    if (finish) finish.disabled = !isCharacterNameValid(name)
  }

  private render(): void {
    const selectedModel = CHARACTER_OPTIONS.find(option => option.id === this.profile.modelId) ?? CHARACTER_OPTIONS[0]
    this.root.innerHTML = `
      <section class="character-customizer__panel">
        <header class="character-customizer__head">
          <div>
            <div class="character-customizer__eyebrow">Aetherion · personagem da campanha</div>
            <h2 class="character-customizer__title" id="character-customizer-title">Criar personagem</h2>
          </div>
          <button class="character-customizer__close" data-close type="button" aria-label="Fechar personalização">✕</button>
        </header>
        <div class="character-customizer__body scroll">
          <p class="character-customizer__intro">Escolha o nome e a aura do protagonista. A identidade ficará fixa; você começa como sobrevivente sem armadura e evolui explorando e fabricando equipamento.</p>
          <label class="character-customizer__section-title" for="campaign-player-name">Nome do jogador</label>
          <input class="character-customizer__name" id="campaign-player-name" data-player-name type="text" maxlength="24" autocomplete="nickname" placeholder="Digite o nome do personagem" required>
          <p class="character-customizer__preview" aria-live="polite">${selectedModel.label} selecionado. Sem armadura, capacete ou botas no início.</p>
          <h3 class="character-customizer__section-title">Visual</h3>
          <div class="character-customizer__models" role="group" aria-label="Modelos de personagem">
            ${CHARACTER_OPTIONS.map(option => `
              <button class="character-choice" data-model="${option.id}" type="button" aria-pressed="${this.profile.modelId === option.id}">
                <span class="character-choice__sigil" aria-hidden="true">✦</span>
                <span class="character-choice__copy"><strong>${option.label}</strong><small>${option.description}</small></span>
                <span class="character-choice__check" aria-hidden="true">${this.profile.modelId === option.id ? '✓' : ''}</span>
              </button>`).join('')}
          </div>
          <h3 class="character-customizer__section-title">Cor da aura</h3>
          <div class="character-customizer__auras" role="group" aria-label="Cores da aura">
            ${AURA_OPTIONS.map(option => `
              <button class="aura-swatch" data-aura="${option.id}" type="button" aria-label="Aura ${option.label}" aria-pressed="${this.profile.auraColor === option.color}">
                <span class="aura-swatch__dot" style="--swatch:${option.color}" aria-hidden="true"></span>
                <span>${option.label}</span>
              </button>`).join('')}
          </div>
        </div>
        <footer class="character-customizer__footer">
          <span>O nome e o visual serão salvos nesta campanha.</span>
          <button class="btn btn--primary" data-finish type="button">Confirmar e começar</button>
        </footer>
      </section>`

    const nameInput = this.root.querySelector<HTMLInputElement>('[data-player-name]')!
    nameInput.value = this.profile.name
    nameInput.addEventListener('input', () => this.updateName(nameInput.value))
    const finish = this.root.querySelector<HTMLButtonElement>('[data-finish]')!
    finish.disabled = !isCharacterNameValid(this.profile.name)
    finish.addEventListener('click', () => this.finish())

    this.root.querySelectorAll<HTMLButtonElement>('[data-model]').forEach(button => {
      button.addEventListener('click', () => {
        const modelId = CHARACTER_OPTIONS.find(option => option.id === button.dataset.model)?.id
        if (modelId) this.update({ modelId })
      })
    })
    this.root.querySelectorAll<HTMLButtonElement>('[data-aura]').forEach(button => {
      button.addEventListener('click', () => {
        const auraColor = AURA_OPTIONS.find(option => option.id === button.dataset.aura)?.color
        if (auraColor) this.update({ auraColor })
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-close]').forEach(button => {
      button.addEventListener('click', () => this.close())
    })
  }
}
