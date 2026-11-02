import type { ResumeThemeConfig } from '../types'

/**
 * Single column in plain reading order, no photo, common system fonts. Parsers
 * read text in content order, so every entry is laid out top to bottom with no
 * right-aligned dates or grid columns that could interleave when extracted.
 */
const ats: ResumeThemeConfig = {
  key: 'ats',
  presentation: 'ats',
  name: 'ATS',
  description: 'Plain single-column reading order for applicant tracking systems.',
  order: 1,
  palette: {
    text: '#111111',
    muted: '#333333',
    rule: '#111111',
  },
  layout: {
    pageMarginY: '16mm',
    pageMarginX: '18mm',
    sectionGap: '5mm',
    itemGap: '3.5mm',
  },
  type: {
    fontFamily: "Arial, Helvetica, 'Liberation Sans', sans-serif",
    baseSize: 11,
    nameSize: 20,
    titleSize: 12,
    itemTitleSize: 11,
    lineHeight: 1.45,
  },
}

export default ats
