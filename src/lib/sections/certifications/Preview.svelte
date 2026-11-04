<script lang="ts">
  import AwardsPreview from '../awards/Preview.svelte'
  import type { Locale, ResolvedCertificationItem } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const { items, locale, presentation = 'classic' }: {
    items: ResolvedCertificationItem[]
    locale: Locale
    presentation?: ResumePresentation
  } = $props()
</script>

<AwardsPreview {items} {locale} {presentation} section="certifications" />
