<script lang="ts">
  import Editable from './Editable.svelte'
  import Icon from '$components/shell/Icon.svelte'
  import { refKey, type BulletRef } from '$lib/editing/fields'
  import { t } from '$lib/i18n/ui'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const { section, id, bullets }: { section: BulletRef['section']; id: string; bullets: string[] } = $props()
  const ref = (index: BulletRef['index']): BulletRef => ({ owner: 'bullet', section, id, key: 'bullets', index })
</script>

{#if bullets.length}
  <ul class="item-bullets">
    {#each bullets as bullet, index (index)}
      <li><Editable ref={ref(index)} value={bullet} /></li>
    {/each}
  </ul>
{/if}
{#if editing.mode === 'edit'}
  <div class="bullet-add" data-print-hide>
    <button type="button" class="tool-btn" data-edit-key={refKey(ref('append'))} onclick={(event) => { event.stopPropagation(); editing.begin({ kind: 'field', ref: ref('append') }) }}><Icon name="plus" />{t(prefs.uiLocale, 'bullet.add')}</button>
  </div>
{/if}
