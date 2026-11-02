import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import ProfileEditor from './ProfileEditor.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

describe('ProfileEditor', () => {
  it('writes a localized field into the active locale only', async () => {
    render(ProfileEditor)
    const before = resumeDoc.current.profile.text.id.headline

    const field = screen.getByLabelText(/Headline/)
    await userEvent.setup().clear(field)
    await userEvent.setup().type(field, 'Staff Engineer')

    expect(resumeDoc.current.profile.text.en.headline).toBe('Staff Engineer')
    expect(resumeDoc.current.profile.text.id.headline).toBe(before)
  })

  it('writes a shared contact field once for both locales', async () => {
    render(ProfileEditor)
    const field = screen.getByLabelText(/Phone/)
    await userEvent.setup().clear(field)
    await userEvent.setup().type(field, '+62 900')

    expect(resumeDoc.current.contact.phone).toBe('+62 900')
    expect(resumeDoc.resolved('id').contact.phone).toBe('+62 900')
    expect(resumeDoc.resolved('en').contact.phone).toBe('+62 900')
  })

  it('labels the contact block as shared once, rather than badging each field', () => {
    render(ProfileEditor)
    expect(screen.getByText('shared by both languages')).toBeInTheDocument()
    // Every field in this pane matches its pane's scope, so none needs a badge.
    expect(screen.queryAllByText(/^(this|both) languages?$/)).toHaveLength(0)
  })

  it('edits the other locale after the document locale changes', async () => {
    const { unmount } = render(ProfileEditor)
    unmount()
    prefs.documentLocale = 'id'
    render(ProfileEditor)

    const field = screen.getByLabelText(/Headline/)
    await userEvent.setup().clear(field)
    await userEvent.setup().type(field, 'Perekayasa Utama')

    expect(resumeDoc.current.profile.text.id.headline).toBe('Perekayasa Utama')
    expect(resumeDoc.current.profile.text.en.headline).not.toBe('Perekayasa Utama')
  })
})
