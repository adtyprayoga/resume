import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripStyles } from './accuracy'
import { buildOutline } from './outline'
import type { BBox, BlockStyle, SourceBlock } from './types'
import { parseExtraction } from './validate'

const S = (font: string, size: number): BlockStyle => ({ font, size, bold: null, italic: null })
const b = (id: string, text: string, label: string, style: BlockStyle | null, bbox: BBox | null = null): SourceBlock => ({
  id, text, label, page: 1, group: null, bbox, style,
})
const roles = (blocks: SourceBlock[]) => buildOutline(blocks).nodes.map((node) => node.role)

const doc = [
  b('b1', 'Rina Wulandari', 'text', S('f1', 14)),
  b('b2', 'People Development | L&D', 'text', S('f1', 10)),
  b('b3', 'Profile Summary', 'section_header', S('f2', 16)),
  b('b4', 'I have 4 years of experience designing training programmes for banks.', 'text', S('f1', 10)),
  b('b5', 'Hobbies', 'text', S('f2', 16)),
  b('b6', 'Working Experience', 'section_header', S('f2', 16)),
  b('b7', 'Contoh Consulting - Bandung, Indonesia', 'section_header', S('f2', 10)),
  b('b8', 'Sep 2024 - Present', 'text', S('f1', 10)),
  b('b9', 'Training Consultant', 'text', S('f3', 10)),
  b('b10', 'Designed 12 modules.', 'list_item', S('f1', 10)),
  b('b11', 'Contoh Edu - Surabaya, Indonesia', 'text', S('f2', 10)),
  b('b12', 'Curriculum Designer', 'section_header', S('f3', 10)),
  b('b13', 'Mapped 30 courses.', 'list_item', S('f1', 10)),
]
const single = (blocks: SourceBlock[], style: BlockStyle | null | undefined): SourceBlock[] =>
  blocks.map(({ style: _style, ...block }) => (style === undefined ? block : { ...block, style }))

