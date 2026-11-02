<script lang="ts">
  import ContactEditor from './ContactEditor.svelte'
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { setPaneScope } from '$lib/ui/scope'

  setPaneScope('localized')

  const locale = $derived(prefs.documentLocale)
  const text = $derived(resumeDoc.current.profile.text)
</script>

{#key locale}
  <div class="field-row">
    <TextField label="Name" bind:value={text[locale].name} />
    <TextField label="Location" bind:value={text[locale].location} />
  </div>
  <TextField label="Headline" bind:value={text[locale].headline} />
  <TextArea label="Summary" bind:value={text[locale].summary} rows={3} />
{/key}

<ContactEditor />
