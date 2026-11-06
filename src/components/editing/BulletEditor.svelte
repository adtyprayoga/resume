<script lang="ts">
  import InlineEditor from './InlineEditor.svelte'
  import EditSheet from './EditSheet.svelte'
  import Icon from '$components/shell/Icon.svelte'
  import { refKey, type BulletRef } from '$lib/editing/fields'
  import { t } from '$lib/i18n/ui'
  import { editing, type EditTarget } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const { ref, phone, anchor, onClose, onApply, onCancel }: {
    ref: BulletRef
    phone: boolean
    anchor: () => Element | null
    onClose: (restoreFocus: boolean, target: EditTarget, applied?: boolean) => void
    onApply: () => void
    onCancel: () => void
  } = $props()
</script>

{#snippet actions()}
  {#if ref.index !== 'append'}
    <button type="button" class="tool-btn" aria-label={t(prefs.uiLocale, 'bullet.remove')} onclick={() => { editing.setDraft(refKey(ref), ''); onApply() }}><Icon name="trash" /></button>
  {/if}
{/snippet}

{#if phone}
  <EditSheet title={t(prefs.uiLocale, 'field.highlights')} refs={[ref]} {onApply} {onCancel} {actions} />
{:else}
  <InlineEditor {ref} {anchor} {onClose} />
{/if}
