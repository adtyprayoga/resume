import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import EditorDrawer from './EditorDrawer.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'id'
  prefs.documentLocale = 'en'
  prefs.drawerSection = 'profile'
})

describe('Indonesian editor', () => {
  it('translates editor chrome independently of document content', async () => {
    render(EditorDrawer)
    expect(screen.getByRole('dialog', { name: 'Sunting resume' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nama')).toHaveValue(resumeDoc.current.profile.text.en.name)
    expect(screen.getByText('digunakan oleh kedua bahasa')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pengalaman Kerja' }))
    expect(screen.getByRole('button', { name: '+ Tambah pekerjaan' })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Perusahaan/).length).toBeGreaterThan(0)
    expect(screen.getAllByPlaceholderText('Satu per baris').length).toBeGreaterThan(0)
  })
  it('retains a partially typed list draft when only the interface locale changes', async () => {
    prefs.drawerSection = 'skills'
    render(EditorDrawer)
    const field = screen.getAllByLabelText('Keahlian')[0]!
    const user = userEvent.setup()
    await user.clear(field)
    await user.type(field, 'TypeScript, ')
    prefs.uiLocale = 'en'
    await tick()
    expect(screen.getAllByLabelText('Skills')[0]).toBe(field)
    expect(field).toHaveValue('TypeScript, ')
    expect(prefs.documentLocale).toBe('en')
  })
  it('renders metadata errors and updates their language without another upload', async () => {
    render(EditorDrawer)
    const input = screen.getByLabelText('Ganti')
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['x'], 'x.txt', { type: 'text/plain' }))
    expect(screen.getByText('Pilih gambar PNG, JPEG, WebP, atau GIF.')).toBeInTheDocument()
    prefs.uiLocale = 'en'
    await tick()
    expect(screen.getByText('Choose a PNG, JPEG, WebP or GIF image.')).toBeInTheDocument()
  })
})
