<script lang="ts">
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import Joined from '$components/editing/Joined.svelte'
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { FieldRef } from '$lib/editing/fields'
  import type { Locale, ResolvedEducationItem } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedEducationItem[]; locale: Locale; presentation?: ResumePresentation } = $props()

  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'education', id, key })
  // The GPA target shows "GPA 3.8" but edits the stored "3.8".
  const meta = (item: ResolvedEducationItem) => [
    { ref: R(item.id, 'degree'), value: item.degree },
    { ref: R(item.id, 'field'), value: item.field },
    { ref: R(item.id, 'gpa'), value: item.gpa && `GPA ${item.gpa}` },
  ]
  const editMode = $derived(editing.mode === 'edit')
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const parts = meta(item).slice(0, 2)}
    {@const dates = formatRange(item.dates, locale, t(locale, 'date.present'))}
    <EntryShell section="education" id={item.id} class="ats-entry">
      <div class="ats-entry-head">
        <h3 class="item-title ats-composite-title"><strong><Editable ref={R(item.id, 'school')} value={item.school} /></strong>{#if item.school && parts.some((part) => part.value)}{', '}{/if}<Joined {parts} separator=", " /></h3>
        {#if dates}<p class="item-dates"><Editable ref={R(item.id, 'dates')} value={dates} /></p>{:else if editMode}<p class="item-dates" data-print-hide><Editable ref={R(item.id, 'dates')} value="" /></p>{/if}
      </div>
      {#if item.gpa}<p class="item-meta"><Editable ref={R(item.id, 'gpa')} value={`GPA ${item.gpa}`} /></p>{:else if editMode}<p class="item-meta" data-print-hide><Editable ref={R(item.id, 'gpa')} value="" /></p>{/if}
      {#if item.description}<p class="item-desc"><Editable ref={R(item.id, 'description')} value={item.description} /></p>{:else if editMode}<p class="item-desc" data-print-hide><Editable ref={R(item.id, 'description')} value="" /></p>{/if}
    </EntryShell>
  {/each}
{:else}
  {#each items as item (item.id)}
    <EntryShell section="education" id={item.id}>
      <div class="item-head">
        <h3 class="item-title"><Editable ref={R(item.id, 'school')} value={item.school} /></h3>
        <span class="item-dates"><Editable ref={R(item.id, 'dates')} value={formatRange(item.dates, locale, t(locale, 'date.present'))} /></span>
      </div>
      <p class="item-meta"><Joined parts={meta(item)} separator=" · " /></p>
      {#if item.description}
        <p class="item-desc"><Editable ref={R(item.id, 'description')} value={item.description} /></p>
      {:else if editMode}
        <p class="item-desc" data-print-hide><Editable ref={R(item.id, 'description')} value="" /></p>
      {/if}
    </EntryShell>
  {/each}
{/if}
