import { normalizeUrl, safeHref } from '$lib/model/sanitize'
import type { ContactInfo } from '$lib/model/types'

/**
 * Bilingual (English / Indonesian) recognition rules for the PDF mapper. Every
 * rule matches explicit text only; anything a rule cannot read with confidence
 * returns null so the mapper leaves the field blank and the text unmatched.
 */

export type HeadingKind = 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'awards' | 'contact' | 'unsupported'

const HEADINGS: Record<HeadingKind, string[]> = {
  summary: [
    'summary', 'professional summary', 'career summary', 'profile', 'professional profile', 'about', 'about me',
    'objective', 'career objective', 'ringkasan', 'ringkasan profesional', 'profil', 'profil singkat', 'tentang saya',
    'tujuan karir', 'tujuan karier',
  ],
  experience: [
    'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history',
    'career history', 'pengalaman', 'pengalaman kerja', 'pengalaman profesional', 'pengalaman pekerjaan', 'riwayat pekerjaan',
    'riwayat kerja',
  ],
  education: ['education', 'academic background', 'educational background', 'pendidikan', 'riwayat pendidikan', 'latar belakang pendidikan'],
  projects: ['projects', 'personal projects', 'selected projects', 'side projects', 'proyek', 'projek', 'portofolio proyek'],
  skills: [
    'skills', 'technical skills', 'core skills', 'key skills', 'skills and tools', 'keahlian', 'keterampilan', 'kemampuan',
    'keahlian teknis',
  ],
  awards: [
    'awards', 'honors', 'honours', 'achievements', 'awards and honors', 'awards and achievements', 'honors and awards',
    'penghargaan', 'prestasi', 'penghargaan dan prestasi',
  ],
  contact: ['contact', 'contacts', 'contact information', 'contact info', 'kontak', 'informasi kontak', 'hubungi saya'],
  // Recognised so their content is not swallowed by the previous section.
  unsupported: [
    'certifications', 'certificates', 'licenses and certifications', 'languages', 'references', 'volunteer',
    'volunteering', 'volunteer experience', 'interests', 'hobbies', 'publications', 'organizations', 'organisations',
    'courses', 'training', 'sertifikasi', 'sertifikat', 'bahasa', 'referensi', 'organisasi', 'pengalaman organisasi',
    'minat', 'hobi', 'publikasi', 'pelatihan', 'kursus', 'relawan', 'kegiatan sukarela',
  ],
}

const HEADING_INDEX = new Map<string, HeadingKind>(
  (Object.entries(HEADINGS) as [HeadingKind, string[]][]).flatMap(([kind, names]) => names.map((name) => [name, kind] as const)),
)

const normalizeHeading = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const matchHeading = (text: string): HeadingKind | null => HEADING_INDEX.get(normalizeHeading(text)) ?? null

// Dates -----------------------------------------------------------------------

const MONTHS: [RegExp, number][] = [
  [/^(january|jan|januari)$/, 1],
  [/^(february|feb|februari|pebruari|peb)$/, 2],
  [/^(march|mar|maret)$/, 3],
  [/^(april|apr)$/, 4],
  [/^(may|mei)$/, 5],
  [/^(june|jun|juni)$/, 6],
  [/^(july|jul|juli)$/, 7],
  [/^(august|aug|agustus|agu|agt|ags)$/, 8],
  [/^(september|sept|sep)$/, 9],
  [/^(october|oct|oktober|okt)$/, 10],
  [/^(november|nov|nop)$/, 11],
  [/^(december|dec|desember|des)$/, 12],
]
const MONTH_WORD =
  'january|jan|januari|february|feb|februari|pebruari|peb|march|mar|maret|april|apr|may|mei|june|jun|juni|july|jul|juli|august|aug|agustus|agu|agt|ags|september|sept|sep|october|oct|oktober|okt|november|nov|nop|december|dec|desember|des'
const YEAR = '(?:19|20)\\d{2}'
const DATE = `(?:(?:${MONTH_WORD})\\.?\\s+${YEAR}|(?:0?[1-9]|1[0-2])[/.]${YEAR}|${YEAR}-(?:0[1-9]|1[0-2])(?![\\d])|${YEAR})`
const PRESENT = '(?:present|current|now|today|ongoing|sekarang|saat ini|kini)'
const SEPARATOR = '\\s*(?:-|–|—|to|until|till|sampai|hingga|s\\.\\s?d\\.?|s/d)\\s*'
const RANGE = new RegExp(`(?<![\\p{L}\\d/.+-])(${DATE})${SEPARATOR}(${DATE}|${PRESENT})(?![\\p{L}\\d/])`, 'iu')
const TRAILING_DATE = new RegExp(`(?<![\\p{L}\\d/.+-])(${DATE})\\s*[).]?\\s*$`, 'iu')
const PRESENT_ONLY = new RegExp(`^${PRESENT}$`, 'i')

const pad = (month: number) => String(month).padStart(2, '0')

/** `YYYY` or `YYYY-MM`; year-only dates stay year-only. */
export const parseDate = (text: string): string | null => {
  const value = text.trim().toLowerCase()
  let match = /^((?:19|20)\d{2})$/.exec(value)
  if (match) return match[1]!
  match = /^([a-z]+)\.?\s+((?:19|20)\d{2})$/.exec(value)
  if (match) {
    const month = MONTHS.find(([pattern]) => pattern.test(match![1]!))?.[1]
    return month ? `${match[2]}-${pad(month)}` : null
  }
  match = /^(0?[1-9]|1[0-2])[/.]((?:19|20)\d{2})$/.exec(value)
  if (match) return `${match[2]}-${pad(Number(match[1]))}`
  match = /^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/.exec(value)
  if (match) return `${match[1]}-${match[2]}`
  return null
}

