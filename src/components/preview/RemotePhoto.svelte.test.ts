import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import ResumePaper from './ResumePaper.svelte'
import AvatarField from '../editor/AvatarField.svelte'
import { sampleDocument } from '../../data/sample'
import { serializeResume } from '$lib/io/exportJson'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'

const REMOTE = 'https://photos.example/me.jpg'

const withAvatar = (avatar: string) => {
  const doc = sampleDocument()
  doc.contact.avatar = avatar
  return doc
}

/** Any attribute anywhere that would make the browser contact the photo host. */
const referencesHost = (host = 'photos.example') =>
  [...document.body.querySelectorAll('*')].some((element) =>
    [...element.attributes].some((attribute) => attribute.value.includes(host)),
  )

const mountBoth = () => {
  render(ResumePaper, { get resume() { return resumeDoc.resolved('en') }, locale: 'en' })
  render(AvatarField)
}

const photos = () => document.querySelectorAll<HTMLImageElement>('img.resume-avatar, img.avatar-preview')

beforeEach(() => {
  prefs.uiLocale = 'en'
  resumeDoc.replace(withAvatar(REMOTE))
})

describe('remote photo consent', () => {
  it('makes no request to the photo host before consent, in either preview', () => {
    mountBoth()
    expect(photos()).toHaveLength(0)
    expect(referencesHost()).toBe(false)
    const notices = screen.getAllByText(/contacts photos\.example/i)
    expect(notices).toHaveLength(2)
    for (const notice of notices) expect(notice.closest('[data-print-hide]')).not.toBeNull()
  })

  it('loads the photo in both previews after consent, without a referrer', async () => {
    mountBoth()
    await userEvent.click(screen.getAllByRole('button', { name: 'Load photo' })[0]!)
    expect(photos()).toHaveLength(2)
    for (const img of photos()) {
      expect(img.getAttribute('src')).toBe(REMOTE)
      expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    }
  })

  it('forgets consent when the document is replaced', async () => {
    mountBoth()
    await userEvent.click(screen.getAllByRole('button', { name: 'Load photo' })[0]!)
    await act(() => resumeDoc.replace(JSON.parse(serializeResume(withAvatar(REMOTE)))))
    expect(photos()).toHaveLength(0)
    expect(referencesHost()).toBe(false)
  })

  it('forgets consent when the avatar changes, even if it changes back', async () => {
    mountBoth()
    await userEvent.click(screen.getAllByRole('button', { name: 'Load photo' })[0]!)
    await act(() => { resumeDoc.current.contact.avatar = 'https://photos.example/other.jpg' })
    expect(photos()).toHaveLength(0)
    await act(() => { resumeDoc.current.contact.avatar = REMOTE })
    expect(photos()).toHaveLength(0)
    expect(referencesHost()).toBe(false)
  })

  it('keeps an http photo blocked with upload guidance and no consent button', () => {
    resumeDoc.replace(withAvatar('http://photos.example/me.jpg'))
    mountBoth()
    expect(photos()).toHaveLength(0)
    expect(referencesHost()).toBe(false)
    expect(screen.queryByRole('button', { name: 'Load photo' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/upload/i).length).toBeGreaterThan(0)
  })

  it('renders an embedded photo immediately, without a referrer', () => {
    resumeDoc.replace(withAvatar('data:image/png;base64,AAA'))
    mountBoth()
    expect(photos()).toHaveLength(2)
    for (const img of photos()) expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('keeps the remote URL in the document and its export', async () => {
    mountBoth()
    expect(resumeDoc.snapshot().contact.avatar).toBe(REMOTE)
    expect(JSON.parse(serializeResume(resumeDoc.snapshot())).contact.avatar).toBe(REMOTE)
  })

  it('shows the notice in the interface language', () => {
    prefs.uiLocale = 'id'
    mountBoth()
    expect(screen.getAllByRole('button', { name: 'Muat foto' })).toHaveLength(2)
  })
})
