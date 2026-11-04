<script lang="ts">
  import FileActionMenu from './FileActionMenu.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  let { onPdf, onJson, open = $bindable(false), onOpen = () => {}, button = $bindable<HTMLButtonElement | undefined>() }: {
    onPdf: () => void; onJson: () => void; open?: boolean; onOpen?: () => void; button?: HTMLButtonElement | undefined
  } = $props()
</script>
<FileActionMenu icon="export" label={t(prefs.uiLocale, 'action.export')} bind:open bind:button {onOpen}
  actions={[{ icon: 'pdf', label: t(prefs.uiLocale, 'action.exportPdf'), run: onPdf }, { icon: 'json', label: t(prefs.uiLocale, 'action.exportJson'), run: onJson }]} />
