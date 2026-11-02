<script lang="ts">
  import { formatRange } from '$lib/model/dates'
  import { t } from '$lib/i18n/ui'
  import type { Locale, ResolvedEducationItem } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    items,
    locale,
    presentation = 'classic',
  }: { items: ResolvedEducationItem[]; locale: Locale; presentation?: ResumePresentation } = $props()
</script>

{#if presentation === 'ats'}
  {#each items as item (item.id)}
    {@const meta = [item.degree, item.field, item.gpa && `GPA ${item.gpa}`].filter(Boolean).join(', ')}
    {@const dates = formatRange(item.dates, locale, t(locale, 'date.present'))}
    <article class="ats-entry" data-break-atom>
      <h3 class="item-title">{item.school}</h3>
      {#if meta}<p class="item-meta">{meta}</p>{/if}
      {#if dates}<p class="item-dates">{dates}</p>{/if}
      {#if item.description}<p class="item-desc">{item.description}</p>{/if}
    </article>
  {/each}
{:else}
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
{/if}