export interface FoundRange {
  start: string
  end: string | null
  current: boolean
  from: number
  to: number
}

/**
 * A `start – end` range anywhere in the text, or a single date that ends the
 * text ("…, 2018"). `current` is true only when the text says so explicitly.
 */
export const findDateRange = (text: string): FoundRange | null => {
  const range = RANGE.exec(text)
  if (range) {
    const start = parseDate(range[1]!)
    const endText = range[2]!
    const current = PRESENT_ONLY.test(endText.trim())
    const end = current ? null : parseDate(endText)
    if (start && (current || end)) return { start, end, current, from: range.index, to: range.index + range[0].length }
  }
  const single = TRAILING_DATE.exec(text)
  if (single) {
    const start = parseDate(single[1]!)
    if (start) return { start, end: null, current: false, from: single.index, to: single.index + single[1]!.length }
  }
  return null
}

// Contacts --------------------------------------------------------------------

export type ContactField = Exclude<keyof ContactInfo, 'avatar'>

export interface FoundContact {
  field: ContactField
  value: string
  raw: string
  from: number
  to: number
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s|,;<>()]+|(?<![@\w.])(?:[a-z0-9-]+\.)+(?:com|id|io|dev|net|org|me|co|app|design|ai|xyz|tech|site|page|info|biz|my)(?:\/[^\s|,;<>()]*)?(?![\w@])/gi
const PHONE = /(?<![\w/.])\+?\d[\d\s().-]{6,}\d(?![\w/])/g

const overlaps = (from: number, to: number, taken: FoundContact[]) => taken.some((c) => from < c.to && to > c.from)

export const findContacts = (text: string): FoundContact[] => {
  const found: FoundContact[] = []
  for (const match of text.matchAll(EMAIL)) {
    found.push({ field: 'email', value: match[0], raw: match[0], from: match.index, to: match.index + match[0].length })
  }
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(/[.,;:]+$/, '')
    const from = match.index
    const to = from + raw.length
    if (overlaps(from, to, found)) continue
    const value = safeHref(normalizeUrl(raw))
    if (!value) continue
    const host = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase()
    const field: ContactField = host.startsWith('github.com/') ? 'github' : host.startsWith('linkedin.com/') ? 'linkedin' : 'website'
    found.push({ field, value, raw, from, to })
  }
  for (const match of text.matchAll(PHONE)) {
    const raw = match[0].trim()
    const from = match.index + match[0].indexOf(raw)
    const to = from + raw.length
    const digits = raw.replace(/\D/g, '').length
    // Reject any candidate holding a start–end range, or that is a lone date;
    // keep a number whose last group merely looks like a year.
    const date = findDateRange(raw)
    const isDate = date !== null && (date.end !== null || date.current || (date.from === 0 && date.to === raw.length))
    if (digits < 9 || digits > 15 || overlaps(from, to, found) || isDate) continue
    found.push({ field: 'phone', value: raw, raw, from, to })
  }
  return found.sort((a, b) => a.from - b.from)
}

// Entries ---------------------------------------------------------------------

const BULLET = /^\s*(?:[•●▪◦‣∙·¢*➢►]|[-–](?=\s))\s*/

/** Text without a leading bullet glyph, and where the kept text starts. */
export const stripBullet = (text: string): { text: string; from: number } => {
  const match = BULLET.exec(text)
  return match ? { text: text.slice(match[0].length), from: match[0].length } : { text, from: 0 }
}

const ROLE_WORDS =
  /\b(engineer|developer|programmer|manager|analyst|designer|intern|internship|consultant|lead|director|officer|specialist|administrator|architect|scientist|assistant|coordinator|head|executive|associate|supervisor|staff|teacher|lecturer|researcher|accountant|founder|co-founder|cto|ceo|cfo|vp|president|technician|writer|editor|marketer|representative|trainee|freelancer|analis|insinyur|manajer|pengembang|desainer|konsultan|magang|kepala|direktur|staf|asisten|koordinator|pengajar|guru|dosen|peneliti|akuntan|pendiri|teknisi|penulis|sekretaris|petugas|pegawai|karyawan|pemrogram)\b/i

/**
 * "Role at Company" is explicit. "A, B" / "A | B" / "A – B" is split only when
 * exactly one side contains a job-title word; otherwise null (ambiguous).
 */
export const splitRoleCompany = (title: string): { role: string; company: string } | null => {
  const explicit = /^(.+?)\s+(?:at|@|di)\s+(.+)$/i.exec(title.trim())
  if (explicit && ROLE_WORDS.test(explicit[1]!)) return { role: explicit[1]!.trim(), company: explicit[2]!.trim() }

  const parts = title.split(/\s*(?:,|\||\s-\s|\s–\s|\s—\s)\s*/).filter(Boolean)
  if (parts.length !== 2) return null
  const [left, right] = parts as [string, string]
  const leftRole = ROLE_WORDS.test(left)
  const rightRole = ROLE_WORDS.test(right)
  if (leftRole === rightRole) return null
  return leftRole ? { role: left, company: right } : { role: right, company: left }
}
