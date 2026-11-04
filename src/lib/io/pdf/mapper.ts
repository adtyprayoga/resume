import { emptyDocument, normalizeSections } from '$lib/model/document'
import { getSectionModule } from '$lib/sections/registry'
import { DEFAULT_SECTION_ORDER, type ListSectionKind } from '$lib/sections/kinds'
import type {
  AwardItem,
  DateRange,
  EducationItem,
  ExperienceItem,
  Locale,
  ProjectItem,
  ResumeDocument,
  SkillGroup,
} from '$lib/model/types'
import { findContacts, findDateRange, matchHeading, splitRoleCompany, stripBullet, type FoundRange, type HeadingKind } from './rules'
import type { Extraction, SourceBlock } from './types'

/**
 * Deterministic mapping of extracted blocks into a resume proposal. It only
 * fills what an explicit rule recognises; everything else stays blank and its
 * text is reported as unmatched so the review can show it. Nothing is
 * generated, translated or reworded.
 */

export interface FieldRef {
  /** `profile.name`, `contact.email`, or `<section>.<itemId>.<field>`. */
  path: string
  blocks: string[]
}

export type WarningCode = 'no_name' | 'ambiguous_title' | 'ambiguous_entries' | 'unsupported_section' | 'nothing_recognised'

export interface MapWarning {
  code: WarningCode
  blocks: string[]
}

export interface UnmatchedText {
  block: string
  page: number
  text: string
}

export interface Proposal {
  locale: Locale
  document: ResumeDocument
  refs: FieldRef[]
  warnings: MapWarning[]
  unmatched: UnmatchedText[]
}

// Usage: which characters of each block were consumed -------------------------

const SEPARATORS = /^[\s|,;:•·/\\–—-]+|[\s|,;:•·/\\–—-]+$/g

const count = (text: string, char: string) => text.split(char).length - 1

/**
 * Trims separators left at the edges of a piece after a span was taken out of
 * it. Brackets are trimmed only when unbalanced (the other half went with the
 * span, as in "Foo (2019 – 2020)"); "PT Pertamina (Persero)" keeps its own.
 */
const trimPiece = (text: string): string => {
  let out = text.replace(SEPARATORS, '')
  for (let changed = true; changed; ) {
    changed = false
    for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
      if (out.endsWith(open) || (out.endsWith(close) && count(out, open) < count(out, close))) {
        out = out.slice(0, -1).replace(SEPARATORS, '')
        changed = true
      }
      if (out.startsWith(close) || (out.startsWith(open) && count(out, open) > count(out, close))) {
        out = out.slice(1).replace(SEPARATORS, '')
        changed = true
      }
    }
  }
  return out
}

class Usage {
  private spans = new Map<string, [number, number][]>()

  take(block: SourceBlock, from = 0, to = block.text.length) {
    if (to <= from) return
    const list = this.spans.get(block.id) ?? []
    list.push([from, to])
    this.spans.set(block.id, list)
  }

  used(block: SourceBlock): boolean {
    return this.spans.has(block.id)
  }

  /** The block's text with consumed spans removed, as [text, offset] pieces. */
  pieces(block: SourceBlock): [string, number][] {
    const taken = [...(this.spans.get(block.id) ?? [])].sort((a, b) => a[0] - b[0])
    const out: [string, number][] = []
    let cursor = 0
    for (const [from, to] of taken) {
      if (from > cursor) out.push([block.text.slice(cursor, from), cursor])
      cursor = Math.max(cursor, to)
    }
    if (cursor < block.text.length) out.push([block.text.slice(cursor), cursor])
    return out
  }

