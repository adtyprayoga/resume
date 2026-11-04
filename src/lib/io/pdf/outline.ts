import { findContacts, findDateRanges, isDocumentTitle, isHeadingLabel, isNameLike, isRoleTitle, matchHeading, sectionHeading, stripBullet, type HeadingKind } from './rules'
import { dateOnly, type SourceSegment } from './segments'

/**
 * The document's outline, read from typography. Bold/italic metadata is
 * unreliable in real PDFs, so a style class is only (font id, size): the
 * heading class is learned from lines that carry a known heading wording, and
 * entry headings (h3) and their second lines (h4) from classes near body size.
 * When no heading class can be established, or a block has no style, roles
 * come from the same signals the rules path uses, so a fallback outline opens
 * sections exactly where the mapper's regions do.
 */

export type OutlineRole = 'name' | 'h2' | 'h3' | 'h4' | 'body' | 'list'

export interface OutlineNode {
  role: OutlineRole
  block: SourceSegment
}

export interface Outline {
  confidence: 'typography' | 'fallback'
  nodes: OutlineNode[]
}

/** Headings are short: a line with more letter tokens is prose, whatever its style. */
const MAX_HEADING_WORDS = 8
/**
 * Entry headings (h3) name a school, employer or course, often with its city
 * and country ("Sea College of … (CSCTL) - Lae, Papua New Guinea"), so they
 * may run longer; a wrapped paragraph in an entry style still exceeds this.
 */
const MAX_ENTRY_WORDS = 16
/** Entry headings (h3/h4) stay within this fraction of the body size. */
const NEAR_BODY = 0.15
/** Sections whose content is a list of entries, where an entry heading style is learned. */
const ENTRY_SECTIONS = new Set<HeadingKind>(['experience', 'education', 'projects', 'awards', 'mixed_awards', 'certifications', 'references'])

const classOf = (block: SourceSegment): string | null => (block.style ? `${block.style.font}@${block.style.size}` : null)
const letters = (text: string) => text.match(/\p{L}/gu)?.length ?? 0
const isBullet = (block: SourceSegment) => block.label === 'list_item' || stripBullet(block.text).from > 0
/** A heading-labelled line behind a decorative glyph ("■ EXPERIENCE"): its wording, not the glyph, decides its role. */
const decorated = (block: SourceSegment) => isHeadingLabel(block.label) && stripBullet(block.text).from > 0
const bare = (block: SourceSegment): SourceSegment => (decorated(block) ? { ...block, text: stripBullet(block.text).text } : block)

/** Not a list item, at most `maxWords` letter tokens, and no date range except one that ends the line. */
const shortStandalone = (block: SourceSegment, maxWords = MAX_HEADING_WORDS) => {
  if (isBullet(block)) return false
  if (block.text.split(/\s+/).filter((token) => /\p{L}/u.test(token)).length > maxWords) return false
  const ranges = findDateRanges(block.text)
  return ranges.length === 0 || (ranges.length === 1 && !/[\p{L}\p{N}]/u.test(block.text.slice(ranges[0]!.to)))
}
/** A line that may carry a heading role; a line that is only a date never does. */
const headingLike = (block: SourceSegment, maxWords = MAX_HEADING_WORDS) => shortStandalone(block, maxWords) && !dateOnly(block)

const nameLike = (block: SourceSegment) => {
  const text = block.text.trim()
  return !isBullet(block) && isNameLike(text) && !isDocumentTitle(text) && !isRoleTitle(text) && findContacts(text).length === 0
}

/** The key with the highest total weight; the first seen wins a tie. */
const top = (votes: [string, number][]): string | null => {
  const totals = new Map<string, number>()
  for (const [key, weight] of votes) totals.set(key, (totals.get(key) ?? 0) + weight)
  let best: string | null = null
  for (const [key, total] of totals) if (best === null || total > totals.get(best)!) best = key
  return best
}

/** Today's signals: where the rules path opens a region, bullets, and everything else as body. */
const fallbackRole = (block: SourceSegment): OutlineRole =>
  sectionHeading(block.text, block.label) ? 'h2' : isBullet(block) ? 'list' : 'body'

const fallbackOutline = (blocks: SourceSegment[]): Outline => {
  const roles = blocks.map(fallbackRole)
  const firstH2 = roles.indexOf('h2')
  const name = blocks.findIndex((block, i) => (firstH2 < 0 || i < firstH2) && roles[i] === 'body' && nameLike(block))
  if (name >= 0) roles[name] = 'name'
  return { confidence: 'fallback', nodes: blocks.map((block, i) => ({ role: roles[i]!, block })) }
}

