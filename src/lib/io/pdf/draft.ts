import { validateDocument } from '$lib/model/document'
import { err, type Result } from '$lib/model/result'
import type { Locale, ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'
import type { Proposal } from './mapper'
import type { Extraction } from './types'

/**
 * Review state for a PDF proposal. It is a private copy: nothing here touches
 * `resumeDoc`, storage, or the suspended editing session until the user
 * confirms, and then only through the normal document validator.
 */

export interface ReviewDraft {
  locale: Locale
  document: ResumeDocument
  acknowledged: boolean
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const createReview = (proposal: Proposal): ReviewDraft => ({
  locale: proposal.locale,
  document: clone(proposal.document),
  acknowledged: false,
})

const blank = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).map(([key, v]) => [key, Array.isArray(v) ? [] : ''])) as T

/** The user says the PDF is in `to`: its text moves there; the other language stays blank. */
export const changeLocale = (draft: ReviewDraft, to: Locale): void => {
  const from = draft.locale
  if (from === to) return
  const nodes: Record<Locale, Record<string, unknown>>[] = [
    draft.document.profile.text as unknown as Record<Locale, Record<string, unknown>>,
    ...Object.values(draft.document.content).flatMap((items) =>
      (items as { text: Record<Locale, Record<string, unknown>> }[]).map((item) => item.text),
    ),
  ]
  for (const text of nodes) {
    text[to] = text[from]!
    text[from] = blank(text[to]!)
  }
  draft.locale = to
}

export const addEntry = (draft: ReviewDraft, kind: ListSectionKind): string => {
  const item = getSectionModule(kind).emptyItem() as { id: string }
  ;(draft.document.content[kind] as { id: string }[]).push(item)
  return item.id
}

export const removeEntry = (draft: ReviewDraft, kind: ListSectionKind, id: string): void => {
  const items = draft.document.content[kind] as { id: string }[]
  const index = items.findIndex((item) => item.id === id)
  if (index >= 0) items.splice(index, 1)
}

export const finalizeReview = (draft: ReviewDraft, unmatchedCount: number): Result<ResumeDocument> => {
  if (unmatchedCount > 0 && !draft.acknowledged) {
    return err('Confirm that you have checked the unplaced text first.', { messageKey: 'pdf.review.ackRequired' })
  }
  return validateDocument(clone(draft.document))
}

/** Text of the blocks behind every field whose path starts with `prefix`, in reading order. */
export const sourceLines = (proposal: Proposal, extraction: Extraction, prefix: string): string[] => {
  const ids = new Set(proposal.refs.filter((ref) => ref.path.startsWith(prefix)).flatMap((ref) => ref.blocks))
  return extraction.blocks.filter((block) => ids.has(block.id)).map((block) => block.text)
}

