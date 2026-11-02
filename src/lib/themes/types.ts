/**
 * Colours are plain hex, not OKLCH. The print path is the one place a colour
 * space conversion could surprise us, and the theme is mapped through typed
 * fields anyway, so the modern syntax buys nothing here.
 */
export interface ResumeThemePalette {
  text: string
  muted: string
  rule: string
}

export interface ResumeThemeLayout {
  /** Page margin, applied as paper padding so screen and print share one box. */
  paperPadding: string
  sectionGap: string
  itemGap: string
}

/** Sizes in points, since the output medium is paper. */
export interface ResumeThemeType {
  fontFamily: string
  baseSize: number
  nameSize: number
  titleSize: number
  itemTitleSize: number
  lineHeight: number
}

export interface ResumeThemeConfig {
  key: string
  name: string
  description: string
  /** Position in the theme picker. */
  order: number
  palette: ResumeThemePalette
  layout: ResumeThemeLayout
  type: ResumeThemeType
}

export type FontScaleKey = 'xsmall' | 'small' | 'standard' | 'large'
