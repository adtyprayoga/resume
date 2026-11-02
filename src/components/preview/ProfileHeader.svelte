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
  <div class="resume-header-text">
    <h1 class="resume-name">{profile.name}</h1>
    {#if profile.headline}
      <p class="resume-headline">{profile.headline}</p>
    {/if}
    {#if details.length}
      <p class="resume-contact">{details.join('  ·  ')}</p>
    {/if}
  </div>
  {#if contact.avatar}
    <img class="resume-avatar" src={contact.avatar} alt="" />
  {/if}
</header>

{#if profile.summary}
  <p class="resume-summary" data-break-atom>{profile.summary}</p>
{/if}
