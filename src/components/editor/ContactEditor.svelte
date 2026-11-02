<script lang="ts">
  import TextField from '$components/ui/TextField.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'

  // Everything here is shared, so the heading says it once instead of each field.
  setPaneScope('shared')

  const contact = $derived(resumeDoc.current.contact)
</script>

<h3 class="editor-subhead">Contact <span class="editor-subhead-note">shared by both languages</span></h3>

<div class="field-row">
  <TextField label="Email" scope="shared" type="email" bind:value={contact.email} />
  <TextField label="Phone" scope="shared" type="tel" bind:value={contact.phone} />
</div>
<TextField label="Website" scope="shared" type="url" bind:value={contact.website} />
<div class="field-row">
  <TextField label="GitHub" scope="shared" type="url" bind:value={contact.github} />
  <TextField label="LinkedIn" scope="shared" type="url" bind:value={contact.linkedin} />
</div>
<TextField
  label="Avatar"
  scope="shared"
  type="url"
  bind:value={contact.avatar}
  placeholder="/images/me.png"
  hint="An image URL or a path on this site. Embedded images can exhaust browser storage."
/>
