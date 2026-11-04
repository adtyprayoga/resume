import { render, cleanup } from '@testing-library/svelte'
import { afterEach, expect, it } from 'vitest'
import Preview from './Preview.svelte'
import { editing } from '$lib/state/editing.svelte'

const item = { id: 'ref_1', name: 'Anggi Pratiwi', position: 'HR Manager at PT Contoh', phone: '+62 812', email: 'a@example.com', note: 'Available on request' }
afterEach(() => { cleanup(); editing.mode = 'preview' })
it('prints name, position, contacts and note in order', () => {
  const { container } = render(Preview, { items: [item], locale: 'en' })
  expect(container.querySelector('h3')?.textContent).toBe(item.name)
  expect(container.querySelector('.item-meta')?.textContent).toBe('HR Manager at PT Contoh - +62 812 | a@example.com')
  expect(container.querySelector('.item-desc')?.textContent).toBe(item.note)
})
it.each([
  [{ ...item, phone: '', email: '' }, 'HR Manager at PT Contoh'],
  [{ ...item, position: '' }, '+62 812 | a@example.com'],
  [{ ...item, position: '', email: '' }, '+62 812'],
])('joins only present parts', (entry, expected) => {
  const { container } = render(Preview, { items: [entry], locale: 'en' })
  expect(container.querySelector('.item-meta')?.textContent).toBe(expected)
})
it('renders a note-only reference without empty heading', () => {
  const { container } = render(Preview, { items: [{ ...item, name: '', position: '', phone: '', email: '' }], locale: 'en' })
  expect(container.querySelector('h3')).toBeNull()
  expect(container.querySelector('.item-meta')).toBeNull()
  expect(container.querySelector('.item-desc')?.textContent).toBe(item.note)
})
it('keeps ATS fields in reading order', () => {
  const { container } = render(Preview, { items: [item], locale: 'en', presentation: 'ats' })
  expect([...container.querySelectorAll('p')].map(el => el.textContent)).toEqual([item.name, item.position, item.phone, item.email, item.note])
})
it.each(['classic', 'ats'] as const)('allows all fields on note-only entries to be edited in %s', (presentation) => {
  editing.mode = 'edit'
  const { container } = render(Preview, { items: [{ ...item, name: '', position: '', phone: '', email: '' }], locale: 'en', presentation })
  expect(container.querySelectorAll('[data-print-hide]')).not.toHaveLength(0)
  expect(container.querySelectorAll('[data-edit-key]')).toHaveLength(5)
})