describe('buildOutline', () => {
  it('learns the heading style from recognised headings', () => {
    const outline = buildOutline(doc)
    expect(outline.confidence).toBe('typography')
    expect(outline.nodes.map((node) => node.block)).toEqual(doc)
    expect(roles(doc)).toEqual(['name', 'body', 'h2', 'body', 'h2', 'h2', 'h3', 'body', 'h4', 'list', 'h3', 'h4', 'list'])
  })

  it('falls back when every block shares one style', () => {
    const blocks = single(doc, S('f1', 10))
    expect(buildOutline(blocks).confidence).toBe('fallback')
    // Only recognised headings open sections; company and role headers stay body, as in today's regions.
    expect(roles(blocks)).toEqual(['name', 'body', 'h2', 'body', 'body', 'h2', 'body', 'body', 'body', 'list', 'body', 'body', 'list'])
  })

  it('marks a second role after bullets as h4', () => {
    const blocks = [...doc, b('b14', 'Analyst', 'text', S('f3', 10)), b('b15', 'Ran 20 audits.', 'list_item', S('f1', 10))]
    expect(roles(blocks).slice(10)).toEqual(['h3', 'h4', 'list', 'h4', 'list'])
  })

  it('ends an h4 run at the next h2', () => {
    const blocks = [...doc, b('b14', 'Education', 'section_header', S('f2', 16)), b('b15', 'Fluent reader', 'text', S('f3', 10))]
    expect(roles(blocks).slice(-2)).toEqual(['h2', 'body'])
  })

  it('falls back when there are no styles', () => {
    for (const style of [undefined, null]) {
      const blocks = single(doc, style)
      expect(buildOutline(blocks).confidence).toBe('fallback')
      expect(roles(blocks)).toEqual(roles(single(doc, S('f1', 10))))
    }
  })

  it('classifies unstyled blocks by fallback signals', () => {
    const blocks = [...doc, b('b14', 'Education', 'section_header', null), b('b15', '• Led X', 'text', null)]
    const outline = buildOutline(blocks)
    expect(outline.confidence).toBe('typography')
    expect(outline.nodes.slice(-2).map((node) => node.role)).toEqual(['h2', 'list'])
  })

  it('opens a fallback section exactly where the rules path does', () => {
    const blocks = [
      b('b1', 'Jane Doe', 'title', null),
      b('b2', 'Skills', 'section_header', null),
      b('b3', 'Languages:', 'text', null),
      b('b4', 'Languages', 'section_header', null),
      b('b5', 'Campus Activities', 'section_header', null),
      b('b6', 'Course', 'text', null),
    ]
    expect(roles(blocks)).toEqual(['name', 'h2', 'body', 'h2', 'h2', 'h2'])
  })

  it('never promotes a list item to h3', () => {
    const blocks = [...doc.slice(0, 10), b('b14', 'Coached new trainers', 'list_item', S('f2', 10))]
    expect(roles(blocks).at(-1)).toBe('list')
  })

  it('does not take a long paragraph in a heading style as h2', () => {
    const paragraph = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    expect(roles([...doc, b('b14', paragraph, 'text', S('f2', 16))]).at(-1)).toBe('body')
  })

  it('takes a long entry heading as h3 while h2 stays short', () => {
    const school = 'Contoh Sea College of Trade and Logistics (CSCTL) - Lae, Papua New Guinea'
    // A body-font bullet keeps the body class ahead of the longer entry line by letter count.
    const bullet = b('b14', 'Trained forty new hires on the branch ledger and the customer service script.', 'list_item', S('f1', 10))
    const blocks = [...doc, bullet, b('b15', school, 'text', S('f2', 10)), b('b16', school, 'text', S('f2', 16))]
    expect(roles(blocks).slice(-2)).toEqual(['h3', 'body'])
  })

  it('keeps a long one-sentence highlight in the entry style as body', () => {
    const highlight = 'Cut onboarding time for branch staff by a third in one year.'
    const bullet = b('b14', 'Trained forty new hires on the branch ledger and the customer service script.', 'list_item', S('f1', 10))
    const blocks = [...doc, bullet, b('b15', highlight, 'text', S('f2', 10))]
    expect(roles(blocks).at(-1)).toBe('body')
  })

  it('does not take a company style far from body size as h3', () => {
    const blocks = doc.map((block) => (block.style?.font === 'f2' && block.style.size === 10 ? { ...block, style: S('f2', 12) } : block))
    const result = roles(blocks)
    expect([result[6], result[10]]).toEqual(['body', 'body'])
  })

  it('finds the heading style without known wording when it repeats in short lines', () => {
    const blocks = [
      b('b1', 'Rina Wulandari', 'text', S('f1', 14)),
      b('b2', 'About Rina', 'text', S('f2', 16)),
      b('b3', 'I have 4 years of experience designing training programmes for banks.', 'text', S('f1', 10)),
      b('b4', 'Places Worked', 'text', S('f2', 16)),
      b('b5', 'Contoh Consulting - Bandung, Indonesia', 'text', S('f1', 10)),
    ]
    const outline = buildOutline(blocks)
    expect(outline.confidence).toBe('typography')
    expect(outline.nodes.map((node) => node.role)).toEqual(['name', 'h2', 'body', 'h2', 'body'])
  })

  it('needs the name first and name-like in typography mode', () => {
    const blocks = [b('b0', 'Rina Wulandari, S.Pd.', 'title', S('f1', 14)), ...doc.slice(1)]
    expect(roles(blocks)[0]).toBe('body')
    expect(roles(blocks)).not.toContain('name')
  })
})

describe('buildOutline on extraction fixtures', () => {
  const root = resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract/valid')
  const load = (name: string) => {
    const parsed = parseExtraction(JSON.parse(readFileSync(resolve(root, `extraction_${name}.json`), 'utf8')))
    if (!parsed.ok) throw new Error(name)
    return parsed.value
  }

  it('reads the guide template by typography', () => {
    const blocks = load('guide_template').blocks
    const outline = buildOutline(blocks)
    expect(outline.confidence).toBe('typography')
    const of = (role: string) => outline.nodes.filter((node) => node.role === role).map((node) => node.block.text)
    expect(of('name')).toEqual(['Rina Wulandari'])
    expect(of('h2')).toEqual([
      'Profile Summary', 'Competencies & Abilities', 'Working Experience', 'Education Background', 'Course', 'References', 'Hobbies',
    ])
    expect(of('h3')).toEqual([
      'Contoh Consulting - Bandung, Indonesia', 'Contoh Edu - Surabaya, Indonesia', 'Contoh Retail - Semarang, Indonesia Aug 2021 - Aug 2022', 'Anggi Pratiwi',
    ])
    expect(of('h4')).toEqual(['Training Consultant', 'Curriculum Designer', 'People Development Officer'])
  })

  it('falls back on every fixture without styles', () => {
    for (const name of ['en_single', 'id_single', 'two_column', 'five_page', 'progression', 'scanned', 'mixed', 'guide_template']) {
      expect(buildOutline(stripStyles(load(name)).blocks).confidence, name).toBe('fallback')
    }
  })
})
