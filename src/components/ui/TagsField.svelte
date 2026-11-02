<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import FieldLabel from './FieldLabel.svelte'

  /** Comma-separated, for short lists such as a tech stack. */
  let {
    value = $bindable<string[]>([]),
    label,
    scope = 'localized',
    placeholder,
  }: {
    value?: string[]
    label: string
    scope?: 'localized' | 'shared'
    placeholder?: string
  } = $props()

  const id = $props.id()
  let draft = $state(value.join(', '))

  const commit = () => {
    value = draft
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
</script>

<div class="field">
  <FieldLabel {label} {scope} forId={id} />
  <input {id} placeholder={placeholder ?? t(prefs.uiLocale, 'placeholder.tags')} class="field-input" bind:value={draft} oninput={commit} />
</div>
