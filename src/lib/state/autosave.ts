import type { ResumeDocument } from '$lib/model/types'
import { saveDocument, type SaveStatus } from '$lib/storage/persist'

export const AUTOSAVE_DELAY_MS = 600

/**
 * `$effect` cannot run at the top level of a `.svelte.ts` module, so the effect
 * driving this lives in `PersistenceHost.svelte` and the logic stays here.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | undefined
  private onStatus: (status: SaveStatus) => void

  constructor(onStatus: (status: SaveStatus) => void) {
    this.onStatus = onStatus
  }


  schedule(doc: ResumeDocument, delay = AUTOSAVE_DELAY_MS): void {
    this.cancel()
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.onStatus(saveDocument(doc))
    }, delay)
  }

  /** For page unload. */
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
