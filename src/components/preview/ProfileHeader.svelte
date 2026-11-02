<script lang="ts">
  import AvatarImage from '../ui/AvatarImage.svelte'
  import Editable from '../editing/Editable.svelte'
  import Joined from '../editing/Joined.svelte'
  import { t } from '$lib/i18n/ui'
  import type { FieldRef } from '$lib/editing/fields'
  import type { ContactInfo, Locale, ResolvedProfile } from '$lib/model/types'
  import { editing } from '$lib/state/editing.svelte'
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

  const P = (key: keyof ResolvedProfile): FieldRef => ({ owner: 'profile', key })
  const C = (key: keyof ContactInfo): FieldRef => ({ owner: 'contact', key })
  const URL_KEYS = ['website', 'github', 'linkedin'] as const

  // Classic shortens URLs for the single contact line; the target still edits the stored address.
  const details = $derived([
    { ref: P('location'), value: profile.location },
    { ref: C('email'), value: contact.email },
    { ref: C('phone'), value: contact.phone },
    ...URL_KEYS.map((key) => ({ ref: C(key), value: strip(contact[key]) })),
  ])

  // ATS keeps URLs exactly as typed so a parser sees a complete address.
  const atsLines = $derived([
    { ref: P('location'), value: profile.location },
    { ref: C('email'), value: contact.email },
    { ref: C('phone'), value: contact.phone },
    ...URL_KEYS.map((key) => ({ ref: C(key), value: contact[key] })),
  ])

  const editMode = $derived(editing.mode === 'edit')
  const anyDetail = $derived(details.some((part) => part.value))
</script>

{#if presentation === 'ats'}
  <!-- The photo is deliberately absent here, not deleted: it stays in the document for Classic. -->
  <header class="resume-header ats-header" data-break-atom>
    <h1 class="resume-name"><Editable ref={P('name')} value={profile.name} /></h1>
    {#if profile.headline}
      <p class="resume-headline"><Editable ref={P('headline')} value={profile.headline} /></p>
    {:else if editMode}
      <p class="resume-headline" data-print-hide><Editable ref={P('headline')} value="" /></p>
    {/if}
    {#if atsLines.some((line) => line.value) || editMode}
      <div class="ats-contact" data-print-hide={atsLines.some((line) => line.value) ? undefined : true}>
        {#each atsLines as line, index (index)}
          {#if line.value}
            <p><Editable ref={line.ref} value={line.value} /></p>
          {:else if editMode}
            <p data-print-hide><Editable ref={line.ref} value="" /></p>
          {/if}
        {/each}
      </div>
    {/if}
  </header>

  {#if profile.summary}
    <section class="resume-section ats-summary">
      <h2 class="resume-section-title">{t(locale, 'section.summary')}</h2>
      <p class="resume-summary" data-break-atom><Editable ref={P('summary')} value={profile.summary} /></p>
    </section>
  {:else if editMode}
    <section class="resume-section ats-summary" data-print-hide>
      <p class="resume-summary"><Editable ref={P('summary')} value="" /></p>
    </section>
  {/if}
{:else}
  <header class="resume-header" data-break-atom>
    <div class="resume-header-text">
      <h1 class="resume-name"><Editable ref={P('name')} value={profile.name} /></h1>
      {#if profile.headline}
        <p class="resume-headline"><Editable ref={P('headline')} value={profile.headline} /></p>
      {:else if editMode}
        <p class="resume-headline" data-print-hide><Editable ref={P('headline')} value="" /></p>
      {/if}
      {#if anyDetail || editMode}
        <p class="resume-contact" data-print-hide={anyDetail ? undefined : true}><Joined parts={details} separator={'  ·  '} /></p>
      {/if}
    </div>
    {#if contact.avatar}
      <Editable ref={C('avatar')} value={contact.avatar}>
        <AvatarImage class="resume-avatar" src={contact.avatar} />
      </Editable>
    {:else if editMode}
      <span class="resume-avatar-prompt" data-print-hide><Editable ref={C('avatar')} value="" /></span>
    {/if}
  </header>

  {#if profile.summary}
    <p class="resume-summary" data-break-atom><Editable ref={P('summary')} value={profile.summary} /></p>
  {:else if editMode}
    <p class="resume-summary" data-print-hide><Editable ref={P('summary')} value="" /></p>
  {/if}
{/if}
