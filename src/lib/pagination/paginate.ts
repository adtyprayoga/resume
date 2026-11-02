export interface MeasuredNode {
  isHeading: boolean
  top: number
  height: number
}

/** `break-after: avoid` moves a heading with its first item, so they paginate as one block. */
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
  /** CSS pixels from the top of the paper. */
  top: number
  height: number
}

/**
 * Where each new page starts.
 *
 * Not multiples of the page height: `break-inside: avoid` pushes a straddling
 * atom whole onto the next page, so the real page starts earlier. Does not model
 * margin collapsing or widows/orphans, hence "approximate" in the UI.
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

    breaks.push(atom.top)
    pageBottom = atom.top + pageHeight

    // An atom taller than a page overflows wherever it starts; step past it.
    while (bottom > pageBottom) pageBottom += pageHeight
  }

  return breaks
}
