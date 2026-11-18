import {
  AURA_OPTIONS,
  CHARACTER_OPTIONS,
  parseCharacterProfile,
  type CharacterProfile,
} from '../game/data/characterProfile'

export class CharacterCustomizer {
  readonly root = document.createElement('div')
  private profile!: CharacterProfile
  private onChange?: (profile: CharacterProfile) => void
  private returnFocus?: HTMLElement

  constructor(parent: HTMLElement, private readonly onClose: () => void) {
    this.root.className = 'overlay character-customizer hidden'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'character-customizer-title')
    this.root.addEventListener('click', event => {
      if (event.target === this.root) this.close()
    })
    this.root.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.close()
      }
    })
    parent.appendChild(this.root)
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden')
  }

  open(profile: CharacterProfile, onChange: (profile: CharacterProfile) => void): void {
    this.profile = parseCharacterProfile(profile)
    this.onChange = onChange
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    this.render()
    this.root.classList.remove('hidden')
    this.root.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }

  close(): void {
    if (!this.visible) return
    this.root.classList.add('hidden')
    this.onChange = undefined
    this.returnFocus?.focus()
    this.returnFocus = undefined
    this.onClose()
  }

  private update(patch: Partial<CharacterProfile>): void {
    this.profile = parseCharacterProfile({ ...this.profile, ...patch })
    this.onChange?.(this.profile)
    this.render()
  }

  private render(): void {
    const selectedModel = CHARACTER_OPTIONS.find(option => option.id === this.profile.modelId) ?? CHARACTER_OPTIONS[0]
    this.root.innerHTML = `
      <section class="character-customizer__panel">
        <header class="character-customizer__head">
          <div>
            <div class="character-customizer__eyebrow">Aetherion · aparência</div>
            <h2 class="character-customizer__title" id="character-customizer-title">Personalizar personagem</h2>
          </div>
          <button class="character-customizer__close" data-close type="button" aria-label="Fechar personalização">✕</button>
        </header>
        <div class="character-customizer__body scroll">
          <p class="character-customizer__intro">Escolha um visual e uma cor de aura. A aparência é cosmética: seus atributos, itens e progresso não mudam.</p>
          <p class="character-customizer__preview" aria-live="polite">${selectedModel.label} selecionado. A mudança é aplicada imediatamente ao aventureiro no cenário.</p>
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
          <span>Salvo automaticamente</span>
          <button class="btn btn--primary" data-close type="button">Concluir</button>
        </footer>
      </section>`

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
