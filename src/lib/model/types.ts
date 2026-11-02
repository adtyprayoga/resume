import type { ListSectionKind } from '$lib/sections/kinds'

export type Locale = 'id' | 'en'

export const LOCALES = ['id', 'en'] as const satisfies readonly Locale[]

export const SCHEMA_VERSION = 1

/**
 * Attaches a per-locale text payload to a shared, locale-invariant core.
 *
 * Every leaf stays a plain `string`: the locale union sits on ONE `text` node
 * per item, never on individual fields. Consumers never unwrap it — they read
 * the flattened `Resolved` form produced by `resolve()`.
 */
export type Localized<Shared, Text> = Shared & { text: Record<Locale, Text> }

/** A `Localized` item flattened for one locale. What every preview component sees. */
export type Resolved<Shared, Text> = Shared & Text

/** A start/end span. `end` is null while `current` is true. */
export interface DateRange {
  start: string
  end: string | null
  current?: boolean
}

/** Locale-invariant contact facts, shared by every language version. */
export interface ContactInfo {
  email: string
  phone: string
  website: string
  github: string
  linkedin: string
  avatar: string
}

export interface ProfileText {
  name: string
  headline: string
  location: string
  summary: string
}
export type Profile = Localized<Record<never, never>, ProfileText>
export type ResolvedProfile = ProfileText

interface EducationCore {
  id: string
  dates: DateRange
  gpa: string
}
export interface EducationText {
  school: string
  degree: string
  field: string
  description: string
}
export type EducationItem = Localized<EducationCore, EducationText>
export type ResolvedEducationItem = Resolved<EducationCore, EducationText>

interface ExperienceCore {
  id: string
  dates: DateRange
  /** Proper noun, not translated. */
  company: string
}
export interface ExperienceText {
  role: string
  team: string
  location: string
  bullets: string[]
}
export type ExperienceItem = Localized<ExperienceCore, ExperienceText>
export type ResolvedExperienceItem = Resolved<ExperienceCore, ExperienceText>

interface ProjectCore {
  id: string
  dates: DateRange
  link: string
  techStack: string[]
}
export interface ProjectText {
  name: string
  role: string
  description: string
  bullets: string[]
}
export type ProjectItem = Localized<ProjectCore, ProjectText>
export type ResolvedProjectItem = Resolved<ProjectCore, ProjectText>

interface SkillCore {
  id: string
}
export interface SkillText {
  title: string
  items: string[]
}
export type SkillGroup = Localized<SkillCore, SkillText>
export type ResolvedSkillGroup = Resolved<SkillCore, SkillText>

interface AwardCore {
  id: string
  date: string
}
export interface AwardText {
  title: string
  issuer: string
  description: string
}
export type AwardItem = Localized<AwardCore, AwardText>
export type ResolvedAwardItem = Resolved<AwardCore, AwardText>

/** A section's placement and visibility in a document. */
export interface SectionState {
  kind: ListSectionKind
  enabled: boolean
}

export interface ResumeSections {
  education: EducationItem[]
  experience: ExperienceItem[]
  projects: ProjectItem[]
  skills: SkillGroup[]
  awards: AwardItem[]
}

/**
 * The persisted document. One structure shared across locales, so adding an
 * item adds it for every language and the two versions cannot drift in shape.
 */
export interface ResumeDocument {
  schemaVersion: typeof SCHEMA_VERSION
  contact: ContactInfo
  profile: Profile
  sections: SectionState[]
  content: ResumeSections
}

/** A document flattened to one locale. The only shape the preview/print path sees. */
export interface ResolvedResume {
  contact: ContactInfo
  profile: ResolvedProfile
  sections: SectionState[]
  education: ResolvedEducationItem[]
  experience: ResolvedExperienceItem[]
  projects: ResolvedProjectItem[]
  skills: ResolvedSkillGroup[]
  awards: ResolvedAwardItem[]
}
