import type { UiMessage } from '$lib/i18n/ui'

export type Result<T> = { ok: true; value: T } | ({ ok: false; error: string } & Partial<UiMessage>)

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = <T = never>(error: string, metadata?: UiMessage): Result<T> => ({ ok: false, error, ...metadata })
