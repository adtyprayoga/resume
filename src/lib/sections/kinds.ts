/**
 * Glob keys are not literal types, so a glob alone cannot produce this union.
 * A test asserts the registry matches it, so the two cannot drift.
 */
export const LIST_SECTION_KINDS = ['experience', 'education', 'projects', 'skills', 'awards', 'certifications'] as const

export type ListSectionKind = (typeof LIST_SECTION_KINDS)[number]

/** Profile is a singleton, not a list, so it is not in the registry. */
export type SectionKind = 'profile' | ListSectionKind

/** Glob key order is lexicographic, so a default must be stated. */
export const DEFAULT_SECTION_ORDER = [
  'experience',
  'education',
  'projects',
  'skills',
  'awards',
  'certifications',
] as const satisfies readonly ListSectionKind[]
