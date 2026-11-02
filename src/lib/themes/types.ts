/** Hex rather than OKLCH: no colour-space conversion on the print path. */
export interface ResumeThemePalette {
  text: string
  muted: string
  rule: string
}

export interface ResumeThemeLayout {
  /**
   * Split so it can drive `@page` directly. Not a single padding value: an
   * element's padding applies once at the top and once at the very bottom, so
   * interior pages would print flush against the paper edge.
   */
  pageMarginY: string
  pageMarginX: string
  sectionGap: string
  itemGap: string
}

/** Points, since the output is paper. */
export interface ResumeThemeType {
  fontFamily: string
  baseSize: number
  nameSize: number
  titleSize: number
  itemTitleSize: number
  lineHeight: number
}

/** How the shared renderer lays out the same content. */
export type ResumePresentation = 'classic' | 'ats'

export interface ResumeThemeConfig {
  key: string
  presentation: ResumePresentation
  name: string
  description: string
  order: number
  palette: ResumeThemePalette
  layout: ResumeThemeLayout
  type: ResumeThemeType
}

export type FontScaleKey = 'xsmall' | 'small' | 'standard' | 'large'
