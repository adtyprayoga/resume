<script lang="ts">
  // A component because `$effect` cannot run at the top level of a `.svelte.ts`
  // module; the state modules stay effect-free.
  import { Autosaver } from '$lib/state/autosave'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { savePreferences } from '$lib/storage/persist'

  const autosaver = new Autosaver((status) => (prefs.saveStatus = status))

  $effect(() => {
    // Snapshotting walks the document, registering a dependency on every field.
    const snapshot = resumeDoc.snapshot()
    autosaver.schedule(snapshot)
    return () => autosaver.cancel()
  })

  $effect(() => {
    savePreferences(prefs.persistable())
  })

  $effect(() => {
    const flush = () => autosaver.flush(resumeDoc.snapshot())
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  })
</script>
