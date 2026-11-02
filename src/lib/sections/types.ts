import type { ListSectionKind } from './kinds'

/**
 * Types only, so section modules can import this while the registry globs them.
 *
 * No components here: each editor form has a different shape, so a generic form
 * contract would cost type safety for no gain at five sections.
 */
export interface SectionModule<Item, Text> {
  kind: ListSectionKind
  /** Glob key order is lexicographic, so order must be declared. */
  order: number
  labelKey: string
  translatableFields: readonly (keyof Text & string)[]
  emptyItem: () => Item
  /** Never throws; coerces instead. */
  validate: (input: unknown) => Item[]
}

/** The one `any`, confined to the registry boundary; `validate` recovers safety. */
export type AnySectionModule = SectionModule<any, any>
