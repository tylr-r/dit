import type { ProgressSnapshot } from '../types'

export type ProgressPayload = ProgressSnapshot & { updatedAt: number }

export type FirebaseProgressAdapter = {
  read: (path: string) => Promise<unknown>
  write: (path: string, payload: ProgressPayload) => Promise<void>
}

export const progressPathForUser = (userId: string) =>
  `users/${userId}/progress`

// Firebase Realtime Database rejects `undefined` values and throws synchronously
// during validation, which bypasses promise .catch handlers. Strip them here so
// unset optional fields (e.g. bestWpm for a new account) don't blow up saves.
const stripUndefined = <T extends Record<string, unknown>>(value: T): T => {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(value)) {
    const entry = value[key]
    if (entry !== undefined) {
      result[key] = entry
    }
  }
  return result as T
}

export const createProgressPayload = (
  snapshot: ProgressSnapshot,
  updatedAt: number = Date.now(),
): ProgressPayload =>
  stripUndefined({
    ...snapshot,
    updatedAt,
  })

export const createFirebaseProgressService = (
  adapter: FirebaseProgressAdapter,
) => ({
  load: (userId: string) => adapter.read(progressPathForUser(userId)),
  save: (userId: string, snapshot: ProgressSnapshot, updatedAt?: number) =>
    adapter.write(
      progressPathForUser(userId),
      createProgressPayload(snapshot, updatedAt),
    ),
})
