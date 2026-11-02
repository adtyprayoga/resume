<script lang="ts">
  /**
   * Phone editing: a full-width bottom sheet at normal size, never scaled with
   * the paper. Fixed header, scrolling body, visible actions; it shrinks with
   * the visual viewport so an open keyboard cannot cover the actions.
   */
  import type { Snippet } from 'svelte'
  import EditForm from './EditForm.svelte'
  import type { FieldRef } from '$lib/editing/fields'
  import { focusTrap } from '$lib/ui/focusTrap'

  const {
    title,
    refs,
    onApply,
    onCancel,
    actions,
  }: {
    title: string
    refs: FieldRef[]
    onApply: () => void
    onCancel: () => void
    actions?: Snippet | undefined
  } = $props()

  let viewportHeight = $state<number | null>(null)
  let offsetTop = $state(0)

  $effect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      viewportHeight = viewport.height
      offsetTop = viewport.offsetTop
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  })

  const style = $derived(
    viewportHeight === null
      ? ''
      : `--sheet-viewport:${viewportHeight}px;--sheet-bottom:calc(100% - ${viewportHeight + offsetTop}px)`,
  )
</script>

<div class="sheet-overlay" data-edit-surface data-print-hide role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onApply() }}>
  <div class="edit-sheet" role="dialog" aria-modal="true" aria-label={title} {style} use:focusTrap>
    <EditForm {title} {refs} {onApply} {onCancel} {actions} variant="sheet" />
  </div>
</div>
