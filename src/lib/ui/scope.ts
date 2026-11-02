import { getContext, setContext } from 'svelte'

export type FieldScope = 'localized' | 'shared'

const KEY = Symbol('field-scope')

/**
 * The scope most fields in a pane share. A field matching it shows no badge —
 * marking every field in Experience as per-language says nothing, while marking
 * the two shared ones says something.
 */
export const setPaneScope = (scope: FieldScope) => setContext(KEY, scope)

export const getPaneScope = (): FieldScope | null => getContext<FieldScope>(KEY) ?? null
