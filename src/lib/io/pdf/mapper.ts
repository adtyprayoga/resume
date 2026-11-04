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
  ReferenceItem,
  ResumeDocument,
  SkillGroup,
} from '$lib/model/types'
import { CONTACT_LABEL, findContacts, findDateRange, findDateRanges, findProjectDate, isAward, isCertificate, isDocumentTitle, isHeadingLabel, isLocation, isNameLike, isRoleTitle, matchHeading, projectMetadata, sectionHeading, splitList, splitRoleCompany, splitTitleIssuer, splitTrailingLocation, stripBullet, type FoundRange, type HeadingKind } from './rules'
import { buildOutline, type Outline, type OutlineRole } from './outline'
import { associateDateRows, joinListContinuations, joinSourceLines, partsOf, sliceSegment, splitEducationRows, type SourceSegment as SourceBlock } from './segments'
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

export type WarningCode = 'no_name' | 'ambiguous_title' | 'ambiguous_entries' | 'ambiguous_dates' | 'outside_structure' | 'nothing_recognised'

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

/** `outside`: a section that is not part of the recommended resume structure. */
type RegionKind = Exclude<HeadingKind, 'unsupported'> | 'header' | 'outside'

/** An outside section's heading and content stay visible as unmatched. */
const unmapped = (kind: RegionKind) => kind === 'outside'

interface Region {
  kind: RegionKind
  heading: SourceBlock | null
  blocks: SourceBlock[]
}

/**
 * With typography, every h2 opens a region, and one whose wording is not a
 * known section is outside the structure. Without it, a region opens where
 * `sectionHeading` reads one, as the rules path always has.
 */
const regionsOf = (outline: Outline): Region[] => {
  const regions: Region[] = [{ kind: 'header', heading: null, blocks: [] }]
  for (const { role, block } of outline.nodes) {
    const kind = outline.confidence === 'typography'
      ? role === 'h2' ? matchHeading(block.text) ?? 'outside' : null
      : sectionHeading(block.text, block.label)
    if (kind) regions.push({ kind: kind === 'unsupported' ? 'outside' : kind, heading: block, blocks: [] })
    else regions.at(-1)!.blocks.push(block)
  }
  return regions
}

/** Letter-bearing tokens: "People Development | L&D" is three words. */
const wordCount = (text: string) => text.split(/\s+/).filter((token) => /\p{L}/u.test(token)).length

/**
 * A `City, Country` piece between the separators of a contact row. A flattened
 * row can glue a headline's last words onto the city ("Bilingual Facilitator
 * Bandung, Indonesia"), so the city is at most two words.
 */
const contactRowLocation = (piece: string): RegExpMatchArray | undefined =>
  [...piece.matchAll(/[^|\n•·]+/g)].find((part) => {
    const text = trimPiece(part[0])
    return isLocation(text) && wordCount(text.split(',')[0]!) <= 2
  })

const ENTRY_KINDS = ['experience', 'education', 'projects', 'awards', 'certifications', 'references'] as const
type EntryKind = (typeof ENTRY_KINDS)[number]

/**
 * A course row with its own date: "Title - Issuer | Jun 2025". A year after a
 * comma or dash ("…, 2024") ends many description lines too, so that form
 * counts only when the title reads as a certificate.
 */
const datedRow = (block: SourceBlock) => {
  if (isBullet(block)) return false
  const row = splitTitleIssuer(block.text)
  return !!row?.date && (/\|\s*$/.test(block.text.slice(0, row.date.from)) || isCertificate(row.title))
}

