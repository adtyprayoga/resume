<script lang="ts">
  import TextArea from '$components/ui/TextArea.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'

  const contact = $derived(resumeDoc.current.contact)
  const locale = $derived(prefs.documentLocale)
  const text = $derived(resumeDoc.current.profile.text)
</script>

{#key locale}
  <TextField label="Name" bind:value={text[locale].name} />
  <TextField label="Headline" bind:value={text[locale].headline} />
  <TextField label="Location" bind:value={text[locale].location} />
  <TextArea label="Summary" bind:value={text[locale].summary} rows={4} />
{/key}

<h3 class="editor-subhead">Contact</h3>
<p class="field-hint" style="margin-bottom:0.5rem">
  Shared across both languages, so a change here updates every version.
</p>
<div class="field-row">
  <TextField label="Email" scope="shared" type="email" bind:value={contact.email} />
  <TextField label="Phone" scope="shared" type="tel" bind:value={contact.phone} />
</div>
<TextField label="Website" scope="shared" type="url" bind:value={contact.website} />
<TextField label="GitHub" scope="shared" type="url" bind:value={contact.github} />
<TextField label="LinkedIn" scope="shared" type="url" bind:value={contact.linkedin} />
<TextField
  label="Avatar URL"
  scope="shared"
  type="url"
  bind:value={contact.avatar}
  hint="An image URL. Embedded images can exhaust browser storage."
/>
