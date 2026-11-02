<script lang="ts">
  // A component because `$effect` cannot run at the top level of a `.svelte.ts`
  // module; the state modules stay effect-free.
  import { Autosaver } from '$lib/state/autosave'
  import { resumeDoc } from '$lib/state/document.svelte'
  import { recovery } from '$lib/state/recovery.svelte'
  import { prefs } from '$lib/state/preferences.svelte'
  import { savePreferences } from '$lib/storage/persist'

  // The first schedule writes what was just loaded; only later ones are the user's changes.
  let initial = true
  let changing = false

  const autosaver = new Autosaver((status) => {
    prefs.saveStatus = status
    prefs.saving = false
    if (changing && status.kind === 'saved') prefs.changeSaved = true
  }, () => !recovery.blocked)

  $effect(() => {
    if (recovery.blocked) return
    // Snapshotting walks the document, registering a dependency on every field.
    const snapshot = resumeDoc.snapshot()
    changing = !initial
    initial = false
    if (changing) prefs.saving = true
    autosaver.schedule(snapshot)
    return () => {
      autosaver.cancel()
      prefs.saving = false
    }
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
