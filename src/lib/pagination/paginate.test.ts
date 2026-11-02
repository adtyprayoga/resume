import { describe, expect, it } from 'vitest'
import { foldHeadings, paginate, type BreakAtom } from './paginate'

const atoms = (...spans: Array<[number, number]>): BreakAtom[] =>
  spans.map(([top, height], index) => ({ id: `a${index}`, top, height }))

describe('paginate', () => {
  it('reports no breaks for an empty document', () => {
    expect(paginate([], 1000)).toEqual([])
  })

  it('reports no breaks when everything fits on one page', () => {
    expect(paginate(atoms([0, 100], [100, 200], [300, 300]), 1000)).toEqual([])
  })

  it('breaks at the top of a straddling atom, not at the page multiple', () => {
    // The second atom runs 900..1100 and cannot be split, so the printer pushes
    // the whole atom to page two: the real page starts at 900, not at 1000.
    const breaks = paginate(atoms([0, 900], [900, 200]), 1000)
    expect(breaks).toEqual([900])
  })

  it('does not break an atom that ends exactly on the boundary', () => {
    expect(paginate(atoms([0, 1000]), 1000)).toEqual([])
  })

  it('measures the second page from the pushed atom, not from the boundary', () => {
    // a1 moves to page 2 starting at 900, so page 2 spans 900..1900 and a2
    // (1500..1800) still fits on it.
    const breaks = paginate(atoms([0, 900], [900, 200], [1500, 300]), 1000)
    expect(breaks).toEqual([900])
  })

  it('reports a break per page across several pages', () => {
    const breaks = paginate(atoms([0, 900], [900, 200], [1900, 200], [2900, 200]), 1000)
    expect(breaks).toEqual([900, 1900, 2900])
  })

  it('advances past an atom taller than a page instead of looping', () => {
    const breaks = paginate(atoms([0, 500], [500, 2500], [3100, 100]), 1000)
    expect(breaks[0]).toBe(500)
    expect(breaks.length).toBeLessThan(10)
    expect(new Set(breaks).size).toBe(breaks.length)
  })

  it('offsets the usable page region by the content top', () => {
    // Content starting 100px down leaves the first page's region as 100..1100.
    expect(paginate(atoms([100, 950]), 1000, 100)).toEqual([])
    expect(paginate(atoms([100, 1050]), 1000, 100)).toEqual([100])
  })

  it('ignores a non-positive page height rather than dividing by zero', () => {
    expect(paginate(atoms([0, 100]), 0)).toEqual([])
    expect(paginate(atoms([0, 100]), -5)).toEqual([])
  })

  it('tolerates atoms arriving out of document order', () => {
    const unordered = atoms([900, 200], [0, 900])
    expect(paginate(unordered, 1000)).toEqual([900])
  })
})

describe('foldHeadings', () => {
  const node = (isHeading: boolean, top: number, height: number) => ({ isHeading, top, height })

  it('passes plain items through', () => {
    expect(foldHeadings([node(false, 0, 100), node(false, 100, 50)])).toEqual([
      { id: 'atom-0', top: 0, height: 100 },
      { id: 'atom-1', top: 100, height: 50 },
    ])
  })

  it('merges a heading with the item below it into one block', () => {
    // break-after: avoid means the printer moves both or neither.
    expect(foldHeadings([node(true, 0, 20), node(false, 30, 70)])).toEqual([
      { id: 'heading-0', top: 0, height: 100 },
    ])
  })

  it('includes the gap between heading and item in the merged height', () => {
    const [atom] = foldHeadings([node(true, 100, 20), node(false, 140, 60)])
    expect(atom).toEqual({ id: 'heading-0', top: 100, height: 100 })
  })

  it('leaves a heading alone when the next node is another heading', () => {
    const atoms = foldHeadings([node(true, 0, 20), node(true, 40, 20), node(false, 70, 30)])
    expect(atoms).toEqual([
      { id: 'heading-0', top: 0, height: 20 },
      { id: 'heading-1', top: 40, height: 60 },
    ])
  })

  it('leaves a trailing heading alone', () => {
    expect(foldHeadings([node(false, 0, 50), node(true, 60, 20)])).toEqual([
      { id: 'atom-0', top: 0, height: 50 },
      { id: 'heading-1', top: 60, height: 20 },
    ])
  })

  it('consumes only one item per heading', () => {
    const atoms = foldHeadings([node(true, 0, 20), node(false, 30, 30), node(false, 70, 30)])
    expect(atoms).toHaveLength(2)
    expect(atoms[1]).toEqual({ id: 'atom-2', top: 70, height: 30 })
  })

  it('returns nothing for no nodes', () => {
    expect(foldHeadings([])).toEqual([])
  })

  it('moves the predicted break earlier than it would be unfolded', () => {
    // A heading at 980 with its item at 1010..1080 and a 1000px page: unfolded,
    // only the item overflows and the break lands at 1010. Folded, the pair
    // overflows as one and the break correctly lands at the heading, 980.
    const nodes = [node(false, 0, 970), node(true, 980, 20), node(false, 1010, 70)]
    expect(paginate(foldHeadings(nodes), 1000)).toEqual([980])
  })
})
