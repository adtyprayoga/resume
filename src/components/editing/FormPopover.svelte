<script lang="ts">
  /** A small labelled form placed just below what it edits. */
  import type { Snippet } from 'svelte'
  import EditForm from './EditForm.svelte'
  import type { FieldRef } from '$lib/editing/fields'
  import { trackAnchor } from '$lib/ui/anchor'

  const {
    title,
    refs,
    anchor,
    onApply,
    onCancel,
    onDismiss,
    actions,
  }: {
    title: string
    refs: FieldRef[]
    anchor: () => Element | null
    onApply: () => void
    onCancel: () => void
    /** A press outside both the popover and what it edits. */
    onDismiss: () => void
    actions?: Snippet | undefined
  } = $props()

  let surface = $state<HTMLDivElement>()

  // Capture phase, so the popover closes before whatever was pressed acts.
  $effect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || surface?.contains(target)) return
      // The opener toggles itself; closing here too would reopen it on click.
      if (anchor()?.contains(target)) return
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  })

  let rect = $state<{ top: number; bottom: number; left: number } | null>(null)
  let height = $state(0)

  $effect(() =>
    trackAnchor(anchor, (next) => {
      rect = next ? { top: next.top, bottom: next.bottom, left: next.left } : null
    }),
  )

  // Below the anchor when it fits, otherwise above it; always inside the viewport.
  const style = $derived.by(() => {
    if (!rect) return 'top:72px;left:max(8px, calc(50vw - 12rem))'
    const below = rect.bottom + 8
    const fitsBelow = typeof window === 'undefined' || below + height <= window.innerHeight - 8
    const top = fitsBelow ? below : Math.max(8, rect.top - 8 - height)
    return `top:${top}px;left:max(8px, min(${rect.left}px, 100vw - min(24rem, 100vw - 16px) - 8px))`
  })
</script>

<div class="form-popover" bind:this={surface} data-edit-surface data-print-hide {style} bind:clientHeight={height}>
  <EditForm {title} {refs} {onApply} {onCancel} {actions} />
</div>
