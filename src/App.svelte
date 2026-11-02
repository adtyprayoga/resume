<script lang="ts">
  import ImportDialog from './components/ImportDialog.svelte'
  import PersistenceHost from './components/PersistenceHost.svelte'
  import RecoveryScreen from './components/RecoveryScreen.svelte'
  import ThemeHost from './components/ThemeHost.svelte'
  import ExportMenu from './components/shell/ExportMenu.svelte'
  import FirstRunIntro from './components/shell/FirstRunIntro.svelte'
  import IconButton from './components/shell/IconButton.svelte'
  import Icon from './components/shell/Icon.svelte'
  import EditLayer from './components/editing/EditLayer.svelte'
  import SettingsPanel from './components/shell/SettingsPanel.svelte'
  import PageBreakOverlay from './components/preview/PageBreakOverlay.svelte'
  import ResumePaper from './components/preview/ResumePaper.svelte'
  import { flushSync, untrack } from 'svelte'
  import { resumeFileName, serializeResume } from '$lib/io/exportJson'
  import { t, translatedMessage } from '$lib/i18n/ui'
  import { printResume } from '$lib/print/print'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { recovery } from '$lib/state/recovery.svelte'
  import { resumeThemes } from '$lib/themes/index'

  // Before PersistenceHost mounts, so autosave cannot write a fresh sample over
  // stored work on first paint. Unreadable data blocks the app behind recovery.
  prefs.hydrate()
  recovery.open()

  let paperElement = $state<HTMLElement | undefined>()
  let previewContainer = $state<HTMLDivElement | undefined>()
  let previewZoom = $state(1)
  let importing = $state(false)
  let settingsOpen = $state(false)

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
  /** Read at export time, after the draft is committed, never from a stale derived value. */
  const currentFileName = () => resumeFileName(resumeDoc.resolved(locale).profile.name, locale)

  // A confirmed import or reset replaces the document; an edit of the old one must not land on it.
  $effect(() => {
    void resumeDoc.generation
    untrack(() => editing.discardStale())
  })

  /** An uncommitted draft is never reported as saved. */
  const statusKind = $derived(
    prefs.saveStatus.kind === 'error'
      ? 'error'
      : editing.active
        ? 'editing'
        : prefs.saving
          ? 'saving'
          : prefs.changeSaved && prefs.saveStatus.kind === 'saved'
            ? 'saved'
            : editing.mode === 'edit'
              ? 'editing'
              : 'preview',
  )

  /** Exports read the document, so the open draft is applied and rendered first. */
  const commitForExport = () => {
    editing.commit()
    flushSync()
  }

  // The browser's own print command (Ctrl+P) must also see the latest edit.
  $effect(() => {
    window.addEventListener('beforeprint', commitForExport)
    return () => window.removeEventListener('beforeprint', commitForExport)
  })

  const exportJson = () => {
    commitForExport()
    const snapshot = resumeDoc.snapshot()
    const blob = new Blob([serializeResume(snapshot)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentFileName()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    commitForExport()
    void printResume(currentFileName())
  }

  const toggleEdit = () => {
    if (editing.mode === 'edit') editing.finish()
    else editing.enter()
  }

  const openSettings = () => {
    editing.suspend()
    settingsOpen = true
  }

  const closeSettings = () => {
    settingsOpen = false
    editing.resume()
  }

  const openImport = () => {
    editing.suspend()
    importing = true
  }

  const closeImport = () => {
    importing = false
    editing.resume()
  }
</script>

<PersistenceHost />
<ThemeHost />

{#if recovery.blocked}
<div class="app-shell">
  <RecoveryScreen />
</div>
{:else}
<div class="app-shell">
  <header class="app-header" data-print-hide data-keeps-draft>
    <div class="app-header-row">
      <p class="app-title">{t(prefs.uiLocale, 'app.title')}</p>

      <div class="toggle-group layout-select" role="group" aria-label={t(prefs.uiLocale, 'app.layout')}>
        {#each resumeThemes as theme (theme.key)}
          <button
            type="button"
            aria-label={t(prefs.uiLocale, 'app.layoutOption', { layout: t(prefs.uiLocale, `layout.${theme.presentation}`) })}
            aria-pressed={prefs.themeKey === theme.key}
            onclick={() => editing.setLayout(theme.key)}
          >
            {t(prefs.uiLocale, `layout.${theme.presentation}`)}
          </button>
        {/each}
      </div>

      <p class="app-status" class:error={statusKind === 'error'} role="status" aria-label={t(prefs.uiLocale, 'status.label')}>
        {t(prefs.uiLocale, `status.${statusKind}`)}
      </p>

      <div class="app-actions" role="toolbar" aria-label={t(prefs.uiLocale, 'app.actions')}>
        <ExportMenu onPdf={exportPdf} onJson={exportJson} />
        <IconButton icon="import" label={t(prefs.uiLocale, 'action.import')} haspopup="dialog" onclick={openImport} />
        <IconButton
          icon={editing.mode === 'edit' ? 'done' : 'edit'}
          label={t(prefs.uiLocale, editing.mode === 'edit' ? 'action.done' : 'action.edit')}
          onclick={toggleEdit}
        />
        <IconButton icon="settings" label={t(prefs.uiLocale, 'action.settings')} haspopup="dialog" onclick={openSettings} />
      </div>
    </div>

    {#if prefs.saveStatus.kind === 'error'}
      <p class="save-status error" role="alert">{translatedMessage(prefs.uiLocale, prefs.saveStatus, prefs.saveStatus.message)}</p>
    {/if}
  </header>

  {#if editing.mode === 'edit'}
    <div class="edit-bar" data-print-hide>
      <button
        type="button"
        class="tool-btn"
        data-profile-details="true"
        aria-haspopup="dialog"
        onclick={() => editing.begin({ kind: 'profile' })}
      >
        <Icon name="user" />{t(prefs.uiLocale, 'edit.profileDetails')}
      </button>
    </div>
  {/if}

  <FirstRunIntro onImport={openImport} />

  <div class="preview-container" bind:this={previewContainer}>
    <div class="resume-paper-frame" style={`--preview-zoom: ${previewZoom}`}>
      <ResumePaper {resume} {locale} presentation={prefs.theme.presentation} bind:element={paperElement} />
      {#if prefs.showPageBreaks && editing.mode === 'preview'}
        <!-- Guides are a Preview aid; editing would remeasure them on every change. -->
        <div data-page-guides data-print-hide><PageBreakOverlay paper={paperElement} /></div>
      {/if}
    </div>
  </div>
</div>

<EditLayer />
<div class="sr-only" aria-live="polite" aria-atomic="true" data-print-hide>{editing.announcement}</div>

{#if settingsOpen}
  <SettingsPanel onClose={closeSettings} />
{/if}

{#if importing}
  <ImportDialog onClose={closeImport} />
{/if}
{/if}
