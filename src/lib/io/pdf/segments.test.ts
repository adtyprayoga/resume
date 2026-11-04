import { describe, expect, it } from 'vitest'
import { associateDateRows, sameRow } from './segments'
import type { SourceBlock } from './types'

const block = (id: string, text: string, x: number, y: number, page = 1): SourceBlock => ({
  id, text, page, label: 'text', group: null, bbox: { l: x, t: y, r: x + 100, b: y + 10 },
})

describe('source date rows', () => {
  it('moves a misplaced employer period back to its own row', () => {
    const company = { ...block('b1', 'Example Company', 40, 100), label: 'section_header' }
    const role = block('b2', 'Software Manager', 50, 130)
    const tenure = block('b3', 'Mar 2019 – Present', 440, 100)
    const period = block('b4', 'Jan 2022 – Present', 440, 130)
    expect(associateDateRows([company, role, tenure, period]).map(b => b.id)).toEqual(['b1', 'b3', 'b2', 'b4'])
  })

  it('does not associate dates across pages or ambiguous neighboring columns', () => {
    expect(sameRow(block('b1', 'Title', 40, 100), block('b2', '2020', 440, 100, 2))).toBe(false)
    const blocks = [block('b1', 'Engineer', 40, 100), block('b2', 'Analyst', 220, 100), block('b3', '2020 – 2022', 440, 100)]
    expect(associateDateRows(blocks)).toEqual(blocks)
  })
})
