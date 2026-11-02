<script lang="ts">
  import DateRangeField from '$components/ui/DateRangeField.svelte'
  import LinesField from '$components/ui/LinesField.svelte'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TagsField from '$components/ui/TagsField.svelte'
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { t } from '$lib/i18n/ui'
  import { normalizeUrl } from '$lib/model/sanitize'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.projects)
  const locale = $derived(prefs.documentLocale)

  setPaneScope('localized')
</script>

<RepeatableList
  {items}
  addLabel={t(prefs.uiLocale, 'add.projects')}
  onAdd={() => resumeDoc.addItem('projects')}
  onRemove={(id) => resumeDoc.removeItem('projects', id)}
  onMove={(id, delta) => resumeDoc.moveItem('projects', id, delta)}
>
  {#snippet children(item)}
      <TextField
        label={t(prefs.uiLocale, 'field.link')}
        scope="shared"
        type="url"
        placeholder={t(prefs.uiLocale, 'placeholder.project')}
        normalize={normalizeUrl}
        bind:value={item.link}
      />
    <TagsField label={t(prefs.uiLocale, 'field.techStack')} scope="shared" bind:value={item.techStack} />
    <DateRangeField bind:value={item.dates} presentLabel={t(prefs.uiLocale, 'date.present')} />
    {#key locale}
      <div class="field-row">
        <TextField label={t(prefs.uiLocale, 'field.name')} bind:value={item.text[locale].name} />
        <TextField label={t(prefs.uiLocale, 'field.role')} bind:value={item.text[locale].role} />
      </div>
      <TextArea label={t(prefs.uiLocale, 'field.description')} bind:value={item.text[locale].description} />
      <LinesField label={t(prefs.uiLocale, 'field.highlights')} bind:value={item.text[locale].bullets} />
    {/key}
  {/snippet}
</RepeatableList>
