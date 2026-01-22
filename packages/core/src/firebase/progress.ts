import type { ProgressSnapshot } from '../types'

export type ProgressPayload = ProgressSnapshot & { updatedAt: number }

export type FirebaseProgressAdapter = {
  read: (path: string) => Promise<unknown>
  write: (path: string, payload: ProgressPayload) => Promise<void>
}

export const progressPathForUser = (userId: string) =>
  `users/${userId}/progress`

export const createProgressPayload = (
  snapshot: ProgressSnapshot,
  updatedAt: number = Date.now(),
): ProgressPayload => ({
  ...snapshot,
  updatedAt,
})

export const createFirebaseProgressService = (
  adapter: FirebaseProgressAdapter,
) => ({
  load: (userId: string) => adapter.read(progressPathForUser(userId)),
  save: (userId: string, snapshot: ProgressSnapshot) =>
    adapter.write(progressPathForUser(userId), createProgressPayload(snapshot)),
})
