<script lang="ts" generics="T extends { id: string }">
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
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

  // Autosave means no undo, so delete needs a confirming second click.
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
            aria-label={t(prefs.uiLocale, 'action.moveUp')}
            onclick={() => { armed = null; onMove(item.id, -1) }}>↑</button
          >
          <button
            type="button"
            class="repeat-btn"
            disabled={index === items.length - 1}
            aria-label={t(prefs.uiLocale, 'action.moveDown')}
            onclick={() => { armed = null; onMove(item.id, 1) }}>↓</button
          >
          <button
            type="button"
            class="repeat-btn danger"
            onclick={() => remove(item.id)}
          >{t(prefs.uiLocale, armed === item.id ? 'action.confirm' : 'action.delete')}</button>
        </div>
      </header>
      {@render children(item, index)}
    </article>
  {/each}

  <button type="button" class="repeat-add" onclick={() => { armed = null; onAdd() }}>
    {addLabel}
  </button>
</div>
