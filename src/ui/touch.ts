export type TouchAction = 'attack' | 'jump' | 'roll' | 'interact' | 'block' | 'potion' | 'ability0' | 'ability1' | 'ability2' | 'pause'

const HELD_ACTIONS = new Set<TouchAction>(['attack', 'jump', 'block'])
const STICK_DEAD_ZONE = 0.14

type ActiveButton = {
  action: TouchAction
  button: HTMLButtonElement
  token: number
  tapPending: boolean
}

/** Virtual stick, look pad and action buttons for phones and tablets. */
export class TouchControls {
  readonly root = document.createElement('div')
  readonly move = { x: 0, y: 0 }
  readonly look = { x: 0, y: 0 }
  private readonly pressed = new Set<TouchAction>()
  private readonly heldActions = new Set<TouchAction>()
  private readonly activeButtons = new Map<number, ActiveButton>()
  private readonly pendingPresses = new Map<TouchAction, Set<number>>()
  private nextPressToken = 0
  private readonly knob: HTMLDivElement
  private stickId: number | null = null
  private stickRadius = 0
  private lookId: number | null = null
  private stickOrigin = { x: 0, y: 0 }
  private lookLast = { x: 0, y: 0 }

  constructor(parent: HTMLElement) {
    this.root.className = 'touch'
    this.root.innerHTML = `
      <div class="touch__stick" aria-label="Direção do movimento"><div class="touch__knob"></div></div>
      <div class="touch__look" aria-label="Girar a câmera"></div>
      <div class="touch__look-hint" aria-hidden="true">Arraste para olhar</div>
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
        <button class="touch__btn" data-action="pause" type="button" aria-label="Pausar">Ⅱ</button>
      </div>`
    this.knob = this.root.querySelector<HTMLDivElement>('.touch__knob')!
    parent.appendChild(this.root)

    const stick = this.root.querySelector<HTMLElement>('.touch__stick')!
    stick.addEventListener('pointerdown', event => {
        event.preventDefault()
        if (this.stickId !== null) return
        this.stickId = event.pointerId
        this.capturePointer(stick, event.pointerId)
        const rect = stick.getBoundingClientRect()
        this.stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      this.stickRadius = Math.min(rect.width, rect.height) / 2
      this.updateStick(event.clientX, event.clientY)
    })
    const releaseStick = (event: PointerEvent): void => {
      if (this.stickId !== event.pointerId) return
      event.preventDefault()
      this.resetStick()
    }
    stick.addEventListener('pointerup', releaseStick)
    stick.addEventListener('pointercancel', releaseStick)
    stick.addEventListener('lostpointercapture', releaseStick)

    const look = this.root.querySelector<HTMLElement>('.touch__look')!
    look.addEventListener('pointerdown', event => {
      event.preventDefault()
      if (this.lookId !== null) return
      this.lookId = event.pointerId
      this.capturePointer(look, event.pointerId)
      this.lookLast = { x: event.clientX, y: event.clientY }
    })
    look.addEventListener('pointerup', event => this.releaseLook(event, false))
    look.addEventListener('pointercancel', event => this.releaseLook(event, true))
    look.addEventListener('lostpointercapture', event => this.releaseLook(event, true))

    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault()
        if (this.activeButtons.has(event.pointerId)) return
        const action = button.dataset.action as TouchAction
        const token = this.nextPressToken++
        const tapPending = action !== 'block'
        this.activeButtons.set(event.pointerId, { action, button, token, tapPending })
        if (tapPending) {
          let pending = this.pendingPresses.get(action)
          if (!pending) {
            pending = new Set<number>()
            this.pendingPresses.set(action, pending)
          }
          pending.add(token)
          this.pressed.add(action)
        }
        this.updateButtonAppearance(button)
        if (HELD_ACTIONS.has(action)) {
          this.heldActions.add(action)
          this.updateHeldAppearance(action)
        }
        this.capturePointer(button, event.pointerId)
      })
      button.addEventListener('pointermove', event => event.preventDefault())
      button.addEventListener('pointerup', event => {
        event.preventDefault()
        this.releaseButton(event.pointerId, false)
      })
      button.addEventListener('pointercancel', event => {
        event.preventDefault()
        this.releaseButton(event.pointerId, true)
      })
      button.addEventListener('lostpointercapture', event => {
        event.preventDefault()
        this.releaseButton(event.pointerId, true)
      })
    })

    window.addEventListener('pointermove', event => this.movePointer(event), { passive: false })
    window.addEventListener('pointerup', event => this.releasePointer(event, false))
    window.addEventListener('pointercancel', event => this.releasePointer(event, true))
    window.addEventListener('blur', () => this.clearActiveControls())
    window.addEventListener('pagehide', () => this.clearActiveControls())
    window.addEventListener('orientationchange', () => this.clearActiveControls())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearActiveControls()
    })
  }

  setInteractLabel(label: string | undefined): void {
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="interact"]')
    if (!button) return
    const mounted = label === 'Desmontar'
    const mounting = label?.startsWith('Montar ')
    button.textContent = mounted ? 'Desm.' : mounting ? 'Montar' : 'E'
    button.setAttribute('aria-label', label ? `${label}; tocar para interagir` : 'Interagir')
  }

  private capturePointer(element: HTMLElement, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId)
    } catch {
      // Some touch providers end the pointer before capture; global listeners still release it.
    }
  }

  private releasePointer(event: PointerEvent, cancelled: boolean): void {
    if (this.stickId === event.pointerId) this.resetStick()
    if (this.lookId === event.pointerId) this.releaseLook(event, cancelled)
    this.releaseButton(event.pointerId, cancelled)
  }

  private movePointer(event: PointerEvent): void {
    if (this.stickId === event.pointerId) {
      event.preventDefault()
      this.updateStick(event.clientX, event.clientY)
    }
    if (this.lookId === event.pointerId) {
      event.preventDefault()
      this.look.x += event.clientX - this.lookLast.x
      this.look.y += event.clientY - this.lookLast.y
      this.lookLast = { x: event.clientX, y: event.clientY }
      this.root.classList.add('look-used')
    }
  }

  private resetStick(): void {
    this.stickId = null
    this.stickRadius = 0
    this.move.x = 0
    this.move.y = 0
    this.knob.style.transform = 'translate(0, 0)'
  }

  private releaseLook(event: PointerEvent, cancelled: boolean): void {
    if (this.lookId !== event.pointerId) return
    event.preventDefault()
    this.lookId = null
    if (cancelled) {
      this.look.x = 0
      this.look.y = 0
    }
  }

  private updateButtonAppearance(button: HTMLButtonElement): void {
    const isPressed = [...this.activeButtons.values()].some(item => item.button === button)
    button.toggleAttribute('data-pressed', isPressed)
  }

  private updateHeldAppearance(action: TouchAction): void {
    this.root.querySelectorAll<HTMLButtonElement>(`[data-action="${action}"]`).forEach(button => {
      button.toggleAttribute('data-held', this.heldActions.has(action))
    })
  }

  private releaseButton(pointerId: number, cancelled: boolean): void {
    const active = this.activeButtons.get(pointerId)
    if (!active) return
    this.activeButtons.delete(pointerId)
    this.updateButtonAppearance(active.button)

    if (cancelled && active.tapPending) {
      const pending = this.pendingPresses.get(active.action)
      pending?.delete(active.token)
      if (pending?.size === 0) this.pendingPresses.delete(active.action)
      if (!this.pendingPresses.has(active.action)) this.pressed.delete(active.action)
    }

    if (HELD_ACTIONS.has(active.action) && ![...this.activeButtons.values()].some(item => item.action === active.action)) {
      this.heldActions.delete(active.action)
      this.updateHeldAppearance(active.action)
    }
  }

  private clearActiveControls(): void {
    this.activeButtons.clear()
    this.pendingPresses.clear()
    this.heldActions.clear()
    this.pressed.clear()
    this.root.querySelectorAll<HTMLButtonElement>('[data-pressed], [data-held]').forEach(button => {
      button.removeAttribute('data-pressed')
      button.removeAttribute('data-held')
    })
    this.resetStick()
    this.lookId = null
    this.look.x = 0
    this.look.y = 0
  }

  private updateStick(clientX: number, clientY: number): void {
    const radius = this.stickRadius
    const dx = clientX - this.stickOrigin.x
    const dy = clientY - this.stickOrigin.y
    const length = Math.hypot(dx, dy)
    const scale = length > radius ? radius / length : 1
    const x = dx * scale
    const y = dy * scale
    this.knob.style.transform = `translate(${x}px, ${y}px)`

    if (radius <= 0 || length / radius <= STICK_DEAD_ZONE) {
      this.move.x = 0
      this.move.y = 0
      return
    }
    const magnitude = Math.min(1, (length / radius - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE))
    this.move.x = (dx / length) * magnitude
    this.move.y = (dy / length) * magnitude
  }

  show(visible: boolean): void {
    if (!visible) this.clearActiveControls()
    this.root.classList.toggle('on', visible)
  }
  resetInputs(): void {
    this.clearActiveControls()
  }

  consume(action: TouchAction): boolean {
    if (!this.pressed.has(action)) return false
    this.pressed.delete(action)
    this.pendingPresses.delete(action)
    this.activeButtons.forEach(active => {
      if (active.action === action) active.tapPending = false
    })
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
