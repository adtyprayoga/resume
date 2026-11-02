import type {
  Locale,
  Localized,
  ResolvedResume,
  Resolved,
  ResumeDocument,
} from './types'

const otherLocale = (locale: Locale): Locale => (locale === 'id' ? 'en' : 'id')

/** Treats blank strings and empty arrays as "not translated yet". */
const isBlank = (value: unknown): boolean =>
  value === '' ||
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0)

/**
 * Field-level fallback: a field left blank in the active locale borrows the
 * other locale's value, so a half-translated resume still renders completely.
 */
const mergeText = <T extends object>(primary: T, fallback: T): T => {
  const merged: Record<string, unknown> = { ...(primary as Record<string, unknown>) }
  for (const [key, value] of Object.entries(merged)) {
    if (isBlank(value)) {
      const replacement = (fallback as Record<string, unknown>)[key]
      if (!isBlank(replacement)) merged[key] = replacement
    }
  }
  return merged as T
}

/** Drops the `text` node and splices the chosen locale's fields onto the core. */
const flatten = <S extends object, T extends object>(
  item: Localized<S, T>,
  locale: Locale,
): Resolved<S, T> => {
  const { text, ...core } = item
  return { ...core, ...mergeText(text[locale], text[otherLocale(locale)]) } as Resolved<S, T>
}

/**
 * The single locale seam. Everything downstream — preview components, the theme
 * layer, pagination and the print path — consumes `ResolvedResume` and is
 * entirely locale-ignorant.
 */
export const resolve = (doc: ResumeDocument, locale: Locale): ResolvedResume => ({
  contact: doc.contact,
  profile: flatten(doc.profile, locale),
  sections: doc.sections,
  education: doc.content.education.map((item) => flatten(item, locale)),
  experience: doc.content.experience.map((item) => flatten(item, locale)),
  projects: doc.content.projects.map((item) => flatten(item, locale)),
  skills: doc.content.skills.map((item) => flatten(item, locale)),
  awards: doc.content.awards.map((item) => flatten(item, locale)),
})
