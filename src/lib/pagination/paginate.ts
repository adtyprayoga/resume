/** A measured element, before headings are folded into their following item. */
export interface MeasuredNode {
  isHeading: boolean
  top: number
  height: number
}

/**
 * Folds each section heading into the item that follows it.
 *
 * `break-after: avoid` on a heading means the printer moves the heading and its
 * first item together, so they behave as one unsplittable block. Treating them
 * separately puts the predicted break one heading too low, which is the most
 * visible way the guide can disagree with the printed page.
 */
export const foldHeadings = (nodes: MeasuredNode[]): BreakAtom[] => {
  const atoms: BreakAtom[] = []

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!

    if (!node.isHeading) {
      atoms.push({ id: `atom-${index}`, top: node.top, height: node.height })
      continue
    }

    const next = nodes[index + 1]
    if (!next || next.isHeading) {
      // A heading with no item after it cannot drag anything onto a new page.
      atoms.push({ id: `heading-${index}`, top: node.top, height: node.height })
      continue
    }

    atoms.push({
      id: `heading-${index}`,
      top: node.top,
      height: next.top + next.height - node.top,
    })
    index += 1
  }

  return atoms
}

export interface BreakAtom {
  id: string
  /** Offset from the top of the paper, in CSS pixels. */
  top: number
  height: number
}

/**
 * Predicts where the printer will start each new page.
 *
 * Guides drawn at multiples of the page height would be wrong: every atom
 * carries `break-inside: avoid`, so an atom straddling a boundary is pushed
 * whole onto the next page and the real page therefore starts *earlier* than
 * the multiple. This walks the atoms and advances the page the same way,
 * which is why the prediction and the print agree.
 *
 * Still an approximation — it does not model margin collapsing at a break,
 * `break-after: avoid` on headings, or widow and orphan control — so the UI
 * labels it as approximate and the print preview remains the real check.
 */
export const paginate = (
  atoms: BreakAtom[],
  pageHeight: number,
  contentTop = 0,
): number[] => {
  if (pageHeight <= 0) return []

  const ordered = [...atoms].sort((left, right) => left.top - right.top)
  const breaks: number[] = []
  let pageBottom = contentTop + pageHeight

  for (const atom of ordered) {
    const bottom = atom.top + atom.height
    if (bottom <= pageBottom) continue

    // The atom cannot be split, so the page break lands at its top edge.
    breaks.push(atom.top)
    pageBottom = atom.top + pageHeight

    // An atom taller than a page overflows no matter where it starts. Advance
    // past it so the walk cannot stall on the same element.
    while (bottom > pageBottom) pageBottom += pageHeight
  }

  return breaks
}
