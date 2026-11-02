<script lang="ts">
  import ImportDialog from './components/ImportDialog.svelte'
  import PersistenceHost from './components/PersistenceHost.svelte'
  import ThemeHost from './components/ThemeHost.svelte'
  import EditorDrawer from './components/editor/EditorDrawer.svelte'
  import PageBreakOverlay from './components/preview/PageBreakOverlay.svelte'
  import ResumePaper from './components/preview/ResumePaper.svelte'
  import { sampleDocument } from './data/sample'
  import { resumeFileName, serializeResume } from '$lib/io/exportJson'
  import { t } from '$lib/i18n/ui'
  import type { Locale } from '$lib/model/types'
  import { printResume } from '$lib/print/print'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { clearDocument, loadDocument } from '$lib/storage/persist'
  import { FONT_SCALES } from '$lib/themes/index'
  import type { FontScaleKey } from '$lib/themes/types'

  /*
   * Hydrate before PersistenceHost mounts, so its autosave effect never writes
   * an empty document over stored work on first paint.
   */
  prefs.hydrate()
  resumeDoc.replace(loadDocument() ?? sampleDocument())

  let paperElement = $state<HTMLElement | undefined>()
  let importing = $state(false)
  let confirmReset = $state(false)

  const locale = $derived(prefs.documentLocale)
  const resume = $derived(resumeDoc.resolved(locale))
  const fileName = $derived(resumeFileName(resume.profile.name, locale))
  const untranslated = $derived(resumeDoc.untranslatedCount(locale))

  const download = () => {
    const blob = new Blob([serializeResume(resumeDoc.snapshot())], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    if (!confirmReset) {
      confirmReset = true
      return
    }
    confirmReset = false
    clearDocument()
    resumeDoc.replace(sampleDocument())
  }

  const otherLocale = (value: Locale): Locale => (value === 'id' ? 'en' : 'id')
</script>

<PersistenceHost />
<ThemeHost />

<div class="min-h-screen bg-neutral-100 py-6">
  <div class="mx-auto mb-4 max-w-[210mm] px-4" data-print-hide>
    <div class="toolbar">
      <button type="button" class="tool-btn primary" onclick={() => printResume(fileName)}>
        {t(prefs.uiLocale, 'action.print')}
      </button>
      <button type="button" class="tool-btn" onclick={() => prefs.openDrawer('profile')}>
        {t(prefs.uiLocale, 'action.edit')}
      </button>
      <button type="button" class="tool-btn" onclick={download}>
        {t(prefs.uiLocale, 'action.exportJson')}
      </button>
      <button type="button" class="tool-btn" onclick={() => (importing = true)}>
        {t(prefs.uiLocale, 'action.importJson')}
      </button>
      <button type="button" class="tool-btn" onclick={reset}>
        {confirmReset ? 'Confirm reset' : 'Reset to sample'}
      </button>
    </div>

    <div class="toolbar">
      <span class="toolbar-label">Resume</span>
      <div class="toggle-group">
        {#each ['id', 'en'] as const as option (option)}
          <button
            type="button"
            aria-pressed={prefs.documentLocale === option}
            onclick={() => (prefs.documentLocale = option)}
          >
            {option.toUpperCase()}
          </button>
        {/each}
      </div>

      <span class="toolbar-label">Interface</span>
      <div class="toggle-group">
        {#each ['id', 'en'] as const as option (option)}
          <button
            type="button"
            aria-pressed={prefs.uiLocale === option}
            onclick={() => (prefs.uiLocale = option)}
          >
            {option.toUpperCase()}
          </button>
        {/each}
      </div>

      <span class="toolbar-label">Size</span>
      <div class="toggle-group">
        {#each Object.keys(FONT_SCALES) as FontScaleKey[] as scale (scale)}
          <button
            type="button"
            aria-pressed={prefs.fontScale === scale}
            onclick={() => (prefs.fontScale = scale)}
          >
            {scale === 'standard' ? 'M' : scale === 'xsmall' ? 'XS' : scale === 'small' ? 'S' : 'L'}
          </button>
        {/each}
      </div>

      <div class="toggle-group">
        <button
          type="button"
          aria-pressed={prefs.showPageBreaks}
          onclick={() => (prefs.showPageBreaks = !prefs.showPageBreaks)}
        >
          Page breaks
        </button>
      </div>

      {#if untranslated > 0}
        <button
          type="button"
          class="tool-btn"
          onclick={() => resumeDoc.copyLocale(otherLocale(locale), locale)}
        >
          Fill {untranslated} untranslated from {otherLocale(locale).toUpperCase()}
        </button>
      {/if}
    </div>

    {#if prefs.saveStatus.kind === 'error'}
      <p class="save-status error">{prefs.saveStatus.message}</p>
    {/if}
    <p class="save-status">{t(prefs.uiLocale, 'app.printHint')}</p>
    <p class="save-status">
      {t(prefs.uiLocale, 'app.demoNotice')}
      {#if prefs.showPageBreaks}{' '}{t(prefs.uiLocale, 'app.pageBreakHint')}{/if}
    </p>
  </div>

  <div class="resume-paper-frame">
    <ResumePaper {resume} {locale} bind:element={paperElement} />
    {#if prefs.showPageBreaks}
      <PageBreakOverlay paper={paperElement} />
    {/if}
  </div>
</div>

{#if prefs.drawerOpen}
  <EditorDrawer />
{/if}

{#if importing}
  <ImportDialog onClose={() => (importing = false)} />
{/if}
