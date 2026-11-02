<script lang="ts">
  /**
   * Draws where the printer will start each new page.
   *
   * Rendered as a sibling of `.resume-paper` rather than inside it, so it is
   * structurally incapable of reaching the printed output.
   *
   * Measurement is driven by DOM observers, not by document state: an effect
   * that read the state and then measured would be measuring the layout it had
   * just invalidated.
   */
  import { collectAtoms, measurePageMetrics } from '$lib/pagination/measure'
  import { paginate } from '$lib/pagination/paginate'

  const { paper }: { paper: HTMLElement | undefined } = $props()

  let breaks = $state<number[]>([])

  $effect(() => {
    if (!paper) return

    let frame = 0
    const remeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const { pageHeight, contentTop } = measurePageMetrics(paper)
        breaks = paginate(collectAtoms(paper), pageHeight, contentTop)
      })
    }

    const resize = new ResizeObserver(remeasure)
    resize.observe(paper)

    const mutation = new MutationObserver(remeasure)
    mutation.observe(paper, { childList: true, subtree: true, characterData: true })

    // Fonts change metrics, so a measurement taken before they load is wrong.
    void document.fonts?.ready.then(remeasure).catch(() => {})
    remeasure()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
    }
  })
</script>

{#each breaks as offset, index (offset)}
  <div class="page-break" style="top: {offset}px" aria-hidden="true">
    <span class="page-break-label">Page {index + 2}</span>
  </div>
{/each}
