import type { Locale } from '$lib/model/types'

type Bilingual = Record<Locale, string>

export type SummaryAnswers = {
  years?: string
  field?: string
  industries?: string[]
  expertise?: string[]
  audience?: string
  strengths?: string[]
}

type BulletAnswers = { with?: string; goal?: string; achievement?: string }

export const NARRATION = {
  opening: {
    en: 'Once upon a time, there lived a {headlineFirstPart} called {name}.',
    id: 'Pada suatu masa, hiduplah seorang {headlineFirstPart} bernama {name}.',
  },
  headlineTitle: { en: 'Headline', id: 'Headline' },
  summaryTitle: { en: 'Profile Summary', id: 'Ringkasan Profil' },
  competenciesTitle: { en: 'Competencies', id: 'Kompetensi' },
  experienceTitle: { en: 'Working Experience', id: 'Pengalaman Kerja' },
  educationTitle: { en: 'Education', id: 'Pendidikan' },
  courseTitle: { en: 'Course', id: 'Kursus' },
  referencesTitle: { en: 'References', id: 'Referensi' },
  ending: {
    en: 'And so the story of {name} was written.',
    id: 'Dan begitulah kisah {name} dituliskan.',
  },
  endingCounts: {
    en: 'You visited {chapters} chapters and wrote {answers} answers.',
    id: 'Kamu mengunjungi {chapters} bab dan menulis {answers} jawaban.',
  },
} satisfies Record<string, Bilingual>

export const GROUP_TITLES: Record<'soft' | 'tools' | 'languages' | 'core', Bilingual> = {
  soft: { en: 'Soft Skills', id: 'Soft Skills' },
  tools: { en: 'Support Technical Skills', id: 'Keterampilan Teknis Pendukung' },
  languages: { en: 'Languages', id: 'Bahasa' },
  core: { en: 'Core Skills', id: 'Keahlian Utama' },
}

const SUMMARY = {
  yearsField: { en: 'I have {years} years of experience in the field of {field}', id: 'Saya memiliki {years} tahun pengalaman di bidang {field}' },
  years: { en: 'I have {years} years of experience', id: 'Saya memiliki {years} tahun pengalaman' },
  field: { en: 'I work in the field of {field}', id: 'Saya bekerja di bidang {field}' },
  industriesSuffix: { en: ', across industries including {list}', id: ', di berbagai industri termasuk {list}' },
  industriesAlone: { en: 'I have experience in industries including {list}.', id: 'Saya memiliki pengalaman di berbagai industri termasuk {list}.' },
  expertise: { en: 'My expertise involves {list}.', id: 'Keahlian saya meliputi {list}.' },
  audience: { en: 'I have worked with {audience}.', id: 'Saya telah bekerja dengan {audience}.' },
  strengths: { en: 'I am known for being {list}.', id: 'Saya dikenal sebagai pribadi yang {list}.' },
} satisfies Record<string, Bilingual>

const BULLET = {
  stakeholderBoth: { en: 'Collaborating with {with} to achieve {goal}.', id: 'Berkolaborasi dengan {with} untuk mencapai {goal}.' },
  stakeholderWith: { en: 'Collaborating with {with}.', id: 'Berkolaborasi dengan {with}.' },
  stakeholderGoal: { en: 'Working towards {goal}.', id: 'Bekerja untuk mencapai {goal}.' },
  achievement: { en: 'Contributing to the achievement of {achievement}.', id: 'Berkontribusi dalam pencapaian {achievement}.' },
} satisfies Record<string, Bilingual>

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

export function joinList(items: string[], locale: Locale): string {
  if (items.length < 2) return items[0] ?? ''
  const conjunction = locale === 'en' ? 'and' : 'dan'
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`
}

export function summarySentence(a: SummaryAnswers, locale: Locale): string {
  const present = (value?: string) => Boolean(value?.trim())
  const list = (values?: string[]) => values?.filter((value) => value.trim()) ?? []
  const sentences: string[] = []
  const industries = list(a.industries)

  let first = ''
  if (present(a.years) && present(a.field)) first = fill(SUMMARY.yearsField[locale], { years: a.years!, field: a.field! })
  else if (present(a.years)) first = fill(SUMMARY.years[locale], { years: a.years! })
  else if (present(a.field)) first = fill(SUMMARY.field[locale], { field: a.field! })

  if (first) {
    if (industries.length) first += fill(SUMMARY.industriesSuffix[locale], { list: joinList(industries, locale) })
    sentences.push(`${first}.`)
  } else if (industries.length) {
    sentences.push(fill(SUMMARY.industriesAlone[locale], { list: joinList(industries, locale) }))
  }

  const expertise = list(a.expertise)
  if (expertise.length) sentences.push(fill(SUMMARY.expertise[locale], { list: joinList(expertise, locale) }))
  if (present(a.audience)) sentences.push(fill(SUMMARY.audience[locale], { audience: a.audience! }))
  const strengths = list(a.strengths)
  if (strengths.length) sentences.push(fill(SUMMARY.strengths[locale], { list: joinList(strengths, locale) }))
  return sentences.join(' ')
}

export function bulletSentence(kind: 'stakeholder' | 'achievement', a: BulletAnswers, locale: Locale): string {
  if (kind === 'achievement') {
    return a.achievement?.trim() ? fill(BULLET.achievement[locale], { achievement: a.achievement }) : ''
  }
  if (a.with?.trim() && a.goal?.trim()) return fill(BULLET.stakeholderBoth[locale], { with: a.with, goal: a.goal })
  if (a.with?.trim()) return fill(BULLET.stakeholderWith[locale], { with: a.with })
  if (a.goal?.trim()) return fill(BULLET.stakeholderGoal[locale], { goal: a.goal })
  return ''
}

export function hardGroupTitle(field: string, locale: Locale): string {
  return locale === 'en' ? `${field} Skills` : `Keahlian ${field}`
}
