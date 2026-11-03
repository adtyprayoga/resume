<script lang="ts">
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import Joined from '$components/editing/Joined.svelte'
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { FieldRef } from '$lib/editing/fields'
  import type { Locale, ResolvedExperienceItem } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedExperienceItem[]; locale: Locale; presentation?: ResumePresentation } = $props()

  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'experience', id, key })
  const meta = (item: ResolvedExperienceItem) => [
    { ref: R(item.id, 'company'), value: item.company },
    { ref: R(item.id, 'team'), value: item.team },
    { ref: R(item.id, 'location'), value: item.location },
  ]
  const editMode = $derived(editing.mode === 'edit')
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const parts = meta(item).slice(1)}
    {@const dates = formatRange(item.dates, locale, t(locale, 'date.present'))}
    <EntryShell section="experience" id={item.id} class="ats-entry">
      <div class="ats-entry-head">
        <h3 class="item-title"><Editable ref={R(item.id, 'company')} value={item.company} /></h3>
        {#if dates}<p class="item-dates"><Editable ref={R(item.id, 'dates')} value={dates} /></p>{:else if editMode}<p class="item-dates" data-print-hide><Editable ref={R(item.id, 'dates')} value="" /></p>{/if}
      </div>
      {#if item.role}<p class="ats-role"><Editable ref={R(item.id, 'role')} value={item.role} /></p>{:else if editMode}<p class="ats-role" data-print-hide><Editable ref={R(item.id, 'role')} value="" /></p>{/if}
      {#if parts.some((part) => part.value)}<p class="item-meta"><Joined {parts} separator=", " /></p>{:else if editMode}<p class="item-meta" data-print-hide><Joined {parts} separator=", " /></p>{/if}
      {#if item.bullets.length}
        <ul class="item-bullets">
          {#each item.bullets as bullet, index (index)}
            <li><Editable ref={R(item.id, 'bullets')} value={bullet} /></li>
          {/each}
        </ul>
      {:else if editMode}
        <p class="item-desc" data-print-hide><Editable ref={R(item.id, 'bullets')} value="" /></p>
      {/if}
    </EntryShell>
  {/each}
{:else}
  {#each items as item (item.id)}
    <EntryShell section="experience" id={item.id}>
      <div class="item-head">
        <h3 class="item-title"><Editable ref={R(item.id, 'role')} value={item.role} /></h3>
        <span class="item-dates"><Editable ref={R(item.id, 'dates')} value={formatRange(item.dates, locale, t(locale, 'date.present'))} /></span>
      </div>
      <p class="item-meta"><Joined parts={meta(item)} separator=" · " /></p>
      {#if item.bullets.length}
        <ul class="item-bullets">
          {#each item.bullets as bullet, index (index)}
            <li><Editable ref={R(item.id, 'bullets')} value={bullet} /></li>
          {/each}
        </ul>
      {:else if editMode}
        <p class="item-desc" data-print-hide><Editable ref={R(item.id, 'bullets')} value="" /></p>
      {/if}
    </EntryShell>
  {/each}
{/if}
