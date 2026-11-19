/** Keeps keyboard focus inside an open modal and routes Escape to its close action. */
export function handleModalKeydown(event: KeyboardEvent, root: HTMLElement, onEscape: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onEscape()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = Array.from(root.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter(element => element.getClientRects().length > 0)
  if (focusable.length === 0) {
    event.preventDefault()
    root.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const outsideModal = !(active instanceof Node) || !root.contains(active)
  if (event.shiftKey && (active === first || outsideModal)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outsideModal)) {
    event.preventDefault()
    first.focus()
  }
}
