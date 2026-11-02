<script lang="ts">
  import ImportDialog from './ImportDialog.svelte'
  import { sampleDocument } from '../data/sample'
  import { t, translatedMessage, type UiMessage } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import { recovery } from '$lib/state/recovery.svelte'

  let importing = $state(false)
  let confirmReset = $state(false)
  let failure = $state<({ message: string } & Partial<UiMessage>) | null>(null)

  const status = $derived(recovery.status)
  const unavailable = $derived(status?.kind === 'unavailable')

  /** The stored string as read: not parsed, not reserialised. */
  const download = () => {
    if (status?.kind !== 'recovery') return
    const blob = new Blob([status.raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'resume-original-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const retry = () => {
    failure = null
    confirmReset = false
    recovery.open()
  }

  const reset = () => {
    if (!confirmReset) {
      confirmReset = true
      return
    }
    confirmReset = false
    const saved = recovery.commit(sampleDocument())
    failure = saved.kind === 'error' ? saved : null
  }
</script>

{#if status}
  <main class="recovery" data-print-hide>
    <h1 class="recovery-title">
      {t(prefs.uiLocale, unavailable ? 'recovery.unavailableTitle' : 'recovery.title')}
    </h1>
    <p class="save-status error">{translatedMessage(prefs.uiLocale, status, status.error)}</p>
    <p>{t(prefs.uiLocale, unavailable ? 'recovery.unavailableBody' : 'recovery.body')}</p>

    {#if failure}
      <p role="alert" class="save-status error">{translatedMessage(prefs.uiLocale, failure, failure.message)}</p>
    {/if}

    <div class="toolbar">
      {#if status.kind === 'recovery'}
        <button type="button" class="tool-btn primary" onclick={download}>{t(prefs.uiLocale, 'recovery.download')}</button>
      {/if}
      <button type="button" class="tool-btn" onclick={retry}>{t(prefs.uiLocale, 'recovery.retry')}</button>
      {#if status.kind === 'recovery'}
        <button type="button" class="tool-btn" onclick={() => (importing = true)}>{t(prefs.uiLocale, 'recovery.import')}</button>
        <button type="button" class="tool-btn" onclick={reset}>
          {t(prefs.uiLocale, confirmReset ? 'recovery.confirmReset' : 'recovery.reset')}
        </button>
      {/if}
    </div>
  </main>

  {#if importing}
    <ImportDialog onClose={() => (importing = false)} commit={(doc) => recovery.commit(doc)} />
  {/if}
{/if}

<style>
  .recovery { max-width: 40rem; margin: 3rem auto; padding: 2rem; display: grid; gap: 1rem; background: var(--color-surface); border: 1px solid var(--color-hairline); border-radius: 0; box-shadow: var(--shadow-card); }
  .recovery-title { margin: 0; font-size: var(--text-h1); font-weight: 700; letter-spacing: var(--tracking-tight); line-height: 1.1; }
</style>
