<script lang="ts">
  import { formatMonth } from '$lib/model/dates'
  import type { Locale, ResolvedAwardItem } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedAwardItem[]; locale: Locale; presentation?: ResumePresentation } = $props()
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const date = formatMonth(item.date, locale)}
    <article class="ats-entry" data-break-atom>
      <h3 class="item-title">{item.title}</h3>
      {#if item.issuer}<p class="item-meta">{item.issuer}</p>{/if}
      {#if date}<p class="item-dates">{date}</p>{/if}
      {#if item.description}<p class="item-desc">{item.description}</p>{/if}
    </article>
  {/each}
{:else}
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
{/if}
