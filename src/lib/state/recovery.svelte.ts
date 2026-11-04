import type { ResumeDocument } from '$lib/model/types'
import { loadDocument, saveDocument, type LoadResult, type SaveStatus } from '$lib/storage/persist'
import { sampleDocument } from '../../data/sample'
import { resumeDoc } from './document.svelte'

type Blocking = Extract<LoadResult, { kind: 'recovery' | 'unavailable' }>

/**
 * Startup gate for the stored document. While `blocked`, editing and every
 * save path stay off, so data that failed to load is never overwritten.
 */
class RecoveryStore {
  status = $state.raw<Blocking | null>(null)

  get blocked(): boolean {
    return this.status !== null
  }

  /** The sample is used only when nothing has ever been stored. */
  open(storage?: Storage | null): void {
    const result = loadDocument(storage)
    if (result.kind === 'loaded' || result.kind === 'empty') {
      resumeDoc.load(result.kind === 'loaded' ? result.document : sampleDocument())
      this.status = null
    } else {
      this.status = result
    }
  }

  /** Writes first; only a successful write replaces the document and lifts the gate. */
  commit(doc: ResumeDocument, storage?: Storage | null): SaveStatus {
    const status = saveDocument(doc, storage)
    if (status.kind === 'saved') {
      resumeDoc.load(doc)
      this.status = null
    }
    return status
  }
}

export const recovery = new RecoveryStore()
