import { DEFAULT_SECTION_ORDER, LIST_SECTION_KINDS, type ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'
import { isRecord, str, textNode } from './coerce'
import { safeHref, safeImageSrc } from './sanitize'
import { err, ok, type Result } from './result'
import {
  SCHEMA_VERSION,
  type ContactInfo,
  type Profile,
  type ProfileText,
  type ResumeDocument,
  type ResumeSections,
  type SectionState,
} from './types'

const isListKind = (value: unknown): value is ListSectionKind =>
  typeof value === 'string' && (LIST_SECTION_KINDS as readonly string[]).includes(value)

const contactOf = (raw: unknown): ContactInfo => {
  const value = isRecord(raw) ? raw : {}
  return {
    email: str(value.email),
    phone: str(value.phone),
    website: safeHref(str(value.website)),
    github: safeHref(str(value.github)),
    linkedin: safeHref(str(value.linkedin)),
    avatar: safeImageSrc(str(value.avatar)),
  }
}

const profileText = (raw: unknown): ProfileText => {
  const value = isRecord(raw) ? raw : {}
  return {
    name: str(value.name),
    headline: str(value.headline),
    location: str(value.location),
    summary: str(value.summary),
  }
}

const profileOf = (raw: unknown): Profile => {
  const value = isRecord(raw) ? raw : {}
  return { text: textNode(value.text, profileText) }
}

/**
 * Reconciles a stored section list against the registry: unknown kinds and
 * duplicates are dropped, and any kind the registry knows but the list omits is
 * appended in default order. A document can therefore never be missing a
 * section, and a section removed from the code can never resurrect.
 */
export const normalizeSections = (raw: unknown): SectionState[] => {
  const entries = Array.isArray(raw) ? raw : []
  const seen = new Set<ListSectionKind>()
  const sections: SectionState[] = []

  for (const entry of entries) {
    if (!isRecord(entry) || !isListKind(entry.kind) || seen.has(entry.kind)) continue
    seen.add(entry.kind)
    sections.push({ kind: entry.kind, enabled: entry.enabled !== false })
  }

  for (const kind of DEFAULT_SECTION_ORDER) {
    if (!seen.has(kind)) sections.push({ kind, enabled: true })
  }

  return sections
}

const contentOf = (raw: unknown): ResumeSections => {
  const value = isRecord(raw) ? raw : {}
  return {
    education: getSectionModule('education').validate(value.education),
    experience: getSectionModule('experience').validate(value.experience),
    projects: getSectionModule('projects').validate(value.projects),
    skills: getSectionModule('skills').validate(value.skills),
    awards: getSectionModule('awards').validate(value.awards),
  }
}

export const emptyDocument = (): ResumeDocument => ({
  schemaVersion: SCHEMA_VERSION,
  contact: contactOf(undefined),
  profile: profileOf(undefined),
  sections: normalizeSections(undefined),
  content: contentOf(undefined),
})

/**
 * Turns unknown input into a document that is safe to put into application
 * state. Containers are checked strictly; leaves are coerced to defaults, so a
 * slightly stale export still imports while garbage never reaches state.
 */
export const validateDocument = (raw: unknown): Result<ResumeDocument> => {
  if (!isRecord(raw)) return err('This file does not look like a resume.')

  return ok({
    schemaVersion: SCHEMA_VERSION,
    contact: contactOf(raw.contact),
    profile: profileOf(raw.profile),
    sections: normalizeSections(raw.sections),
    content: contentOf(raw.content),
  })
}
