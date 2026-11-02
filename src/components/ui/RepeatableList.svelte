<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte'

  const {
    items,
    addLabel,
    onAdd,
    onRemove,
    onMove,
    children,
  }: {
    items: T[]
    addLabel: string
    onAdd: () => void
    onRemove: (id: string) => void
    onMove: (id: string, delta: number) => void
    children: Snippet<[T, number]>
  } = $props()

  /**
   * Deleting is destructive and autosave means there is no undo, so a
   * second click is required. Arming is per-item and resets on any other action.
   */
  let armed = $state<string | null>(null)

  const remove = (id: string) => {
    if (armed === id) {
      armed = null
      onRemove(id)
    } else {
      armed = id
    }
  }
</script>

<div class="repeat">
  {#each items as item, index (item.id)}
    <article class="repeat-item">
      <header class="repeat-head">
        <span class="repeat-index">{index + 1}</span>
        <div class="repeat-actions">
          <button
            type="button"
            class="repeat-btn"
            disabled={index === 0}
            aria-label="Move up"
            onclick={() => { armed = null; onMove(item.id, -1) }}>↑</button
          >
          <button
            type="button"
            class="repeat-btn"
            disabled={index === items.length - 1}
            aria-label="Move down"
            onclick={() => { armed = null; onMove(item.id, 1) }}>↓</button
          >
          <button
            type="button"
            class="repeat-btn danger"
            onclick={() => remove(item.id)}
          >{armed === item.id ? 'Confirm' : 'Delete'}</button>
        </div>
      </header>
      {@render children(item, index)}
    </article>
  {/each}

  <button type="button" class="repeat-add" onclick={() => { armed = null; onAdd() }}>
    {addLabel}
  </button>
</div>
