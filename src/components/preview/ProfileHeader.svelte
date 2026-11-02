<script lang="ts">
  import type { ContactInfo, ResolvedProfile } from '$lib/model/types'

  const { profile, contact }: { profile: ResolvedProfile; contact: ContactInfo } = $props()

  const strip = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const details = $derived(
    [
      profile.location,
      contact.email,
      contact.phone,
      strip(contact.website),
      strip(contact.github),
      strip(contact.linkedin),
    ].filter(Boolean),
  )
</script>

<header class="resume-header" data-break-atom>
  <h1 class="resume-name">{profile.name}</h1>
  {#if profile.headline}
    <p class="resume-headline">{profile.headline}</p>
  {/if}
  {#if details.length}
    <p class="resume-contact">{details.join('  ·  ')}</p>
  {/if}
  {#if profile.summary}
    <p class="resume-summary">{profile.summary}</p>
  {/if}
</header>
