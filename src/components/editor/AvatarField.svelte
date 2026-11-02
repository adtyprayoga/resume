<script lang="ts">
  import { resumeDoc } from '$lib/state/document.svelte'
  import { AVATAR_PIXELS, fileToAvatar } from '$lib/ui/avatar'

  const contact = $derived(resumeDoc.current.contact)

  let error = $state('')
  let busy = $state(false)

  const choose = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    error = ''
    busy = true
    const result = await fileToAvatar(file)
    busy = false

    if (!result.ok) {
      error = result.error
      return
    }
    contact.avatar = result.dataUrl
  }
</script>

<div class="field">
  <span class="field-label">Photo</span>
  <div class="avatar-row">
    {#if contact.avatar}
      <img class="avatar-preview" src={contact.avatar} alt="" />
    {:else}
      <span class="avatar-preview empty" aria-hidden="true">—</span>
    {/if}

    <div class="avatar-actions">
      <label class="tool-btn avatar-pick">
        {busy ? 'Reading…' : contact.avatar ? 'Replace' : 'Choose image'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={choose} />
      </label>
      {#if contact.avatar}
        <button type="button" class="repeat-btn danger" onclick={() => (contact.avatar = '')}>
          Remove
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <p class="field-hint error">{error}</p>
  {:else}
    <p class="field-hint">
      Stored inside your resume and resized to {AVATAR_PIXELS}px, since there is no
      server to upload to. It travels with your JSON export.
    </p>
  {/if}
</div>
