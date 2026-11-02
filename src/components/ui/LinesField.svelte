<script lang="ts">
  import FieldLabel from './FieldLabel.svelte'

  /**
   * Edits a string array as one line per entry — the natural shape for resume
   * bullets.
   *
   * The textarea keeps its own draft text so that typing is never fought by a
   * re-render. That makes the draft stale if `value` changes from outside, so
   * callers key this component on whatever can change it (the active locale).
   */
  let {
    value = $bindable<string[]>([]),
    label,
    scope = 'localized',
    hint = 'One per line.',
    rows = 4,
  }: {
    value?: string[]
    label: string
    scope?: 'localized' | 'shared'
    hint?: string
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
  <textarea {id} {rows} class="field-textarea" bind:value={draft} oninput={commit}></textarea>
  {#if hint}<p class="field-hint">{hint}</p>{/if}
</div>
