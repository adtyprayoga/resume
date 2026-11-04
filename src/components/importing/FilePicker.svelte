<script lang="ts">
  import Icon from '../shell/Icon.svelte'
  import { t } from '$lib/i18n/ui'
  import { prefs } from '$lib/state/preferences.svelte'
  const { id, format, label, limit, disabled = false, onSelect }: {
    id: string; format: 'pdf' | 'json'; label: string; limit: number; disabled?: boolean; onSelect: (file: File | null) => void
  } = $props()
  let input = $state<HTMLInputElement>()
  let file = $state<File | null>(null)
  let error = $state('')
  let dragging = $state(false)
  const size = (bytes: number) => bytes < 1024
    ? `${bytes.toLocaleString(prefs.uiLocale)} B`
    : new Intl.NumberFormat(prefs.uiLocale, { style: 'unit', unit: bytes < 1024 * 1024 ? 'kilobyte' : 'megabyte', maximumFractionDigits: 1 })
      .format(bytes / (bytes < 1024 * 1024 ? 1024 : 1024 * 1024))
  const select = (files: FileList | File[]) => {
    if (disabled) return
    error = ''
    if (files.length !== 1) {
      if (files.length > 1) { error = t(prefs.uiLocale, 'picker.multiple'); file = null; onSelect(null) }
      return
    }
    const candidate = files[0]!
    const mime = format === 'pdf' ? 'application/pdf' : 'application/json'
    if (!candidate.name.toLowerCase().endsWith(`.${format}`) || (candidate.type !== '' && candidate.type !== mime)) {
      error = t(prefs.uiLocale, 'picker.type', { format: format.toUpperCase() })
    } else if (candidate.size > limit) {
      error = t(prefs.uiLocale, 'picker.size', { limit: format === 'pdf' ? '10 MiB' : '1,000,000 bytes' })
    }
    if (error) { file = null; onSelect(null); return }
    file = candidate
    onSelect(file)
  }
  const remove = () => { file = null; error = ''; if (input) input.value = ''; onSelect(null) }
</script>

<div class="file-picker" class:dragging role="group" aria-label={`${label}: ${t(prefs.uiLocale, 'picker.drop')}`}
  ondragenter={(event) => { event.preventDefault(); if (!disabled) dragging = true }}
  ondragover={(event) => { event.preventDefault() }}
  ondragleave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dragging = false }}
  ondrop={(event) => { event.preventDefault(); dragging = false; if (event.dataTransfer) select(event.dataTransfer.files) }}>
  <Icon name="import" size={28} />
  <label class="sr-only" for={id}>{label}</label>
  <input {id} class="file-picker-input" hidden tabindex="-1" type="file" accept={format === 'pdf' ? 'application/pdf,.pdf' : 'application/json,.json'}
    bind:this={input} {disabled} aria-describedby={`${id}-guidance${error ? ` ${id}-error` : ''}`} aria-invalid={!!error}
    onchange={(event) => { select(event.currentTarget.files ?? []); event.currentTarget.value = '' }} />
  <p id="{id}-guidance" class="field-hint">{t(prefs.uiLocale, 'picker.drop')}</p>
  {#if file}
    <p class="file-picker-name">{file.name}</p>
    <p class="field-hint">{size(file.size)}</p>
  {/if}
  <div class="import-actions">
    <button id={`${id}-choose`} type="button" class="tool-btn" {disabled} onclick={() => input?.click()}>{t(prefs.uiLocale, file ? 'picker.change' : format === 'pdf' ? 'picker.choosePdf' : 'picker.chooseJson')}</button>
    {#if file}<button type="button" class="tool-btn" {disabled} onclick={remove}>{t(prefs.uiLocale, 'picker.remove')}</button>{/if}
  </div>
  {#if error}<p id="{id}-error" class="save-status error" role="alert">{error}</p>{/if}
</div>
