import type { Locale } from '$lib/model/types'
import { loadPreferences } from '$lib/storage/persist'
import type { SaveStatus } from '$lib/storage/persist'
import { defaultTheme, FONT_SCALES, getTheme } from '$lib/themes/index'
import type { FontScaleKey } from '$lib/themes/types'

const LOCALE_VALUES: Locale[] = ['id', 'en']

const asLocale = (value: unknown, fallback: Locale): Locale =>
  LOCALE_VALUES.includes(value as Locale) ? (value as Locale) : fallback

const asFontScale = (value: unknown): FontScaleKey =>
  typeof value === 'string' && value in FONT_SCALES ? (value as FontScaleKey) : 'standard'


interface PersistablePreferences {
  uiLocale: Locale
  documentLocale: Locale
  themeKey: string
  fontScale: FontScaleKey
  introDismissed: boolean
}

class PreferencesStore {
  uiLocale = $state<Locale>('en')
  /** Independent of `uiLocale`: an Indonesian interface editing an English resume is reasonable. */
  documentLocale = $state<Locale>('en')
  themeKey = $state<string>(defaultTheme.key)
  fontScale = $state<FontScaleKey>('standard')

  showPageBreaks = $state(true)
  /** The first-run introduction was closed; it never returns. */
  introDismissed = $state(false)

  /** Surfaced in the UI; a silent autosave failure would be the worst bug here. */
  saveStatus = $state<SaveStatus>({ kind: 'idle' })
  /** A committed change is waiting for the autosave timer. */
  saving = $state(false)
  /** A change made in this session has reached storage; the first-load save does not count. */
  changeSaved = $state(false)

  get theme() {
    return getTheme(this.themeKey)
  }

  /** Ignores values that are no longer valid. */
  hydrate(storage?: Storage | null): void {
    const stored = loadPreferences(storage)
    if (!stored) return

    this.uiLocale = asLocale(stored.uiLocale, this.uiLocale)
    this.documentLocale = asLocale(stored.documentLocale, this.documentLocale)
    this.fontScale = asFontScale(stored.fontScale)
    this.introDismissed = stored.introDismissed === true
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
      introDismissed: this.introDismissed,
    }
  }
}

export const prefs = new PreferencesStore()
