import type { ResumeThemeConfig } from '../types'

/**
 * Deliberately background-free: structure comes from rules and whitespace, so
 * the PDF is correct whether or not the user has "Background graphics" enabled
 * in the print dialog — a setting the page cannot override.
 */
const minimal: ResumeThemeConfig = {
  key: 'minimal',
  name: 'Minimal',
  description: 'Single column, rules and whitespace only. Prints identically everywhere.',
  order: 0,
  palette: {
    text: '#1a1a1a',
    muted: '#4a4a4a',
    rule: '#1a1a1a',
  },
  layout: {
    pageMarginY: '16mm',
    pageMarginX: '18mm',
    sectionGap: '6mm',
    itemGap: '3.5mm',
  },
  type: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    baseSize: 10.5,
    nameSize: 20,
    titleSize: 11,
    itemTitleSize: 10.5,
    lineHeight: 1.45,
  },
}

export default minimal