  /** Remaining text, trimmed of separators; empty when nothing meaningful is left. */
  rest(block: SourceBlock): string {
    return this.pieces(block)
      .map(([text]) => trimPiece(text))
      .filter((text) => /[\p{L}\p{N}]/u.test(text))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** Consumes and returns the remaining meaningful text of a block. */
  takeRest(block: SourceBlock): string {
    const pieces = this.pieces(block)
    const kept: string[] = []
    for (const [text, offset] of pieces) {
      const trimmed = trimPiece(text)
      this.take(block, offset, offset + text.length)
      if (!/[\p{L}\p{N}]/u.test(trimmed)) continue
      kept.push(trimmed)
    }
    if (!pieces.length) this.take(block)
    return kept.join(' ').replace(/\s+/g, ' ').trim()
  }
}

// Helpers ----------------------------------------------------------------------

const HEADER_LABELS = new Set(['title', 'section_header'])
const isHeaderLabel = (block: SourceBlock) => HEADER_LABELS.has(block.label)
/** Document titles, not names: "CURRICULUM VITAE", "Daftar Riwayat Hidup". */
const DOCUMENT_TITLE = /^\s*(?:curriculum vitae|cv|resume|résumé|daftar riwayat hidup|riwayat hidup)\s*$/i
const NAME_LIKE = /^[\p{Lu}][\p{L}.'’-]*(?:\s+[\p{L}][\p{L}.'’-]*){0,4}$/u
const LOCATION_LIKE = /^[\p{L}][\p{L} .'’-]*(?:,\s*[\p{L}][\p{L} .'’-]*){1,2}$/u
const SKILL_SPLIT = /\s*[,;|•·]\s*/
const TECH_LINE = /^(?:tech(?:nolog(?:y|ies))?(?:\s+stack)?|stack|tools|built with|teknologi|alat)\s*:\s*(.+)$/i
const GPA = /\b(?:gpa|ipk)\s*:?\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)/i

const isBullet = (block: SourceBlock) => block.label === 'list_item' || stripBullet(block.text).from > 0

const dateRangeOf = (found: FoundRange): DateRange =>
  found.current ? { start: found.start, end: null, current: true } : { start: found.start, end: found.end }

/** A block that is nothing but a date or date range. */
const isDateLine = (block: SourceBlock) => {
  const found = findDateRange(block.text)
  if (!found) return false
  const rest = trimPiece(block.text.slice(0, found.from) + block.text.slice(found.to))
  return !/[\p{L}\p{N}]/u.test(rest)
}

type RegionKind = HeadingKind | 'header'

interface Region {
  kind: RegionKind
  heading: SourceBlock | null
  blocks: SourceBlock[]
}

const regionsOf = (blocks: SourceBlock[]): Region[] => {
  const regions: Region[] = [{ kind: 'header', heading: null, blocks: [] }]
  for (const block of blocks) {
    const matched = matchHeading(block.text)
    // "Languages:" inside a skills list is a label; only a layout heading opens an unsupported section.
    const kind = matched === 'unsupported' && !isHeaderLabel(block) ? null : matched
    if (kind) regions.push({ kind, heading: block, blocks: [] })
    else regions.at(-1)!.blocks.push(block)
  }
  return regions
}

const ENTRY_KINDS = ['experience', 'education', 'projects', 'awards'] as const
type EntryKind = (typeof ENTRY_KINDS)[number]

/**
 * Splits a section into entries at title-like blocks, or failing that at the
 * line before each date-only line. Blocks before the first entry are returned
 * separately; null means no boundary at all could be found.
 */
const splitEntries = (blocks: SourceBlock[]): { lead: SourceBlock[]; entries: SourceBlock[][] } | null => {
  let starts = blocks.flatMap((block, i) => (isHeaderLabel(block) ? [i] : []))
  if (!starts.length) {
    starts = blocks.flatMap((block, i) => {
      const next = blocks[i + 1]
      return next && isDateLine(next) && !isDateLine(block) && !isBullet(block) ? [i] : []
    })
  }
  if (!starts.length) return null
  return {
    lead: blocks.slice(0, starts[0]),
    entries: starts.map((start, i) => blocks.slice(start, starts[i + 1] ?? blocks.length)),
  }
}

// Mapper -----------------------------------------------------------------------

