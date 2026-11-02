<script lang="ts">
  import type { Snippet } from 'svelte'
  import FieldControl from './FieldControl.svelte'
  import { t } from '$lib/i18n/ui'
  import { refKey, type FieldRef } from '$lib/editing/fields'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const {
    title,
    refs,
    onApply,
    onCancel,
    actions,
    variant = 'popover',
  }: {
    title: string
    refs: FieldRef[]
    onApply: () => void
    onCancel: () => void
    /** Extra actions, e.g. move or delete for an entry. */
    actions?: Snippet | undefined
    variant?: 'popover' | 'sheet'
  } = $props()

  const uid = $props.id()
  let body = $state<HTMLDivElement>()

  $effect(() => {
    body?.querySelector<HTMLElement>('input:not([type="file"]):not([type="checkbox"]), textarea, input, button')?.focus()
  })

  const onkeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onApply()
    }
  }
</script>

<!-- Escape and Ctrl/Cmd+Enter are shortcuts for the form's own buttons. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  class="edit-form {variant}"
  aria-labelledby="{uid}-title"
  novalidate
  onsubmit={(event) => {
    event.preventDefault()
    onApply()
  }}
  {onkeydown}
>
  <header class="edit-form-head">
    <h2 id="{uid}-title" class="edit-form-title">{title}</h2>
  </header>
  <div class="edit-form-body" bind:this={body}>
    {#each refs as ref (refKey(ref))}
      <FieldControl
        {ref}
        value={editing.active?.draft[refKey(ref)] ?? ''}
        onchange={(value) => editing.setDraft(refKey(ref), value)}
      />
    {/each}
  </div>
  <footer class="edit-form-actions">
    {#if actions}<div class="edit-form-extra">{@render actions()}</div>{/if}
    <button type="button" class="tool-btn" onclick={onCancel}>{t(prefs.uiLocale, 'action.cancel')}</button>
    <button type="submit" class="tool-btn primary">{t(prefs.uiLocale, 'action.apply')}</button>
  </footer>
</form>
