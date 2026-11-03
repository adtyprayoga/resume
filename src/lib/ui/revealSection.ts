import type { ListSectionKind } from '$lib/sections/kinds'

export type NavTarget = ListSectionKind | 'profile'

/**
 * Brings a CV section's heading into view only when it is not already fully
 * visible, with an immediate nearest-edge scroll: a short CV never jumps.
 * Returns whether it scrolled.
 */
export const revealSection = (target: NavTarget): boolean => {
  const section = document.querySelector<HTMLElement>(`[data-cv-section="${target}"]`)
  if (!section) return false
  const heading = section.querySelector<HTMLElement>('h1, h2') ?? section
  const { top, bottom } = heading.getBoundingClientRect()
  if (top >= 0 && bottom <= window.innerHeight) return false
  heading.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  return true
}
