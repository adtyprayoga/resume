<script lang="ts">
  import AvatarImage from '../ui/AvatarImage.svelte'
  import { t, translatedMessage, type UiMessage } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { AVATAR_PIXELS, fileToAvatar } from '$lib/ui/avatar'

  const contact = $derived(resumeDoc.current.contact)

  let error = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let busy = $state(false)

  const choose = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    error = null
    busy = true
    const result = await fileToAvatar(file)
    busy = false

    if (!result.ok) {
      error = result
      return
    }
    contact.avatar = result.dataUrl
  }
</script>

<div class="field">
  <span class="field-label">{t(prefs.uiLocale, 'avatar.photo')}</span>
  <div class="avatar-row">
    {#if contact.avatar}
      <AvatarImage class="avatar-preview" src={contact.avatar} />
    {:else}
      <span class="avatar-preview empty" aria-hidden="true">—</span>
    {/if}

    <div class="avatar-actions">
      <label class="tool-btn avatar-pick">
        {t(prefs.uiLocale, busy ? 'avatar.reading' : contact.avatar ? 'avatar.replace' : 'avatar.choose')}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={choose} />
      </label>
      {#if contact.avatar}
        <button type="button" class="repeat-btn danger" onclick={() => (contact.avatar = '')}>
          {t(prefs.uiLocale, 'avatar.remove')}
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <p class="field-hint error">{translatedMessage(prefs.uiLocale, error, error.error)}</p>
  {:else}
    <p class="field-hint">
      {t(prefs.uiLocale, 'avatar.hint', { pixels: AVATAR_PIXELS })}
    </p>
  {/if}
</div>
