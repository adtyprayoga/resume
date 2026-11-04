import { describe, expect, it } from 'vitest'
import { associateDateRows, joinListContinuations, partsOf, sameRow } from './segments'
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

const b = (id: string, text: string, label = 'text', options: Partial<Pick<SourceBlock, 'page' | 'group' | 'bbox'>> = {}): SourceBlock => ({
  id, text, label, page: 1, group: null, bbox: null, ...options,
})

// Geometry from a real two-page CV whose right-column dates come late in reading order.
describe('late date rows on plain-text company lines', () => {
  it('re-attaches a late date to a one-line plain-text company row', () => {
    const company = b('b12', 'Contoh Consulting - Bandung, Indonesia', 'text', { bbox: { l: 73, t: 513, r: 202, b: 522 } })
    const role = b('b13', 'Training Consultant', 'section_header', { bbox: { l: 74, t: 527, r: 155, b: 536 } })
    const bullet = b('b29', 'Ran workshops.', 'list_item', { page: 2, bbox: { l: 91, t: 83, r: 519, b: 104 } })
    const date = b('b30', 'Sep 2024 - Present', 'text', { bbox: { l: 435, t: 514, r: 511, b: 522 } })
    expect(associateDateRows([company, role, bullet, date]).map(x => x.id)).toEqual(['b12', 'b30', 'b13', 'b29'])
  })

  it('does not attach a date to a multi-line paragraph overlapping its row', () => {
    const paragraph = b('b4', 'I have four years of experience in learning and development.', 'text', { bbox: { l: 73, t: 480, r: 400, b: 559 } })
    const bullet = b('b5', 'Ran workshops.', 'list_item', { page: 2, bbox: { l: 91, t: 83, r: 519, b: 104 } })
    const date = b('b6', 'Sep 2024 - Present', 'text', { bbox: { l: 435, t: 514, r: 511, b: 522 } })
    const blocks = [paragraph, bullet, date]
    expect(associateDateRows(blocks)).toEqual(blocks)
  })

  it('does not attach a date to a bullet-led plain line', () => {
    const line = b('b4', '• Ran workshops', 'text', { bbox: { l: 73, t: 513, r: 202, b: 522 } })
    const date = b('b5', 'Sep 2024 - Present', 'text', { bbox: { l: 435, t: 514, r: 511, b: 522 } })
    const other = b('b6', 'Training Consultant', 'section_header', { bbox: { l: 74, t: 527, r: 155, b: 536 } })
    const blocks = [line, other, date]
    expect(associateDateRows(blocks)).toEqual(blocks)
  })
})

describe('list continuations', () => {
  const first = b('b27', 'Reviewed drafts before submission to the programme office', 'list_item', { group: 'g4', bbox: { l: 91, t: 760, r: 500, b: 770 } })

  it('joins an indented lowercase continuation across a page break', () => {
    const next = b('b28', 'for further review.', 'list_item', { group: 'g4', page: 2, bbox: { l: 108, t: 50, r: 200, b: 60 } })
    const joined = joinListContinuations([first, next])
    expect(joined).toHaveLength(1)
    expect(joined[0]!.text).toBe('Reviewed drafts before submission to the programme office for further review.')
    expect(partsOf(joined[0]!).map(part => part.block.id)).toEqual(['b27', 'b28'])
    expect(joined[0]!.page).toBe(1)
  })

  it('keeps lowercase bullets at the same indent separate', () => {
    const next = b('b28', 'for further review.', 'list_item', { group: 'g4', page: 2, bbox: { l: 91, t: 50, r: 200, b: 60 } })
    expect(joinListContinuations([first, next])).toHaveLength(2)
  })

  it.each([
    ['another group', { group: 'g5' }],
    ['two pages on', { page: 3 }],
    ['a bullet glyph', { text: '• for further review.' }],
    ['a capital letter', { text: 'For further review.' }],
  ])('keeps a continuation with %s separate', (_, change) => {
    const next = { ...b('b28', 'for further review.', 'list_item', { group: 'g4', page: 2, bbox: { l: 108, t: 50, r: 200, b: 60 } }), ...change }
    expect(joinListContinuations([first, next])).toHaveLength(2)
  })

  it('keeps an indented lowercase line after a finished sentence separate', () => {
    const done = { ...first, text: 'Reviewed drafts before submission.' }
    const next = b('b28', 'for further review.', 'list_item', { group: 'g4', page: 2, bbox: { l: 108, t: 50, r: 200, b: 60 } })
    expect(joinListContinuations([done, next])).toHaveLength(2)
  })
})

describe('late dates in a two-column layout', () => {
  it('does not attach a main-column date to a sidebar line on its row', () => {
    const skill = b('b9', 'Design Systems', 'text', { bbox: { l: 57, t: 201, r: 121, b: 210 } })
    const role = b('b15', 'Junior Designer, Sample Agency', 'section_header', { bbox: { l: 246, t: 181, r: 402, b: 190 } })
    const date = b('b16', '2018 - 2020', 'text', { bbox: { l: 246, t: 196, r: 299, b: 203 } })
    const blocks = [skill, role, date]
    expect(associateDateRows(blocks)).toEqual(blocks)
  })
})

describe('fix round 1', () => {
  const first = b('b20', 'Reviewed curriculum drafts before submission to the programme office', 'list_item', { group: 'g3', bbox: { l: 56, t: 779, r: 380, b: 788 } })

  it('joins a plain-text, ungrouped continuation indented under a bullet', () => {
    const next = b('b21', 'for further review.', 'text', { page: 2, bbox: { l: 68, t: 49, r: 145, b: 56 } })
    const joined = joinListContinuations([first, next])
    expect(joined).toHaveLength(1)
    expect(joined[0]!.text).toBe('Reviewed curriculum drafts before submission to the programme office for further review.')
    expect(partsOf(joined[0]!).map(part => part.block.id)).toEqual(['b20', 'b21'])
  })

  it('keeps a plain-text line without the indent separate', () => {
    const next = b('b21', 'for further review.', 'text', { page: 2, bbox: { l: 56, t: 49, r: 145, b: 56 } })
    expect(joinListContinuations([first, next])).toHaveLength(2)
  })

  it('still attaches a late date to the role heading when a plain-text location shares its row', () => {
    const role = b('b3', 'Software Engineer', 'section_header', { bbox: { l: 40, t: 100, r: 160, b: 110 } })
    const location = b('b4', 'Jakarta, Indonesia', 'text', { bbox: { l: 200, t: 100, r: 300, b: 110 } })
    const bullet = b('b5', 'Built services.', 'list_item', { bbox: { l: 50, t: 120, r: 400, b: 130 } })
    const date = b('b6', 'Jan 2020 - Present', 'text', { bbox: { l: 440, t: 100, r: 520, b: 110 } })
    expect(associateDateRows([role, location, bullet, date]).map(x => x.id)).toEqual(['b3', 'b6', 'b4', 'b5'])
  })
})
