<script lang="ts">
  import type { ResolvedSkillGroup } from '$lib/model/types'

  const { items }: { items: ResolvedSkillGroup[] } = $props()
</script>

{#each items as group (group.id)}
  <article data-break-atom class="skill-row">
    <span class="skill-title">{group.title}</span>
    <span class="skill-items">{group.items.join(' · ')}</span>
  </article>
{/each}
