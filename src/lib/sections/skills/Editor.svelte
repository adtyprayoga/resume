<script lang="ts">
  import RepeatableList from '$components/ui/RepeatableList.svelte'
  import TagsField from '$components/ui/TagsField.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const items = $derived(resumeDoc.current.content.skills)
  const locale = $derived(prefs.documentLocale)
</script>

<RepeatableList
  {items}
  addLabel="+ Add skill group"
  onAdd={() => resumeDoc.addItem('skills')}
  onRemove={(id) => resumeDoc.removeItem('skills', id)}
  onMove={(id, delta) => resumeDoc.moveItem('skills', id, delta)}
>
  {#snippet children(item)}
    {#key locale}
      <TextField label="Group" bind:value={item.text[locale].title} />
      <TagsField label="Skills" bind:value={item.text[locale].items} />
    {/key}
  {/snippet}
</RepeatableList>
