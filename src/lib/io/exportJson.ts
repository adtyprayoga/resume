import type { Locale, ResumeDocument } from '$lib/model/types'

/** Pretty-printed so a hand-edited export stays reviewable in git. */
export const serializeResume = (doc: ResumeDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`

/** Safe across filesystems and used as the print dialog's default PDF name. */
export const resumeFileName = (name: string, locale: Locale): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `${slug}-resume-${locale}` : `resume-${locale}`
}
