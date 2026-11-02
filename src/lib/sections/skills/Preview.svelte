<script lang="ts">
  import type { ResolvedSkillGroup } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    presentation = 'classic',
  }: { items: ResolvedSkillGroup[]; presentation?: ResumePresentation } = $props()
</script>

{#if presentation === 'ats'}
  {#each items as group (group.id)}
    {#if group.title || group.items.length}
      <p class="ats-skill" data-break-atom>
        {#if group.title}<strong>{group.title}:</strong>{' '}{/if}{group.items.join(', ')}
      </p>
    {/if}
  {/each}
{:else}
  {#each items as group (group.id)}
    <article data-break-atom class="skill-row">
      <span class="skill-title">{group.title}</span>
      <span class="skill-items">{group.items.join(' · ')}</span>
    </article>
  {/each}
{/if}
