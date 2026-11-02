<script lang="ts">
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { Locale, ResolvedProjectItem } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedProjectItem[]; locale: Locale; presentation?: ResumePresentation } = $props()
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const dates = formatRange(item.dates, locale, t(locale, 'date.present'))}
    <article class="ats-entry" data-break-atom>
      <h3 class="item-title">{[item.name, item.role].filter(Boolean).join(' — ')}</h3>
      {#if dates}<p class="item-dates">{dates}</p>{/if}
      {#if item.techStack.length}<p class="item-meta">{item.techStack.join(', ')}</p>{/if}
      {#if item.description}<p class="item-desc">{item.description}</p>{/if}
      {#if item.bullets.length}
        <ul class="item-bullets">
          {#each item.bullets as bullet, index (index)}
            <li>{bullet}</li>
          {/each}
        </ul>
      {/if}
      {#if item.link}<p class="item-link">{item.link}</p>{/if}
    </article>
  {/each}
{:else}
  {#each items as item (item.id)}
    <article data-break-atom>
      <div class="item-head">
        <h3 class="item-title">
          {item.name}{#if item.role}<span class="item-role">&nbsp;— {item.role}</span>{/if}
        </h3>
        <span class="item-dates">{formatRange(item.dates, locale, t(locale, 'date.present'))}</span>
      </div>
      {#if item.techStack.length}
        <p class="item-meta">{item.techStack.join(' · ')}</p>
      {/if}
      {#if item.description}
        <p class="item-desc">{item.description}</p>
      {/if}
      {#if item.bullets.length}
        <ul class="item-bullets">
          {#each item.bullets as bullet, index (index)}
            <li>{bullet}</li>
          {/each}
        </ul>
      {/if}
      {#if item.link}
        <p class="item-link">{item.link}</p>
      {/if}
    </article>
  {/each}
{/if}