/**
 * Splits a section into entries. A block starts an entry when the layout calls
 * it a heading, or when it is a plain line directly before a date-only line and
 * the current entry already has content (a date or a bullet), so a title
 * followed by a location and then its dates stays one entry. In courses, a row
 * carrying its own date starts one too. Blocks before the first entry are
 * returned separately; null means no boundary was found.
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
    const courseRow = kind === 'certifications' && datedRow(block)
    if ((!isDateLine(block) && isHeaderLabel(block)) || inlineEntry || courseRow || (titleBeforeDate && (!starts.length || content))) {
      starts.push(i)
      content = false
    }
    if (isDateLine(block) || isBullet(block) || courseRow) content = true
  })
  if (!starts.length) return null
  return {
    lead: blocks.slice(0, starts[0]),
    entries: starts.map((start, i) => blocks.slice(start, starts[i + 1] ?? blocks.length)),
  }
}

/**
 * A company row whose roles follow as their own entries. Its tenure is copied
 * to a role only when the row carries exactly one date and exactly one role
 * follows, since several roles would each need their own period.
 */
interface Employer {
  block: SourceBlock
  company: string
  location: string
  date?: SourceBlock | undefined
}

/**
 * An entry of a section, or an employer row (`employer`). `of` points at the
 * employer unit an entry may share; `role` marks an entry whose title the
 * typography reads as a role (an h4 under a company h3).
 */
interface Unit {
  blocks: SourceBlock[]
  employer?: boolean
  of?: number | undefined
  role?: boolean
}

/** A row's text without a date range that ends it, and that date. */
const headOf = (block: SourceBlock): { text: string; date: FoundRange | null } => {
  const date = findDateRange(block.text)
  if (date && date.from > 0 && !/[\p{L}\p{N}]/u.test(block.text.slice(date.to))) return { text: trimPiece(block.text.slice(0, date.from)), date }
  return { text: block.text.trim(), date: null }
}

/** A title the rules path reads as a role that may share an employer. */
const sharesEmployer = (unit: Unit) => {
  if (unit.role) return true
  const text = headOf(unit.blocks[0]!).text
  return !splitRoleCompany(text) && isRoleTitle(text)
}

/**
 * Links entries to employer rows. A unit is an employer when typography puts
 * a role under it, or when it is a heading (`headed`) that is not itself a
 * role and the next title is one; later entries share it until an entry names
 * its own company ("Role at Company"). An employer of typography roles is
 * shared by those roles only.
 */
const linkEmployers = (units: Unit[], kind: EntryKind, headed: (unit: Unit) => boolean): Unit[] => {
  if (kind !== 'experience') return units
  let current: number | undefined
  // An employer that typography puts roles under owns only those roles: its
  // scope ends at the next h3 (or the region's end, at the next h2).
  let scoped = false
  units.forEach((unit, index) => {
    if (unit.role) {
      unit.of = current
      return
    }
    if (scoped) current = undefined
    scoped = false
    const title = unit.blocks[0]!
    const text = headOf(title).text
    const next = units[index + 1]
    if (next && (next.role || (headed(unit) && !isRoleTitle(text) && !splitRoleCompany(text) && isRoleTitle(next.blocks[0]!.text)))) {
      unit.employer = true
      current = index
      scoped = !!next.role
      return
    }
    unit.of = current
    if (splitRoleCompany(title.text)) current = undefined
  })
  return units
}

/** Rules-path employer rows: a heading-labelled title, or a title followed only by date lines. */
const rulesUnits = (entries: SourceBlock[][], kind: EntryKind): Unit[] =>
  linkEmployers(entries.map((blocks) => ({ blocks })), kind, ({ blocks }) => isHeaderLabel(blocks[0]!) || blocks.slice(1).every(isDateLine))

/**
 * A short standalone line: the outline's h4 is every line of its class under
 * an h3, so a paragraph that happens to share the class must not start a role.
 */
const roleLine = (block: SourceBlock) => {
  const text = block.text.trim()
  return !isBullet(block) && !isDateLine(block) && wordCount(text) <= 8 && !/[.!?:;]$/.test(text) && !isLocation(text)
}

/**
 * Typography entries: each h3 starts an entry; in experience, each h4 under an
 * h3 starts a role entry that shares that h3 as employer. An h3 company row
 * followed by role h3s keeps the rules path's shared-employer reading.
 */
