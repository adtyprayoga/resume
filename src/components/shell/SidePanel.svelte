<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'

  /**
   * A nonmodal workspace panel: no backdrop, focus trap or outside-click dismissal,
   * so the CV beside it stays usable. Escape closes it only while focus is inside.
   */
  const {
    id,
    title,
    side,
    onClose,
    children,
  }: { id: string; title: string; side: 'sections' | 'settings'; onClose: () => void; children: Snippet } = $props()

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    onClose()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside {id} class="side-panel {side}-side" aria-labelledby="{id}-title" data-print-hide onkeydown={onKeydown}>
  <header class="drawer-head side-panel-head">
    <h2 id="{id}-title" class="settings-title" tabindex="-1">{title}</h2>
    <button type="button" class="icon-btn" aria-label={t(prefs.uiLocale, 'action.close')} onclick={onClose}>
      <Icon name="close" />
    </button>
  </header>
  <div class="drawer-body side-panel-body">
    {@render children()}
  </div>
</aside>
