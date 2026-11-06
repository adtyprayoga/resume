/** Insert at the caret (or replace the selection), preserving native input handling. */
export const insertLineBreak = (event: KeyboardEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  const input = event.currentTarget as HTMLTextAreaElement
  input.setRangeText('\n', input.selectionStart, input.selectionEnd, 'end')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
