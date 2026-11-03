import { beforeEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'
import SettingsPanel from './SettingsPanel.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
})

describe('settings panel', () => {
  // Groups never reorder; a reordered keyed row would restart its entry animation.
  it('staggers its groups', () => {
    const { container } = render(SettingsPanel, { id: 'settings-panel', onClose: () => {} })
    const groups = [...container.ownerDocument.querySelectorAll('.settings-group')]
    expect(groups.length).toBe(4)
    groups.forEach((group, index) => expect(group.getAttribute('style')).toContain(`--i: ${index}`))
  })
})
