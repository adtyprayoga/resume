<script lang="ts">
  /** One labelled control for a draft value, used by contextual forms and sheets. */
  import PhotoField from './PhotoField.svelte'
  import { t } from '$lib/i18n/ui'
  import { specFor, type DateDraft, type DraftValue, type FieldRef } from '$lib/editing/fields'
  import { prefs } from '$lib/state/preferences.svelte'

  const { ref, value, onchange }: { ref: FieldRef; value: DraftValue; onchange: (value: DraftValue) => void } = $props()

  const uid = $props.id()
  const spec = $derived(specFor(ref))
  const label = $derived(t(prefs.uiLocale, spec.labelKey))
  const scopeText = $derived(t(prefs.uiLocale, spec.scope === 'shared' ? 'scope.shared' : 'scope.localized'))
  const placeholder = $derived(
    spec.placeholderKey
      ? t(prefs.uiLocale, spec.placeholderKey)
      : spec.type === 'lines'
        ? t(prefs.uiLocale, 'placeholder.lines')
        : spec.type === 'tags'
          ? t(prefs.uiLocale, 'placeholder.tags')
          : '',
  )
  const inputType = $derived(
    spec.type === 'email' ? 'email' : spec.type === 'tel' ? 'tel' : spec.type === 'url' ? 'url' : 'text',
  )

  const text = $derived(typeof value === 'string' ? value : '')
  const range = $derived((typeof value === 'string' ? { start: '', end: '', current: false } : value) as DateDraft)

  const fromInput = (event: Event) => onchange((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value)
</script>

{#if spec.type === 'photo'}
  <PhotoField value={text} {label} {scopeText} {onchange} />
{:else if spec.type === 'dates'}
  <fieldset class="field date-field">
    <legend class="field-label"><span>{label}</span><span class="field-scope {spec.scope}">{scopeText}</span></legend>
    <div class="date-row">
      <input
        class="field-input"
        aria-label={t(prefs.uiLocale, 'field.from')}
        placeholder={t(prefs.uiLocale, 'placeholder.startDate')}
        value={range.start}
        oninput={(event) => onchange({ ...range, start: event.currentTarget.value })}
      />
      <span class="date-sep" aria-hidden="true">–</span>
      <input
        class="field-input"
        aria-label={t(prefs.uiLocale, 'field.to')}
        placeholder={t(prefs.uiLocale, 'placeholder.endDate')}
        disabled={range.current}
        value={range.end}
        oninput={(event) => onchange({ ...range, end: event.currentTarget.value })}
      />
      <label class="field-check">
        <input type="checkbox" checked={range.current} onchange={(event) => onchange({ ...range, current: event.currentTarget.checked })} />
        {t(prefs.uiLocale, 'date.present')}
      </label>
    </div>
  </fieldset>
{:else}
  <div class="field">
    <label class="field-label" for="{uid}-input">{label}<span class="field-scope {spec.scope}">{scopeText}</span></label>
    {#if spec.type === 'multiline' || spec.type === 'lines'}
      <textarea id="{uid}-input" class="field-textarea" rows={spec.type === 'lines' ? 5 : 3} {placeholder} value={text} oninput={fromInput}></textarea>
    {:else}
      <input id="{uid}-input" class="field-input" type={inputType} {placeholder} value={text} oninput={fromInput} />
    {/if}
  </div>
{/if}
