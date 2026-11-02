<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'

  let {
    value = $bindable(''),
    label,
    scope = 'localized',
    placeholder = '',
    hint = '',
    type = 'text',
    normalize,
  }: {
    value?: string
    label: string
    scope?: 'localized' | 'shared'
    placeholder?: string
    hint?: string
    type?: 'text' | 'email' | 'url' | 'tel'
    /** Applied on blur, so it never fights the user mid-typing. */
    normalize?: (value: string) => string
  } = $props()

  const id = $props.id()
</script>

<div class="field">
  <FieldLabel {label} {scope} forId={id} />
  <input
    {id}
    {type}
    {placeholder}
    class="field-input"
    bind:value
    onblur={normalize ? () => (value = normalize(value)) : undefined}
  />
  {#if hint}<p class="field-hint">{hint}</p>{/if}
</div>
