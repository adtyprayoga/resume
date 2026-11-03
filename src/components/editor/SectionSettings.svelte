<script lang="ts">
  import { tick } from 'svelte'
  import Icon from '../shell/Icon.svelte'
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { getSectionModule } from '$lib/sections/registry'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import type { NavTarget } from '$lib/ui/revealSection'

  /** When given, each row gets a Go to button and a fixed Profile row leads the list. */
  const { onNavigate }: { onNavigate?: (target: NavTarget) => void } = $props()

  const sections = $derived(resumeDoc.current.sections)

  // Native drag and drop is unreliable under a finger, so phones also get move buttons.
  const PHONE_QUERY = '(max-width: 639px)'
  let phone = $state(false)
  $effect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(PHONE_QUERY)
    phone = query.matches
    const onChange = (event: { matches: boolean }) => (phone = event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  /** Why a section has nothing on the paper to go to, or null when it does. */
  const unavailable = (kind: ListSectionKind, enabled: boolean): 'sections.hiddenNote' | 'sections.emptyNote' | null =>
    !enabled ? 'sections.hiddenNote'
      : resumeDoc.current.content[kind].length === 0 && editing.mode !== 'edit' ? 'sections.emptyNote'
        : null

  const uid = $props.id()
  let list = $state<HTMLUListElement>()
  let moved = $state<ListSectionKind | null>(null)
  const position = (kind: ListSectionKind) => ({ section: label(kind), position: sections.findIndex(s => s.kind === kind) + 1, count: sections.length })
  const announcement = $derived(moved ? t(prefs.uiLocale, 'sections.position', position(moved)) : '')

  const focusMoved = async (kind: ListSectionKind) => {
    moved = kind
    await tick()
    list?.querySelector<HTMLElement>(`[data-section="${kind}"] .drag-handle`)?.focus()
  }

  const move = (kind: ListSectionKind, delta: number) => {
    editing.dismiss()
    resumeDoc.moveSection(kind, delta)
    void focusMoved(kind)
  }

  let dragging = $state<ListSectionKind | null>(null)
  let over = $state<ListSectionKind | null>(null)

  const label = (kind: ListSectionKind) =>
    t(prefs.uiLocale, getSectionModule(kind).labelKey as UiStringKey)

  const drop = (target: ListSectionKind) => {
    if (dragging && dragging !== target) {
      editing.dismiss()
      resumeDoc.moveSectionTo(dragging, sections.findIndex((s) => s.kind === target))
      void focusMoved(dragging)
    }
    dragging = null
    over = null
  }

  const onKeydown = (event: KeyboardEvent, kind: ListSectionKind) => {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    event.preventDefault()
    move(kind, delta)
  }
</script>

<p id="{uid}-hint" class="field-hint" style="margin-bottom:0.625rem">
  {t(prefs.uiLocale, 'sections.hint')}
</p>
<p role="status" aria-live="polite" aria-atomic="true" class="sr-only">{announcement}</p>

{#if onNavigate}
  <div class="setting-row setting-row-fixed" data-section="profile">
    <button
      type="button"
      class="setting-name"
      aria-label={t(prefs.uiLocale, 'sections.goTo', { section: t(prefs.uiLocale, 'sections.profile') })}
      onclick={() => onNavigate('profile')}
    >{t(prefs.uiLocale, 'sections.profile')}</button>
  </div>
{/if}

<ul class="section-list" bind:this={list}>
  {#each sections as section, index (section.kind)}
    {@const reason = onNavigate ? unavailable(section.kind, section.enabled) : null}
    <li
      class="setting-row"
      data-section={section.kind}
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
        aria-label={t(prefs.uiLocale, 'sections.reorder', position(section.kind))}
        aria-describedby="{uid}-hint"
        onkeydown={(event) => onKeydown(event, section.kind)}
      ><Icon name="grip" /></span>

      {#if onNavigate}
        <button
          type="button"
          class="setting-name"
          disabled={reason !== null}
          aria-label={t(prefs.uiLocale, 'sections.goTo', { section: label(section.kind) })}
          aria-describedby={reason ? `${uid}-${section.kind}-why` : undefined}
          onclick={() => onNavigate(section.kind)}
        >
          <span>{label(section.kind)}</span>
          <span class="setting-count">{resumeDoc.current.content[section.kind].length}</span>
        </button>
      {:else}
        <span class="setting-name">
          <span>{label(section.kind)}</span>
          <span class="setting-count">{resumeDoc.current.content[section.kind].length}</span>
        </span>
      {/if}

      {#if phone}
        <div class="repeat-actions">
          <button type="button" class="repeat-btn" disabled={index === 0} aria-label={t(prefs.uiLocale, 'sections.moveUp', { section: label(section.kind) })} onclick={() => move(section.kind, -1)}><Icon name="up" size={18} /></button>
          <button type="button" class="repeat-btn" disabled={index === sections.length - 1} aria-label={t(prefs.uiLocale, 'sections.moveDown', { section: label(section.kind) })} onclick={() => move(section.kind, 1)}><Icon name="down" size={18} /></button>
        </div>
      {/if}

      <label class="setting-show">
        <input
          type="checkbox"
          checked={section.enabled}
          aria-label={t(prefs.uiLocale, 'sections.show', { section: label(section.kind) })}
          onchange={(event) => {
            editing.dismiss()
            resumeDoc.setSectionEnabled(section.kind, (event.currentTarget as HTMLInputElement).checked)
          }}
        />
      </label>

      {#if reason}<span id="{uid}-{section.kind}-why" class="setting-note">{t(prefs.uiLocale, reason)}</span>{/if}
    </li>
  {/each}
</ul>
