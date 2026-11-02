<script lang="ts">
  /**
   * Edits a photo draft. Image processing is asynchronous, so a result that
   * arrives after this field closed — the edit was cancelled or applied — or
   * after a newer pick is dropped instead of landing on a later session.
   */
  import { onDestroy } from 'svelte'
  import AvatarImage from '../ui/AvatarImage.svelte'
  import { t, translatedMessage, type UiMessage } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  import { AVATAR_PIXELS, fileToAvatar } from '$lib/ui/avatar'

  const { value, label, scopeText, onchange }: {
    value: string
    label: string
    scopeText: string
    onchange: (value: string) => void
  } = $props()

  let error = $state<({ error: string } & Partial<UiMessage>) | null>(null)
  let busy = $state(false)
  let alive = true
  let token = 0

  onDestroy(() => {
    alive = false
  })

  const choose = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const mine = ++token
    error = null
    busy = true
    const result = await fileToAvatar(file)
    if (!alive || mine !== token) return
    busy = false

    if (!result.ok) {
      error = result
      return
    }
    onchange(result.dataUrl)
  }

  const remove = () => {
    token += 1
    busy = false
    error = null
    onchange('')
  }
</script>

<div class="field">
  <span class="field-label"><span>{label}</span><span class="field-scope shared">{scopeText}</span></span>
  <div class="avatar-row">
    {#if value}
      <AvatarImage class="avatar-preview" src={value} />
    {:else}
      <span class="avatar-preview empty" aria-hidden="true">—</span>
    {/if}

    <div class="avatar-actions">
      <label class="tool-btn avatar-pick">
        {t(prefs.uiLocale, busy ? 'avatar.reading' : value ? 'avatar.replace' : 'avatar.choose')}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={choose} />
      </label>
      {#if value}
        <button type="button" class="repeat-btn danger" onclick={remove}>{t(prefs.uiLocale, 'avatar.remove')}</button>
      {/if}
    </div>
  </div>

  {#if error}
    <p class="field-hint error" role="alert">{translatedMessage(prefs.uiLocale, error, error.error)}</p>
  {:else}
    <p class="field-hint">{t(prefs.uiLocale, 'avatar.hint', { pixels: AVATAR_PIXELS })}</p>
  {/if}
  <p class="field-hint">{t(prefs.uiLocale, 'avatar.layoutNote')}</p>
</div>
