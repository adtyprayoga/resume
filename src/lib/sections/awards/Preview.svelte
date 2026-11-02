<script lang="ts">
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import Joined from '$components/editing/Joined.svelte'
  import { formatMonth } from '$lib/model/dates'
  import type { FieldRef } from '$lib/editing/fields'
  import type { Locale, ResolvedAwardItem } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedAwardItem[]; locale: Locale; presentation?: ResumePresentation } = $props()

  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'awards', id, key })
  const editMode = $derived(editing.mode === 'edit')
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const date = formatMonth(item.date, locale)}
    <EntryShell section="awards" id={item.id} class="ats-entry">
      <h3 class="item-title"><Editable ref={R(item.id, 'title')} value={item.title} /></h3>
      {#if item.issuer}<p class="item-meta"><Editable ref={R(item.id, 'issuer')} value={item.issuer} /></p>{:else if editMode}<p class="item-meta" data-print-hide><Editable ref={R(item.id, 'issuer')} value="" /></p>{/if}
      {#if date}<p class="item-dates"><Editable ref={R(item.id, 'date')} value={date} /></p>{:else if editMode}<p class="item-dates" data-print-hide><Editable ref={R(item.id, 'date')} value="" /></p>{/if}
      {#if item.description}<p class="item-desc"><Editable ref={R(item.id, 'description')} value={item.description} /></p>{:else if editMode}<p class="item-desc" data-print-hide><Editable ref={R(item.id, 'description')} value="" /></p>{/if}
    </EntryShell>
  {/each}
{:else}
  {#each items as item (item.id)}
    {@const parts = [{ ref: R(item.id, 'issuer'), value: item.issuer }, { ref: R(item.id, 'description'), value: item.description }]}
    <EntryShell section="awards" id={item.id}>
      <div class="item-head">
        <h3 class="item-title"><Editable ref={R(item.id, 'title')} value={item.title} /></h3>
        <span class="item-dates"><Editable ref={R(item.id, 'date')} value={formatMonth(item.date, locale)} /></span>
      </div>
      {#if item.issuer || item.description}
        <p class="item-meta"><Joined {parts} separator=" · " /></p>
      {:else if editMode}
        <p class="item-meta" data-print-hide><Joined {parts} separator=" · " /></p>
      {/if}
    </EntryShell>
  {/each}
{/if}
