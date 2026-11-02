/**
 * Printing goes through the browser's own dialog on the live document — no
 * offscreen iframe, no stylesheet cloning. `styles/print.css` is what makes the
 * on-screen paper and the printed page the same box.
 */

/**
 * `document.title` supplies the default filename in the Save-as-PDF dialog.
 *
 * It is restored on `afterprint` rather than straight after `print()` returns:
 * Chrome reads the title asynchronously, so restoring synchronously can land
 * before it has been read. The timeout is a safety net for browsers that never
 * fire `afterprint` (e.g. when the dialog is dismissed in an unusual way).
 */
const withDocumentTitle = (title: string): void => {
  const previous = document.title
  let restored = false

  const restore = () => {
    if (restored) return
    restored = true
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }

  document.title = title
  window.addEventListener('afterprint', restore)
  window.setTimeout(restore, 60_000)
}

/**
 * Waits for fonts before opening the dialog. Printing mid-swap gives a PDF laid
 * out with fallback metrics, which is the one timing bug direct printing shares
 * with the iframe approach.
 */
export const printResume = async (fileName: string): Promise<void> => {
  try {
    await document.fonts?.ready
  } catch {
    // A font-loading failure should not block printing.
  }

  withDocumentTitle(fileName)
  window.print()
}
