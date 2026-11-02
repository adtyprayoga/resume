<script lang="ts">
  import DateRangeField from '$components/ui/DateRangeField.svelte'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { t } from '$lib/i18n/ui'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.education)
  const locale = $derived(prefs.documentLocale)
</script>

<RepeatableList
  {items}
  addLabel="+ Add education"
  onAdd={() => resumeDoc.addItem('education')}
  onRemove={(id) => resumeDoc.removeItem('education', id)}
  onMove={(id, delta) => resumeDoc.moveItem('education', id, delta)}
>
  {#snippet children(item)}
    <TextField label="GPA" scope="shared" bind:value={item.gpa} hint="Leave blank to hide." />
    <DateRangeField bind:value={item.dates} presentLabel={t(prefs.uiLocale, 'date.present')} />
    {#key locale}
      <TextField label="School" bind:value={item.text[locale].school} />
      <div class="field-row">
        <TextField label="Degree" bind:value={item.text[locale].degree} />
        <TextField label="Field" bind:value={item.text[locale].field} />
      </div>
      <TextArea label="Notes" bind:value={item.text[locale].description} />
    {/key}
  {/snippet}
</RepeatableList>
