import type { FontScaleKey, ResumeThemeConfig } from './types'

const modules = import.meta.glob<ResumeThemeConfig>('./presets/*.ts', {
  eager: true,
  import: 'default',
})

export const resumeThemes: ResumeThemeConfig[] = Object.values(modules).sort(
  (left, right) => left.order - right.order,
)

const first = resumeThemes[0]
if (!first) throw new Error('No resume theme presets registered')
export const defaultTheme: ResumeThemeConfig = first

export const getTheme = (key: string | null | undefined): ResumeThemeConfig =>
  resumeThemes.find((theme) => theme.key === key) ?? defaultTheme

/** Lets the user fit content without an auto-shrink algorithm. */
export const FONT_SCALES: Record<FontScaleKey, number> = {
  xsmall: 0.86,
  small: 0.93,
  standard: 1,
  large: 1.07,
}

const pt = (size: number, scale: number): string => `${Number((size * scale).toFixed(2))}pt`

/** print.css declares a fallback for each, so a missing variable still renders. */
export const buildThemeStyleVars = (
  theme: ResumeThemeConfig,
  fontScale: FontScaleKey = 'standard',
): Record<string, string> => {
  const scale = FONT_SCALES[fontScale]

  return {
    '--page-margin-y': theme.layout.pageMarginY,
    '--page-margin-x': theme.layout.pageMarginX,
    '--section-gap': theme.layout.sectionGap,
    '--item-gap': theme.layout.itemGap,
    '--paper-text': theme.palette.text,
    '--paper-muted': theme.palette.muted,
    '--paper-rule': theme.palette.rule,
    '--paper-font': theme.type.fontFamily,
    '--paper-line-height': String(theme.type.lineHeight),
    '--paper-font-size': pt(theme.type.baseSize, scale),
    '--name-font-size': pt(theme.type.nameSize, scale),
    '--title-font-size': pt(theme.type.titleSize, scale),
    '--item-title-font-size': pt(theme.type.itemTitleSize, scale),
  }
}


export const themeStyleAttr = (
  theme: ResumeThemeConfig,
  fontScale: FontScaleKey = 'standard',
): string =>
  Object.entries(buildThemeStyleVars(theme, fontScale))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ')
