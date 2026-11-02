<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.awards)
  const locale = $derived(prefs.documentLocale)

  setPaneScope('localized')
</script>

<RepeatableList
  {items}
  addLabel={t(prefs.uiLocale, 'add.awards')}
  onAdd={() => resumeDoc.addItem('awards')}
  onRemove={(id) => resumeDoc.removeItem('awards', id)}
  onMove={(id, delta) => resumeDoc.moveItem('awards', id, delta)}
>
  {#snippet children(item)}
    <TextField label={t(prefs.uiLocale, 'field.date')} scope="shared" bind:value={item.date} placeholder={t(prefs.uiLocale, 'placeholder.awardDate')} />
    {#key locale}
      <TextField label={t(prefs.uiLocale, 'field.title')} bind:value={item.text[locale].title} />
      <TextField label={t(prefs.uiLocale, 'field.issuer')} bind:value={item.text[locale].issuer} />
      <TextArea label={t(prefs.uiLocale, 'field.notes')} bind:value={item.text[locale].description} rows={2} />
    {/key}
  {/snippet}
</RepeatableList>
