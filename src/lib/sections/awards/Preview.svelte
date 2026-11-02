<script lang="ts">
  import { formatMonth } from '$lib/model/dates'
  import type { Locale, ResolvedAwardItem } from '$lib/model/types'

  const { items, locale }: { items: ResolvedAwardItem[]; locale: Locale } = $props()
</script>

{#each items as item (item.id)}
  <article data-break-atom>
    <div class="item-head">
      <h3 class="item-title">{item.title}</h3>
      <span class="item-dates">{formatMonth(item.date, locale)}</span>
    </div>
    {#if item.issuer || item.description}
      <p class="item-meta">{[item.issuer, item.description].filter(Boolean).join(' · ')}</p>
    {/if}
  </article>
{/each}
