<script lang="ts">
  import FileActionMenu from './FileActionMenu.svelte'
  import { PDF_IMPORT_ENABLED } from '$lib/io/pdf/client'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  let { onSelect, pdfImport = PDF_IMPORT_ENABLED, open = $bindable(false), onOpen = () => {}, button = $bindable<HTMLButtonElement | undefined>() }: {
    onSelect: (format: 'pdf' | 'json') => void; pdfImport?: boolean; open?: boolean; onOpen?: () => void; button?: HTMLButtonElement | undefined
  } = $props()
</script>
<FileActionMenu icon="import" label={t(prefs.uiLocale, 'action.upload')} bind:open bind:button {onOpen}
  actions={[...(pdfImport ? [{ icon: 'pdf' as const, label: t(prefs.uiLocale, 'action.uploadPdf'), run: () => onSelect('pdf') }] : []), { icon: 'json', label: t(prefs.uiLocale, 'action.uploadJson'), run: () => onSelect('json') }]} />
