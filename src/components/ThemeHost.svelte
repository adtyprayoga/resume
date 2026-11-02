<script lang="ts">
  /**
   * Applies the theme's custom properties to the document root.
   *
   * They cannot live on the preview element: `@page` resolves against the page
   * context, which inherits from the root, so a margin set further down the
   * tree would be invisible to the print rules.
   */
  import { prefs } from '$lib/state/preferences.svelte'
  import { buildThemeStyleVars } from '$lib/themes/index'

  $effect(() => {
    const vars = buildThemeStyleVars(prefs.theme, prefs.fontScale)
    const root = document.documentElement
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)

    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name)
    }
  })
</script>
