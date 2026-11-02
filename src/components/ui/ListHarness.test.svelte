<script lang="ts">
  /** Supplies the item snippet RepeatableList requires, which a bare render cannot. */
  import RepeatableList from './RepeatableList.svelte'

  const props: {
    items: { id: string }[]
    addLabel: string
    onAdd: () => void
    onRemove: (id: string) => void
    onMove: (id: string, delta: number) => void
  } = $props()
</script>

<RepeatableList {...props}>
  {#snippet children(item)}
    <span data-testid="row">{item.id}</span>
  {/snippet}
</RepeatableList>
