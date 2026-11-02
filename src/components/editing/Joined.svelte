<script lang="ts">
  /**
   * A display line built from several fields, e.g. "Company · Team · Place".
   * Each filled field is its own target, joined exactly as Preview joins the
   * strings, so the printed text is identical. Empty fields only appear as
   * print-hidden prompts after the line, in Edit mode.
   */
  import Editable from './Editable.svelte'
  import type { FieldRef } from '$lib/editing/fields'
  import { editing } from '$lib/state/editing.svelte'

  const { parts, separator }: { parts: { ref: FieldRef; value: string }[]; separator: string } = $props()

  const filled = $derived(parts.filter((part) => part.value))
  const empty = $derived(editing.mode === 'edit' ? parts.filter((part) => !part.value) : [])
</script>

{#each filled as part, index (index)}{#if index > 0}{separator}{/if}<Editable ref={part.ref} value={part.value} />{/each}{#each empty as part, index (index)}<Editable ref={part.ref} value="" />{/each}
