<script lang="ts">
  /**
   * `scope` tells the user whether a value is shared across both languages or
   * belongs to the one being edited — which is what makes it predictable what
   * will change when they switch locale.
   */
  const {
    label,
    scope = 'localized',
    forId,
  }: { label: string; scope?: 'localized' | 'shared'; forId?: string } = $props()
</script>

<label class="field-label" for={forId}>
  {label}
  <span class="field-scope {scope}">{scope === 'shared' ? 'BOTH' : 'THIS'}</span>
</label>
