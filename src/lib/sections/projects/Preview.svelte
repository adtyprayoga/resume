<script lang="ts">
  import EditableBullets from '$components/editing/EditableBullets.svelte'
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { FieldRef } from '$lib/editing/fields'
  import type { Locale, ResolvedProjectItem } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedProjectItem[]; locale: Locale; presentation?: ResumePresentation } = $props()

  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'projects', id, key })
  const editMode = $derived(editing.mode === 'edit')
</script>

{#snippet tail(item: ResolvedProjectItem)}
  {#if item.description}
    <p class="item-desc"><Editable ref={R(item.id, 'description')} value={item.description} /></p>
  {:else if editMode}
    <p class="item-desc" data-print-hide><Editable ref={R(item.id, 'description')} value="" /></p>
  {/if}
  <EditableBullets section="projects" id={item.id} bullets={item.bullets} />
  {#if item.link}
    <p class="item-link"><Editable ref={R(item.id, 'link')} value={item.link} /></p>
  {:else if editMode}
    <p class="item-link" data-print-hide><Editable ref={R(item.id, 'link')} value="" /></p>
  {/if}
{/snippet}

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const dates = formatRange(item.dates, locale, t(locale, 'date.present'))}
    {@const tech = item.techStack.join(', ')}
    <EntryShell section="projects" id={item.id} class="ats-entry">
      <div class="ats-entry-head ats-project-head">
        <h3 class="item-title ats-composite-title"><strong><Editable ref={R(item.id, 'name')} value={item.name} /></strong>{#if item.role}{' — '}<em><Editable ref={R(item.id, 'role')} value={item.role} /></em>{:else if editMode}<Editable ref={R(item.id, 'role')} value="" />{/if}{#if tech}{' ('}<Editable ref={R(item.id, 'techStack')} value={tech} />{')'}{:else if editMode}<Editable ref={R(item.id, 'techStack')} value="" />{/if}</h3>
        {#if dates}<p class="item-dates"><Editable ref={R(item.id, 'dates')} value={dates} /></p>{:else if editMode}<p class="item-dates" data-print-hide><Editable ref={R(item.id, 'dates')} value="" /></p>{/if}
      </div>
      {@render tail(item)}
    </EntryShell>
  {/each}
{:else}
  {#each items as item (item.id)}
    {@const tech = item.techStack.join(' · ')}
    <EntryShell section="projects" id={item.id}>
      <div class="item-head">
        <h3 class="item-title">
          <Editable ref={R(item.id, 'name')} value={item.name} />{#if item.role}<span class="item-role">&nbsp;— <Editable ref={R(item.id, 'role')} value={item.role} /></span>{:else if editMode}<Editable ref={R(item.id, 'role')} value="" />{/if}
        </h3>
        <span class="item-dates"><Editable ref={R(item.id, 'dates')} value={formatRange(item.dates, locale, t(locale, 'date.present'))} /></span>
      </div>
      {#if tech}
        <p class="item-meta"><Editable ref={R(item.id, 'techStack')} value={tech} /></p>
      {:else if editMode}
        <p class="item-meta" data-print-hide><Editable ref={R(item.id, 'techStack')} value="" /></p>
      {/if}
      {@render tail(item)}
    </EntryShell>
  {/each}
{/if}