const outlineUnits = (blocks: SourceBlock[], kind: EntryKind, roleOf: Map<SourceBlock, OutlineRole>): { lead: SourceBlock[]; units: Unit[] } => {
  const lead: SourceBlock[] = []
  const units: Unit[] = []
  for (const block of blocks) {
    const role = roleOf.get(block)
    if (role === 'h3') units.push({ blocks: [block] })
    else if (!units.length) lead.push(block)
    else if (kind === 'experience' && role === 'h4' && roleLine(block)) units.push({ blocks: [block], role: true })
    else units.at(-1)!.blocks.push(block)
  }
  // Lines before the first entry heading that the rules path reads wholly as
  // entries (a first course row set in another font, then its date line) are
  // entries too; otherwise they stay the unplaced lead.
  const early = lead.length ? splitEntries(kind === 'education' ? splitEducationRows(lead) : lead, kind) : null
  if (early && !early.lead.length) return { lead: [], units: linkEmployers([...early.entries.map((blocks) => ({ blocks })), ...units], kind, () => true) }
  return { lead, units: linkEmployers(units, kind, () => true) }
}

/** Where a dated "Title - Issuer | <date>" row ends inside a longer line, or null. */
const rowEnd = (text: string): number | null => {
  for (const space of text.matchAll(/\s+/g)) {
    const head = text.slice(0, space.index)
    const row = splitTitleIssuer(head)
    if (row?.date && /\|\s*$/.test(head.slice(0, row.date.from)) && /[\p{L}\p{N}]/u.test(text.slice(space.index))) return space.index
  }
  return null
}

/**
 * A course row that runs on into more text (Docling merged it with the lines
 * below) ends at its date, and the rest is the entry's next line. When the rest
 * holds another dated row, where one description ends and the next title
 * begins is not in the text, so the rest stays unplaced.
 */
const courseRows = (blocks: SourceBlock[], roleOf: Map<SourceBlock, OutlineRole>, warnings: MapWarning[]): SourceBlock[] =>
  blocks.flatMap((block) => {
    const end = isBullet(block) ? null : rowEnd(block.text)
    if (end === null) return [block]
    const start = end + /^\s*/.exec(block.text.slice(end))![0].length
    const row = sliceSegment(block, 0, end)
    const rest = sliceSegment(block, start, block.text.length)
    const role = roleOf.get(block)
    if (role) roleOf.set(row, role)
    roleOf.set(rest, 'body')
    if (rowEnd(rest.text) === null && !datedRow(rest)) return [row, rest]
    warnings.push({ code: 'ambiguous_entries', blocks: [...new Set(partsOf(rest).map((part) => part.block.id))] })
    return [row]
  })

/**
 * References: a name line starts an entry, and `lines(i)` says how many of the
 * following lines belong to it. The first of them, up to its first contact
 * and that contact's label ("Phone:"), is the position; the first phone and email in any of them fill those
 * fields; another line without contacts is the note. A line outside an entry
 * becomes a note entry, unless it holds contacts: then it stays unplaced.
 */
const mapReferences = (blocks: SourceBlock[], lines: (index: number) => number | null, document: ResumeDocument, locale: Locale, usage: Usage, ref: Ref) => {
  const module = getSectionModule('references')
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const item = module.emptyItem() as ReferenceItem
    const text = item.text[locale]
    const path = (field: string) => `references.${item.id}.${field}`
    const count = lines(i)
    if (count !== null) {
      text.name = block.text.trim()
      usage.take(block)
      ref(path('name'), block)
      const notes: string[] = []
      blocks.slice(i + 1, i + 1 + count).forEach((line, index) => {
        const contacts = findContacts(line.text)
        for (const field of ['phone', 'email'] as const) {
          const found = contacts.find((contact) => contact.field === field)
          if (!found || item[field]) continue
          item[field] = found.value
          const label = CONTACT_LABEL.exec(line.text.slice(0, found.from))
          usage.take(line, label ? label.index : found.from, found.to)
          ref(path(field), line)
        }
        // A contact's label ("Phone:") is never the position.
        const before = line.text.slice(0, contacts[0]?.from ?? line.text.length)
        const end = contacts.length ? CONTACT_LABEL.exec(before)?.index ?? before.length : before.length
        const lead = trimPiece(stripBullet(line.text.slice(0, end)).text)
        if (!/[\p{L}\p{N}]/u.test(lead)) return
        if (index === 0) {
          text.position = lead
          usage.take(line, 0, end)
          ref(path('position'), line)
        } else if (!contacts.length) {
          notes.push(lead)
          usage.take(line)
          ref(path('note'), line)
        }
      })
      if (notes.length) text.note = notes.join('\n')
      i += count
    } else {
      const note = stripBullet(block.text).text.trim()
      if (!note || findContacts(block.text).length) continue
      text.note = note
      usage.take(block)
      ref(path('note'), block)
    }
    document.content.references.push(item)
  }
}

