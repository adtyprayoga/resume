<script lang="ts">
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { getSectionModule } from '$lib/sections/registry'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const sections = $derived(resumeDoc.current.sections)

  let dragging = $state<ListSectionKind | null>(null)
  let over = $state<ListSectionKind | null>(null)

  const label = (kind: ListSectionKind) =>
    t(prefs.uiLocale, getSectionModule(kind).labelKey as UiStringKey)

  const drop = (target: ListSectionKind) => {
    if (dragging && dragging !== target) {
      resumeDoc.moveSectionTo(dragging, sections.findIndex((s) => s.kind === target))
    }
    dragging = null
    over = null
  }

  // Dragging is unusable without a pointer, so the handle also reorders by key.
  const onKeydown = (event: KeyboardEvent, kind: ListSectionKind) => {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    event.preventDefault()
    resumeDoc.moveSection(kind, delta)
  }
</script>

<p class="field-hint" style="margin-bottom:0.625rem">
  Drag to reorder, or focus a handle and use the arrow keys. A section with no
  entries is hidden automatically, so no empty headings reach the page.
</p>

<ul class="section-list">
  {#each sections as section, index (section.kind)}
    <li
      class="setting-row"
      class:dragging={dragging === section.kind}
      class:drop-target={over === section.kind && dragging !== section.kind}
      draggable="true"
      ondragstart={() => (dragging = section.kind)}
      ondragover={(event) => {
        event.preventDefault()
        over = section.kind
      }}
      ondragleave={() => over === section.kind && (over = null)}
      ondrop={(event) => {
        event.preventDefault()
        drop(section.kind)
      }}
      ondragend={() => {
        dragging = null
        over = null
      }}
    >
      <span
        class="drag-handle"
        role="button"
        tabindex="0"
        aria-label="Reorder {label(section.kind)}, position {index + 1} of {sections.length}"
        onkeydown={(event) => onKeydown(event, section.kind)}
      >⠿</span>

      <label class="field-check" style="flex:1">
        <input
          type="checkbox"
          checked={section.enabled}
          onchange={(event) =>
            resumeDoc.setSectionEnabled(
              section.kind,
              (event.currentTarget as HTMLInputElement).checked,
            )}
        />
        <span>{label(section.kind)}</span>
        <span class="setting-count">{resumeDoc.current.content[section.kind].length}</span>
      </label>
    </li>
  {/each}
</ul>