/** Known headings vote for the heading class; without any, a non-body class of repeated short lines, largest first. */
const headingClass = (styled: SourceSegment[], body: string): string | null => {
  const known = styled.filter((block) => {
    const kind = matchHeading(block.text)
    return kind !== null && (kind !== 'unsupported' || isHeadingLabel(block.label)) && headingLike(bare(block))
  })
  if (known.length) return top(known.map((block) => [classOf(block)!, 1]))
  const members = new Map<string, SourceSegment[]>()
  for (const block of styled) members.set(classOf(block)!, [...(members.get(classOf(block)!) ?? []), block])
  let best: SourceSegment[] | null = null
  for (const [key, group] of members) {
    if (key === body || group.length < 2 || !group.every((block) => headingLike(block))) continue
    if (!best || group[0]!.style!.size > best[0]!.style!.size) best = group
  }
  return best ? classOf(best[0]!) : null
}

export const buildOutline = (blocks: SourceSegment[]): Outline => {
  const styled = blocks.filter((block) => block.style)
  const body = top(styled.map((block) => [classOf(block)!, letters(block.text)]))
  const h2 = body === null ? null : headingClass(styled, body)
  if (body === null || h2 === null || h2 === body) return fallbackOutline(blocks)
  const bodySize = styled.find((block) => classOf(block) === body)!.style!.size
  const near = (block: SourceSegment) => Math.abs(block.style!.size - bodySize) <= NEAR_BODY * bodySize

  const roles: OutlineRole[] = blocks.map((block) => {
    if (!block.style) return fallbackRole(block)
    if (decorated(block)) return classOf(block) === h2 && matchHeading(block.text) !== null && headingLike(bare(block)) ? 'h2' : 'list'
    if (isBullet(block)) return 'list'
    return classOf(block) === h2 && headingLike(block) ? 'h2' : 'body'
  })
  const firstH2 = roles.indexOf('h2')

  // Name: the first block of page 1 above the first heading, if it reads as a name.
  const first = blocks.findIndex((block, i) => (firstH2 < 0 || i < firstH2) && !isDocumentTitle(block.text))
  if (first >= 0 && blocks[first]!.page === 1 && roles[first] === 'body' && nameLike(blocks[first]!)) roles[first] = 'name'

  // A short line in a non-body, non-heading class inside a section may head an
  // entry. Past the h2 limit, a line ending in sentence punctuation reads as a
  // highlight sentence set in the entry style, not as a heading.
  const entryLine = (i: number) => {
    const block = blocks[i]!
    const key = classOf(block)
    if (!(firstH2 >= 0 && i > firstH2 && roles[i] === 'body' && key !== null && key !== body && key !== h2 && headingLike(block, MAX_ENTRY_WORDS))) return false
    return headingLike(block) || !/[.!?]$/.test(block.text.trim())
  }
  const previousLine = (i: number) => {
    let j = i - 1
    while (j >= 0 && dateOnly(blocks[j]!)) j--
    return j
  }
  const nextLine = (i: number) => {
    let j = i + 1
    while (j < blocks.length && dateOnly(blocks[j]!)) j++
    return j
  }

  // Only lines in sections made of entries vote: a sidebar's contact lines or
  // one-per-line skills share a short, body-like style that is not an entry's.
  let section: HeadingKind | null = null
  const inEntries = roles.map((role, i) => {
    if (role === 'h2') section = matchHeading(blocks[i]!.text)
    return section !== null && ENTRY_SECTIONS.has(section)
  })

  // H3: the class that most often begins an entry. A line directly under
  // another entry line (dates aside) is that entry's second line, so it does
  // not vote; otherwise a company with several roles would elect the role style.
  const h3 = top(blocks.flatMap((block, i): [string, number][] => {
    const previous = previousLine(i)
    return inEntries[i] && entryLine(i) && near(block) && !(previous >= 0 && entryLine(previous)) ? [[classOf(block)!, 1]] : []
  }))
  blocks.forEach((block, i) => { if (h3 !== null && entryLine(i) && classOf(block) === h3) roles[i] = 'h3' })

  // H4: the class most often held by the first non-date line after an h3. Every
  // block in it within an h3's entry is h4, so a second role after the first
  // role's bullets is still h4.
  const h4Candidate = (i: number) => {
    const block = blocks[i]
    const key = block && classOf(block)
    return !!key && roles[i] === 'body' && key !== body && key !== h2 && key !== h3 && near(block) && !dateOnly(block)
  }
  const h4 = top(roles.flatMap((role, i): [string, number][] => {
    const next = nextLine(i)
    return role === 'h3' && h4Candidate(next) ? [[classOf(blocks[next]!)!, 1]] : []
  }))
  let inEntry = false
  roles.forEach((role, i) => {
    if (role === 'h2') inEntry = false
    else if (role === 'h3') inEntry = true
    else if (inEntry && h4 !== null && h4Candidate(i) && classOf(blocks[i]!) === h4) roles[i] = 'h4'
  })

  return { confidence: 'typography', nodes: blocks.map((block, i) => ({ role: roles[i]!, block })) }
}
