export type TouchAction = 'attack' | 'jump' | 'roll' | 'interact' | 'block' | 'potion' | 'ability0' | 'ability1' | 'ability2' | 'pause'

const HELD_ACTIONS = new Set<TouchAction>(['attack', 'jump', 'block'])

/** Virtual stick, look pad and action buttons for phones and tablets. */
export class TouchControls {
  readonly root = document.createElement('div')
  readonly move = { x: 0, y: 0 }
  readonly look = { x: 0, y: 0 }
  private readonly pressed = new Set<TouchAction>()
  private readonly heldActions = new Set<TouchAction>()
  private readonly activeButtons = new Map<number, { action: TouchAction; button: HTMLButtonElement }>()
  private readonly knob: HTMLDivElement
  private stickId: number | null = null
  private lookId: number | null = null
  private stickOrigin = { x: 0, y: 0 }
  private lookLast = { x: 0, y: 0 }

  constructor(parent: HTMLElement) {
    this.root.className = 'touch'
    this.root.innerHTML = `
      <div class="touch__stick" aria-label="Direção do movimento"><div class="touch__knob"></div></div>
      <div class="touch__look" aria-label="Girar a câmera"></div>
      <div class="touch__btns">
        <button class="touch__btn" data-action="block" type="button" aria-label="Bloquear enquanto pressionado">Bloq</button>
        <button class="touch__btn" data-action="jump" type="button" aria-label="Pular">Pular</button>
        <button class="touch__btn" data-action="interact" type="button" aria-label="Interagir">E</button>
        <button class="touch__btn" data-action="ability0" type="button" aria-label="Usar habilidade 1">Z</button>
        <button class="touch__btn" data-action="ability1" type="button" aria-label="Usar habilidade 2">X</button>
        <button class="touch__btn" data-action="ability2" type="button" aria-label="Usar habilidade 3">C</button>
        <button class="touch__btn" data-action="roll" type="button" aria-label="Rolar">Rolar</button>
        <button class="touch__btn touch__btn--big" data-action="attack" type="button" aria-label="Atacar; mantenha pressionado para continuar">Atacar</button>
        <button class="touch__btn" data-action="potion" type="button" aria-label="Usar poção">Poção</button>
      </div>`
    this.knob = this.root.querySelector<HTMLDivElement>('.touch__knob')!
    parent.appendChild(this.root)

    const stick = this.root.querySelector<HTMLElement>('.touch__stick')!
    stick.addEventListener('pointerdown', event => {
      event.preventDefault()
      if (this.stickId !== null) return
      this.stickId = event.pointerId
      stick.setPointerCapture(event.pointerId)
      const rect = stick.getBoundingClientRect()
      this.stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      this.updateStick(event.clientX, event.clientY, rect.width / 2)
    })
    stick.addEventListener('pointermove', event => {
      if (this.stickId !== event.pointerId) return
      event.preventDefault()
      const rect = stick.getBoundingClientRect()
      this.updateStick(event.clientX, event.clientY, rect.width / 2)
    })
    const releaseStick = (event: PointerEvent): void => {
      if (this.stickId !== event.pointerId) return
      event.preventDefault()
      this.stickId = null
      this.move.x = 0
      this.move.y = 0
      this.knob.style.transform = 'translate(0, 0)'
    }
    stick.addEventListener('pointerup', releaseStick)
    stick.addEventListener('pointercancel', releaseStick)
    stick.addEventListener('lostpointercapture', releaseStick)

    const look = this.root.querySelector<HTMLElement>('.touch__look')!
    look.addEventListener('pointerdown', event => {
      event.preventDefault()
      if (this.lookId !== null) return
      this.lookId = event.pointerId
      look.setPointerCapture(event.pointerId)
      this.lookLast = { x: event.clientX, y: event.clientY }
    })
    look.addEventListener('pointermove', event => {
      if (this.lookId !== event.pointerId) return
      event.preventDefault()
      this.look.x += event.clientX - this.lookLast.x
      this.look.y += event.clientY - this.lookLast.y
      this.lookLast = { x: event.clientX, y: event.clientY }
    })
    const releaseLook = (event: PointerEvent): void => {
      if (this.lookId !== event.pointerId) return
      event.preventDefault()
      this.lookId = null
    }
    look.addEventListener('pointerup', releaseLook)
    look.addEventListener('pointercancel', releaseLook)
    look.addEventListener('lostpointercapture', releaseLook)

    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault()
        if (this.activeButtons.has(event.pointerId)) return
        const action = button.dataset.action as TouchAction
        this.activeButtons.set(event.pointerId, { action, button })
        if (action !== 'block') this.pressed.add(action)
        if (HELD_ACTIONS.has(action)) {
          this.heldActions.add(action)
          this.updateHeldAppearance(action)
        }
        button.setPointerCapture(event.pointerId)
      })
      button.addEventListener('pointermove', event => event.preventDefault())
      const releaseButton = (event: PointerEvent): void => {
        event.preventDefault()
        this.releaseButton(event.pointerId)
      }
      button.addEventListener('pointerup', releaseButton)
      button.addEventListener('pointercancel', releaseButton)
      button.addEventListener('lostpointercapture', releaseButton)
    })

    window.addEventListener('blur', () => this.clearActiveControls())
  }

  private updateHeldAppearance(action: TouchAction): void {
    this.root.querySelectorAll<HTMLButtonElement>(`[data-action="${action}"]`).forEach(button => {
      button.toggleAttribute('data-held', this.heldActions.has(action))
    })
  }

  private releaseButton(pointerId: number): void {
    const active = this.activeButtons.get(pointerId)
    if (!active) return
    this.activeButtons.delete(pointerId)
    if (HELD_ACTIONS.has(active.action) && ![...this.activeButtons.values()].some(item => item.action === active.action)) {
      this.heldActions.delete(active.action)
      this.updateHeldAppearance(active.action)
    }
  }

  private clearActiveControls(): void {
    this.activeButtons.clear()
    this.heldActions.clear()
    this.pressed.clear()
    this.root.querySelectorAll<HTMLButtonElement>('[data-held]').forEach(button => button.removeAttribute('data-held'))
    this.stickId = null
    this.lookId = null
    this.move.x = 0
    this.move.y = 0
    this.look.x = 0
    this.look.y = 0
    this.knob.style.transform = 'translate(0, 0)'
  }

  private updateStick(clientX: number, clientY: number, radius: number): void {
    const dx = clientX - this.stickOrigin.x
    const dy = clientY - this.stickOrigin.y
    const length = Math.hypot(dx, dy)
    const scale = length > radius ? radius / length : 1
    const x = dx * scale
    const y = dy * scale
    this.knob.style.transform = `translate(${x}px, ${y}px)`
    this.move.x = x / radius
    this.move.y = y / radius
  }

  show(visible: boolean): void {
    if (!visible) this.clearActiveControls()
    this.root.classList.toggle('on', visible)
  }

  consume(action: TouchAction): boolean {
    if (!this.pressed.has(action)) return false
    this.pressed.delete(action)
    return true
  }

  held(action: TouchAction): boolean {
    return this.heldActions.has(action)
  }

  consumeLook(): { x: number; y: number } {
    const value = { x: this.look.x, y: this.look.y }
    this.look.x = 0
    this.look.y = 0
    return value
  }

  static get supported(): boolean {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }
}
