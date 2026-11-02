import { emptyDocument } from '$lib/model/document'
import { resumeDoc } from './document.svelte'
import { editing } from './editing.svelte'

/** Replaces the document with an empty one; an open draft belongs to the old document and is dropped. */
export const startBlank = (): void => {
  editing.cancel()
  resumeDoc.replace(emptyDocument())
}
