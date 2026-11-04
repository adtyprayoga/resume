<script lang="ts">
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import Joined from '$components/editing/Joined.svelte'
  import type { FieldRef } from '$lib/editing/fields'
  import type { Locale, ResolvedReferenceItem } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const { items, locale: _locale, presentation = 'classic' }: {
    items: ResolvedReferenceItem[]; locale: Locale; presentation?: ResumePresentation
  } = $props()
  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'references', id, key })
  const editMode = $derived(editing.mode === 'edit')
</script>

{#each items as item (item.id)}
  <EntryShell section="references" id={item.id} class={presentation === 'ats' ? 'ats-entry' : ''}>
    {#if presentation === 'ats'}
      {#each ['name', 'position', 'phone', 'email', 'note'] as const as key}
        {@const value = item[key]}
        {#if value || editMode}
          <p class={key === 'name' ? 'item-title' : key === 'note' ? 'item-desc' : 'item-meta'} data-print-hide={!value ? true : undefined}><Editable ref={R(item.id, key)} {value} /></p>
        {/if}
      {/each}
    {:else}
      {#if item.name || editMode}<h3 class="item-title" data-print-hide={!item.name ? true : undefined}><Editable ref={R(item.id, 'name')} value={item.name} /></h3>{/if}
      {#if item.position || item.phone || item.email || editMode}
        <p class="item-meta" data-print-hide={!item.position && !item.phone && !item.email ? true : undefined}><Editable ref={R(item.id, 'position')} value={item.position} />{#if item.position && (item.phone || item.email)}{' - '}{/if}<Joined parts={[{ ref: R(item.id, 'phone'), value: item.phone }, { ref: R(item.id, 'email'), value: item.email }]} separator=" | " /></p>
      {/if}
      {#if item.note || editMode}<p class="item-desc" data-print-hide={!item.note ? true : undefined}><Editable ref={R(item.id, 'note')} value={item.note} /></p>{/if}
    {/if}
  </EntryShell>
{/each}
