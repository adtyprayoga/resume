<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import { getPaneScope, type FieldScope } from '$lib/ui/scope'

  const {
    label,
    scope = 'localized',
    forId,
  }: { label: string; scope?: FieldScope; forId?: string } = $props()

  const paneScope = getPaneScope()
  const showBadge = $derived(paneScope !== null && scope !== paneScope)
</script>

<label class="field-label" for={forId}>
  {label}
  {#if showBadge}
    <span class="field-scope {scope}">
      {t(prefs.uiLocale, scope === 'shared' ? 'scope.shared' : 'scope.localized')}
    </span>
  {/if}
</label>
