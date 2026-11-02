<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'

  /** Comma-separated editing for short lists such as a tech stack. */
  let {
    value = $bindable<string[]>([]),
    label,
    scope = 'localized',
    hint = 'Separate with commas.',
  }: {
    value?: string[]
    label: string
    scope?: 'localized' | 'shared'
    hint?: string
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
  <input {id} class="field-input" bind:value={draft} oninput={commit} />
  {#if hint}<p class="field-hint">{hint}</p>{/if}
</div>
