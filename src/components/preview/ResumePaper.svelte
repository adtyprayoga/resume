<script lang="ts">
  import ProfileHeader from './ProfileHeader.svelte'
  import SectionShell from './SectionShell.svelte'
  import AwardsPreview from '$lib/sections/awards/Preview.svelte'
  import EducationPreview from '$lib/sections/education/Preview.svelte'
  import ExperiencePreview from '$lib/sections/experience/Preview.svelte'
  import ProjectsPreview from '$lib/sections/projects/Preview.svelte'
  import SkillsPreview from '$lib/sections/skills/Preview.svelte'
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import { getSectionModule } from '$lib/sections/registry'
  import type { Locale, ResolvedResume } from '$lib/model/types'

  let {
    resume,
    locale,
    element = $bindable<HTMLElement | undefined>(),
  }: {
    resume: ResolvedResume
    locale: Locale
    /** Exposed so the page-break overlay can measure the paper. */
    element?: HTMLElement | undefined
  } = $props()

  // Enabled and non-empty, so an empty list leaves no stray heading.
  const visible = $derived(
    resume.sections
      .filter((section) => section.enabled && resume[section.kind].length > 0)
      .map((section) => ({
        kind: section.kind,
        title: t(locale, getSectionModule(section.kind).labelKey as UiStringKey),
      })),
  )
</script>

<article lang={locale} class="resume-paper" bind:this={element}>
  <ProfileHeader profile={resume.profile} contact={resume.contact} />

  {#each visible as section (section.kind)}
    <SectionShell title={section.title}>
      {#if section.kind === 'experience'}
        <ExperiencePreview items={resume.experience} {locale} />
      {:else if section.kind === 'education'}
        <EducationPreview items={resume.education} {locale} />
      {:else if section.kind === 'projects'}
        <ProjectsPreview items={resume.projects} {locale} />
      {:else if section.kind === 'skills'}
        <SkillsPreview items={resume.skills} />
      {:else if section.kind === 'awards'}
        <AwardsPreview items={resume.awards} {locale} />
      {/if}
    </SectionShell>
  {/each}
</article>
