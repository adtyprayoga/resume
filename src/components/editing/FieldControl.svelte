<script lang="ts">
  /** One labelled control for a draft value, used by contextual forms and sheets. */
  import BulletRows from '$components/ui/BulletRows.svelte'
  import PhotoField from './PhotoField.svelte'
  import { insertLineBreak } from '$lib/ui/textarea'
  import { t } from '$lib/i18n/ui'
  import { bulletKeyAction, specFor, type DateDraft, type DraftValue, type FieldRef } from '$lib/editing/fields'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const { ref, value, onchange }: { ref: FieldRef; value: DraftValue; onchange: (value: DraftValue) => void } = $props()

  const uid = $props.id()
  const spec = $derived(specFor(ref))
  const label = $derived(t(prefs.uiLocale, spec.labelKey))
  const scopeText = $derived(t(prefs.uiLocale, spec.scope === 'shared' ? 'scope.shared' : 'scope.localized'))
  const placeholder = $derived(
    spec.placeholderKey
      ? t(prefs.uiLocale, spec.placeholderKey)
      : spec.type === 'tags'
        ? t(prefs.uiLocale, 'placeholder.tags')
        : '',
  )
  const inputType = $derived(
    spec.type === 'email' ? 'email' : spec.type === 'tel' ? 'tel' : spec.type === 'url' ? 'url' : 'text',
  )

  const text = $derived(typeof value === 'string' ? value : '')
  const range = $derived((typeof value === 'object' && !Array.isArray(value) ? value : { start: '', end: '', current: false }) as DateDraft)

  const fromInput = (event: Event) => onchange((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value)
</script>

{#if spec.type === 'photo'}
  <PhotoField value={text} {label} {scopeText} {onchange} />
{:else if spec.type === 'lines'}
  <BulletRows value={Array.isArray(value) ? value : []} {label} scope={spec.scope} {onchange} />
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
    {#if spec.type === 'bullet'}
      <textarea id="{uid}-input" class="field-textarea" rows="3" value={text} oninput={fromInput} onkeydown={(event) => {
        const action = bulletKeyAction(event)
        if (action === 'newline') { insertLineBreak(event); return }
        if (action !== 'commit' && action !== 'next') return
        event.preventDefault()
        event.stopPropagation()
        if (action === 'next' && text.trim()) editing.continueBullet()
        else event.currentTarget.form?.requestSubmit()
      }}></textarea>
    {:else if spec.type === 'multiline'}
      <textarea id="{uid}-input" class="field-textarea" rows="3" {placeholder} value={text} oninput={fromInput}></textarea>
    {:else}
      <input id="{uid}-input" class="field-input" type={inputType} {placeholder} value={text} oninput={fromInput} />
    {/if}
  </div>
{/if}
