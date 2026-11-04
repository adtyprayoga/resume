<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import type { UnmatchedText } from '$lib/io/pdf/mapper'
  import type { Extraction } from '$lib/io/pdf/types'
  import { prefs } from '$lib/state/preferences.svelte'

  const { extraction, unmatched }: { extraction: Extraction; unmatched: UnmatchedText[] } = $props()
  const uid = $props.id()
</script>

<section class="pdf-source" aria-labelledby="{uid}-unmatched">
  <h3 id="{uid}-unmatched" class="editor-subhead">
    {unmatched.length ? t(prefs.uiLocale, 'pdf.review.unmatched', { count: unmatched.length }) : t(prefs.uiLocale, 'pdf.review.noUnmatched')}
  </h3>
  {#if unmatched.length}
    <p class="field-hint">{t(prefs.uiLocale, 'pdf.review.unmatchedHint')}</p>
    <ul class="pdf-text-list" aria-labelledby="{uid}-unmatched">
      {#each unmatched as entry (entry.block)}
        <li><span class="pdf-page">{t(prefs.uiLocale, 'pdf.review.page', { page: entry.page })}</span> <span>{entry.text}</span></li>
      {/each}
    </ul>
  {/if}

  <details class="pdf-all-text">
    <summary>{t(prefs.uiLocale, 'pdf.review.sourceText', { count: extraction.blocks.length })}</summary>
    <ol class="pdf-text-list">
      {#each extraction.blocks as block (block.id)}
        <li><span class="pdf-page">{t(prefs.uiLocale, 'pdf.review.page', { page: block.page })}</span> <span>{block.text}</span></li>
      {/each}
    </ol>
  </details>
</section>
