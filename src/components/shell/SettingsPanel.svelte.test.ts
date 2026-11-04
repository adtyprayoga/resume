import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import SettingsPanel from './SettingsPanel.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.themeKey = 'minimal'
})

describe('settings panel', () => {
  it.each(['en', 'id'] as const)('describes the selected layout in %s', async (locale) => {
    prefs.uiLocale = locale
    render(SettingsPanel, { id: 'settings-panel', onClose: () => {} })
    const group = screen.getByRole('group', { name: locale === 'en' ? 'Resume layout' : 'Tata letak resume' })
    const classic = locale === 'en' ? 'Photo, a single contact line, and dates aligned to the right' : 'Foto, satu baris kontak, dan tanggal rata kanan'
    const ats = locale === 'en' ? 'Plain single column that job portals read reliably' : 'Satu kolom polos yang mudah dibaca portal lowongan kerja'
    expect(group).toHaveAccessibleDescription(classic)
    await userEvent.setup().click(screen.getByRole('button', { name: locale === 'en' ? 'Resume layout: ATS' : 'Tata letak resume: ATS' }))
    expect(group).toHaveAccessibleDescription(ats)
  })

  // Groups never reorder; a reordered keyed row would restart its entry animation.
  it('staggers its groups', () => {
    const { container } = render(SettingsPanel, { id: 'settings-panel', onClose: () => {} })
    const groups = [...container.ownerDocument.querySelectorAll('.settings-group')]
    expect(groups.length).toBe(4)
    groups.forEach((group, index) => expect(group.getAttribute('style')).toContain(`--i: ${index}`))
  })
})
