<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'

  let {
    value = $bindable(''),
    label,
    scope = 'localized',
    placeholder = '',
    hint = '',
    type = 'text',
  }: {
    value?: string
    label: string
    scope?: 'localized' | 'shared'
    placeholder?: string
    hint?: string
    type?: 'text' | 'email' | 'url' | 'tel'
  } = $props()

  const id = $props.id()
</script>

<div class="field">
  <FieldLabel {label} {scope} forId={id} />
  <input {id} {type} {placeholder} class="field-input" bind:value />
  {#if hint}<p class="field-hint">{hint}</p>{/if}
</div>
