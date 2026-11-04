import { afterEach, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'
import Preview from './Preview.svelte'
import { editing } from '$lib/state/editing.svelte'

afterEach(() => editing.reset())

it.each(['classic', 'ats'] as const)('keeps %s editing targets scoped to certifications', (presentation) => {
  editing.mode = 'edit'
  const { container } = render(Preview, {
    items: [{ id: 'crt_1', date: '2024-05', title: 'Cloud course', issuer: 'Cloud board', description: 'Practitioner' }],
    locale: 'en',
    presentation,
  })
  for (const key of ['title', 'date', 'issuer', 'description']) {
    expect(container.querySelector(`[data-edit-key="item.certifications.crt_1.${key}"]`)).not.toBeNull()
  }
  expect(container.querySelector('[data-edit-key^="item.awards."]')).toBeNull()
})
