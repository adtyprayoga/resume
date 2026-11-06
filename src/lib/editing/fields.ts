/**
 * Typed edit targets. A target names a stored field by identity — profile or
 * contact key, or section + item id + key — so a click on rendered text can
 * never be turned into a storage path by reading what the text says.
 */
import type { UiStringKey } from '$lib/i18n/ui'
import { normalizeUrl } from '$lib/model/sanitize'
import type { ContactInfo, DateRange, Locale, ProfileText, ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'

export type FieldType =
  | 'bullet'
  | 'text'
  | 'multiline'
  | 'lines'
  | 'tags'
  | 'email'
  | 'tel'
  | 'url'
  | 'month'
  | 'dates'
  | 'photo'

export type FieldScope = 'shared' | 'localized'

export type BulletRef = {
  owner: 'bullet'
  section: 'experience' | 'projects'
  id: string
  key: 'bullets'
  index: number | 'append'
}

export type FieldRef =
  | BulletRef
  | { owner: 'profile'; key: keyof ProfileText }
  | { owner: 'contact'; key: keyof ContactInfo }
  | { owner: 'item'; section: ListSectionKind; id: string; key: string }

export interface FieldSpec {
  key: string
  scope: FieldScope
  type: FieldType
  labelKey: UiStringKey
  placeholderKey?: UiStringKey
}

/** A date range as a form edits it: `end` is never null, `current` is explicit. */
export interface DateDraft {
  start: string
  end: string
  current: boolean
}

export type DraftValue = string | DateDraft | string[]

const spec = (
  key: string,
  scope: FieldScope,
  type: FieldType,
  labelKey: UiStringKey,
  placeholderKey?: UiStringKey,
): FieldSpec => ({ key, scope, type, labelKey, ...(placeholderKey ? { placeholderKey } : {}) })

export const PROFILE_FIELDS: readonly FieldSpec[] = [
  spec('name', 'localized', 'text', 'field.name'),
  spec('headline', 'localized', 'text', 'field.headline'),
  spec('location', 'localized', 'text', 'field.location'),
  spec('summary', 'localized', 'multiline', 'field.summary'),
]

export const CONTACT_FIELDS: readonly FieldSpec[] = [
  spec('email', 'shared', 'email', 'field.email'),
  spec('phone', 'shared', 'tel', 'field.phone'),
  spec('website', 'shared', 'url', 'field.website', 'placeholder.website'),
  spec('github', 'shared', 'url', 'field.github', 'placeholder.github'),
  spec('linkedin', 'shared', 'url', 'field.linkedin', 'placeholder.linkedin'),
  spec('avatar', 'shared', 'photo', 'avatar.photo'),
]

/** In the order the entry form lists them. */
export const SECTION_FIELDS: Record<ListSectionKind, readonly FieldSpec[]> = {
  experience: [
    spec('role', 'localized', 'text', 'field.role'),
    spec('company', 'shared', 'text', 'field.company'),
    spec('team', 'localized', 'text', 'field.team'),
    spec('location', 'localized', 'text', 'field.location'),
    spec('dates', 'shared', 'dates', 'field.dates'),
    spec('bullets', 'localized', 'lines', 'field.highlights'),
  ],
  education: [
    spec('school', 'localized', 'text', 'field.school'),
    spec('degree', 'localized', 'text', 'field.degree'),
    spec('field', 'localized', 'text', 'field.field'),
    spec('gpa', 'shared', 'text', 'field.gpa'),
    spec('dates', 'shared', 'dates', 'field.dates'),
    spec('description', 'localized', 'multiline', 'field.notes'),
  ],
  projects: [
    spec('name', 'localized', 'text', 'field.name'),
    spec('role', 'localized', 'text', 'field.role'),
    spec('dates', 'shared', 'dates', 'field.dates'),
    spec('techStack', 'shared', 'tags', 'field.techStack'),
    spec('description', 'localized', 'multiline', 'field.description'),
    spec('bullets', 'localized', 'lines', 'field.highlights'),
    spec('link', 'shared', 'url', 'field.link', 'placeholder.project'),
  ],
  skills: [
    spec('title', 'localized', 'text', 'field.group'),
    spec('items', 'localized', 'tags', 'field.skills'),
  ],
  awards: [
    spec('title', 'localized', 'text', 'field.title'),
    spec('issuer', 'localized', 'text', 'field.issuer'),
    spec('date', 'shared', 'month', 'field.date', 'placeholder.awardDate'),
    spec('description', 'localized', 'multiline', 'field.notes'),
  ],
  references: [
    spec('name', 'localized', 'text', 'field.name'),
    spec('position', 'localized', 'text', 'field.position'),
    spec('phone', 'shared', 'text', 'field.phone'),
    spec('email', 'shared', 'text', 'field.email'),
    spec('note', 'localized', 'multiline', 'field.notes'),
  ],
  certifications: [
    spec('title', 'localized', 'text', 'field.title'),
    spec('issuer', 'localized', 'text', 'field.issuer'),
    spec('date', 'shared', 'month', 'field.date', 'placeholder.certificationDate'),
    spec('description', 'localized', 'multiline', 'field.notes'),
  ],
}

export const refKey = (ref: FieldRef): string =>
  ref.owner === 'bullet' ? `bullet.${ref.section}.${ref.id}.${ref.index}` :
  ref.owner === 'item' ? `item.${ref.section}.${ref.id}.${ref.key}` : `${ref.owner}.${ref.key}`

export const specFor = (ref: FieldRef): FieldSpec => {
  if (ref.owner === 'bullet') return spec('bullets', 'localized', 'bullet', 'field.highlights')
  const list =
    ref.owner === 'profile' ? PROFILE_FIELDS : ref.owner === 'contact' ? CONTACT_FIELDS : SECTION_FIELDS[ref.section]
  const found = list.find((entry) => entry.key === ref.key)
  if (!found) throw new Error(`Unknown field ${refKey(ref)}`)
  return found
}

export const entryRefs = (section: ListSectionKind, id: string): FieldRef[] =>
  SECTION_FIELDS[section].map((entry) => ({ owner: 'item', section, id, key: entry.key }))

export const profileRefs = (): FieldRef[] => [
  ...PROFILE_FIELDS.map((entry) => ({ owner: 'profile', key: entry.key }) as FieldRef),
  ...CONTACT_FIELDS.map((entry) => ({ owner: 'contact', key: entry.key }) as FieldRef),
]

/** Item shape as far as editing cares: shared keys on the item, localized keys under `text`. */
interface EditableItem {
  id: string
  text: Record<Locale, Record<string, unknown>>
  [key: string]: unknown
}

const findItem = (doc: ResumeDocument, section: ListSectionKind, id: string, staged?: { id: string }) => {
  if (staged?.id === id) return staged as unknown as EditableItem
  return (doc.content[section] as unknown as EditableItem[]).find((item) => item.id === id)
}

export const itemExists = (doc: ResumeDocument, ref: FieldRef, staged?: { id: string }): boolean =>
  (ref.owner !== 'item' && ref.owner !== 'bullet') || findItem(doc, ref.section, ref.id, staged) !== undefined

const toDraft = (type: FieldType, value: unknown): DraftValue => {
  if (type === 'dates') {
    const range = (value ?? { start: '', end: null }) as DateRange
    return { start: range.start, end: range.end ?? '', current: range.current === true }
  }
  if (type === 'lines') return [...value as string[]]
  if (type === 'tags') return (value as string[]).join(', ')
  return typeof value === 'string' ? value : ''
}

export const parseTags = (draft: string): string[] =>
  draft.split(',').map((entry) => entry.trim()).filter(Boolean)

const fromDraft = (type: FieldType, draft: DraftValue): unknown => {
  if (type === 'dates') {
    const range = draft as DateDraft
    return range.current
      ? { start: range.start, end: null, current: true }
      : { start: range.start, end: range.end || null }
  }
  if (type === 'lines') return [...draft as string[]]
  const text = draft as string
  if (type === 'tags') return parseTags(text)
  if (type === 'url') return normalizeUrl(text)
  return text
}

/** `undefined` when the item no longer exists. */
export const readDraft = (
  doc: ResumeDocument,
  ref: FieldRef,
  locale: Locale,
  staged?: { id: string },
): DraftValue | undefined => {
  const { type, scope } = specFor(ref)
  if (ref.owner === 'profile') return toDraft(type, doc.profile.text[locale][ref.key])
  if (ref.owner === 'contact') return toDraft(type, doc.contact[ref.key])
  const item = findItem(doc, ref.section, ref.id, staged)
  if (!item) return undefined
  if (ref.owner === 'bullet') {
    const primary = item.text[locale]!.bullets as string[]
    const values = primary.length ? primary : item.text[locale === 'en' ? 'id' : 'en']!.bullets as string[]
    if (ref.index === 'append') return ''
    return Number.isInteger(ref.index) && ref.index >= 0 ? values[ref.index] : undefined
  }
  return toDraft(type, scope === 'shared' ? item[ref.key] : item.text[locale]?.[ref.key])
}

/** Returns false, writing nothing, when the item no longer exists. */
export const applyDraft = (
  doc: ResumeDocument,
  ref: FieldRef,
  locale: Locale,
  draft: DraftValue,
  staged?: { id: string },
): boolean => {
  const { type, scope } = specFor(ref)
  const value = fromDraft(type, draft)
  if (ref.owner === 'profile') {
    doc.profile.text[locale][ref.key] = value as string
    return true
  }
  if (ref.owner === 'contact') {
    doc.contact[ref.key] = value as string
    return true
  }
  const item = findItem(doc, ref.section, ref.id, staged)
  if (!item) return false
  if (ref.owner === 'bullet') {
    if (readDraft(doc, ref, locale, staged) === undefined) return false
    const value = (draft as string).trim()
    if (ref.index === 'append' && !value) return true
    const primary = item.text[locale]!.bullets as string[]
    const values = [...(primary.length ? primary : item.text[locale === 'en' ? 'id' : 'en']!.bullets as string[])]
    if (ref.index === 'append') values.push(value)
    else values.splice(ref.index, 1, ...(value ? [value] : []))
    item.text[locale]!.bullets = values
    return true
  }
  if (scope === 'shared') item[ref.key] = value
  else item.text[locale]![ref.key] = value
  return true
}

export const sameDraft = (left: DraftValue | undefined, right: DraftValue | undefined): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

export type EditKeyAction = 'commit' | 'cancel' | null

/**
 * IME composition is checked first: the Enter that confirms a composed
 * character must not also commit the field.
 */
export const editKeyAction = (
  event: Pick<KeyboardEvent, 'key' | 'isComposing' | 'ctrlKey' | 'metaKey'> & { keyCode?: number },
  multiline: boolean,
): EditKeyAction => {
  if (event.isComposing || event.key === 'Process' || event.keyCode === 229) return null
  if (event.key === 'Escape') return 'cancel'
  if (event.key !== 'Enter') return null
  if (!multiline) return 'commit'
  return event.ctrlKey || event.metaKey ? 'commit' : null
}
