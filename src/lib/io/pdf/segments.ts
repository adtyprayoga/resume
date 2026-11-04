import { findDateRange, findDateRanges, isRoleTitle, matchHeading } from './rules'
import type { SourceBlock } from './types'

export interface SourceSegment extends SourceBlock {
  parts?: { block: SourceBlock; from: number; to: number; at: number }[]
}

export const partsOf = (block: SourceSegment) => block.parts ?? [{ block, from: 0, to: block.text.length, at: 0 }]

export const joinSourceLines = (blocks: SourceBlock[]): SourceSegment[] => {
  const result: SourceSegment[] = []
  for (const block of blocks) {
    const previous = result.at(-1)
    const compatible = previous && previous.group && previous.group === block.group && previous.page === block.page &&
      previous.label === block.label && !['list_item', 'table'].includes(block.label) &&
      !dateOnly(previous) && !dateOnly(block) && !matchHeading(block.text) &&
      (!previous.bbox || !block.bbox || Math.abs(previous.bbox.l - block.bbox.l) <= 12)
    const continuation = previous && (
      previous.label === 'section_header' ||
      ((previous.text.match(/\(/g)?.length ?? 0) > (previous.text.match(/\)/g)?.length ?? 0)) ||
      /[,\-]$/.test(previous.text) || /^[\p{Ll}]/u.test(block.text))
    if (!compatible || !continuation || /^[^:]{1,40}:/.test(block.text)) { result.push(block); continue }
    const at = previous.text.length + 1
    result[result.length - 1] = {
      ...previous,
      text: `${previous.text} ${block.text}`,
      parts: [...partsOf(previous), { block, from: 0, to: block.text.length, at }],
    }
  }
  return result
}

/** Some native parsers combine successive inline school rows into one item. */
export const splitEducationRows = (blocks: SourceBlock[]): SourceSegment[] => blocks.flatMap(block => {
  const dates = findDateRanges(block.text)
  if (dates.length < 2) return [block]
  const starts = [0, ...dates.slice(0, -1).map(date => date.to)]
  const rows = starts.map((from, i) => ({ from, to: i === dates.length - 1 ? block.text.length : dates[i]!.to }))
  if (!rows.every(({ from, to }) => /\s[–—-]\s/.test(block.text.slice(from, to)) &&
    /\b(universit\p{L}*|institut\p{L}*|school|college|sekolah|smk|sma)\b/iu.test(block.text.slice(from, to)))) return [block]
  return rows.map(({ from, to }) => ({
    ...block,
    parts: partsOf(block).flatMap(part => {
      const start = Math.max(from, part.at)
      const end = Math.min(to, part.at + part.to - part.from)
      return start < end ? [{ block: part.block, from: part.from + start - part.at, to: part.from + end - part.at, at: start - from }] : []
    }),
    text: block.text.slice(from, to),
  }))
})

export const sameRow = (a: SourceBlock, b: SourceBlock): boolean => {
  if (a.page !== b.page || !a.bbox || !b.bbox) return false
  return Math.min(a.bbox.b, b.bbox.b) > Math.max(a.bbox.t, b.bbox.t)
}

export const dateOnly = (block: SourceBlock): boolean => {
  const date = findDateRange(block.text)
  return date !== null && !/[\p{L}\p{N}]/u.test(block.text.slice(0, date.from) + block.text.slice(date.to))
}

/** Associate only unambiguous visual rows; retain reading order everywhere else. */
export const associateDateRows = (blocks: SourceBlock[]): SourceBlock[] => {
  const attached = new Map<SourceBlock, SourceBlock[]>()
  const moved = new Set<SourceBlock>()
  for (const date of blocks.filter(dateOnly)) {
    const candidates = blocks.filter(b => b !== date && !dateOnly(b) && b.label !== 'list_item' &&
      (b.label === 'section_header' || b.label === 'title' || isRoleTitle(b.text)) &&
      !matchHeading(b.text) && sameRow(b, date) && b.bbox!.r <= date.bbox!.l &&
      !blocks.some(h => h.page === date.page && h.bbox && matchHeading(h.text) &&
        h.bbox.l > b.bbox!.r && h.bbox.l <= date.bbox!.l && h.bbox.t < date.bbox!.t))
    if (candidates.length !== 1) continue
    const target = candidates[0]!
    attached.set(target, [...(attached.get(target) ?? []), date])
    moved.add(date)
  }
  return blocks.flatMap(b => moved.has(b) ? [] : [b, ...(attached.get(b) ?? [])])
}
