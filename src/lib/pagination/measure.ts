import { foldHeadings, type BreakAtom } from './paginate'

export interface PageMetrics {
  /** Printable content height of one page, in CSS pixels. */
  pageHeight: number
  contentTop: number
}

/**
 * Probes a 297mm element rather than assuming 96dpi. The probe goes on the body,
 * outside the paper: inside it, the insertion would trip the paper's own
 * MutationObserver and remeasure forever. Outside the zoomed preview frame it
 * also measures unscaled layout pixels, the same space as the atoms' offsets.
 */
export const measurePageMetrics = (paper: HTMLElement): PageMetrics => {
  const probe = paper.ownerDocument.createElement('div')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:1mm;height:297mm;top:0;left:0'
  paper.ownerDocument.body.appendChild(probe)
  const sheetHeight = probe.offsetHeight
  probe.remove()

  const styles = getComputedStyle(paper)
  const marginTop = Number.parseFloat(styles.paddingTop) || 0
  const marginBottom = Number.parseFloat(styles.paddingBottom) || 0

  return {
    pageHeight: Math.max(0, sheetHeight - marginTop - marginBottom),
    contentTop: marginTop,
  }
}

/** Reads the same `data-break-atom` that print.css applies `break-inside: avoid` to. */
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
