<script lang="ts">
  /**
   * A native input or textarea laid over the text it edits. It lives outside
   * the scaled paper, so it keeps a 16px font and the paper's observers never
   * see it. Plain text only: no contenteditable, no markup.
   */
  import Icon from '$components/shell/Icon.svelte'
  import { t } from '$lib/i18n/ui'
  import { editKeyAction, refKey, specFor, type FieldRef } from '$lib/editing/fields'
  import { editing, type EditTarget } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { trackAnchor } from '$lib/ui/anchor'

  const {
    ref,
    anchor,
    onClose,
  }: {
    ref: FieldRef
    anchor: () => Element | null
    /** `restoreFocus` is false when the user moved focus elsewhere themselves. */
    onClose: (restoreFocus: boolean, target: EditTarget, applied?: boolean) => void
  } = $props()

  const key = $derived(refKey(ref))
  const spec = $derived(specFor(ref))
  const multiline = $derived(spec.type !== 'text')
  const label = $derived(
    `${t(prefs.uiLocale, spec.labelKey)} · ${t(prefs.uiLocale, spec.scope === 'shared' ? 'scope.shared' : 'scope.localized')}`,
  )
  const value = $derived(String(editing.active?.draft[key] ?? ''))
  // Captured at mount: once applied or cancelled, the session's target is gone.
  const session = editing.active!.target

  let rect = $state<{ top: number; left: number; width: number; height: number } | null>(null)
  let container = $state<HTMLDivElement>()

  $effect(() =>
    trackAnchor(anchor, (next) => {
      rect = next ? { top: next.top, left: next.left, width: next.width, height: next.height } : null
    }),
  )

  $effect(() => {
    container?.querySelector<HTMLElement>('input, textarea')?.focus()
  })

  const width = $derived(rect ? Math.max(rect.width + 16, multiline ? 320 : 200) : 0)
  const style = $derived(
    rect
      ? `top:${Math.max(4, rect.top - 6)}px;left:max(8px, min(${rect.left - 8}px, 100vw - ${width}px - 8px));width:min(${width}px, 100vw - 16px)`
      : // Not visibility:hidden — browsers refuse to focus hidden elements, and focus moves here on mount.
        'opacity:0;top:0;left:0',
  )

  /** Still the session this editor was opened for. */
  const mine = () => editing.active?.target === session && !editing.suspended

  const apply = (restoreFocus: boolean) => {
    if (!mine()) return
    const result = editing.commit()
    onClose(restoreFocus, session, result === 'applied')
  }

  const cancel = () => {
    if (!mine()) return
    editing.cancel()
    onClose(true, session)
  }

  const onkeydown = (event: KeyboardEvent) => {
    const action = editKeyAction(event, multiline && spec.type !== 'bullet')
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'commit') apply(true)
    else cancel()
  }

  const onfocusout = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next && container?.contains(next)) return
    // Toolbar actions decide for themselves: Settings and Import suspend the
    // draft, Export and Done apply it.
    if (next instanceof Element && next.closest('[data-keeps-draft]')) return
    apply(false)
  }

  const oninput = (event: Event) =>
    editing.setDraft(key, (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value)
</script>

<div class="inline-editor" class:multiline data-edit-surface data-print-hide {style} bind:this={container} {onfocusout}>
  {#if multiline}
    <textarea class="inline-input" aria-label={label} rows={spec.type === 'bullet' ? 3 : 4} {value} {oninput} {onkeydown}></textarea>
    <div class="inline-actions">
      {#if ref.owner === 'bullet' && ref.index !== 'append'}
        <button type="button" class="tool-btn" aria-label={t(prefs.uiLocale, 'bullet.remove')} onclick={() => { editing.setDraft(key, ''); apply(true) }}><Icon name="trash" /></button>
      {/if}
      <button type="button" class="tool-btn" onclick={cancel}>{t(prefs.uiLocale, 'action.cancel')}</button>
      <button type="button" class="tool-btn primary" onclick={() => apply(true)}>{t(prefs.uiLocale, 'action.apply')}</button>
    </div>
  {:else}
    <input class="inline-input" aria-label={label} {value} {oninput} {onkeydown} />
  {/if}
</div>
