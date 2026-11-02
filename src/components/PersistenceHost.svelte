<script lang="ts">
  /**
   * The app's only `$effect`. It exists as a component because `$effect` cannot
   * be called at the top level of a `.svelte.ts` module, so the state modules
   * stay effect-free and the write logic stays a plain testable class.
   */
  import { Autosaver } from '$lib/state/autosave'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { savePreferences } from '$lib/storage/persist'

  const autosaver = new Autosaver((status) => (prefs.saveStatus = status))

  $effect(() => {
    // Snapshotting walks the whole document, which is what registers the
    // dependency on every field, so any edit reschedules the write.
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