export const mapExtraction = (extraction: Extraction, locale: Locale): Proposal => {
  const document = emptyDocument()
  const usage = new Usage()
  const refs: FieldRef[] = []
  const warnings: MapWarning[] = []
  const regions = regionsOf(extraction.blocks)

  const ref = (path: string, block: SourceBlock) => {
    const existing = refs.find((r) => r.path === path)
    if (!existing) refs.push({ path, blocks: [block.id] })
    else if (!existing.blocks.includes(block.id)) existing.blocks.push(block.id)
  }

  for (const region of regions) if (region.heading && region.kind !== 'unsupported') usage.take(region.heading)

  // Contacts: only from the header and explicit contact sections, so a project
  // link is never mistaken for the person's website.
  const contactBlocks = regions.filter((r) => r.kind === 'header' || r.kind === 'contact').flatMap((r) => r.blocks)
  for (const block of contactBlocks) {
    for (const found of findContacts(block.text)) {
      if (document.contact[found.field]) continue
      document.contact[found.field] = found.value
      usage.take(block, found.from, found.to)
      ref(`contact.${found.field}`, block)
    }
  }

  const profile = document.profile.text[locale]
  const header = regions[0]!.blocks
  for (const block of header) if (DOCUMENT_TITLE.test(block.text)) usage.take(block)
  const nameBlock = header.find((block) => isHeaderLabel(block) && !usage.used(block) && NAME_LIKE.test(block.text.trim()))
  if (nameBlock) {
    profile.name = nameBlock.text.trim()
    usage.take(nameBlock)
    ref('profile.name', nameBlock)
  } else {
    warnings.push({ code: 'no_name', blocks: [] })
  }
  const afterName = nameBlock ? header.slice(header.indexOf(nameBlock) + 1) : []
  for (const block of afterName) {
    if (usage.used(block) || isHeaderLabel(block)) continue
    const text = block.text.trim()
    const words = text.split(/\s+/).length
    if (!profile.location && LOCATION_LIKE.test(text) && words <= 6) {
      profile.location = text
      usage.take(block)
      ref('profile.location', block)
    } else if (!profile.headline && !/[,\d@]/.test(text) && text.length <= 80 && words <= 10) {
      profile.headline = text
      usage.take(block)
      ref('profile.headline', block)
    }
  }

  const sectionOrder: ListSectionKind[] = []
  const seen = (kind: ListSectionKind) => {
    if (!sectionOrder.includes(kind)) sectionOrder.push(kind)
  }

  for (const region of regions) {
    switch (region.kind) {
      case 'summary': {
        const lines = region.blocks.map((block) => {
          usage.take(block)
          ref('profile.summary', block)
          return block.text.trim()
        })
        if (lines.length) profile.summary = [profile.summary, ...lines].filter(Boolean).join('\n')
        break
      }
      case 'unsupported':
        warnings.push({ code: 'unsupported_section', blocks: [region.heading!.id] })
        break
      case 'skills':
        seen('skills')
        mapSkills(region.blocks, document, locale, usage, ref)
        break
      case 'experience':
      case 'education':
      case 'projects':
      case 'awards': {
        seen(region.kind)
        const kind: EntryKind = region.kind
        const split = splitEntries(region.blocks)
        if (!split) {
          if (kind === 'awards') {
            for (const block of region.blocks) mapEntry(kind, [block], document, locale, usage, ref, warnings)
          } else if (region.blocks.length) {
            warnings.push({ code: 'ambiguous_entries', blocks: region.blocks.map((b) => b.id) })
          }
          break
        }
        if (split.lead.length) warnings.push({ code: 'ambiguous_entries', blocks: split.lead.map((b) => b.id) })
        for (const entry of split.entries) mapEntry(kind, entry, document, locale, usage, ref, warnings)
        break
      }
      default:
        break
    }
  }

  if (regions.length === 1) warnings.push({ code: 'nothing_recognised', blocks: [] })

  document.sections = normalizeSections([...sectionOrder, ...DEFAULT_SECTION_ORDER].map((kind) => ({ kind, enabled: true })))

  const unmatched = extraction.blocks.flatMap((block) => {
    const text = usage.rest(block)
    return text ? [{ block: block.id, page: block.page, text }] : []
  })

  return { locale, document, refs, warnings, unmatched }
}

type Ref = (path: string, block: SourceBlock) => void

