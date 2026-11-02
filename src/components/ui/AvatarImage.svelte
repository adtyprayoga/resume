<script lang="ts">
  // Shared by the paper and the editor so both apply the same image-source policy.
  import { t } from '$lib/i18n/ui'
  import { photoConsent } from '$lib/state/photoConsent.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { classifyImageSource } from '$lib/ui/imageSource'

  const { src, class: className }: { src: string; class: string } = $props()

  const source = $derived(classifyImageSource(src))
  const visible = $derived(
    source.kind === 'embedded' ||
      source.kind === 'same-origin' ||
      (source.kind === 'remote-https' && photoConsent.allows(source.url)),
  )

  $effect(() => {
    photoConsent.forgetUnless(source.kind === 'remote-https' ? source.url : '')
  })
</script>

{#if visible}
  <img class={className} {src} alt="" referrerpolicy="no-referrer" />
{:else if source.kind === 'remote-https'}
  <div class="photo-notice {className}" data-print-hide>
    <p>{t(prefs.uiLocale, 'photo.remoteNotice', { host: source.host })}</p>
    <button type="button" class="repeat-btn" onclick={() => photoConsent.allow(source.url)}>
      {t(prefs.uiLocale, 'photo.remoteAllow')}
    </button>
  </div>
{:else if source.kind === 'remote-http'}
  <div class="photo-notice {className}" data-print-hide>
    <p>{t(prefs.uiLocale, 'photo.httpBlocked', { host: source.host })}</p>
  </div>
{/if}

<style>
  .photo-notice {
    display: grid;
    align-content: center;
    gap: 0.25rem;
    width: auto;
    height: auto;
    max-width: 14rem;
    padding: 0.375rem;
    border: 1px dashed var(--color-line);
    font: 400 var(--text-caps)/1.3 var(--font-sans);
    color: var(--color-muted);
    object-fit: initial;
  }
</style>
