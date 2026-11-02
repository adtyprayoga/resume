<script lang="ts">
  import ProfileEditor from './ProfileEditor.svelte'
  import SectionSettings from './SectionSettings.svelte'
  import AwardsEditor from '$lib/sections/awards/Editor.svelte'
  import EducationEditor from '$lib/sections/education/Editor.svelte'
  import ExperienceEditor from '$lib/sections/experience/Editor.svelte'
  import ProjectsEditor from '$lib/sections/projects/Editor.svelte'
  import SkillsEditor from '$lib/sections/skills/Editor.svelte'
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import { sectionModules } from '$lib/sections/registry'
  import { prefs } from '$lib/state/preferences.svelte'
  import { focusTrap } from '$lib/ui/focusTrap'

  /** Profile first, then every registered section in document order, then settings. */
  const tabs = $derived([
    { key: 'profile' as const, label: 'Profile' },
    ...sectionModules.map((module) => ({
      key: module.kind,
      label: t(prefs.uiLocale, module.labelKey as UiStringKey),
    })),
    { key: 'settings' as const, label: 'Sections' },
  ])

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') prefs.closeDrawer()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="drawer-overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) prefs.closeDrawer()
  }}
>
  <div
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-label="Edit resume"
    use:focusTrap
  >
    <header class="drawer-head">
      <nav class="drawer-tabs">
        {#each tabs as tab (tab.key)}
          <button
            type="button"
            class="drawer-tab"
            aria-current={prefs.drawerSection === tab.key}
            onclick={() => (prefs.drawerSection = tab.key)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>
      <button type="button" class="repeat-btn" onclick={() => prefs.closeDrawer()}>Close</button>
    </header>

    <div class="drawer-body">
      {#if prefs.drawerSection === 'profile'}
        <ProfileEditor />
      {:else if prefs.drawerSection === 'experience'}
        <ExperienceEditor />
      {:else if prefs.drawerSection === 'education'}
        <EducationEditor />
      {:else if prefs.drawerSection === 'projects'}
        <ProjectsEditor />
      {:else if prefs.drawerSection === 'skills'}
        <SkillsEditor />
      {:else if prefs.drawerSection === 'awards'}
        <AwardsEditor />
      {:else}
        <SectionSettings />
      {/if}
    </div>
  </div>
</div>
