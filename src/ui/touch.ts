export type TouchAction = 'attack' | 'jump' | 'roll' | 'interact' | 'block' | 'potion' | 'ability0' | 'ability1' | 'ability2' | 'pause'

/** Virtual stick, look pad and action buttons for phones and tablets. */
export class TouchControls {
  readonly root = document.createElement('div')
  readonly move = { x: 0, y: 0 }
  readonly look = { x: 0, y: 0 }
  private readonly pressed = new Set<TouchAction>()
  private readonly knob: HTMLDivElement
  private stickId: number | null = null
  private lookId: number | null = null
  private stickOrigin = { x: 0, y: 0 }
  private lookLast = { x: 0, y: 0 }

  constructor(parent: HTMLElement) {
    this.root.className = 'touch'
    this.root.innerHTML = `
      <div class="touch__stick"><div class="touch__knob"></div></div>
      <div class="touch__look"></div>
      <div class="touch__btns">
        <button class="touch__btn" data-action="block" type="button">Bloq</button>
        <button class="touch__btn" data-action="jump" type="button">Pular</button>
        <button class="touch__btn" data-action="interact" type="button">E</button>
        <button class="touch__btn" data-action="ability0" type="button">Z</button>
        <button class="touch__btn" data-action="ability1" type="button">X</button>
        <button class="touch__btn" data-action="ability2" type="button">C</button>
        <button class="touch__btn" data-action="roll" type="button">Rolar</button>
        <button class="touch__btn touch__btn--big" data-action="attack" type="button">Atacar</button>
        <button class="touch__btn" data-action="potion" type="button">Poção</button>
      </div>`
    this.knob = this.root.querySelector<HTMLDivElement>('.touch__knob')!
    parent.appendChild(this.root)

    const stick = this.root.querySelector<HTMLElement>('.touch__stick')!
    stick.addEventListener('pointerdown', event => {
      this.stickId = event.pointerId
      stick.setPointerCapture(event.pointerId)
      const rect = stick.getBoundingClientRect()
      this.stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      this.updateStick(event.clientX, event.clientY, rect.width / 2)
    })
    stick.addEventListener('pointermove', event => {
      if (this.stickId !== event.pointerId) return
      const rect = stick.getBoundingClientRect()
      this.updateStick(event.clientX, event.clientY, rect.width / 2)
    })
    const release = (event: PointerEvent): void => {
      if (this.stickId !== event.pointerId) return
      this.stickId = null
      this.move.x = 0
      this.move.y = 0
      this.knob.style.transform = 'translate(0, 0)'
    }
    stick.addEventListener('pointerup', release)
    stick.addEventListener('pointercancel', release)

    const look = this.root.querySelector<HTMLElement>('.touch__look')!
    look.addEventListener('pointerdown', event => {
      this.lookId = event.pointerId
      look.setPointerCapture(event.pointerId)
      this.lookLast = { x: event.clientX, y: event.clientY }
    })
    look.addEventListener('pointermove', event => {
      if (this.lookId !== event.pointerId) return
      this.look.x += event.clientX - this.lookLast.x
      this.look.y += event.clientY - this.lookLast.y
      this.lookLast = { x: event.clientX, y: event.clientY }
    })
    const releaseLook = (event: PointerEvent): void => {
      if (this.lookId === event.pointerId) this.lookId = null
    }
    look.addEventListener('pointerup', releaseLook)
    look.addEventListener('pointercancel', releaseLook)

    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault()
        const action = button.dataset.action as TouchAction
        this.pressed.add(action)
        if (action === 'block') button.dataset.held = '1'
      })
      const up = (): void => {
        if (button.dataset.action === 'block') {
          this.pressed.delete('block')
          delete button.dataset.held
        }
      }
      button.addEventListener('pointerup', up)
      button.addEventListener('pointerleave', up)
      button.addEventListener('pointercancel', up)
    })
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
    this.root.classList.toggle('on', visible)
  }

  consume(action: TouchAction): boolean {
    if (!this.pressed.has(action)) return false
    this.pressed.delete(action)
    return true
  }

  held(action: TouchAction): boolean {
    return this.pressed.has(action)
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
