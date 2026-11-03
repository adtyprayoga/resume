import type { ResumeThemeConfig } from '../types'

/** Serif, single-column adaptation of the LaTeX reference. */
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
    pageMarginX: '16mm',
    sectionGap: '5mm',
    itemGap: '3pt',
  },
  type: {
    fontFamily: "'Latin Modern Roman', 'Computer Modern', 'Times New Roman', 'Liberation Serif', serif",
    baseSize: 11,
    nameSize: 14.4,
    titleSize: 12,
    itemTitleSize: 11,
    lineHeight: 1.2,
  },
}

export default ats
