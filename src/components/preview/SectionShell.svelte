<script lang="ts">
  import type { Snippet } from 'svelte'

  import type { ListSectionKind } from '$lib/sections/kinds'

  const {
    kind,
    title,
    children,
    printHide = false,
  }: {
    /** Stable navigation anchor; never derived from the displayed title. */
    kind: ListSectionKind
    title: string
    children: Snippet
    /** An empty section shown only so it can be filled in Edit mode. */
    printHide?: boolean
  } = $props()
</script>

<section class="resume-section" data-cv-section={kind} data-print-hide={printHide ? true : undefined}>
  <h2 class="resume-section-title">{title}</h2>
  {@render children()}
</section>
