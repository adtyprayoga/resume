<script lang="ts">
  import AvatarImage from '../ui/AvatarImage.svelte'
  import { t } from '$lib/i18n/ui'
  import type { ContactInfo, Locale, ResolvedProfile } from '$lib/model/types'
  import type { ResumePresentation } from '$lib/themes/types'

  const {
    profile,
    contact,
    locale,
    presentation = 'classic',
  }: {
    profile: ResolvedProfile
    contact: ContactInfo
    locale: Locale
    presentation?: ResumePresentation
  } = $props()

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

  // ATS keeps URLs exactly as typed so a parser sees a complete address.
  const atsLines = $derived(
    [
      profile.location,
      contact.email,
      contact.phone,
      contact.website,
      contact.github,
      contact.linkedin,
    ].filter(Boolean),
  )
</script>

{#if presentation === 'ats'}
  <!-- The photo is deliberately absent here, not deleted: it stays in the document for Classic. -->
  <header class="resume-header ats-header" data-break-atom>
    <h1 class="resume-name">{profile.name}</h1>
    {#if profile.headline}
      <p class="resume-headline">{profile.headline}</p>
    {/if}
    {#if atsLines.length}
      <div class="ats-contact">
        {#each atsLines as line, index (index)}
          <p>{line}</p>
        {/each}
      </div>
    {/if}
  </header>

  {#if profile.summary}
    <section class="resume-section ats-summary">
      <h2 class="resume-section-title">{t(locale, 'section.summary')}</h2>
      <p class="resume-summary" data-break-atom>{profile.summary}</p>
    </section>
  {/if}
{:else}
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
      <AvatarImage class="resume-avatar" src={contact.avatar} />
    {/if}
  </header>

  {#if profile.summary}
    <p class="resume-summary" data-break-atom>{profile.summary}</p>
  {/if}
{/if}
