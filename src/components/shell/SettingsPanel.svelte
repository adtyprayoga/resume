<script lang="ts">
  import Icon from './Icon.svelte'
  import SectionSettings from '../editor/SectionSettings.svelte'
  import { sampleDocument } from '../../data/sample'
  import { t } from '$lib/i18n/ui'
  import { LOCALES, type Locale } from '$lib/model/types'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { clearDocument } from '$lib/storage/persist'
  import { FONT_SCALES } from '$lib/themes/index'
  import type { FontScaleKey } from '$lib/themes/types'
  import { focusTrap } from '$lib/ui/focusTrap'

  const { onClose }: { onClose: () => void } = $props()
  const uid = $props.id()

  let confirmReset = $state(false)

  const locale = $derived(prefs.documentLocale)
  const untranslated = $derived(resumeDoc.untranslatedCount(locale))
  const otherLocale = (value: Locale): Locale => (value === 'id' ? 'en' : 'id')
  const sizeLabel = (scale: FontScaleKey) =>
    scale === 'standard' ? 'M' : scale === 'xsmall' ? 'XS' : scale === 'small' ? 'S' : 'L'

  const reset = () => {
    if (!confirmReset) {
      confirmReset = true
      return
    }
    confirmReset = false
    editing.cancel()
    clearDocument()
    resumeDoc.replace(sampleDocument())
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="drawer-overlay"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}
>
  <div class="drawer settings-panel" role="dialog" aria-modal="true" aria-labelledby="{uid}-title" use:focusTrap>
    <header class="drawer-head settings-head">
      <h2 id="{uid}-title" class="settings-title">{t(prefs.uiLocale, 'settings.title')}</h2>
      <button type="button" class="icon-btn" aria-label={t(prefs.uiLocale, 'action.close')} onclick={onClose}>
        <Icon name="close" />
      </button>
    </header>

    <div class="drawer-body settings-body">
      <section class="settings-group">
        <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.document')}</h3>

        <div class="settings-row">
          <span class="field-label" id="{uid}-doc">{t(prefs.uiLocale, 'app.resumeLanguage')}</span>
          <div class="toggle-group" role="group" aria-labelledby="{uid}-doc">
            {#each LOCALES as option (option)}
              <button
                type="button"
                aria-label={t(prefs.uiLocale, 'app.documentLanguageOption', { language: t(prefs.uiLocale, `language.${option}`) })}
                aria-pressed={prefs.documentLocale === option}
                onclick={() => editing.setDocumentLocale(option)}
              >
                {option.toUpperCase()}
              </button>
            {/each}
          </div>
        </div>

        <div class="settings-row">
          <span class="field-label" id="{uid}-size">{t(prefs.uiLocale, 'app.fontSize')}</span>
          <div class="toggle-group" role="group" aria-labelledby="{uid}-size">
            {#each Object.keys(FONT_SCALES) as FontScaleKey[] as scale (scale)}
              <button
                type="button"
                aria-label={t(prefs.uiLocale, 'app.fontSizeOption', { size: t(prefs.uiLocale, `size.${scale}`) })}
                aria-pressed={prefs.fontScale === scale}
                onclick={() => (prefs.fontScale = scale)}
              >
                {sizeLabel(scale)}
              </button>
            {/each}
          </div>
        </div>

        <div class="settings-row">
          <div class="toggle-group">
            <button
              type="button"
              aria-pressed={prefs.showPageBreaks}
              onclick={() => (prefs.showPageBreaks = !prefs.showPageBreaks)}
            >
              {t(prefs.uiLocale, 'app.pageBreaks')}
            </button>
          </div>
        </div>

        {#if untranslated > 0}
          <div class="settings-row">
            <button type="button" class="tool-btn" onclick={() => resumeDoc.copyLocale(otherLocale(locale), locale)}>
              {t(prefs.uiLocale, 'app.fillUntranslated', { count: untranslated, language: otherLocale(locale).toUpperCase() })}
            </button>
          </div>
        {/if}
      </section>

      <section class="settings-group">
        <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.sections')}</h3>
        <SectionSettings />
      </section>

      <section class="settings-group">
        <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.interface')}</h3>
        <div class="settings-row">
          <span class="field-label" id="{uid}-ui">{t(prefs.uiLocale, 'app.interfaceLanguage')}</span>
          <div class="toggle-group" role="group" aria-labelledby="{uid}-ui">
            {#each LOCALES as option (option)}
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
        </div>
      </section>

      <section class="settings-group">
        <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.data')}</h3>
        <button type="button" class="tool-btn" onclick={reset}>
          {t(prefs.uiLocale, confirmReset ? 'action.confirmReset' : 'action.reset')}
        </button>
      </section>

      <section class="settings-group">
        <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.help')}</h3>
        <p class="field-hint">{t(prefs.uiLocale, 'app.printHint')}</p>
        <p class="field-hint">{t(prefs.uiLocale, 'app.pageBreakHint')}</p>
        <p class="field-hint">{t(prefs.uiLocale, 'app.demoNotice')}</p>
      </section>
    </div>
  </div>
</div>
