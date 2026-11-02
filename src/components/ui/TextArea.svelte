<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'

  let {
    value = $bindable(''),
    label,
    scope = 'localized',
    placeholder = '',
    hint = '',
    rows = 3,
  }: {
    value?: string
    label: string
    scope?: 'localized' | 'shared'
    placeholder?: string
    hint?: string
    rows?: number
  } = $props()

  const id = $props.id()
</script>

<div class="field">
  <FieldLabel {label} {scope} forId={id} />
  <textarea {id} {rows} {placeholder} class="field-textarea" bind:value></textarea>
  {#if hint}<p class="field-hint">{hint}</p>{/if}
</div>
