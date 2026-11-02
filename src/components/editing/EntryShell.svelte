<script lang="ts">
  /**
   * The element of one entry. In Preview it is exactly the element the layout
   * always rendered; in Edit it can be selected, which reveals its actions.
   */
  import type { Snippet } from 'svelte'
  import EntryActions from './EntryActions.svelte'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { editing } from '$lib/state/editing.svelte'

  const {
    section,
    id,
    tag = 'article',
    class: className = undefined,
    printHide = false,
    children,
  }: {
    section: ListSectionKind
    id: string
    tag?: 'article' | 'p'
    class?: string | undefined
    /** An entry with nothing to print, shown only so it can be filled. */
    printHide?: boolean
    children: Snippet
  } = $props()

  const editMode = $derived(editing.mode === 'edit')
  const selected = $derived(editMode && editing.selected?.section === section && editing.selected.id === id)

  const isPhone = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches

  // Text targets stop propagation, so this only sees taps between fields —
  // and on the entry's own action buttons, which act for themselves.
  const onclick = (event: MouseEvent) => {
    if ((event.target as Element).closest('.entry-actions')) return
    editing.select(section, id)
    if (isPhone()) editing.begin({ kind: 'entry', section, id })
  }
</script>

{#if editMode}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_static_element_interactions -->
  <svelte:element
    this={tag}
    class={className}
    class:entry-selected={selected}
    data-break-atom
    data-entry="{section}:{id}"
    data-print-hide={printHide ? true : undefined}
    tabindex="-1"
    {onclick}
    onfocusin={() => editing.select(section, id)}
  >{@render children()}{#if selected}<EntryActions {section} {id} />{/if}</svelte:element>
{:else}
  <svelte:element this={tag} class={className} data-break-atom>{@render children()}</svelte:element>
{/if}
