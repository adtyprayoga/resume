<script lang="ts">
  import { getPaneScope, type FieldScope } from '$lib/ui/scope'

  const {
    label,
    scope = 'localized',
    forId,
  }: { label: string; scope?: FieldScope; forId?: string } = $props()

  const paneScope = getPaneScope()
  const showBadge = $derived(paneScope !== null && scope !== paneScope)
</script>

<label class="field-label" for={forId}>
  {label}
  {#if showBadge}
    <span class="field-scope {scope}">
      {scope === 'shared' ? 'both languages' : 'this language'}
    </span>
  {/if}
</label>
