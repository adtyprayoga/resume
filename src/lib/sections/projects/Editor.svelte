<script lang="ts">
  import DateRangeField from '$components/ui/DateRangeField.svelte'
  import LinesField from '$components/ui/LinesField.svelte'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TagsField from '$components/ui/TagsField.svelte'
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { t } from '$lib/i18n/ui'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.projects)
  const locale = $derived(prefs.documentLocale)

  setPaneScope('localized')
</script>

<RepeatableList
  {items}
  addLabel="+ Add project"
  onAdd={() => resumeDoc.addItem('projects')}
  onRemove={(id) => resumeDoc.removeItem('projects', id)}
  onMove={(id, delta) => resumeDoc.moveItem('projects', id, delta)}
>
  {#snippet children(item)}
    <TextField label="Link" scope="shared" type="url" bind:value={item.link} />
    <TagsField label="Tech stack" scope="shared" bind:value={item.techStack} />
    <DateRangeField bind:value={item.dates} presentLabel={t(prefs.uiLocale, 'date.present')} />
    {#key locale}
      <div class="field-row">
        <TextField label="Name" bind:value={item.text[locale].name} />
        <TextField label="Role" bind:value={item.text[locale].role} />
      </div>
      <TextArea label="Description" bind:value={item.text[locale].description} />
      <LinesField label="Highlights" bind:value={item.text[locale].bullets} />
    {/key}
  {/snippet}
</RepeatableList>
