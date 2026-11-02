import type { Locale } from '$lib/model/types'
import type { SectionKind } from '$lib/sections/kinds'
import { loadPreferences } from '$lib/storage/persist'
import type { SaveStatus } from '$lib/storage/persist'
import { defaultTheme, FONT_SCALES, getTheme } from '$lib/themes/index'
import type { FontScaleKey } from '$lib/themes/types'

const LOCALE_VALUES: Locale[] = ['id', 'en']

const asLocale = (value: unknown, fallback: Locale): Locale =>
  LOCALE_VALUES.includes(value as Locale) ? (value as Locale) : fallback

const asFontScale = (value: unknown): FontScaleKey =>
  typeof value === 'string' && value in FONT_SCALES ? (value as FontScaleKey) : 'standard'

/** Persisted settings, kept apart from document content. */
interface PersistablePreferences {
  uiLocale: Locale
  documentLocale: Locale
  themeKey: string
  fontScale: FontScaleKey
}

class PreferencesStore {
  /** Language of the interface. */
  uiLocale = $state<Locale>('en')
  /**
   * Language of the resume being edited. Independent of `uiLocale` on purpose:
   * editing an English resume through an Indonesian interface is reasonable, and
   * splitting these later would need a migration.
   */
  documentLocale = $state<Locale>('en')
  themeKey = $state<string>(defaultTheme.key)
  fontScale = $state<FontScaleKey>('standard')

  drawerOpen = $state(false)
  drawerSection = $state<SectionKind>('profile')
  showPageBreaks = $state(true)

  /** Surfaced in the UI so a failed autosave is never silent. */
  saveStatus = $state<SaveStatus>({ kind: 'idle' })

  get theme() {
    return getTheme(this.themeKey)
  }

  /** Reads stored settings, ignoring anything that is no longer a valid value. */
  hydrate(storage?: Storage | null): void {
    const stored = loadPreferences(storage)
    if (!stored) return

    this.uiLocale = asLocale(stored.uiLocale, this.uiLocale)
    this.documentLocale = asLocale(stored.documentLocale, this.documentLocale)
    this.fontScale = asFontScale(stored.fontScale)
    this.themeKey = getTheme(
      typeof stored.themeKey === 'string' ? stored.themeKey : null,
    ).key
  }

  persistable(): PersistablePreferences {
    return {
      uiLocale: this.uiLocale,
      documentLocale: this.documentLocale,
      themeKey: this.themeKey,
      fontScale: this.fontScale,
    }
  }

  openDrawer(section: SectionKind): void {
    this.drawerSection = section
    this.drawerOpen = true
  }

  closeDrawer(): void {
    this.drawerOpen = false
  }
}

export const prefs = new PreferencesStore()
