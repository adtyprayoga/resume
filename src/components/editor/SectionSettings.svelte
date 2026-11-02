<script lang="ts">
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import { getSectionModule } from '$lib/sections/registry'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const sections = $derived(resumeDoc.current.sections)

  const label = (kind: (typeof sections)[number]['kind']) =>
    t(prefs.uiLocale, getSectionModule(kind).labelKey as UiStringKey)

  const count = (kind: (typeof sections)[number]['kind']) =>
    resumeDoc.current.content[kind].length
</script>

<p class="field-hint" style="margin-bottom:0.625rem">
  Order and visibility of each section. A section with no entries is hidden
  automatically, so no empty headings reach the page.
</p>

{#each sections as section, index (section.kind)}
  <div class="setting-row">
    <label class="field-check" style="flex:1">
      <input
        type="checkbox"
        checked={section.enabled}
        onchange={(e) =>
          resumeDoc.setSectionEnabled(
            section.kind,
            (e.currentTarget as HTMLInputElement).checked,
          )}
      />
      <span>{label(section.kind)}</span>
      <span class="setting-count">{count(section.kind)}</span>
    </label>
    <div class="repeat-actions">
      <button
        type="button"
        class="repeat-btn"
        disabled={index === 0}
        aria-label="Move section up"
        onclick={() => resumeDoc.moveSection(section.kind, -1)}>↑</button
      >
      <button
        type="button"
        class="repeat-btn"
        disabled={index === sections.length - 1}
        aria-label="Move section down"
        onclick={() => resumeDoc.moveSection(section.kind, 1)}>↓</button
      >
    </div>
  </div>
{/each}
