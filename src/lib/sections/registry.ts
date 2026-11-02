import { LIST_SECTION_KINDS, type ListSectionKind } from './kinds'
import type { AnySectionModule } from './types'

const modules = import.meta.glob<AnySectionModule>('./*/index.ts', {
  eager: true,
  import: 'default',
})


export const sectionModules: AnySectionModule[] = Object.values(modules).sort(
  (left, right) => left.order - right.order,
)

export const sectionModuleMap = sectionModules.reduce<Record<string, AnySectionModule>>(
  (map, module) => {
    map[module.kind] = module
    return map
  },
  {},
)

export const getSectionModule = (kind: ListSectionKind): AnySectionModule => {
  const module = sectionModuleMap[kind]
  if (!module) throw new Error(`No section module registered for "${kind}"`)
  return module
}

/** For the drift test. */
export const registeredKinds = (): string[] => sectionModules.map((module) => module.kind).sort()

export const expectedKinds = (): string[] => [...LIST_SECTION_KINDS].sort()
