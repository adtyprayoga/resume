<script lang="ts">
  /**
   * The one place an active edit is shown. Rendered beside the paper, never
   * inside it: the paper is scaled and observed for pagination, and an editor
   * inside it would be both tiny and remeasured on every keystroke.
   */
  import { tick } from 'svelte'
  import EditSheet from './EditSheet.svelte'
  import FormPopover from './FormPopover.svelte'
  import InlineEditor from './InlineEditor.svelte'
  import { findEntry } from './entryFocus'
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import { refKey, specFor } from '$lib/editing/fields'
  import { getSectionModule } from '$lib/sections/registry'
  import { editing, type EditTarget } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const PHONE_QUERY = '(max-width: 639px)'

  let phone = $state(false)

  $effect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(PHONE_QUERY)
    const update = () => (phone = query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  })

  const active = $derived(editing.suspended ? null : editing.active)
  const target = $derived(active?.target ?? null)

  /** Attribute + value pairs, matched by comparison so ids never reach a selector string. */
  const anchorFor = (subject: EditTarget): [string, string] => {
    if (subject.kind === 'field') return ['editKey', refKey(subject.ref)]
    if (subject.kind === 'entry') return ['entry', `${subject.section}:${subject.id}`]
    if (subject.kind === 'new-entry') return ['addEntry', subject.section]
    return ['profileDetails', 'true']
  }

  const find = (subject: EditTarget): HTMLElement | null => {
    const [name, value] = anchorFor(subject)
    const attribute = `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
    for (const element of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
      if (element.dataset[name] === value && !element.closest('[data-edit-surface]')) return element
    }
    return null
  }

  const title = (subject: EditTarget): string => {
    if (subject.kind === 'field') return t(prefs.uiLocale, specFor(subject.ref).labelKey)
    if (subject.kind === 'profile') return t(prefs.uiLocale, 'edit.profileDetails')
    return t(prefs.uiLocale, getSectionModule(subject.section).labelKey as UiStringKey)
  }

  const inline = $derived(
    !phone &&
      target?.kind === 'field' &&
      target.ref.owner !== 'contact' &&
      ['text', 'multiline', 'lines'].includes(specFor(target.ref).type),
  )

  const restore = async (subject: EditTarget) => {
    await tick()
    find(subject)?.focus()
  }

  const close = (subject: EditTarget, restoreFocus: boolean) => {
    if (restoreFocus) void restore(subject)
  }

  const apply = async () => {
    const subject = editing.active?.target
    if (!subject) return
    const result = editing.commit()
    const added = editing.lastAdded
    if (subject.kind === 'new-entry' && result === 'applied' && added) {
      editing.select(added.section, added.id)
      editing.announce(t(prefs.uiLocale, 'entry.added', { section: title(subject) }))
      await tick()
      findEntry(added.section, added.id)?.focus()
      return
    }
    void restore(subject)
  }

  const cancel = () => {
    const subject = editing.active?.target
    if (!subject) return
    editing.cancel()
    void restore(subject)
  }
</script>

{#if active && target}
  {#key active.target}
    {#if inline && target.kind === 'field'}
      <InlineEditor ref={target.ref} anchor={() => find(target)} onClose={(restoreFocus, subject) => close(subject, restoreFocus)} />
    {:else if phone}
      <EditSheet title={title(target)} refs={active.refs} onApply={apply} onCancel={cancel} />
    {:else}
      <FormPopover title={title(target)} refs={active.refs} anchor={() => find(target)} onApply={apply} onCancel={cancel} />
    {/if}
  {/key}
{/if}
