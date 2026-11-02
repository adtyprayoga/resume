<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import FieldLabel from './FieldLabel.svelte'

  /**
   * One line per entry. The textarea keeps its own draft so typing is never
   * fought by a re-render, which makes the draft stale if `value` changes from
   * outside — callers key this on the active locale.
   */
  let {
    value = $bindable<string[]>([]),
    label,
    scope = 'localized',
    placeholder,
    rows = 4,
  }: {
    value?: string[]
    label: string
    scope?: 'localized' | 'shared'
    placeholder?: string
    rows?: number
  } = $props()

  const id = $props.id()
  let draft = $state(value.join('\n'))

  const commit = () => {
    value = draft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
</script>

<div class="field">
  <FieldLabel {label} {scope} forId={id} />
  <textarea {id} {rows} placeholder={placeholder ?? t(prefs.uiLocale, 'placeholder.lines')} class="field-textarea" bind:value={draft} oninput={commit}
  ></textarea>
</div>
