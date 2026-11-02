const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Traps Tab inside `node` and restores focus on teardown. */
export const focusTrap = (node: HTMLElement) => {
  const previous = document.activeElement as HTMLElement | null

  // Not offsetParent: it is null for position:fixed elements, which this is.
  const isHidden = (element: HTMLElement): boolean =>
    // `hidden` is `string | boolean` because it also accepts "until-found".
    Boolean(element.hidden) ||
    element.closest('[hidden]') !== null ||
    element.closest('[aria-hidden="true"]') !== null

  const focusable = () =>
    [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => !isHidden(element) && !element.matches(':disabled'),
    )

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return

    const elements = focusable()
    if (elements.length === 0) return

    const first = elements[0]!
    const last = elements[elements.length - 1]!
    const active = document.activeElement

    if (event.shiftKey && (active === first || !node.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  focusable()[0]?.focus()
  node.addEventListener('keydown', onKeydown)

  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown)
      previous?.focus?.()
    },
  }
}
