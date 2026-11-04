<script lang="ts">
  import ImportDialog from './components/ImportDialog.svelte'
  import UploadMenu from './components/shell/UploadMenu.svelte'
  import PersistenceHost from './components/PersistenceHost.svelte'
  import RecoveryScreen from './components/RecoveryScreen.svelte'
  import ThemeHost from './components/ThemeHost.svelte'
  import ExportMenu from './components/shell/ExportMenu.svelte'
  import FirstRunIntro from './components/shell/FirstRunIntro.svelte'
  import IconButton from './components/shell/IconButton.svelte'
  import Icon from './components/shell/Icon.svelte'
  import EditLayer from './components/editing/EditLayer.svelte'
  import SettingsPanel from './components/shell/SettingsPanel.svelte'
  import SectionsPanel from './components/shell/SectionsPanel.svelte'
  import PageBreakOverlay from './components/preview/PageBreakOverlay.svelte'
  import ResumePaper from './components/preview/ResumePaper.svelte'
  import { isSampleDocument } from './data/sample'
  import { flushSync, tick, untrack } from 'svelte'
  import { resumeFileName, serializeResume } from '$lib/io/exportJson'
  import { t, translatedMessage } from '$lib/i18n/ui'
  import { printResume } from '$lib/print/print'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { recovery } from '$lib/state/recovery.svelte'
  import { redo, undo } from '$lib/state/actions'
  import { historyShortcut, isTextEntry } from '$lib/ui/keys'
  import { revealSection, type NavTarget } from '$lib/ui/revealSection'

  // Before PersistenceHost mounts, so autosave cannot write a fresh sample over
  // stored work on first paint. Unreadable data blocks the app behind recovery.
  prefs.hydrate()
  recovery.open()

  let paperElement = $state<HTMLElement | undefined>()
  let previewContainer = $state<HTMLDivElement | undefined>()
  let previewZoom = $state(1)
  let importing = $state(false)
  let importFormat = $state<'pdf' | 'json'>('json')
  let uploadOpen = $state(false)
  let exportOpen = $state(false)
  let settingsOpen = $state(false)
  let sectionsOpen = $state(false)
  let importButton = $state<HTMLButtonElement | undefined>()
  let settingsButton = $state<HTMLButtonElement | undefined>()
  let sectionsButton = $state<HTMLButtonElement | undefined>()
  let headerElement = $state<HTMLElement | undefined>()
  let phone = $state(false)
  let panelBounds = $state({ top: 16, height: 0, viewport: 0 })

  $effect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 639px)')
    phone = query.matches
    const update = (event: { matches: boolean }) => { phone = event.matches }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  })

  $effect(() => {
    if (!phone || (!sectionsOpen && !settingsOpen) || !headerElement) return
    const header = headerElement
    const viewport = window.visualViewport
    let frame = 0
    const measure = () => {
      const top = viewport?.offsetTop ?? 0
      const height = viewport?.height ?? window.innerHeight
      const safeTop = Math.max(top + 16, header.getBoundingClientRect().bottom + 16)
      panelBounds = { top: safeTop, height: Math.max(0, top + height - 16 - safeTop), viewport: height }
    }
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; measure() })
    }
    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(header)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    viewport?.addEventListener('resize', schedule)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      viewport?.removeEventListener('resize', schedule)
    }
  })

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
  const statusKind = $derived<'error' | 'draft' | 'saving' | 'saved' | null>(
    prefs.saveStatus.kind === 'error'
      ? 'error'
      : editing.active
        ? 'draft'
        : prefs.saving
          ? 'saving'
          : prefs.saveStatus.kind === 'saved'
            ? 'saved'
            : null,
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

  const profileDetailsOpen = $derived(!editing.suspended && editing.active?.target.kind === 'profile')

  /** A second click closes the form, keeping what was typed. */
  const toggleProfileDetails = () => {
    if (profileDetailsOpen) editing.commit()
    else editing.begin({ kind: 'profile' })
  }

  type Panel = 'sections' | 'settings'
  const PANEL_ID: Record<Panel, string> = { sections: 'sections-panel', settings: 'settings-panel' }
  /** Below this width only one panel fits; phones float it over the CV. */
  const NARROW_QUERY = '(max-width: 1023px)'
  const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
  let lastOpened = $state<Panel | null>(null)

  const isOpen = (panel: Panel) => (panel === 'sections' ? sectionsOpen : settingsOpen)
  const setOpen = (panel: Panel, open: boolean) => {
    if (panel === 'sections') sectionsOpen = open
    else settingsOpen = open
  }

  /**
   * Opening or closing a panel moves the paper, so the open editor is applied and
   * closed first rather than left floating at a stale position.
   */
  const setPanel = async (panel: Panel, open: boolean) => {
    editing.dismiss()
    setOpen(panel, open)
    if (open) {
      lastOpened = panel
      if (isNarrow()) setOpen(panel === 'sections' ? 'settings' : 'sections', false)
    }
    await tick()
    if (open) document.getElementById(`${PANEL_ID[panel]}-title`)?.focus({ preventScroll: true })
    else (panel === 'sections' ? sectionsButton : settingsButton)?.focus()
  }

  const togglePanel = (panel: Panel) => void setPanel(panel, !isOpen(panel))

  const navigateSection = async (target: NavTarget) => {
    editing.dismiss()
    if (phone) sectionsOpen = false
    await tick()
    revealSection(target)
    if (!phone) return
    const heading = document.querySelector<HTMLElement>(`[data-cv-section="${target}"] h1, [data-cv-section="${target}"] h2`)
    if (!heading) {
      sectionsButton?.focus({ preventScroll: true })
      return
    }
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1')
      heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true })
    }
    heading.focus({ preventScroll: true })
  }

  // Narrowing the window with both open keeps the one opened last.
  $effect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(NARROW_QUERY)
    const onChange = (event: { matches: boolean }) => {
      if (!event.matches || !sectionsOpen || !settingsOpen) return
      editing.dismiss()
      setOpen(lastOpened === 'settings' ? 'sections' : 'settings', false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  const openImport = (format: 'pdf' | 'json') => {
    importFormat = format
    editing.suspend()
    importing = true
  }

  /** Text fields keep the browser's own undo; modal dialogs keep the app's out of their way. */
  const onHistoryKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || recovery.blocked || isTextEntry(event.target)) return
    if (document.querySelector('[aria-modal="true"]')) return
    const action = historyShortcut(event)
    if (!action) return
    event.preventDefault()
    if (action === 'undo') undo(prefs.uiLocale)
    else redo(prefs.uiLocale)
  }

  const closeImport = () => {
    importing = false
    editing.resume()
    void tick().then(() => importButton?.focus())
  }
