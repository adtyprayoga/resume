import type { ListSectionKind } from '$lib/sections/kinds'

/** Matched by comparison, so stored ids never reach a selector string. */
const byData = (attribute: string, name: string, value: string): HTMLElement | null => {
  for (const element of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    if (element.dataset[name] === value) return element
  }
  return null
}

export const findEntry = (section: ListSectionKind, id: string) => byData('data-entry', 'entry', `${section}:${id}`)

export const findAddAction = (section: ListSectionKind) => byData('data-add-entry', 'addEntry', section)

export const focusAddAction = (section: ListSectionKind) => findAddAction(section)?.focus()
