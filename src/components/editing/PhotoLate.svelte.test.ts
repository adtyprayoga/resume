import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'

const pending: Array<(value: { ok: true; dataUrl: string }) => void> = []

vi.mock('$lib/ui/avatar', async (original) => ({
  ...(await original<typeof import('$lib/ui/avatar')>()),
  fileToAvatar: () => new Promise((resolve) => pending.push(resolve)),
}))

const { default: App } = await import('../../App.svelte')
const { editing } = await import('$lib/state/editing.svelte')
const { resumeDoc } = await import('$lib/state/document.svelte')
const { prefs } = await import('$lib/state/preferences.svelte')

const LATE = 'data:image/jpeg;base64,TEFURQ=='

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  pending.length = 0
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.themeKey = 'minimal'
})

const openPhoto = async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.click(screen.getByRole('button', { name: 'Edit Photo' }))
  const form = screen.getByRole('form', { name: 'Photo' })
  await user.upload(within(form).getByLabelText('Replace'), new File(['x'], 'p.png', { type: 'image/png' }))
  return { user, form }
}

describe('late image processing', () => {
  it('applies a processed photo only when the draft is applied', async () => {
    const { user, form } = await openPhoto()
    pending[0]!({ ok: true, dataUrl: LATE })
    await tick()
    await tick()
    expect(resumeDoc.current.contact.avatar).not.toBe(LATE)
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.contact.avatar).toBe(LATE)
  })

  it('discards a result that arrives after the edit was cancelled', async () => {
    const { user, form } = await openPhoto()
    const before = resumeDoc.current.contact.avatar
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    pending[0]!({ ok: true, dataUrl: LATE })
    await tick()
    await tick()
    expect(resumeDoc.current.contact.avatar).toBe(before)
    expect(editing.active).toBeNull()

    // A later photo edit must not pick it up either.
    await user.click(screen.getByRole('button', { name: 'Edit Photo' }))
    expect(editing.active?.draft['contact.avatar']).toBe(before)
  })
})
