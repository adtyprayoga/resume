<script lang="ts">
  import SidePanel from './SidePanel.svelte'
  import SectionSettings from '../editor/SectionSettings.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import type { NavTarget } from '$lib/ui/revealSection'

  const { id, onClose, onNavigate }: {
    id: string
    onClose: () => void
    onNavigate: (target: NavTarget) => void
  } = $props()
</script>

<SidePanel {id} side="sections" title={t(prefs.uiLocale, 'action.sections')} {onClose}>
  <SectionSettings {onNavigate} />
</SidePanel>
