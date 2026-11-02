/**
 * `document.title` becomes the default Save-as-PDF filename.
 *
 * Restored on `afterprint`, not after `print()` returns: Chrome reads the title
 * asynchronously. The timeout covers browsers that never fire `afterprint`.
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

/** Waits for fonts: printing mid-swap lays the PDF out with fallback metrics. */
export const printResume = async (fileName: string): Promise<void> => {
  try {
    await document.fonts?.ready
  } catch {
    // Printing is still better than not printing.
  }

  withDocumentTitle(fileName)
  window.print()
}