const mapSkills = (blocks: SourceBlock[], document: ResumeDocument, locale: Locale, usage: Usage, ref: Ref) => {
  const module = getSectionModule('skills')
  let pending: { title: string; block: SourceBlock } | null = null
  let loose: SkillGroup | null = null

  const add = (title: string) => {
    const group = module.emptyItem() as SkillGroup
    group.text[locale].title = title
    document.content.skills.push(group)
    return group
  }

  for (const block of blocks) {
    const text = stripBullet(block.text).text.trim()
    const labelled = /^([^:]{1,40}):\s*(.*)$/.exec(text)
    if (labelled && !labelled[2]!.trim()) {
      pending = { title: labelled[1]!.trim(), block }
      loose = null
      continue
    }
    const items = (labelled ? labelled[2]! : text).split(SKILL_SPLIT).map((s) => s.trim()).filter(Boolean)
    if (!items.length) continue
    let group: SkillGroup
    if (labelled) {
      group = add(labelled[1]!.trim())
      loose = null
    } else if (pending) {
      group = add(pending.title)
      usage.take(pending.block)
      ref(`skills.${group.id}.title`, pending.block)
      pending = null
      loose = null
    } else {
      group = loose ?? add('')
      loose = group
    }
    group.text[locale].items.push(...items)
    usage.take(block)
    if (labelled) ref(`skills.${group.id}.title`, block)
    ref(`skills.${group.id}.items`, block)
  }
}

const mapEntry = (
  kind: EntryKind,
  blocks: SourceBlock[],
  document: ResumeDocument,
  locale: Locale,
  usage: Usage,
  ref: Ref,
  warnings: MapWarning[],
) => {
  const item = getSectionModule(kind).emptyItem() as ExperienceItem & EducationItem & ProjectItem & AwardItem
  const text = item.text[locale] as unknown as Record<string, string | string[]>
  const path = (field: string) => `${kind}.${item.id}.${field}`
  let dated = false

  const takeDates = (block: SourceBlock) => {
    if (dated) return
    const found = findDateRange(block.text)
    if (!found || usage.rest(block) === '') return
    dated = true
    usage.take(block, found.from, found.to)
    if (kind === 'awards') {
      item.date = found.start
      ref(path('date'), block)
    } else {
      item.dates = dateRangeOf(found)
      ref(path('dates'), block)
    }
  }

  const [title, ...rest] = blocks as [SourceBlock, ...SourceBlock[]]
  takeDates(title)
  const titleText = stripBullet(usage.rest(title)).text.trim()

  if (kind === 'experience') {
    const split = splitRoleCompany(titleText)
    if (split) {
      item.company = split.company
      text.role = split.role
      usage.takeRest(title)
      ref(path('company'), title)
      ref(path('role'), title)
    } else if (titleText) {
      warnings.push({ code: 'ambiguous_title', blocks: [title.id] })
    }
  } else if (titleText) {
    const field = { education: 'school', projects: 'name', awards: 'title' }[kind]
    text[field] = stripBullet(usage.takeRest(title)).text
    ref(path(field), title)
  }

  const description: string[] = []
  for (const block of rest) {
    // A year inside an achievement ("…by 30% in 2019") is not the entry's period.
    if (!isBullet(block)) takeDates(block)
    if (usage.rest(block) === '') continue

    if (isBullet(block) && kind !== 'education' && kind !== 'awards') {
      const bullets = text.bullets as string[]
      bullets.push(stripBullet(block.text).text.trim())
      usage.take(block)
      ref(path('bullets'), block)
      continue
    }

    if (kind === 'education') {
      const gpa = GPA.exec(block.text)
      if (gpa && !item.gpa) {
        item.gpa = gpa[1]!
        usage.take(block, gpa.index, gpa.index + gpa[0].length)
        ref(path('gpa'), block)
      }
      if (!text.degree && !isBullet(block)) {
        const degree = usage.takeRest(block)
        if (degree) {
          text.degree = degree
          ref(path('degree'), block)
        }
        continue
      }
    }

    if (kind === 'projects') {
      const tech = TECH_LINE.exec(block.text.trim())
      if (tech && !item.techStack.length) {
        item.techStack = tech[1]!.split(SKILL_SPLIT).map((s) => s.trim()).filter(Boolean)
        usage.take(block)
        ref(path('techStack'), block)
        continue
      }
      const link = findContacts(block.text).find((c) => c.field !== 'email' && c.field !== 'phone')
      if (link && !item.link) {
        item.link = link.value
        usage.take(block, link.from, link.to)
        ref(path('link'), block)
        if (usage.rest(block) === '') continue
      }
    }

    // Experience has no free-text field: leftover lines stay unmatched.
    if (kind === 'experience') continue
    const line = usage.takeRest(block)
    if (line) {
      description.push(stripBullet(line).text)
      ref(path('description'), block)
    }
  }
  if (description.length) text.description = description.join('\n')

  document.content[kind].push(item as never)
}
