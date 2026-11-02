<script lang="ts">
  import { prefs } from '$lib/state/preferences.svelte'
  import { t } from '$lib/i18n/ui'
  import AvatarField from './AvatarField.svelte'
  import TextField from '$components/ui/TextField.svelte'
  import { normalizeUrl } from '$lib/model/sanitize'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { setPaneScope } from '$lib/ui/scope'

  // Everything here is shared, so the heading says it once instead of each field.
  setPaneScope('shared')

  const contact = $derived(resumeDoc.current.contact)
</script>

<h3 class="editor-subhead">{t(prefs.uiLocale, 'editor.contact')} <span class="editor-subhead-note">{t(prefs.uiLocale, 'editor.sharedContact')}</span></h3>

<div class="field-row">
  <TextField label={t(prefs.uiLocale, 'field.email')} scope="shared" type="email" bind:value={contact.email} />
  <TextField label={t(prefs.uiLocale, 'field.phone')} scope="shared" type="tel" bind:value={contact.phone} />
</div>
<TextField
  label={t(prefs.uiLocale, 'field.website')}
  scope="shared"
  type="url"
  placeholder={t(prefs.uiLocale, 'placeholder.website')}
  normalize={normalizeUrl}
  bind:value={contact.website}
/>
<div class="field-row">
  <TextField
    label={t(prefs.uiLocale, 'field.github')}
    scope="shared"
    type="url"
    placeholder={t(prefs.uiLocale, 'placeholder.github')}
    normalize={normalizeUrl}
    bind:value={contact.github}
  />
  <TextField
    label={t(prefs.uiLocale, 'field.linkedin')}
    scope="shared"
    type="url"
    placeholder={t(prefs.uiLocale, 'placeholder.linkedin')}
    normalize={normalizeUrl}
    bind:value={contact.linkedin}
  />
</div>
<AvatarField />
