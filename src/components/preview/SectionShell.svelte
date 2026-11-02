<script lang="ts">
  import type { Snippet } from 'svelte'

  const { title, children }: { title: string; children: Snippet } = $props()
</script>

<section class="resume-section">
  <h2 class="resume-section-title">{title}</h2>
  {@render children()}
</section>
