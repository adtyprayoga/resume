<script lang="ts">
  /**
   * Move and delete for the selected entry. Print-hidden and absolutely
   * positioned, so the paper's layout does not move; sized against the
   * preview zoom so the targets stay 44px on screen.
   */
  import { tick } from 'svelte'
  import Icon from '../shell/Icon.svelte'
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { getSectionModule } from '$lib/sections/registry'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { findEntry, focusAddAction } from './entryFocus'

  const { section, id }: { section: ListSectionKind; id: string } = $props()

  const items = $derived(resumeDoc.current.content[section] as { id: string }[])
  const index = $derived(items.findIndex((item) => item.id === id))
  const count = $derived(items.length)
  const sectionLabel = $derived(t(prefs.uiLocale, getSectionModule(section).labelKey as UiStringKey))

  // Autosave means no undo, so delete needs a confirming second click.
  let armed = $state(false)

  const touchesEntry = () =>
    editing.active?.refs.some((ref) => ref.owner === 'item' && ref.section === section && ref.id === id) === true

  const move = async (delta: -1 | 1) => {
    armed = false
    if (touchesEntry()) editing.commit()
    resumeDoc.moveItem(section, id, delta)
    const position = items.findIndex((item) => item.id === id) + 1
    editing.announce(t(prefs.uiLocale, 'entry.moved', { section: sectionLabel, position, count }))
    await tick()
    const entry = findEntry(section, id)
    const same = entry?.querySelector<HTMLButtonElement>(`[data-entry-action="${delta < 0 ? 'up' : 'down'}"]`)
    const fallback = entry?.querySelector<HTMLButtonElement>('[data-entry-action="edit"]')
    ;(same && !same.disabled ? same : fallback)?.focus()
  }

  const remove = async () => {
    if (!armed) {
      armed = true
      return
    }
    armed = false
    if (touchesEntry()) editing.cancel()
    const next = items[index + 1]?.id
    resumeDoc.removeItem(section, id)
    editing.announce(t(prefs.uiLocale, 'entry.deleted', { section: sectionLabel }))
    if (next) editing.select(section, next)
    else editing.selected = null
    await tick()
    if (next) findEntry(section, next)?.focus()
    else focusAddAction(section)
  }
</script>

<span
  class="entry-actions"
  role="group"
  aria-label={t(prefs.uiLocale, 'entry.actions', { section: sectionLabel, position: index + 1, count })}
  data-print-hide
>
  <button type="button" class="entry-btn" data-entry-action="edit" onclick={() => editing.begin({ kind: 'entry', section, id })}>
    <Icon name="edit" size={18} /><span>{t(prefs.uiLocale, 'entry.edit')}</span>
  </button>
  <button type="button" class="entry-btn icon" data-entry-action="up" aria-label={t(prefs.uiLocale, 'action.moveUp')} disabled={index <= 0} onclick={() => move(-1)}>
    <Icon name="up" size={18} />
  </button>
  <button type="button" class="entry-btn icon" data-entry-action="down" aria-label={t(prefs.uiLocale, 'action.moveDown')} disabled={index >= count - 1} onclick={() => move(1)}>
    <Icon name="down" size={18} />
  </button>
  <button type="button" class="entry-btn danger" data-entry-action="delete" onclick={remove} onblur={() => (armed = false)}>
    <Icon name="trash" size={18} /><span>{t(prefs.uiLocale, armed ? 'entry.confirmDelete' : 'action.delete')}</span>
  </button>
</span>
