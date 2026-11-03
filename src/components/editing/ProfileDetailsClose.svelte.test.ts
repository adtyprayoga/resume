import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import App from '../../App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { defaultTheme } from '$lib/themes/index'

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

afterEach(() => editing.reset())

const openProfileDetails = async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  const toggle = screen.getByRole('button', { name: 'Profile details' })
  await user.click(toggle)
  const form = screen.getByRole('form', { name: 'Profile details' })
  return { user, toggle, form }
}

const typeEmail = async (user: ReturnType<typeof userEvent.setup>, form: HTMLElement) => {
  const email = within(form).getByLabelText(/^Email/)
  await user.clear(email)
  await user.type(email, 'siti@example.com')
}

describe('closing profile details', () => {
  it('closes when the Profile details button is clicked again, keeping what was typed', async () => {
    const { user, toggle, form } = await openProfileDetails()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await typeEmail(user, form)
    await user.click(toggle)
    expect(screen.queryByRole('form', { name: 'Profile details' })).not.toBeInTheDocument()
    expect(resumeDoc.current.contact.email).toBe('siti@example.com')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on a click outside it, keeping what was typed', async () => {
    const { user, form } = await openProfileDetails()
    await typeEmail(user, form)
    await user.click(document.querySelector<HTMLElement>('.preview-container')!)
    expect(screen.queryByRole('form', { name: 'Profile details' })).not.toBeInTheDocument()
    expect(resumeDoc.current.contact.email).toBe('siti@example.com')
  })

  it('stays open for clicks inside it', async () => {
    const { user, form } = await openProfileDetails()
    await user.click(within(form).getByRole('heading', { name: 'Profile details' }))
    await user.click(within(form).getByLabelText(/^Email/))
    expect(screen.getByRole('form', { name: 'Profile details' })).toBeInTheDocument()
  })

  it('does not add a blank new entry when clicked away from', async () => {
    const user = userEvent.setup()
    render(App)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const before = resumeDoc.current.content.awards.length
    await user.click(screen.getByRole('button', { name: 'Add entry to Awards' }))
    expect(screen.getByRole('form', { name: 'Awards' })).toBeInTheDocument()
    await user.click(document.querySelector<HTMLElement>('.preview-container')!)
    expect(screen.queryByRole('form', { name: 'Awards' })).not.toBeInTheDocument()
    expect(resumeDoc.current.content.awards).toHaveLength(before)
  })

  it('reopens on a third click', async () => {
    const { user, toggle } = await openProfileDetails()
    await user.click(toggle)
    await user.click(toggle)
    expect(screen.getByRole('form', { name: 'Profile details' })).toBeInTheDocument()
  })
})
