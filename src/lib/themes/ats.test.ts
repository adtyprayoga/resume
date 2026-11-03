import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildThemeStyleVars, defaultTheme, getTheme } from './index'

// Read from disk: Vitest does not process CSS, so a ?raw import comes back empty.
const printCss = readFileSync(resolve(__dirname, '../../styles/print.css'), 'utf8')
const ats = getTheme('ats')

/** Every declaration block whose selector targets the ATS presentation. */
const atsRules = () =>
  [...printCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector!.includes("[data-presentation='ats']"))
    .map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }))

const ruleFor = (fragment: string) => {
  const rule = atsRules().find(({ selector }) =>
    selector.split(',').some((part) => part.trim().endsWith(fragment)),
  )
  expect(rule, `no ATS rule ending in ${fragment}`).toBeTruthy()
  return rule!.body
}

describe('ATS typography', () => {
  it('uses 11pt body, 14.4pt name, 12pt headings, 11pt entry titles, 1.2 leading', () => {
    const vars = buildThemeStyleVars(ats, 'standard')
    expect(vars['--paper-font-size']).toBe('11pt')
    expect(vars['--name-font-size']).toBe('14.4pt')
    expect(vars['--title-font-size']).toBe('12pt')
    expect(vars['--item-title-font-size']).toBe('11pt')
    expect(vars['--paper-line-height']).toBe('1.2')
  })

  it('uses LaTeX-style serif fonts and dark text', () => {
    expect(ats.type.fontFamily).toBe("'Latin Modern Roman', 'Computer Modern', 'Times New Roman', 'Liberation Serif', serif")
    expect(ats.palette.text).toMatch(/^#[0-3][0-9a-f]{5}$/i)
  })

  it('uses 16mm ATS margins and 3pt entries without changing Classic', () => {
    expect(ats.layout.pageMarginY).toBe(defaultTheme.layout.pageMarginY)
    expect(defaultTheme.layout.pageMarginX).toBe('18mm')
    expect(ats.layout.pageMarginY).toBe('16mm')
    expect(ats.layout.pageMarginX).toBe('16mm')
    expect(ats.layout.sectionGap).toBe('5mm')
    expect(ats.layout.itemGap).toBe('3pt')
  })

  it('still honours the manual font-size control', () => {
    expect(buildThemeStyleVars(ats, 'small')['--paper-font-size']).toBe('10.23pt')
    expect(buildThemeStyleVars(ats, 'large')['--paper-font-size']).toBe('11.77pt')
  })
})

describe('ATS stylesheet', () => {
  it('scopes its rules to the ATS presentation', () => {
    expect(atsRules().length).toBeGreaterThan(0)
  })

  it('sets headings in bold with normal letter spacing and no case transform', () => {
    const title = ruleFor('.resume-section-title')
    expect(title).toMatch(/letter-spacing:\s*normal/)
    expect(title).toMatch(/text-transform:\s*none/)
    expect(title).toMatch(/font-weight:\s*700/)
    expect(ruleFor('.resume-name')).toMatch(/letter-spacing:\s*normal/)
  })

  it('centers the header and wraps heading rows with complete dates at body size', () => {
    expect(ruleFor('.ats-header')).toMatch(/display:\s*block/)
    const dates = ruleFor('.item-dates')
    expect(dates).toMatch(/white-space:\s*nowrap/)
    expect(ruleFor('.ats-entry-head')).toMatch(/flex-wrap:\s*wrap/)
    expect(ruleFor('.ats-header')).toMatch(/text-align:\s*center/)
    expect(dates).toMatch(/font-size:\s*inherit/)
  })

  it('lets long values wrap rather than overflow', () => {
    expect(ruleFor("[data-presentation='ats']")).toMatch(/overflow-wrap:\s*(anywhere|break-word)/)
  })

  it('uses template spacing for paragraphs, bullets and entry gaps', () => {
    expect(ruleFor('.item-desc')).toMatch(/margin-top:\s*4pt/)
    expect(atsRules().some(({ selector, body }) => selector.endsWith('.item-bullets') && /padding-left:\s*0.9em/.test(body))).toBe(true)
    expect(ruleFor('.item-bullets li + li')).toMatch(/margin-top:\s*2pt/)
    expect(ruleFor('.resume-section-title')).toMatch(/border-bottom-width:\s*0.4pt/)
    expect(ruleFor('.resume-name')).toMatch(/text-transform:\s*uppercase/)
    expect(ruleFor('.ats-project-head .item-dates')).toMatch(/font-style:\s*italic/)
  })

  it('never clips: no fixed heights or hidden overflow', () => {
    for (const { body } of atsRules()) {
      expect(body).not.toMatch(/(^|[;\s])height:/)
      expect(body).not.toMatch(/overflow:\s*hidden/)
    }
  })
})
