<script lang="ts">
  import Editable from '$components/editing/Editable.svelte'
  import EntryShell from '$components/editing/EntryShell.svelte'
  import type { FieldRef } from '$lib/editing/fields'
  import type { ResolvedSkillGroup } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    presentation = 'classic',
  }: { items: ResolvedSkillGroup[]; presentation?: ResumePresentation } = $props()

  const R = (id: string, key: string): FieldRef => ({ owner: 'item', section: 'skills', id, key })
  const editMode = $derived(editing.mode === 'edit')
</script>

{#if presentation === 'ats'}
  {#each items as group (group.id)}
    {#if group.title || group.items.length}
      <EntryShell section="skills" id={group.id} tag="p" class="ats-skill">{#if group.title}<strong><Editable ref={R(group.id, 'title')} value={group.title} />:</strong>{' '}{:else if editMode}<Editable ref={R(group.id, 'title')} value="" />{/if}<Editable ref={R(group.id, 'items')} value={group.items.join(', ')} /></EntryShell>
    {:else if editMode}
      <EntryShell section="skills" id={group.id} tag="p" class="ats-skill" printHide><Editable ref={R(group.id, 'title')} value="" /><Editable ref={R(group.id, 'items')} value="" /></EntryShell>
    {/if}
  {/each}
{:else}
  {#each items as group (group.id)}
    <EntryShell section="skills" id={group.id} class="skill-row">
      <span class="skill-title"><Editable ref={R(group.id, 'title')} value={group.title} /></span>
      <span class="skill-items"><Editable ref={R(group.id, 'items')} value={group.items.join(' · ')} /></span>
    </EntryShell>
  {/each}
{/if}
