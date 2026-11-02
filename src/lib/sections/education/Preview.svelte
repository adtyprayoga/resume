<script lang="ts">
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { Locale, ResolvedEducationItem } from '$lib/model/types'

  const { items, locale }: { items: ResolvedEducationItem[]; locale: Locale } = $props()
</script>

{#each items as item (item.id)}
  <article data-break-atom>
    <div class="item-head">
      <h3 class="item-title">{item.school}</h3>
      <span class="item-dates">{formatRange(item.dates, locale, t(locale, 'date.present'))}</span>
    </div>
    <p class="item-meta">
      {[item.degree, item.field, item.gpa && `GPA ${item.gpa}`].filter(Boolean).join(' · ')}
    </p>
    {#if item.description}
      <p class="item-desc">{item.description}</p>
    {/if}
  </article>
{/each}
