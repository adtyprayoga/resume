<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { t, translatedMessage, type UiMessage, type UiStringKey } from '$lib/i18n/ui'
  import { parseResumeJson, readResumeFile } from '$lib/io/importJson'
  import { fetchResumeJson } from '$lib/io/importUrl'
  import type { ResumeDocument } from '$lib/model/types'
  import type { Result } from '$lib/model/result'
  import { resolve } from '$lib/model/resolve'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import type { SaveStatus } from '$lib/storage/persist'
  import { focusTrap } from '$lib/ui/focusTrap'

  /**
   * `commit` lets a caller persist before the document changes (recovery does);
   * an error status keeps the review open and the current document untouched.
   */
  const { onClose, commit }: { onClose: () => void; commit?: (doc: ResumeDocument) => SaveStatus } = $props()
  const uid = $props.id()
  type Source = 'file' | 'url' | 'paste'

  let pasted = $state('')
  let url = $state('')
  let error = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let commitError = $state<({ message: string } & Partial<UiMessage>) | null>(null)
  let source = $state<Source | null>(null)
  let busy = $state(false)
  let pending = $state.raw<ResumeDocument | null>(null)
  let cancelButton = $state<HTMLButtonElement>()
  let closeButton = $state<HTMLButtonElement>()
  let fileInput = $state<HTMLInputElement>()
  let closed = false
  let request: AbortController | null = null

  /** Every way out of the dialog goes through here, so no request outlives it. */
  const abortRequest = () => {
    request?.abort()
    request = null
  }

  const review = $derived(pending ? resolve(pending, prefs.documentLocale) : null)
  const counts = $derived(pending?.sections.filter(section => pending!.content[section.kind].length > 0) ?? [])
  const message = $derived(error ? translatedMessage(prefs.uiLocale, error, error.error) : '')
  const errorId = `${uid}-error`
  const invalid = (field: Source) => error !== null && source === field
  const describedBy = (field: Source) =>
    [field === 'url' ? `${uid}-url-hint` : '', invalid(field) ? errorId : ''].filter(Boolean).join(' ') || undefined

  onDestroy(() => {
    closed = true
    abortRequest()
  })

  const close = () => {
    closed = true
    abortRequest()
    pending = null
    onClose()
  }

  const stage = async (result: Result<ResumeDocument>) => {
    if (closed) return
    if (!result.ok) {
      error = result
      return
    }
    error = null
    pending = result.value
    await tick()
    if (!closed) cancelButton?.focus()
  }

  const fromPaste = () => {
    if (busy || pending || closed) return
    source = 'paste'
    void stage(parseResumeJson(pasted))
  }

  const onFile = async () => {
    if (busy || pending || closed) return
    const input = fileInput
    const file = input?.files?.[0]
    if (!file) return
    source = 'file'
    error = null
    busy = true
    closeButton?.focus()
    try {
      const result = await readResumeFile(file)
      if (!closed) await stage(result)
    } catch {
      if (!closed) error = { error: 'That file could not be read.', messageKey: 'import.fileReadError' }
    } finally {
      if (!closed) busy = false
      if (error && input) input.value = ''
    }
  }

  const fromUrl = async () => {
    if (busy || pending || closed) return
    source = 'url'
    error = null
    busy = true
    closeButton?.focus()
    abortRequest()
    const current = new AbortController()
    request = current
    const result = await fetchResumeJson(url, undefined, current.signal)
    if (closed || current.signal.aborted) return
    request = null
    busy = false
    await stage(result)
  }

  const back = async () => {
    pending = null
    commitError = null
    await tick()
    document.getElementById(`${uid}-${source}`)?.focus()
  }

  const replace = () => {
    if (!pending || closed) return
    if (commit) {
      const status = commit(pending)
      if (status.kind === 'error') {
        commitError = status
        return
      }
    } else {
      resumeDoc.replace(pending)
    }
    close()
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }} />

<div
  class="drawer-overlay import-overlay"
  role="presentation"
  onclick={(event) => { if (event.target === event.currentTarget) close() }}
