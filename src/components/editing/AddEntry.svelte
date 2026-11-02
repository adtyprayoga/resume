<script lang="ts">
  import { t, type UiStringKey } from '$lib/i18n/ui'
  import type { ListSectionKind } from '$lib/sections/kinds'
  import { getSectionModule } from '$lib/sections/registry'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const { section }: { section: ListSectionKind } = $props()
</script>

<p class="add-entry-row" data-print-hide>
  <button
    type="button"
    class="add-entry"
    data-add-entry={section}
    aria-haspopup="dialog"
    aria-label={t(prefs.uiLocale, 'section.addTo', { section: t(prefs.uiLocale, getSectionModule(section).labelKey as UiStringKey) })}
    onclick={() => editing.begin({ kind: 'new-entry', section })}
  >{t(prefs.uiLocale, 'section.add')}</button>
</p>
