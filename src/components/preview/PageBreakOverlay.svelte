<script lang="ts">
  // Screen-only guides; data-print-hide explicitly excludes them from printing.
  // Driven by DOM observers rather than state: an effect that read state and
  // then measured would be measuring layout it had just invalidated.
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import { collectAtoms, measurePageMetrics } from '$lib/pagination/measure'
  import { paginate } from '$lib/pagination/paginate'

  const { paper }: { paper: HTMLElement | undefined } = $props()

  let breaks = $state<number[]>([])

  const sameBreaks = (left: number[], right: number[]) =>
    left.length === right.length && left.every((value, index) => value === right[index])

  $effect(() => {
    if (!paper) return

    let active = true
    let frame = 0
    const measure = () => {
      frame = 0
      if (!active) return
      const { pageHeight, contentTop } = measurePageMetrics(paper)
      const next = paginate(collectAtoms(paper), pageHeight, contentTop)
      if (!sameBreaks(breaks, next)) breaks = next
    }
    // One frame per burst: further notifications ride the pending one.
    const schedule = () => {
      if (active && frame === 0) frame = requestAnimationFrame(measure)
    }

    const resize = new ResizeObserver(schedule)
    resize.observe(paper)

    const mutation = new MutationObserver(schedule)
    mutation.observe(paper, { childList: true, subtree: true, characterData: true })

    // Fonts change metrics. `active` guards a promise that can settle after teardown.
    void document.fonts?.ready.then(schedule).catch(() => {})
    schedule()

    return () => {
      active = false
      cancelAnimationFrame(frame)
      frame = 0
      resize.disconnect()
      mutation.disconnect()
    }
  })
</script>

{#each breaks as offset, index (offset)}
  <div class="page-break" data-print-hide style="top: {offset}px" aria-hidden="true">
    <span class="page-break-label">{t(prefs.uiLocale, 'app.page', { page: index + 2 })}</span>
  </div>
{/each}
