import type { Answers, Written } from '$lib/guidance/apply'
import type { Blank, StoryPage } from '$lib/guidance/story'

export function visible(page: StoryPage, id: string, answers: Answers): boolean {
  if (page.confirm?.reveals.includes(id) && answers[page.confirm.id] !== 'yes') return false
  const blank = page.blanks.find(b => b.id === id)
  return !blank?.when || answers[blank.when.choiceId] === blank.when.value
}

/** Count blank answers represented in changed fields, never confirms or reflective choices. */
export function wasWritten(page: StoryPage, blank: Blank, answers: Answers, written: Written[]): boolean {
  if (!answers[blank.id]?.trim() || !visible(page, blank.id, answers)) return false
  if (blank.input === 'month' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(answers[blank.id]!)) return false
  const slot = blank.id.split(':').at(-1)!
  if (page.chapter === 'summary') return written.some(w => w.ref.owner === 'profile' && w.ref.key === 'summary')
  if (page.chapter === 'headline') {
    const key = slot === 'secondary' || slot === 'differentiator' ? 'headline' : slot === 'city' ? 'location' : slot
    return written.some(w => w.ref.key === key && w.value !== '')
  }
  if (page.chapter === 'competencies') {
    if (blank.id.includes(':level:')) return written.some(w => w.ref.owner === 'item' && w.ref.id === blank.id.split(':')[2] && w.ref.key === 'items')
    return written.some(w => w.ref.owner === 'item' && w.ref.section === 'skills' && typeof w.value === 'string' &&
      (slot === 'hardField' ? w.ref.key === 'title' && w.value.includes(answers[blank.id]!.trim()) : w.ref.key === 'items' && answers[blank.id]!.split(',').some(v => v.trim() && w.value.toString().includes(v.trim()))))
  }
  const key = ['start', 'end'].includes(slot) ? 'dates' : ['achievement', 'with', 'goal'].includes(slot) ? 'bullets' : slot === 'topics' ? 'description' : slot
  const id = blank.id.slice(page.chapter.length + 1, blank.id.lastIndexOf(':'))
  return written.some(w => w.ref.owner === 'item' && (id === 'new' || w.ref.id === id) && w.ref.key === key && w.value !== '')
}
