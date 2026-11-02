import type { ResumeDocument } from '$lib/model/types'
import { saveDocument, type SaveStatus } from '$lib/storage/persist'

export const AUTOSAVE_DELAY_MS = 600

/**
 * Debounced writer, kept as a plain function rather than an effect.
 *
 * `$effect` cannot be called at the top level of a `.svelte.ts` module — it must
 * run while a parent effect is active — so the effect that drives this lives in
 * `PersistenceHost.svelte` and the logic stays here, pure and testable.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | undefined
  private onStatus: (status: SaveStatus) => void

  constructor(onStatus: (status: SaveStatus) => void) {
    this.onStatus = onStatus
  }

  /** Coalesces rapid edits into a single write. */
  schedule(doc: ResumeDocument, delay = AUTOSAVE_DELAY_MS): void {
    this.cancel()
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.onStatus(saveDocument(doc))
    }, delay)
  }

  /** Writes immediately, for page unload. */
  flush(doc: ResumeDocument): void {
    this.cancel()
    this.onStatus(saveDocument(doc))
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  get pending(): boolean {
    return this.timer !== undefined
  }
}
