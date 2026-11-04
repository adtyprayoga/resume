/** Input types where typing happens; the browser owns Ctrl+Z in these. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

export const isTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  return target.isContentEditable || target.getAttribute('contenteditable') === 'true'
}

/** Ctrl or Cmd + Z undoes; adding Shift, or Ctrl/Cmd + Y, redoes. */
export const historyShortcut = (event: KeyboardEvent): 'undo' | 'redo' | null => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}
