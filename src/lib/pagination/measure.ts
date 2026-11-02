import { foldHeadings, type BreakAtom } from './paginate'

/**
 * Measures the printable geometry from the live DOM.
 *
 * The page height is probed rather than computed from an assumed 96dpi: a
 * `297mm` element is appended inside the paper so it resolves under exactly the
 * same styling context as the content being measured, which keeps the units
 * consistent.
 */
export interface PageMetrics {
  /** Printable content height of one page, in CSS pixels. */
  pageHeight: number
  /** Offset from the top of the paper at which content begins. */
  contentTop: number
}

export const measurePageMetrics = (paper: HTMLElement): PageMetrics => {
  const probe = paper.ownerDocument.createElement('div')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:1mm;height:297mm;top:0;left:0'
  paper.appendChild(probe)
  const sheetHeight = probe.offsetHeight
  probe.remove()

  const styles = getComputedStyle(paper)
  const marginTop = Number.parseFloat(styles.paddingTop) || 0
  const marginBottom = Number.parseFloat(styles.paddingBottom) || 0

  return {
    // Each page can hold the sheet minus the margin it carries top and bottom.
    pageHeight: Math.max(0, sheetHeight - marginTop - marginBottom),
    contentTop: marginTop,
  }
}

/**
 * Collects the elements the printer must not split.
 *
 * Reads the same `data-break-atom` attribute that `styles/print.css` applies
 * `break-inside: avoid` to, so the prediction and the print are driven by one
 * contract rather than two lists that can drift.
 *
 * Section headings are folded into the item that follows them, because
 * `break-after: avoid` means the printer moves the two together. Without this
 * the predicted break sits one heading too low — the most visible way the
 * guide can disagree with the real page.
 */
export const collectAtoms = (paper: HTMLElement): BreakAtom[] =>
  foldHeadings(
    [...paper.querySelectorAll<HTMLElement>('[data-break-atom], .resume-section-title')].map(
      (element) => ({
        isHeading: element.classList.contains('resume-section-title'),
        top: element.offsetTop,
        height: element.offsetHeight,
      }),
    ),
  )
