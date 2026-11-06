<script lang="ts">
  import Editable from './Editable.svelte'
  import Icon from '$components/shell/Icon.svelte'
  import { refKey, type BulletRef } from '$lib/editing/fields'
  import { t } from '$lib/i18n/ui'
  import { editing } from '$lib/state/editing.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const { section, id, bullets }: { section: BulletRef['section']; id: string; bullets: string[] } = $props()
  const pending = $derived.by(() => {
    const target = editing.active?.target
    if (editing.suspended || editing.mode !== 'edit' || target?.kind !== 'field' || target.ref.owner !== 'bullet') return null
    return target.ref.section === section && target.ref.id === id && target.ref.index === 'append' ? target.ref : null
  })
  const ref = (index: BulletRef['index']): BulletRef => ({ owner: 'bullet', section, id, key: 'bullets', index })
</script>

{#snippet draftRow()}
  {#if pending}
    <li data-print-hide><span class="bullet-draft-anchor" data-edit-key={refKey(pending)} aria-hidden="true"></span></li>
  {/if}
{/snippet}

{#if bullets.length || pending}
  <ul class="item-bullets" data-print-hide={!bullets.length ? true : undefined}>
    {#each bullets as bullet, index (index)}
      <li><Editable ref={ref(index)} value={bullet} /></li>
      {#if pending?.after === index}{@render draftRow()}{/if}
    {/each}
    {#if pending && pending.after === undefined}{@render draftRow()}{/if}
  </ul>
{/if}
{#if editing.mode === 'edit'}
  <div class="bullet-add" data-print-hide>
    <button type="button" class="tool-btn" data-edit-key={refKey(ref('append'))} onclick={(event) => { event.stopPropagation(); editing.begin({ kind: 'field', ref: ref('append') }) }}><Icon name="plus" />{t(prefs.uiLocale, 'bullet.add')}</button>
  </div>
{/if}
