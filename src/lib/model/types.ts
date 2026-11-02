import type { ListSectionKind } from '$lib/sections/kinds'

export type Locale = 'id' | 'en'

export const LOCALES = ['id', 'en'] as const satisfies readonly Locale[]

export const SCHEMA_VERSION = 1

/**
 * Per-locale text on a shared core. The locale union sits on one `text` node per
 * item, never on individual fields, so every leaf stays a plain `string` and
 * consumers read the flattened `Resolved` form instead of unwrapping.
 */
export type Localized<Shared, Text> = Shared & { text: Record<Locale, Text> }

/** What every preview component sees. */
export type Resolved<Shared, Text> = Shared & Text

/** `end` is null while `current` is true. */
export interface DateRange {
  start: string
  end: string | null
  current?: boolean
}

/** Shared by every language version. */
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
  /** Proper noun; not translated. */
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

/** One structure shared across locales, so the language versions cannot drift in shape. */
export interface ResumeDocument {
  schemaVersion: typeof SCHEMA_VERSION
  contact: ContactInfo
  profile: Profile
  sections: SectionState[]
  content: ResumeSections
}

/** Flattened to one locale; the only shape the preview and print paths see. */
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
