<script lang="ts">
  import type { Snippet } from 'svelte'

  const {
    title,
    children,
    printHide = false,
  }: {
    title: string
    children: Snippet
    /** An empty section shown only so it can be filled in Edit mode. */
    printHide?: boolean
  } = $props()
</script>

<section class="resume-section" data-print-hide={printHide ? true : undefined}>
  <h2 class="resume-section-title">{title}</h2>
  {@render children()}
</section>
