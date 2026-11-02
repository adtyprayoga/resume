import type { ListSectionKind } from './kinds'

/**
 * A list section's identity and behaviour. Types only — this module has no
 * runtime exports, so section modules can import it while the registry globs
 * them, without a circular import.
 *
 * Deliberately NOT here: Svelte components. Each section's editor form has a
 * genuinely different shape, so a single generic form contract would cost
 * either `any` or generics gymnastics for no benefit at five sections. The
 * registry gives uniform mounting and ordering, not uniform forms.
 */
export interface SectionModule<Item, Text> {
  kind: ListSectionKind
  /** Position in a fresh document. Glob key order is lexicographic, so this is required. */
  order: number
  labelKey: string
  /** The field names that live in the per-locale text node. */
  translatableFields: readonly (keyof Text & string)[]
  emptyItem: () => Item
  /** Coerces unknown input into a clean item list. Never throws. */
  validate: (input: unknown) => Item[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The single `any`, confined to the registry boundary. Safety is recovered by `validate`. */
export type AnySectionModule = SectionModule<any, any>
