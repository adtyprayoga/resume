<script lang="ts">
  import ImportDialog from './components/ImportDialog.svelte'
  import PersistenceHost from './components/PersistenceHost.svelte'
  import RecoveryScreen from './components/RecoveryScreen.svelte'
  import ThemeHost from './components/ThemeHost.svelte'
  import EditorDrawer from './components/editor/EditorDrawer.svelte'
  import PageBreakOverlay from './components/preview/PageBreakOverlay.svelte'
  import ResumePaper from './components/preview/ResumePaper.svelte'
  import { sampleDocument } from './data/sample'
  import { resumeFileName, serializeResume } from '$lib/io/exportJson'
  import { t, translatedMessage } from '$lib/i18n/ui'
  import type { Locale } from '$lib/model/types'
  import { printResume } from '$lib/print/print'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { recovery } from '$lib/state/recovery.svelte'
  import { clearDocument } from '$lib/storage/persist'
  import { FONT_SCALES } from '$lib/themes/index'
  import type { FontScaleKey } from '$lib/themes/types'

  // Before PersistenceHost mounts, so autosave cannot write a fresh sample over
  // stored work on first paint. Unreadable data blocks the app behind recovery.
  prefs.hydrate()
  recovery.open()

  let paperElement = $state<HTMLElement | undefined>()
  let previewContainer = $state<HTMLDivElement | undefined>()
  let previewZoom = $state(1)
  let importing = $state(false)
  let confirmReset = $state(false)

  $effect(() => { document.documentElement.lang = prefs.uiLocale })

  $effect(() => {
    if (!previewContainer || !paperElement) return
    const container = previewContainer
    const paper = paperElement
    const fit = (availableWidth: number) => {
      if (paper.offsetWidth > 0) previewZoom = Math.min(1, availableWidth / paper.offsetWidth)
    }
    const styles = getComputedStyle(container)
    fit(container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight))
    let frame = 0
    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fit(entry.contentRect.width))
    })
    resize.observe(container)
    return () => {
      resize.disconnect()
      cancelAnimationFrame(frame)
    }
  })

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

{#if recovery.blocked}
<div class="app-shell min-h-screen bg-neutral-100 py-6">
  <RecoveryScreen />
</div>
{:else}
<div class="app-shell min-h-screen bg-neutral-100 py-6">
  <div class="app-controls mx-auto mb-4" data-print-hide>
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
        {t(prefs.uiLocale, confirmReset ? 'action.confirmReset' : 'action.reset')}
      </button>
    </div>

    <div class="toolbar">
      <span class="toolbar-label">{t(prefs.uiLocale, 'app.resumeLanguage')}</span>
      <div class="toggle-group" role="group" aria-label={t(prefs.uiLocale, 'app.resumeLanguage')}>
        {#each ['id', 'en'] as const as option (option)}
          <button
            type="button"
            aria-label={t(prefs.uiLocale, 'app.documentLanguageOption', { language: t(prefs.uiLocale, `language.${option}`) })}
            aria-pressed={prefs.documentLocale === option}
            onclick={() => (prefs.documentLocale = option)}
          >
            {option.toUpperCase()}
          </button>
        {/each}
      </div>

      <span class="toolbar-label">{t(prefs.uiLocale, 'app.interfaceLanguage')}</span>
      <div class="toggle-group" role="group" aria-label={t(prefs.uiLocale, 'app.interfaceLanguage')}>
        {#each ['id', 'en'] as const as option (option)}
          <button
            type="button"
            aria-label={t(prefs.uiLocale, 'app.interfaceLanguageOption', { language: t(prefs.uiLocale, `language.${option}`) })}
            aria-pressed={prefs.uiLocale === option}
            onclick={() => (prefs.uiLocale = option)}
          >
            {option.toUpperCase()}
          </button>
        {/each}
      </div>

      <span class="toolbar-label">{t(prefs.uiLocale, 'app.fontSize')}</span>
      <div class="toggle-group" role="group" aria-label={t(prefs.uiLocale, 'app.fontSize')}>
        {#each Object.keys(FONT_SCALES) as FontScaleKey[] as scale (scale)}
          <button
            type="button"
            aria-label={t(prefs.uiLocale, 'app.fontSizeOption', { size: t(prefs.uiLocale, `size.${scale}`) })}
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
          {t(prefs.uiLocale, 'app.pageBreaks')}
        </button>
      </div>

      {#if untranslated > 0}
        <button
          type="button"
          class="tool-btn"
          onclick={() => resumeDoc.copyLocale(otherLocale(locale), locale)}
        >
          {t(prefs.uiLocale, 'app.fillUntranslated', { count: untranslated, language: otherLocale(locale).toUpperCase() })}
        </button>
      {/if}
    </div>

    {#if prefs.saveStatus.kind === 'error'}
      <p class="save-status error">{translatedMessage(prefs.uiLocale, prefs.saveStatus, prefs.saveStatus.message)}</p>
    {/if}
    <p class="save-status">{t(prefs.uiLocale, 'app.printHint')}</p>
    <p class="save-status">
      {t(prefs.uiLocale, 'app.demoNotice')}
      {#if prefs.showPageBreaks}{' '}{t(prefs.uiLocale, 'app.pageBreakHint')}{/if}
    </p>
  </div>

  <div class="preview-container" bind:this={previewContainer}>
    <div class="resume-paper-frame" style={`--preview-zoom: ${previewZoom}`}>
      <ResumePaper {resume} {locale} bind:element={paperElement} />
      {#if prefs.showPageBreaks}
        <PageBreakOverlay paper={paperElement} />
      {/if}
    </div>
  </div>
</div>

{#if prefs.drawerOpen}
  <EditorDrawer />
{/if}

{#if importing}
  <ImportDialog onClose={() => (importing = false)} />
{/if}
{/if}
