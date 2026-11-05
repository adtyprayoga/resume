import { beforeEach, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { readFileSync } from 'node:fs'
import ResumePaper from '../preview/ResumePaper.svelte'
import { resolve } from '$lib/model/resolve'
import { editing } from '$lib/state/editing.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { storyHighlights } from '$lib/state/storyHighlights.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  editing.reset()
  resumeDoc.load(sampleDocument())
  storyHighlights.reset()
  prefs.documentLocale = 'en'
})

it('marks the whole summary in Preview and the existing target in Edit', async () => {
  const summary = resumeDoc.current.profile.text.en.summary
  storyHighlights.add([{ ref: { owner: 'profile', key: 'summary' }, locale: 'en', value: summary }])
  const { container } = render(ResumePaper, { resume: resolve(resumeDoc.current, 'en'), locale: 'en' })
  const previewMark = container.querySelector('.resume-summary .story-mark')
  expect(previewMark?.textContent).toBe(summary)
  expect(previewMark?.tagName).toBe('SPAN')
  editing.enter()
  await tick()
  const editMark = container.querySelector('.resume-summary .story-mark')
  expect(editMark?.textContent).toBe(summary)
  expect(editMark?.classList.contains('editable')).toBe(true)
})

it('marks only the bullets the storyteller added, not the person\'s own', () => {
  const item = resumeDoc.current.content.experience[0]!
  const added = item.text.en.bullets.at(-1)!
  storyHighlights.add([{
    ref: { owner: 'item', section: 'experience', id: item.id, key: 'bullets' },
    locale: 'en',
    value: item.text.en.bullets.join('\n'),
    lines: [added],
  }])
  const { container } = render(ResumePaper, { resume: resolve(resumeDoc.current, 'en'), locale: 'en' })
  const marks = container.querySelectorAll('.item-bullets .story-mark')
  expect([...marks].map((mark) => mark.textContent)).toEqual([added])
  expect(storyHighlights.count).toBe(1)
})

it('marks nothing for a list write that added no lines (a reorder)', () => {
  const item = resumeDoc.current.content.experience[0]!
  storyHighlights.add([{
    ref: { owner: 'item', section: 'experience', id: item.id, key: 'bullets' },
    locale: 'en',
    value: item.text.en.bullets.join('\n'),
    lines: [],
  }])
  const { container } = render(ResumePaper, { resume: resolve(resumeDoc.current, 'en'), locale: 'en' })
  expect(container.querySelectorAll('.item-bullets .story-mark')).toHaveLength(0)
  expect(storyHighlights.count).toBe(0)
})

it('removes highlight background in print CSS', () => {
  const css = readFileSync('src/styles/print.css', 'utf8')
  expect(css).toMatch(/@media print\s*\{[\s\S]*?\.story-mark\s*\{\s*background:\s*none/)
})
