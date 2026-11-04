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
import { findContacts, findDateRange, findDateRanges, findProjectDate, isAward, isDocumentTitle, isHeadingLabel, isLocation, isNameLike, isRoleTitle, projectMetadata, sectionHeading, splitList, splitRoleCompany, stripBullet, type FoundRange, type HeadingKind } from './rules'
import { associateDateRows, joinSourceLines, partsOf, splitEducationRows, type SourceSegment as SourceBlock } from './segments'
import type { Extraction } from './types'

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

export type WarningCode = 'no_name' | 'ambiguous_title' | 'ambiguous_entries' | 'ambiguous_dates' | 'unsupported_section' | 'nothing_recognised'

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
    for (const part of partsOf(block)) {
      const start = Math.max(from, part.at)
      const end = Math.min(to, part.at + part.to - part.from)
      if (start >= end) continue
      const list = this.spans.get(part.block.id) ?? []
      list.push([start - part.at + part.from, end - part.at + part.from])
      this.spans.set(part.block.id, list)
    }
  }

  used(block: SourceBlock): boolean {
    return partsOf(block).some(part => this.spans.has(part.block.id))
  }

  /** The block's text with consumed spans removed, as [text, offset] pieces. */
  pieces(block: SourceBlock): [string, number][] {
    const taken = partsOf(block).flatMap(part => (this.spans.get(part.block.id) ?? [])
      .map(([from, to]): [number, number] => [Math.max(part.from, from) - part.from + part.at, Math.min(part.to, to) - part.from + part.at]))
      .filter(([from, to]) => from < to).sort((a, b) => a[0] - b[0])
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

const isHeaderLabel = (block: SourceBlock) => isHeadingLabel(block.label)
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

/** Recognised but not imported yet: their heading and content stay visible as unmatched. */
const unmapped = (kind: RegionKind) => kind === 'unsupported' || kind === 'certifications' || kind === 'references'

interface Region {
  kind: RegionKind
  heading: SourceBlock | null
  blocks: SourceBlock[]
}

const regionsOf = (blocks: SourceBlock[]): Region[] => {
  const regions: Region[] = [{ kind: 'header', heading: null, blocks: [] }]
  for (const block of blocks) {
    const kind = sectionHeading(block.text, block.label)
    if (kind) regions.push({ kind, heading: block, blocks: [] })
    else regions.at(-1)!.blocks.push(block)
  }
  return regions
}

const ENTRY_KINDS = ['experience', 'education', 'projects', 'awards'] as const
type EntryKind = (typeof ENTRY_KINDS)[number]

/**
 * Splits a section into entries. A block starts an entry when the layout calls
 * it a heading, or when it is a plain line directly before a date-only line and
 * the current entry already has content (a date or a bullet), so a title
 * followed by a location and then its dates stays one entry. Blocks before the
 * first entry are returned separately; null means no boundary was found.
 */
const splitEntries = (blocks: SourceBlock[], kind: EntryKind): { lead: SourceBlock[]; entries: SourceBlock[][] } | null => {
  const starts: number[] = []
  let content = false
  blocks.forEach((block, i) => {
    const next = blocks[i + 1]
    const titleBeforeDate = next !== undefined && isDateLine(next) && !isDateLine(block) && !isBullet(block)
    const date = kind === 'projects' ? findProjectDate(block.text) : findDateRange(block.text)
    const titleText = date ? trimPiece(block.text.slice(0, date.from)) : block.text.trim()
    const inlineEntry = !isBullet(block) && (
      (kind === 'experience' && isRoleTitle(titleText)) ||
      (kind === 'projects' && projectMetadata(titleText) !== null) ||
      (kind === 'education' && date !== null && /\s[–—-]\s/.test(titleText)))
    if ((!isDateLine(block) && isHeaderLabel(block)) || inlineEntry || (titleBeforeDate && (!starts.length || content))) {
      starts.push(i)
      content = false
    }
    if (isDateLine(block) || isBullet(block)) content = true
  })
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
  const regions = regionsOf(associateDateRows(joinSourceLines(extraction.blocks)))

  const ref = (path: string, block: SourceBlock) => {
    const ids = partsOf(block).map(part => part.block.id)
    const existing = refs.find((r) => r.path === path)
    if (!existing) refs.push({ path, blocks: [...new Set(ids)] })
    else for (const id of ids) if (!existing.blocks.includes(id)) existing.blocks.push(id)
  }

  for (const region of regions) if (region.heading && !unmapped(region.kind)) usage.take(region.heading)

  // Contacts: only from the header and explicit contact sections, so a project
  // link is never mistaken for the person's website.
  const contactBlocks = regions.filter((r) => r.kind === 'header' || r.kind === 'contact').flatMap((r) => r.blocks)
  for (const block of contactBlocks) {
    for (const found of findContacts(block.text)) {
      if (document.contact[found.field]) continue
      document.contact[found.field] = found.value
      usage.take(block, found.from, found.to)
      const label = /(?:e-?mail|phone|telephone|tel|telepon|ponsel|portfolio|portofolio|website|github|linkedin)\s*:?\s*$/i.exec(block.text.slice(0, found.from))
      if (label) usage.take(block, label.index, found.from)
      ref(`contact.${found.field}`, block)
    }
  }

  const profile = document.profile.text[locale]
  const header = regions[0]!.blocks
  for (const block of header) if (isDocumentTitle(block.text)) usage.take(block)
  const nameBlock = header.find((block) => isHeaderLabel(block) && !usage.used(block) && isNameLike(block.text.trim()))
  if (nameBlock) {
    profile.name = nameBlock.text.trim()
    usage.take(nameBlock)
    ref('profile.name', nameBlock)
  } else {
    warnings.push({ code: 'no_name', blocks: [] })
  }
  const afterName = nameBlock ? header.slice(header.indexOf(nameBlock) + 1) : []
  for (const block of afterName) {
    if (isHeaderLabel(block)) continue
    if (!profile.location) {
      for (const [piece, offset] of usage.pieces(block)) {
        for (const line of piece.matchAll(/[^\n]+/g)) {
          const intact = trimPiece(line[0])
          if (isLocation(intact)) {
            profile.location = intact
            usage.take(block, offset + line.index, offset + line.index + line[0].length)
            ref('profile.location', block)
            break
          }
        }
        if (profile.location) break
        // A flattened header can lose its newline immediately before the city.
        const location = /([\p{Lu}][\p{Ll}.'’-]+,\s*[\p{Lu}][\p{L} .'’-]+)\s*[—–|\-]*\s*$/u.exec(piece)
        if (!location) continue
        profile.location = trimPiece(location[1]!)
        usage.take(block, offset + location.index, offset + location.index + location[0].length)
        ref('profile.location', block)
        break
      }
    }
    for (const [piece, offset] of usage.pieces(block)) {
      for (const line of piece.matchAll(/[^\n]+/g)) {
        const text = trimPiece(line[0])
        const words = text.split(/\s+/).length
        let field: 'location' | 'headline' | null = null
        if (!profile.location && isLocation(text)) field = 'location'
        else if (!profile.headline && !/[@\d]/.test(text) && (isRoleTitle(text) || (!usage.used(block) && text.length <= 80 && words <= 10))) field = 'headline'
        if (field) {
          profile[field] = text
          usage.take(block, offset + line.index, offset + line.index + line[0].length)
          ref(`profile.${field}`, block)
        }
      }
    }
  }

  const sectionOrder: ListSectionKind[] = []
  const seen = (kind: ListSectionKind) => {
    if (!sectionOrder.includes(kind)) sectionOrder.push(kind)
  }

  for (const region of regions) {
    switch (region.kind) {
      case 'summary':
      case 'highlights': {
        const lines = region.blocks.map((block) => {
          usage.take(block)
          ref('profile.summary', block)
          return block.text.trim()
        })
        if (region.kind === 'highlights') lines.unshift(region.heading!.text)
        if (lines.length) profile.summary = [profile.summary, ...lines].filter(Boolean).join('\n')
        break
      }
      case 'unsupported':
      case 'certifications':
      case 'references':
        warnings.push({ code: 'unsupported_section', blocks: [region.heading!.id] })
        break
      case 'skills':
        seen('skills')
        mapSkills(region.blocks, document, locale, usage, ref)
        break
      case 'mixed_awards':
        seen('awards')
        for (const block of region.blocks) {
          if (isAward(block.text)) mapEntry('awards', [block], document, locale, usage, ref, warnings)
          else warnings.push({ code: 'unsupported_section', blocks: [block.id] })
        }
        break
      case 'experience':
      case 'education':
      case 'projects':
      case 'awards': {
        seen(region.kind)
        const kind: EntryKind = region.kind
        const blocks = kind === 'education' ? splitEducationRows(region.blocks) : region.blocks
        const split = splitEntries(blocks, kind)
        if (!split) {
          if (kind === 'awards') {
            for (const block of region.blocks) mapEntry(kind, [block], document, locale, usage, ref, warnings)
          } else if (region.blocks.length) {
            warnings.push({ code: 'ambiguous_entries', blocks: region.blocks.map((b) => b.id) })
          }
          break
        }
        if (split.lead.length) warnings.push({ code: 'ambiguous_entries', blocks: split.lead.map((b) => b.id) })
        let employer: SourceBlock | undefined
        for (let index = 0; index < split.entries.length; index++) {
          const entry = split.entries[index]!
          const title = entry[0]!
          const titleText = usage.rest(title)
          const next = split.entries[index + 1]?.[0]
          if (kind === 'experience' && isHeaderLabel(title) && !isRoleTitle(titleText) && !splitRoleCompany(titleText) && next && isRoleTitle(next.text)) {
            employer = title
            usage.take(title)
            continue
          }
          mapEntry(kind, entry, document, locale, usage, ref, warnings, employer)
          if (kind === 'experience' && splitRoleCompany(titleText)) employer = undefined
        }
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
    const items = splitList(labelled ? labelled[2]! : text)
    if (!items.length) continue
    let group: SkillGroup
    if (labelled) {
      group = add(labelled[1]!.trim())
      loose = group
    } else if (pending) {
      group = add(pending.title)
      usage.take(pending.block)
      ref(`skills.${group.id}.title`, pending.block)
      pending = null
      loose = group
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
  employer?: SourceBlock,
) => {
  const item = getSectionModule(kind).emptyItem() as ExperienceItem & EducationItem & ProjectItem & AwardItem
  const text = item.text[locale] as unknown as Record<string, string | string[]>
  const path = (field: string) => `${kind}.${item.id}.${field}`
  let dated = false

  const dateCandidates = blocks.filter(b => !isBullet(b)).flatMap(block => {
    if (kind === 'projects') {
      const found = findProjectDate(block.text)
      return found ? [{ block, found }] : []
    }
    const ranges = findDateRanges(block.text)
    const single = findDateRange(block.text)
    return (ranges.length ? ranges : single ? [single] : []).map(found => ({ block, found }))
  })
  const ambiguous = dateCandidates.length > 1 && (kind === 'experience' || dateCandidates.some(c => c.block === blocks[0]))
  if (ambiguous) warnings.push({ code: 'ambiguous_dates', blocks: [...new Set(dateCandidates.map(c => c.block.id))] })
  const takeDates = (block: SourceBlock) => {
    if (ambiguous) return
    if (dated) return
    const found = kind === 'projects' ? findProjectDate(block.text) : findDateRange(block.text)
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
  let titleText = stripBullet(usage.rest(title)).text.trim()
  const titleLimit = ambiguous ? Math.min(...dateCandidates.filter(c => c.block === title).map(c => c.found.from), title.text.length) : title.text.length
  if (ambiguous) titleText = trimPiece(title.text.slice(0, titleLimit))
  let inlineDescription = ''
  if (kind === 'projects') {
    const date = findProjectDate(title.text)
    if (date && !ambiguous) {
      titleText = trimPiece(title.text.slice(0, date.from))
      inlineDescription = trimPiece(title.text.slice(date.to))
    }
  }

  if (kind === 'experience') {
    const split = splitRoleCompany(titleText)
    if (split) {
      item.company = split.company
      text.role = split.role
      if (ambiguous) usage.take(title, 0, titleLimit)
      else usage.takeRest(title)
      ref(path('company'), title)
      ref(path('role'), title)
    } else if (isRoleTitle(titleText)) {
      text.role = titleText
      if (ambiguous) usage.take(title, 0, titleLimit)
      else usage.takeRest(title)
      ref(path('role'), title)
      if (employer) {
        item.company = employer.text.trim()
        ref(path('company'), employer)
      }
    } else if (titleText) {
      warnings.push({ code: 'ambiguous_title', blocks: [title.id] })
    }
  } else if (titleText) {
    const field = { education: 'school', projects: 'name', awards: 'title' }[kind]
    const metadata = kind === 'projects' ? projectMetadata(titleText) : null
    const school = kind === 'education' ? /^(.+?)\s+[–—-]\s+(.+)$/.exec(titleText) : null
    if (metadata) {
      text.name = metadata.name
      text.role = metadata.role
      item.techStack = metadata.techStack
      ref(path('role'), title)
      ref(path('techStack'), title)
    } else if (school) {
      text.school = school[1]!.trim()
      const qualification = school[2]!.trim()
      const degree = /^(B\.Sc\.|M\.Sc\.|B\.A\.|M\.A\.|Ph\.D\.|S[123]|D[1234])(?:\s+(.+))?$/i.exec(qualification)
      text.degree = degree?.[1] ?? ''
      text.field = degree ? degree[2] ?? '' : qualification
      if (text.degree) ref(path('degree'), title)
      if (text.field) ref(path('field'), title)
    } else text[field] = titleText
    if (ambiguous) usage.take(title, 0, titleLimit)
    else usage.takeRest(title)
    ref(path(field), title)
  }

  const description: string[] = inlineDescription ? [inlineDescription] : []
  if (inlineDescription) ref(path('description'), title)
  for (const block of rest) {
    // A year inside an achievement ("…by 30% in 2019") is not the entry's period.
    if (!isBullet(block)) takeDates(block)
    if (usage.rest(block) === '') continue
    if (ambiguous && dateCandidates.some(c => c.block === block)) continue

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
        item.techStack = splitList(tech[1]!)
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
