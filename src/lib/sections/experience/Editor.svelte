<script lang="ts">
  import DateRangeField from '$components/ui/DateRangeField.svelte'
  import LinesField from '$components/ui/LinesField.svelte'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { t } from '$lib/i18n/ui'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.experience)
  const locale = $derived(prefs.documentLocale)

  setPaneScope('localized')
</script>

<RepeatableList
  {items}
  addLabel={t(prefs.uiLocale, 'add.experience')}
  onAdd={() => resumeDoc.addItem('experience')}
  onRemove={(id) => resumeDoc.removeItem('experience', id)}
  onMove={(id, delta) => resumeDoc.moveItem('experience', id, delta)}
>
  {#snippet children(item)}
    <TextField label={t(prefs.uiLocale, 'field.company')} scope="shared" bind:value={item.company} />
    <DateRangeField bind:value={item.dates} presentLabel={t(prefs.uiLocale, 'date.present')} />
    {#key locale}
      <TextField label={t(prefs.uiLocale, 'field.role')} bind:value={item.text[locale].role} />
      <div class="field-row">
        <TextField label={t(prefs.uiLocale, 'field.team')} bind:value={item.text[locale].team} />
        <TextField label={t(prefs.uiLocale, 'field.location')} bind:value={item.text[locale].location} />
      </div>
      <LinesField label={t(prefs.uiLocale, 'field.highlights')} bind:value={item.text[locale].bullets} rows={5} />
    {/key}
  {/snippet}
</RepeatableList>