</script>

<svelte:window onkeydown={onHistoryKey} />

<PersistenceHost />
<ThemeHost />

{#if recovery.blocked}
<div class="app-shell">
  <RecoveryScreen />
</div>
{:else}
<div class="app-shell">
  <header class="app-header" bind:this={headerElement} data-print-hide data-keeps-draft>
    <div class="app-header-row">
      <div class="app-brand">
        <p class="app-title">{t(prefs.uiLocale, 'app.title')}</p>
        <p class="app-status" class:error={statusKind === 'error'} role="status" aria-label={t(prefs.uiLocale, 'status.label')}>
          {statusKind ? t(prefs.uiLocale, `status.${statusKind}`) : ''}
        </p>
      </div>

      <div class="app-actions" role="toolbar" aria-label={t(prefs.uiLocale, 'app.actions')}>
        <IconButton
          icon="undo"
          label={t(prefs.uiLocale, 'action.undo')}
          disabled={!resumeDoc.canUndo}
          onclick={() => undo(prefs.uiLocale)}
        />
        <IconButton
          icon="redo"
          label={t(prefs.uiLocale, 'action.redo')}
          disabled={!resumeDoc.canRedo}
          onclick={() => redo(prefs.uiLocale)}
        />
        <IconButton
          icon="sections"
          label={t(prefs.uiLocale, 'action.sections')}
          controls={sectionsOpen ? PANEL_ID.sections : undefined}
          expanded={sectionsOpen}
          bind:element={sectionsButton}
          onclick={() => togglePanel('sections')}
        />
        <IconButton
          icon={editing.mode === 'edit' ? 'done' : 'edit'}
          label={t(prefs.uiLocale, editing.mode === 'edit' ? 'action.done' : 'action.edit')}
          onclick={toggleEdit}
          variant="primary"
        />
        <UploadMenu onSelect={openImport} bind:open={uploadOpen} onOpen={() => (exportOpen = false)} bind:button={importButton} />
        <ExportMenu onPdf={exportPdf} onJson={exportJson} bind:open={exportOpen} onOpen={() => (uploadOpen = false)} />
        <IconButton
          icon="settings"
          label={t(prefs.uiLocale, 'action.settings')}
          controls={settingsOpen ? PANEL_ID.settings : undefined}
          expanded={settingsOpen}
          bind:element={settingsButton}
          onclick={() => togglePanel('settings')}
        />
      </div>
    </div>

    {#if prefs.saveStatus.kind === 'error'}
      <p class="save-status error" role="alert">{translatedMessage(prefs.uiLocale, prefs.saveStatus, prefs.saveStatus.message)}</p>
    {/if}
    {#if isSampleDocument(resumeDoc.current)}
      <p class="app-demo-notice">{t(prefs.uiLocale, 'app.demoNotice')}</p>
    {/if}
  </header>

  {#if editing.mode === 'edit'}
    <div class="edit-bar" data-print-hide>
      <p class="edit-hint">{t(prefs.uiLocale, 'edit.hint')}</p>
      <button
        type="button"
        class="tool-btn"
        data-profile-details="true"
        aria-haspopup="dialog"
        aria-expanded={profileDetailsOpen}
        onclick={toggleProfileDetails}
      >
        <Icon name="user" />{t(prefs.uiLocale, 'edit.profileDetails')}
      </button>
    </div>
  {/if}

  <div class="workspace" class:with-sections={sectionsOpen} class:with-settings={settingsOpen}
    style={`--panel-safe-top: ${panelBounds.top}px; --panel-safe-height: ${panelBounds.height}px; --panel-viewport-height: ${panelBounds.viewport}px`}>
    {#if sectionsOpen}
      <SectionsPanel id={PANEL_ID.sections} onClose={() => void setPanel('sections', false)} onNavigate={(target) => void navigateSection(target)} />
    {/if}

    <div class="workspace-main">
      <FirstRunIntro />

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

    {#if settingsOpen}
      <SettingsPanel id={PANEL_ID.settings} onClose={() => void setPanel('settings', false)} />
    {/if}
  </div>
</div>

<EditLayer />
<div class="sr-only" aria-live="polite" aria-atomic="true" data-print-hide>{editing.announcement}</div>

{#if importing}
  <ImportDialog format={importFormat} onClose={closeImport} />
{/if}
{/if}
