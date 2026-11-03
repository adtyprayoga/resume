<script lang="ts">
  import SidePanel from './SidePanel.svelte'
  import SectionSettings from '../editor/SectionSettings.svelte'
  import { tick } from 'svelte'
  import { t } from '$lib/i18n/ui'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { revealSection, type NavTarget } from '$lib/ui/revealSection'

  const { id, onClose }: { id: string; onClose: () => void } = $props()

  /** Applies the open edit and lets the paper settle before measuring the heading. Focus stays on the button. */
  const navigate = async (target: NavTarget) => {
    editing.dismiss()
    await tick()
    revealSection(target)
  }
</script>

<SidePanel {id} side="sections" title={t(prefs.uiLocale, 'action.sections')} {onClose}>
  <SectionSettings onNavigate={(target) => void navigate(target)} />
</SidePanel>
