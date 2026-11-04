<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { t, translatedMessage, type UiMessage, type UiStringKey } from '$lib/i18n/ui'
  import { MAX_IMPORT_BYTES, parseResumeJson, readResumeFile } from '$lib/io/importJson'
  import { fetchResumeJson } from '$lib/io/importUrl'
  import { convertPdf, MAX_PDF_MB, MAX_PDF_PAGES, PDF_IMPORT_ENABLED, type PdfStage } from '$lib/io/pdf/client'
  import { mapExtraction, type Proposal } from '$lib/io/pdf/mapper'
  import type { Extraction, PdfProgress } from '$lib/io/pdf/types'
  import type { ResumeDocument } from '$lib/model/types'
  import type { Result } from '$lib/model/result'
  import { resolve } from '$lib/model/resolve'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { saveDocument, type SaveStatus } from '$lib/storage/persist'
  import { focusTrap } from '$lib/ui/focusTrap'
  import FilePicker from './importing/FilePicker.svelte'
  import PdfImportReview from './importing/PdfImportReview.svelte'

  /**
   * `commit` lets a caller persist before the document changes (recovery does);
   * an error status keeps the review open and the current document untouched.
   */
  const {
    onClose,
    commit,
    pdfImport = PDF_IMPORT_ENABLED,
    format = 'json',
    pdfPollMs = 1000,
  }: {
    onClose: () => void
    commit?: (doc: ResumeDocument) => SaveStatus
    /** PDF conversion needs the optional backend; off in the static-only build. */
    format?: 'pdf' | 'json'
    pdfImport?: boolean
    pdfPollMs?: number
  } = $props()
  const uid = $props.id()
  type Source = 'file' | 'url' | 'paste'

  let alternativesOpen = $state(false)
  let pasted = $state('')
  let url = $state('')
  let error = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let commitError = $state<({ message: string } & Partial<UiMessage>) | null>(null)
  let source = $state<Source | null>(null)
  let busy = $state(false)
  let pending = $state.raw<ResumeDocument | null>(null)
  let cancelButton = $state<HTMLButtonElement>()
  let closeButton = $state<HTMLButtonElement>()
  let jsonFile = $state<File | null>(null)
  let titleElement = $state<HTMLHeadingElement>()
  let pdfFile = $state<File | null>(null)
  let pdfStage = $state<PdfStage | null>(null)
  let pdfProgress = $state<PdfProgress | null>(null)
  const selectedFormat = $derived(format === 'pdf' && pdfImport ? 'pdf' : 'json')
  let pdfNotice = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let pdfError = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let pdfReview = $state.raw<{ proposal: Proposal; extraction: Extraction } | null>(null)
  let pdfRequest: AbortController | null = null
  let convertButton = $state<HTMLButtonElement>()
  let cancelPdfButton = $state<HTMLButtonElement>()
  let closed = false
  let request: AbortController | null = null

  /** Every way out of the dialog goes through here, so no request outlives it. */
  const abortRequest = () => {
    request?.abort()
    request = null
    pdfRequest?.abort()
    pdfRequest = null
  }

  const pdfBusy = $derived(pdfStage !== null)
  const title = $derived<UiStringKey>(
    pdfReview ? 'pdf.review.title' : pending ? 'import.reviewTitle' : selectedFormat === 'pdf' ? 'import.titleAny' : 'import.title',
  )

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
    pdfReview = null
    onClose()
  }

  const convert = async () => {
    if (!pdfFile || pdfBusy || closed) return
    pdfError = null
    pdfNotice = null
    pdfProgress = null
    const current = new AbortController()
    pdfRequest = current
    pdfStage = 'uploading'
    // Convert is about to be disabled; keep focus on a live control in the modal.
    void tick().then(() => { if (pdfRequest === current) cancelPdfButton?.focus() })
    const result = await convertPdf(pdfFile, { signal: current.signal, pollMs: pdfPollMs, onStage: (stage) => { if (!current.signal.aborted && !closed) pdfStage = stage }, onProgress: (progress) => { if (!current.signal.aborted && !closed) pdfProgress = progress } })
    if (closed || pdfRequest !== current) return
    pdfRequest = null
    pdfStage = null
    if (!result.ok) {
      pdfProgress = null
      if (result.messageKey === 'pdf.error.cancelled') pdfNotice = result
      else pdfError = result
      await tick()
      if (!closed) convertButton?.focus()
      return
    }
    const proposal = mapExtraction(result.value, prefs.documentLocale)
    // Text extraction cannot supply a photo; retain the one already in the resume.
    proposal.document.contact.avatar = resumeDoc.current.contact.avatar
    pdfReview = { proposal, extraction: result.value }
    await tick()
    if (!closed) titleElement?.focus()
  }

  /**
   * The PDF review is an editing form whose server copy is already gone, so a
   * stray Escape or backdrop tap must not throw it away; Cancel and Close still do.
   */
  const dismiss = () => {
    if (!pdfReview) close()
  }

  const cancelConversion = () => {
    pdfRequest?.abort()
    pdfProgress = null
  }

  const backFromPdf = async () => {
    pdfReview = null
    pdfProgress = null
    await tick()
    document.getElementById(`${uid}-pdf-choose`)?.focus()
  }

  /** Saved first, so a storage failure leaves the current resume in place. */
  const replaceFromPdf = (doc: ResumeDocument): ({ message: string } & Partial<UiMessage>) | null => {
    if (closed) return null
    const status = commit ? commit(doc) : saveDocument(doc)
    if (status.kind === 'error') return status
    if (!commit) resumeDoc.replace(doc)
    close()
    return null
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
    const file = jsonFile
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
    document.getElementById(`${uid}-${source === 'file' ? 'file-choose' : source}`)?.focus()
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

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); dismiss() } }} />

