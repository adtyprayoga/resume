/**
 * The section list, written once by hand.
 *
 * `import.meta.glob` keys are not literal types, so a glob alone cannot produce
 * a string-literal union. This union is the contract; a test asserts the glob's
 * registered kinds match it exactly, so the two cannot drift.
 */
export const LIST_SECTION_KINDS = ['experience', 'education', 'projects', 'skills', 'awards'] as const

export type ListSectionKind = (typeof LIST_SECTION_KINDS)[number]

/** Profile is a singleton, not a list, so it is not a registry member. */
export type SectionKind = 'profile' | ListSectionKind

/**
 * Order for a fresh document. Glob key order is lexicographic and therefore
 * meaningless, so a default must be stated explicitly.
 */
export const DEFAULT_SECTION_ORDER = [
  'experience',
  'education',
  'projects',
  'skills',
  'awards',
] as const satisfies readonly ListSectionKind[]
