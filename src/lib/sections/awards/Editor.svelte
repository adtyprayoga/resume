<script lang="ts">
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
  addLabel="+ Add award"
  onAdd={() => resumeDoc.addItem('awards')}
  onRemove={(id) => resumeDoc.removeItem('awards', id)}
  onMove={(id, delta) => resumeDoc.moveItem('awards', id, delta)}
>
  {#snippet children(item)}
    <TextField label="Date" scope="shared" bind:value={item.date} placeholder="2024-05" />
    {#key locale}
      <TextField label="Title" bind:value={item.text[locale].title} />
      <TextField label="Issuer" bind:value={item.text[locale].issuer} />
      <TextArea label="Notes" bind:value={item.text[locale].description} rows={2} />
    {/key}
  {/snippet}
</RepeatableList>
