<script lang="ts">
  import { parseResumeJson } from '$lib/io/importJson'
  import { fetchResumeJson } from '$lib/io/importUrl'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { focusTrap } from '$lib/ui/focusTrap'

  const { onClose }: { onClose: () => void } = $props()

  let pasted = $state('')
  let url = $state('')
  let error = $state('')
  let busy = $state(false)

  const applyText = (text: string) => {
    const result = parseResumeJson(text)
    if (!result.ok) {
      error = result.error
      return
    }
    resumeDoc.replace(result.value)
    onClose()
  }

  const onFile = async (event: Event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    error = ''
    applyText(await file.text())
  }

  const fromUrl = async () => {
    error = ''
    busy = true
    const result = await fetchResumeJson(url)
    busy = false
    if (!result.ok) {
      error = result.error
      return
    }
    resumeDoc.replace(result.value)
    onClose()
  }
</script>

<div
  class="drawer-overlay"
  style="align-items:center;justify-content:center"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose()
  }}
>
  <div
    class="drawer"
    style="width:min(32rem,100vw);max-height:80vh;border-radius:0.625rem"
    role="dialog"
    aria-modal="true"
    aria-label="Import resume JSON"
    use:focusTrap
  >
    <header class="drawer-head">
      <strong style="flex:1;font-size:0.9375rem">Import resume JSON</strong>
      <button type="button" class="repeat-btn" onclick={onClose}>Close</button>
    </header>

    <div class="drawer-body">
      {#if error}
        <p class="save-status error" style="margin-bottom:0.75rem">{error}</p>
      {/if}

      <h3 class="editor-subhead" style="margin-top:0">From a file</h3>
      <input type="file" accept="application/json,.json" onchange={onFile} />

      <h3 class="editor-subhead">From a URL</h3>
      <div style="display:flex;gap:0.375rem">
        <input
          class="field-input"
          type="url"
          placeholder="https://example.com/resume.json"
          bind:value={url}
        />
        <button type="button" class="tool-btn" disabled={busy || !url} onclick={fromUrl}>
          {busy ? 'Loading…' : 'Load'}
        </button>
      </div>
      <p class="field-hint">https only.</p>

      <h3 class="editor-subhead">Paste JSON</h3>
      <textarea class="field-textarea" rows={6} bind:value={pasted}></textarea>
      <button
        type="button"
        class="tool-btn"
        disabled={!pasted.trim()}
        onclick={() => applyText(pasted)}
      >
        Import pasted JSON
      </button>
    </div>
  </div>
</div>
