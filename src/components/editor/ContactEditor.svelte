<script lang="ts">
  import AvatarField from './AvatarField.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { normalizeUrl } from '$lib/model/sanitize'
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
<TextField
  label="Website"
  scope="shared"
  type="url"
  placeholder="example.com"
  normalize={normalizeUrl}
  bind:value={contact.website}
/>
<div class="field-row">
  <TextField
    label="GitHub"
    scope="shared"
    type="url"
    placeholder="github.com/you"
    normalize={normalizeUrl}
    bind:value={contact.github}
  />
  <TextField
    label="LinkedIn"
    scope="shared"
    type="url"
    placeholder="linkedin.com/in/you"
    normalize={normalizeUrl}
    bind:value={contact.linkedin}
  />
</div>
<AvatarField />
