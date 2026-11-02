import type { UiMessage } from '$lib/i18n/ui'
/** Downscaled hard: the result is embedded in the document and stored in localStorage. */
export const AVATAR_PIXELS = 320
export const MAX_SOURCE_BYTES = 8_000_000
export const MAX_RESULT_BYTES = 120_000

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export type AvatarResult = { ok: true; dataUrl: string } | ({ ok: false; error: string } & Partial<UiMessage>)

export const checkSource = (file: { type: string; size: number }): string | null => {
  if (!ACCEPTED.includes(file.type)) return 'Choose a PNG, JPEG, WebP or GIF image.'
  if (file.size > MAX_SOURCE_BYTES) return 'That image is too large to read.'
  return null
}

/** Longest side to AVATAR_PIXELS, preserving aspect ratio. */
export const fitWithin = (width: number, height: number, max: number) => {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Rough decoded size of a base64 data URL, for the storage budget. */
export const dataUrlBytes = (dataUrl: string): number => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Reads an image file and returns a small JPEG data URL.
 *
 * The resume has no server, so an avatar has to live inside the document. That
 * means it also lives in localStorage, hence the downscale: a phone photo
 * pasted in raw would exhaust the quota on its own.
 */
export const fileToAvatar = async (file: File): Promise<AvatarResult> => {
  const problem = checkSource(file)
  if (problem) return { ok: false, error: problem, messageKey: ACCEPTED.includes(file.type) ? 'error.avatarSourceLarge' : 'error.avatarType' }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'That image could not be read.', messageKey: 'error.avatarRead' }
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, AVATAR_PIXELS)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return { ok: false, error: 'This browser cannot resize images.', messageKey: 'error.avatarResize' }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)

  if (dataUrlBytes(dataUrl) > MAX_RESULT_BYTES) {
    return { ok: false, error: 'That image is still too large after resizing.', messageKey: 'error.avatarResultLarge' }
  }

  return { ok: true, dataUrl }
}
