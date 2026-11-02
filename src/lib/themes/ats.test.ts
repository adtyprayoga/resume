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
  it('uses 11pt body, 20pt name, 12pt headings, 11pt entry titles, 1.45 leading', () => {
    const vars = buildThemeStyleVars(ats, 'standard')
    expect(vars['--paper-font-size']).toBe('11pt')
    expect(vars['--name-font-size']).toBe('20pt')
    expect(vars['--title-font-size']).toBe('12pt')
    expect(vars['--item-title-font-size']).toBe('11pt')
    expect(vars['--paper-line-height']).toBe('1.45')
  })

  it('uses common sans-serif fonts and dark text', () => {
    expect(ats.type.fontFamily).toBe("Arial, Helvetica, 'Liberation Sans', sans-serif")
    expect(ats.palette.text).toMatch(/^#[0-3][0-9a-f]{5}$/i)
  })

  it('keeps Classic margins and uses 5mm sections, 3.5mm entries', () => {
    expect(ats.layout.pageMarginY).toBe(defaultTheme.layout.pageMarginY)
    expect(ats.layout.pageMarginX).toBe(defaultTheme.layout.pageMarginX)
    expect(ats.layout.pageMarginY).toBe('16mm')
    expect(ats.layout.pageMarginX).toBe('18mm')
    expect(ats.layout.sectionGap).toBe('5mm')
    expect(ats.layout.itemGap).toBe('3.5mm')
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

  it('lays out the header and dates in normal block flow at body size', () => {
    expect(ruleFor('.ats-header')).toMatch(/display:\s*block/)
    const dates = ruleFor('.item-dates')
    expect(dates).toMatch(/display:\s*block/)
    expect(dates).toMatch(/font-size:\s*inherit/)
  })

  it('lets long values wrap rather than overflow', () => {
    expect(ruleFor("[data-presentation='ats']")).toMatch(/overflow-wrap:\s*(anywhere|break-word)/)
  })

  it('never clips: no fixed heights or hidden overflow', () => {
    for (const { body } of atsRules()) {
      expect(body).not.toMatch(/(^|[;\s])height:/)
      expect(body).not.toMatch(/overflow:\s*hidden/)
    }
  })
})
