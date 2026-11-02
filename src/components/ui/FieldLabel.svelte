<script lang="ts">
  /** `scope` shows whether a value is shared or belongs to the locale being edited. */
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
