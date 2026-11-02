<script lang="ts">
  /**
   * One stored field as it appears on the paper. In Preview it is the bare
   * text, so the rendered resume is unchanged; in Edit it becomes a focusable
   * target, or a print-hidden prompt when empty. The target carries the
   * field's identity, never its text.
   */
  import type { Snippet } from 'svelte'
  import { t } from '$lib/i18n/ui'
  import { refKey, specFor, type FieldRef } from '$lib/editing/fields'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const {
    ref,
    value,
    prompt = true,
    children,
  }: {
    ref: FieldRef
    /** Displayed text; may be shortened from what is stored. */
    value: string
    /** Show an Add prompt in Edit mode when empty. */
    prompt?: boolean
    /** Custom display, e.g. the photo. */
    children?: Snippet
  } = $props()

  const key = $derived(refKey(ref))
  const spec = $derived(specFor(ref))
  const label = $derived(t(prefs.uiLocale, spec.labelKey))
  const name = $derived(
    spec.type === 'photo' || children
      ? t(prefs.uiLocale, 'edit.field', { field: label })
      : t(prefs.uiLocale, 'edit.target', { field: label, value }),
  )

  const open = (event: Event) => {
    event.stopPropagation()
    editing.begin({ kind: 'field', ref })
  }

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open(event)
    }
  }
</script>

{#if editing.mode !== 'edit'}{#if children}{@render children()}{:else}{value}{/if}{:else if value}<span class="editable" class:editable-block={!!children} role="button" tabindex="0" data-edit-key={key} aria-label={name} onclick={open} {onkeydown}>{#if children}{@render children()}{:else}{value}{/if}</span>{:else if prompt}<span class="edit-prompt" role="button" tabindex="0" data-print-hide data-edit-key={key} aria-label={t(prefs.uiLocale, 'edit.add', { field: label })} onclick={open} {onkeydown}>+ {label}</span>{/if}