>
  <div class="drawer import-dialog" role="dialog" aria-modal="true" aria-labelledby="{uid}-title" use:focusTrap>
    <header class="drawer-head">
      <h2 id="{uid}-title" class="import-title">{t(prefs.uiLocale, pending ? 'import.reviewTitle' : 'import.title')}</h2>
      <button type="button" class="repeat-btn" bind:this={closeButton} onclick={close}>{t(prefs.uiLocale, 'action.close')}</button>
    </header>

    <div class="drawer-body">
      <fieldset class="import-sources" hidden={pending !== null} disabled={busy} aria-busy={busy}>
        {#if error}
          <p id={errorId} role="alert" class="save-status error">{message}</p>
        {/if}
        <div class="field">
          <label class="field-label" for="{uid}-file">{t(prefs.uiLocale, 'import.file')}</label>
          <input id="{uid}-file" bind:this={fileInput} type="file" accept="application/json,.json" aria-invalid={invalid('file')} aria-describedby={describedBy('file')} onchange={onFile} />
          <button type="button" class="tool-btn" disabled={busy || !fileInput?.files?.length} onclick={onFile}>{t(prefs.uiLocale, 'import.reviewFile')}</button>
        </div>

        <div class="field">
          <label class="field-label" for="{uid}-url">{t(prefs.uiLocale, 'import.url')}</label>
          <div class="import-url-row">
            <input id="{uid}-url" class="field-input" type="url" placeholder="https://example.com/resume.json" bind:value={url} aria-invalid={invalid('url')} aria-describedby={describedBy('url')} />
            <button type="button" class="tool-btn" disabled={busy || !url.trim()} onclick={fromUrl}>
              {t(prefs.uiLocale, busy && source === 'url' ? 'import.loading' : 'import.load')}
            </button>
          </div>
          <p id="{uid}-url-hint" class="field-hint">{t(prefs.uiLocale, 'import.urlHint')}</p>
        </div>

        <div class="field">
          <label class="field-label" for="{uid}-paste">{t(prefs.uiLocale, 'import.paste')}</label>
          <textarea id="{uid}-paste" class="field-textarea" rows={6} bind:value={pasted} aria-invalid={invalid('paste')} aria-describedby={describedBy('paste')}></textarea>
          <button type="button" class="tool-btn" disabled={busy || !pasted.trim()} onclick={fromPaste}>{t(prefs.uiLocale, 'import.reviewPaste')}</button>
        </div>
      </fieldset>

      {#if pending && review}
        <p class="import-name">{review.profile.name || t(prefs.uiLocale, 'import.unnamed')}</p>
        <ul class="import-counts">
          {#each counts as section (section.kind)}
            <li>{t(prefs.uiLocale, `section.${section.kind}` as UiStringKey)}: {pending.content[section.kind].length}</li>
          {/each}
        </ul>
        <p class="import-warning">{t(prefs.uiLocale, 'import.warning')}</p>
        {#if commitError}
          <p role="alert" class="save-status error">{translatedMessage(prefs.uiLocale, commitError, commitError.message)}</p>
        {/if}
        <div class="import-actions">
          <button type="button" class="tool-btn" bind:this={cancelButton} onclick={close}>{t(prefs.uiLocale, 'import.cancel')}</button>
          <button type="button" class="tool-btn" onclick={back}>{t(prefs.uiLocale, 'import.back')}</button>
          <button type="button" class="tool-btn primary" onclick={replace}>{t(prefs.uiLocale, 'import.replace')}</button>
        </div>
      {/if}
      {#if busy}<div class="skeleton import-skeleton" aria-hidden="true"></div><p role="status" class="sr-only">{t(prefs.uiLocale, 'import.loading')}</p>{/if}
    </div>
  </div>
</div>

<style>
  .import-overlay { align-items: center; justify-content: center; }
  .import-dialog { width: min(32rem, 100%); max-height: 90dvh; border: 1px solid var(--color-hairline); border-radius: 0; }
  .import-title { flex: 1; margin: 0; font-size: var(--text-h2); font-weight: 700; letter-spacing: var(--tracking-tight); line-height: 1.2; }
  .import-sources { min-width: 0; padding: 0; border: 0; }
  .import-url-row { display: flex; gap: 0.5rem; }
  .import-url-row input { flex: 1; min-width: 0; }
  .import-url-row button { flex: none; }
  .import-name { font-weight: 600; overflow-wrap: anywhere; }
  .import-counts { margin-block: 1rem; padding-left: 1.25rem; list-style: disc; }
  .import-warning { margin-block: 1rem; }
  .import-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .import-skeleton { height: 7.5rem; margin-top: 1rem; }
</style>
