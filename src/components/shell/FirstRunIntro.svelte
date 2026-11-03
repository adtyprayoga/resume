<script lang="ts">
  import Icon from './Icon.svelte'
  import { isSampleDocument } from '../../data/sample'
  import { t } from '$lib/i18n/ui'
  import { startBlank } from '$lib/state/actions'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const uid = $props.id()

  /** Only for the untouched sample: a returning user's own resume never gets this. */
  const visible = $derived(
    !prefs.introDismissed && editing.mode === 'preview' && isSampleDocument(resumeDoc.current),
  )

  const blank = () => {
    startBlank()
    editing.enter()
  }
</script>

{#if visible}
  <section class="intro" aria-labelledby="{uid}-title" data-print-hide>
    <div class="intro-card">
      <div class="intro-head">
        <h2 id="{uid}-title" class="intro-title">{t(prefs.uiLocale, 'intro.title')}</h2>
        <button
          type="button"
          class="icon-btn"
          aria-label={t(prefs.uiLocale, 'intro.dismiss')}
          onclick={() => (prefs.introDismissed = true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <p class="intro-text">{t(prefs.uiLocale, 'intro.body')}</p>
      <div class="intro-actions">
        <button type="button" class="tool-btn" onclick={blank}>{t(prefs.uiLocale, 'action.startBlank')}</button>
      </div>
    </div>
  </section>
{/if}
