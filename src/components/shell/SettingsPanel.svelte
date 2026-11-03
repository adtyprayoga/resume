<script lang="ts">
  import SidePanel from './SidePanel.svelte'
  import { sampleDocument } from '../../data/sample'
  import { t } from '$lib/i18n/ui'
  import { LOCALES, type Locale } from '$lib/model/types'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { startBlank } from '$lib/state/actions'
  import { clearDocument } from '$lib/storage/persist'
  import { FONT_SCALES, resumeThemes } from '$lib/themes/index'
  import type { FontScaleKey } from '$lib/themes/types'

  const { id, onClose }: { id: string; onClose: () => void } = $props()
  const uid = $props.id()

  let confirmReset = $state(false)
  let confirmBlank = $state(false)

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

  const blank = () => {
    if (!confirmBlank) {
      confirmBlank = true
      return
    }
    confirmBlank = false
    clearDocument()
    startBlank()
  }

</script>

<SidePanel {id} side="settings" title={t(prefs.uiLocale, 'settings.title')} {onClose}>
  <div class="settings-body">
    <section class="settings-group" style="--i: 0">
      <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.document')}</h3>

      <div class="settings-row">
        <span class="field-label" id="{uid}-layout">{t(prefs.uiLocale, 'app.layout')}</span>
        <div class="toggle-group" role="group" aria-labelledby="{uid}-layout" aria-describedby="{uid}-layout-hint">
          {#each resumeThemes as theme (theme.key)}
            <button type="button"
              aria-label={t(prefs.uiLocale, 'app.layoutOption', { layout: t(prefs.uiLocale, `layout.${theme.presentation}`) })}
              aria-pressed={prefs.themeKey === theme.key}
              onclick={() => editing.setLayout(theme.key)}>
              {t(prefs.uiLocale, `layout.${theme.presentation}`)}
            </button>
          {/each}
        </div>
      </div>
      <p id="{uid}-layout-hint" class="field-hint">{t(prefs.uiLocale, 'layout.atsHint')}</p>

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
          <button type="button" class="tool-btn" onclick={() => resumeDoc.fillUntranslated(otherLocale(locale), locale)}>
            {t(prefs.uiLocale, 'app.fillUntranslated', { count: untranslated, language: otherLocale(locale).toUpperCase() })}
          </button>
        </div>
      {/if}
    </section>

    <section class="settings-group" style="--i: 1">
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

    <section class="settings-group" style="--i: 2">
      <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.data')}</h3>
      <div class="repeat-actions">
        <button type="button" class="tool-btn" onclick={reset}>
          {t(prefs.uiLocale, confirmReset ? 'action.confirmReset' : 'action.reset')}
        </button>
        <button type="button" class="tool-btn" onclick={blank}>
          {t(prefs.uiLocale, confirmBlank ? 'action.confirmBlank' : 'action.startBlank')}
        </button>
      </div>
    </section>

    <section class="settings-group" style="--i: 3">
      <h3 class="settings-subhead">{t(prefs.uiLocale, 'settings.help')}</h3>
      <p class="field-hint">{t(prefs.uiLocale, 'app.printHint')}</p>
      <p class="field-hint">{t(prefs.uiLocale, 'app.pageBreakHint')}</p>
    </section>
  </div>
</SidePanel>
