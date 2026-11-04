import { resumeDoc } from './document.svelte'

/**
 * Consent to load one remote photo for the current document. Memory only, so
 * a reload asks again; a replaced document or a changed avatar asks again too.
 */
class PhotoConsent {
  /** Keyed on document identity, so undo and redo keep consent for the same photo. */
  private approved = $state<{ identity: number; url: string } | null>(null)

  allow(url: string): void {
    this.approved = { identity: resumeDoc.identity, url }
  }

  allows(url: string): boolean {
    return this.approved?.identity === resumeDoc.identity && this.approved.url === url
  }

  /** Called whenever the avatar is observed, so A → B → A does not revive consent for A. */
  forgetUnless(url: string): void {
    if (this.approved && !this.allows(url)) this.approved = null
  }
}

export const photoConsent = new PhotoConsent()
