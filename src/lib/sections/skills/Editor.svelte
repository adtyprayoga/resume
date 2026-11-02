<script lang="ts">
  import { t } from '$lib/i18n/ui'
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TagsField from '$components/ui/TagsField.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.skills)
  const locale = $derived(prefs.documentLocale)

  setPaneScope('localized')
</script>

<RepeatableList
  {items}
  addLabel={t(prefs.uiLocale, 'add.skills')}
  onAdd={() => resumeDoc.addItem('skills')}
  onRemove={(id) => resumeDoc.removeItem('skills', id)}
  onMove={(id, delta) => resumeDoc.moveItem('skills', id, delta)}
>
  {#snippet children(item)}
    {#key locale}
      <TextField label={t(prefs.uiLocale, 'field.group')} bind:value={item.text[locale].title} />
      <TagsField label={t(prefs.uiLocale, 'field.skills')} bind:value={item.text[locale].items} />
    {/key}
  {/snippet}
</RepeatableList>
