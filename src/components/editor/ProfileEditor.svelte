<script lang="ts">
  import { t } from '$lib/i18n/ui'
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
    <TextField label={t(prefs.uiLocale, 'field.name')} bind:value={text[locale].name} />
    <TextField label={t(prefs.uiLocale, 'field.location')} bind:value={text[locale].location} />
  </div>
  <TextField label={t(prefs.uiLocale, 'field.headline')} bind:value={text[locale].headline} />
  <TextArea label={t(prefs.uiLocale, 'field.summary')} bind:value={text[locale].summary} rows={3} />
{/key}

<ContactEditor />