<div
  class="drawer-overlay import-overlay"
  role="presentation"
  onclick={(event) => { if (event.target === event.currentTarget) dismiss() }}
>
  <div class="drawer import-dialog" class:import-dialog-wide={pdfReview !== null} role="dialog" aria-modal="true" aria-labelledby="{uid}-title" use:focusTrap>
    <header class="drawer-head">
      <h2 id="{uid}-title" class="import-title" tabindex="-1" bind:this={titleElement}>{t(prefs.uiLocale, title)}</h2>
      <button type="button" class="repeat-btn" bind:this={closeButton} onclick={close}>{t(prefs.uiLocale, 'action.close')}</button>
    </header>

    <div class="drawer-body">
      {#if selectedFormat === 'pdf'}
        <section class="pdf-import-source" hidden={pending !== null || pdfReview !== null} aria-labelledby="{uid}-pdf-heading">
          <h3 id="{uid}-pdf-heading" class="editor-subhead">{t(prefs.uiLocale, 'pdf.heading')}</h3>
          {#if pdfError}
            <p id="{uid}-pdf-error" role="alert" class="save-status error">{translatedMessage(prefs.uiLocale, pdfError, pdfError.error)}</p>
          {/if}
          <div class="field">
            <FilePicker id={`${uid}-pdf`} format="pdf" label={t(prefs.uiLocale, 'pdf.file')} limit={MAX_PDF_MB * 1024 * 1024} disabled={pdfBusy || busy}
              onSelect={(file) => { pdfFile = file; pdfError = null; pdfNotice = null; pdfProgress = null }} />
            <p id="{uid}-pdf-hint" class="field-hint">{t(prefs.uiLocale, 'pdf.privacy')}</p>
            <p id="{uid}-pdf-limits" class="field-hint">{t(prefs.uiLocale, 'pdf.limits', { size: MAX_PDF_MB, pages: MAX_PDF_PAGES })}</p>
            <div class="import-actions">
              <button type="button" class="tool-btn" bind:this={convertButton} disabled={pdfBusy || busy || !pdfFile} onclick={convert}>{t(prefs.uiLocale, 'pdf.convert')}</button>
              {#if pdfBusy}
                <button type="button" class="tool-btn" bind:this={cancelPdfButton} onclick={cancelConversion}>{t(prefs.uiLocale, 'pdf.cancel')}</button>
              {/if}
            </div>
            {#if pdfStage || pdfNotice}
              <div class="pdf-progress">
                {#if pdfStage}
                  <progress aria-label={t(prefs.uiLocale, 'pdf.progress.label')} max="100" value={pdfProgress ? Math.min(99, pdfProgress.percent) : undefined}></progress>
                  {#if pdfProgress}<p class="pdf-percent">{Math.min(99, pdfProgress.percent)}%</p>{/if}
                {/if}
                <p role="status" class="pdf-stage">
                  {pdfProgress ? t(prefs.uiLocale, `pdf.phase.${pdfProgress.phase}`) : pdfStage ? t(prefs.uiLocale, `pdf.stage.${pdfStage}`) : pdfNotice ? translatedMessage(prefs.uiLocale, pdfNotice, pdfNotice.error) : ''}
                  {#if pdfProgress?.total_pages !== null && pdfProgress?.total_pages !== undefined}
                    {t(prefs.uiLocale, 'pdf.progress.pages', { completed: pdfProgress.completed_pages, total: pdfProgress.total_pages })}
                  {/if}
                </p>
                {#if pdfStage}<p class="field-hint">{t(prefs.uiLocale, 'pdf.progress.hint')}</p>{/if}
              </div>
            {/if}
          </div>
        </section>
      {/if}

      {#if pdfReview}
        <p role="status">{t(prefs.uiLocale, 'pdf.progress.complete')}</p>
        <PdfImportReview proposal={pdfReview.proposal} extraction={pdfReview.extraction} onCancel={close} onBack={backFromPdf} onConfirm={replaceFromPdf} />
      {/if}

      {#if selectedFormat === 'json'}
      <fieldset class="import-sources" hidden={pending !== null || pdfReview !== null} disabled={busy || pdfBusy} aria-busy={busy}>
        {#if error}
          <p id={errorId} role="alert" class="save-status error">{message}</p>
        {/if}
        <div class="field">
          <FilePicker id={`${uid}-file`} format="json" label={t(prefs.uiLocale, 'import.file')} limit={MAX_IMPORT_BYTES} disabled={busy}
            onSelect={(file) => { jsonFile = file; error = null; if (file) void onFile() }} />
          <p class="field-hint">{t(prefs.uiLocale, 'picker.jsonLimits')}</p>
          <button type="button" class="tool-btn" disabled={busy || !jsonFile} onclick={onFile}>{t(prefs.uiLocale, 'import.reviewFile')}</button>
        </div>
        <details class="import-alternatives" bind:open={alternativesOpen}>
          <summary tabindex={busy ? -1 : 0}>{t(prefs.uiLocale, 'import.alternatives')}</summary>
          <div hidden={!alternativesOpen}>

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
          </div>
        </details>
      </fieldset>
      {/if}

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
  .import-dialog-wide { width: min(48rem, 100%); }
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