// Mapper -----------------------------------------------------------------------

export const mapExtraction = (extraction: Extraction, locale: Locale): Proposal => {
  const document = emptyDocument()
  const usage = new Usage()
  const refs: FieldRef[] = []
  const warnings: MapWarning[] = []
  const outline = buildOutline(associateDateRows(joinListContinuations(joinSourceLines(extraction.blocks))))
  const regions = regionsOf(outline)
  // List items never fill header fields.
  const lists = new Set(outline.nodes.filter((node) => node.role === 'list').map((node) => node.block))
  const roleOf = new Map(outline.nodes.map((node) => [node.block, node.role]))

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
      const label = CONTACT_LABEL.exec(block.text.slice(0, found.from))
      if (label) usage.take(block, label.index, found.from)
      ref(`contact.${found.field}`, block)
    }
  }

  const profile = document.profile.text[locale]
  const header = regions[0]!.blocks
  for (const block of header) if (isDocumentTitle(block.text)) usage.take(block)
  const outlineName = outline.confidence === 'typography' ? outline.nodes.find((node) => node.role === 'name')?.block : undefined
  const nameBlock = (outlineName && header.includes(outlineName) && !usage.used(outlineName) ? outlineName : undefined) ??
    header.find((block) => isHeaderLabel(block) && !usage.used(block) && isNameLike(block.text.trim()))
  if (nameBlock) {
    profile.name = nameBlock.text.trim()
    usage.take(nameBlock)
    ref('profile.name', nameBlock)
  } else {
    warnings.push({ code: 'no_name', blocks: [] })
  }
  const afterName = (nameBlock ? header.slice(header.indexOf(nameBlock) + 1) : []).filter((block) => !isHeaderLabel(block) && !lists.has(block))
  // The contact row's location comes before any other "A, B" line.
  for (const block of afterName) {
    if (profile.location || !findContacts(block.text).length) continue
    for (const [piece, offset] of usage.pieces(block)) {
      const part = contactRowLocation(piece)
      if (!part) continue
      profile.location = trimPiece(part[0])
      usage.take(block, offset + part.index!, offset + part.index! + part[0].length)
      ref('profile.location', block)
      break
    }
  }
  for (const block of afterName) {
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
        let field: 'location' | 'headline' | null = null
        if (!profile.location && isLocation(text)) field = 'location'
        else if (!profile.headline && !/[@\d]/.test(text) && (isRoleTitle(text) || (!usage.used(block) && text.length <= 80 && wordCount(text) <= 10))) field = 'headline'
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
      case 'outside':
        warnings.push({ code: 'outside_structure', blocks: [region.heading!.id] })
        break
      case 'skills':
        seen('skills')
        mapSkills(region.blocks, document, locale, usage, ref)
        break
      case 'mixed_awards':
        for (const block of region.blocks) {
          const kind = isAward(block.text) ? 'awards' : isCertificate(block.text) ? 'certifications' : null
          if (!kind) {
            warnings.push({ code: 'outside_structure', blocks: [block.id] })
            continue
          }
          seen(kind)
          mapEntry(kind, [block], document, locale, usage, ref, warnings)
        }
        break
      case 'references': {
        seen('references')
        const blocks = region.blocks
        const headed = outline.confidence === 'typography' && blocks.some((block) => roleOf.get(block) === 'h3')
        const contact = (i: number) => i < blocks.length && findContacts(blocks[i]!.text).length > 0
        // Typography: every line up to the next h3. Rules path: a name-like line
        // followed by a contact line, or by a position line and then one, and
        // any contact lines directly after.
        const lines = (i: number): number | null => {
          const block = blocks[i]!
          if (headed) {
            if (roleOf.get(block) !== 'h3') return null
            const next = blocks.findIndex((other, j) => j > i && roleOf.get(other) === 'h3')
            return (next < 0 ? blocks.length : next) - i - 1
          }
          if (isBullet(block) || !isNameLike(block.text.trim())) return null
          let count = contact(i + 1) ? 1 : i + 2 < blocks.length && !isBullet(blocks[i + 1]!) && contact(i + 2) && lines(i + 1) === null ? 2 : 0
          if (!count) return null
          // Further contact lines ("Email: …" under "Phone: …") belong to it too.
          while (contact(i + count + 1)) count++
          return count
        }
        mapReferences(blocks, lines, document, locale, usage, ref)
        break
      }
      case 'experience':
      case 'education':
      case 'projects':
      case 'awards':
      case 'certifications': {
        seen(region.kind)
        const kind: ListEntryKind = region.kind
        const blocks = kind === 'certifications' ? courseRows(region.blocks, roleOf, warnings) : region.blocks
        let split: { lead: SourceBlock[]; units: Unit[] }
        // Typography decides per region: entry headings split it only where they exist.
        if (outline.confidence === 'typography' && blocks.some((block) => roleOf.get(block) === 'h3')) {
          split = outlineUnits(blocks, kind, roleOf)
        } else {
          const rules = splitEntries(kind === 'education' ? splitEducationRows(blocks) : blocks, kind)
          if (!rules) {
            if (kind === 'awards' || kind === 'certifications') {
              for (const block of blocks) mapEntry(kind, [block], document, locale, usage, ref, warnings)
            } else if (blocks.length) {
              warnings.push({ code: 'ambiguous_entries', blocks: blocks.map((b) => b.id) })
            }
            break
          }
          split = { lead: rules.lead, units: rulesUnits(rules.entries, kind) }
        }
        if (split.lead.length) warnings.push({ code: 'ambiguous_entries', blocks: split.lead.map((b) => b.id) })
        const employers = new Map<number, Employer>()
        split.units.forEach((unit, index) => {
          if (unit.employer) {
            const [title, ...rest] = unit.blocks as [SourceBlock, ...SourceBlock[]]
            const head = headOf(title)
            usage.take(title, 0, head.date ? head.date.from : title.text.length)
            const dates = [...(head.date ? [title] : []), ...rest.filter(isDateLine)]
            const roles = split.units.filter((other) => other.of === index && sharesEmployer(other)).length
            const { head: company, location } = splitTrailingLocation(head.text) ?? { head: head.text, location: '' }
            employers.set(index, { block: title, company, location, date: dates.length === 1 && roles === 1 ? dates[0] : undefined })
            return
          }
          mapEntry(kind, unit.blocks, document, locale, usage, ref, warnings, unit.of === undefined ? undefined : employers.get(unit.of), unit.role)
        })
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

/** Entry kinds mapped field by field; references have their own reader. */
type ListEntryKind = Exclude<EntryKind, 'references'>

const mapEntry = (
  kind: ListEntryKind,
  blocks: SourceBlock[],
  document: ResumeDocument,
  locale: Locale,
  usage: Usage,
  ref: Ref,
  warnings: MapWarning[],
  employer?: Employer,
  asRole = false,
) => {
  const item = getSectionModule(kind).emptyItem() as ExperienceItem & EducationItem & ProjectItem & AwardItem
  const text = item.text[locale] as unknown as Record<string, string | string[]>
  const path = (field: string) => `${kind}.${item.id}.${field}`
  let dated = false

  const [title, ...rest] = blocks as [SourceBlock, ...SourceBlock[]]
  // A course's date is on its row or a date line under it, and a date line
  // wins over the row's inline date; a year in its description is not its date.
  const courseDate = kind === 'certifications'
    ? (block: SourceBlock) => rest.some(isDateLine) ? isDateLine(block) : block === title || isDateLine(block)
    : () => true
  const dateCandidates = blocks.filter(b => !isBullet(b) && courseDate(b)).flatMap(block => {
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
    if (kind === 'awards' || kind === 'certifications') {
      item.date = found.start
      ref(path('date'), block)
    } else {
      item.dates = dateRangeOf(found)
      ref(path('dates'), block)
    }
  }

  if (courseDate(title)) takeDates(title)
  const titleDated = dated
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
    const split = asRole ? null : splitRoleCompany(titleText)
    if (split) {
      item.company = split.company
      text.role = split.role
      if (ambiguous) usage.take(title, 0, titleLimit)
      else usage.takeRest(title)
      ref(path('company'), title)
      ref(path('role'), title)
    } else if (asRole ? titleText : isRoleTitle(titleText)) {
      text.role = titleText
      if (ambiguous) usage.take(title, 0, titleLimit)
      else usage.takeRest(title)
      ref(path('role'), title)
      if (employer) {
        item.company = employer.company
        ref(path('company'), employer.block)
        if (employer.location) {
          text.location = employer.location
          ref(path('location'), employer.block)
        }
        // The employer's tenure, only for a role with no date of its own.
        const tenure = !dateCandidates.length && employer.date ? findDateRange(employer.date.text) : null
        if (tenure) {
          dated = true
          usage.take(employer.date!, tenure.from, tenure.to)
          item.dates = dateRangeOf(tenure)
          ref(path('dates'), employer.date!)
        }
      }
    } else if (titleText) {
      warnings.push({ code: 'ambiguous_title', blocks: [title.id] })
    }
  } else if (titleText) {
    const field = { education: 'school', projects: 'name', awards: 'title', certifications: 'title' }[kind]
    const metadata = kind === 'projects' ? projectMetadata(titleText) : null
    // The title without its date, or else the whole row, whose date may be what
    // separates "Title, Issuer, 2024".
    const row = stripBullet(title.text)
    const whole = kind === 'certifications' ? splitTitleIssuer(row.text) : null
    const course = kind === 'certifications' ? splitTitleIssuer(titleText) ?? whole : null
    // An inline date that is not the entry's stays unplaced.
    const keptDate = course && !titleDated && whole?.date ? row.from + whole.date.from : null
    // "School - City, Country" names the place, not a qualification: kept whole.
    const schoolSplit = kind === 'education' ? /^(.+?)\s+[–—-]\s+(.+)$/.exec(titleText) : null
    const school = schoolSplit && !isLocation(schoolSplit[2]!.trim()) ? schoolSplit : null
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
    } else if (course) {
      text.title = course.title
      if (course.issuer) {
        text.issuer = course.issuer
        ref(path('issuer'), title)
      }
    } else text[field] = titleText
    if (keptDate !== null) usage.take(title, 0, keptDate)
    else if (ambiguous) usage.take(title, 0, titleLimit)
    else usage.takeRest(title)
    ref(path(field), title)
  }

  const description: string[] = inlineDescription ? [inlineDescription] : []
  if (inlineDescription) ref(path('description'), title)
  for (const block of rest) {
    // A year inside an achievement ("…by 30% in 2019") is not the entry's period.
    if (!isBullet(block) && courseDate(block)) takeDates(block)
    if (usage.rest(block) === '') continue
    if (ambiguous && dateCandidates.some(c => c.block === block)) continue

    if (isBullet(block) && kind !== 'education' && kind !== 'awards' && kind !== 'certifications') {
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
