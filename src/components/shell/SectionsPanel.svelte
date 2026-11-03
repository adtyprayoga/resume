<script lang="ts">
  import SidePanel from './SidePanel.svelte'
  import SectionSettings from '../editor/SectionSettings.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'

  const { id, onClose }: { id: string; onClose: () => void } = $props()
</script>

<SidePanel {id} side="sections" title={t(prefs.uiLocale, 'action.sections')} {onClose}>
  <SectionSettings />
</SidePanel>
