import { describe, expect, it } from 'vitest'
import {
  createFirebaseProgressService,
  createProgressPayload,
  progressPathForUser,
} from '../../src/firebase/progress'
import type { ProgressSnapshot } from '../../src/types'

const baseSnapshot: ProgressSnapshot = {
  listenWpm: 20,
  maxLevel: 1,
  practiceWordMode: false,
  scores: {} as ProgressSnapshot['scores'],
  showHint: true,
  showMnemonic: true,
  wordMode: false,
}

describe('createProgressPayload', () => {
  it('omits undefined snapshot fields so Firebase RTDB set() does not throw', () => {
    const payload = createProgressPayload(
      { ...baseSnapshot, bestWpm: undefined, streak: undefined },
      1_700_000_000_000,
    )

    expect(Object.hasOwn(payload, 'bestWpm')).toBe(false)
    expect(Object.hasOwn(payload, 'streak')).toBe(false)
    expect(payload.updatedAt).toBe(1_700_000_000_000)
    expect(payload.listenWpm).toBe(20)
  })

  it('preserves defined falsy values like 0 and false', () => {
    const payload = createProgressPayload(
      { ...baseSnapshot, bestWpm: 0, practiceAutoPlay: false },
      1,
    )

    expect(payload.bestWpm).toBe(0)
    expect(payload.practiceAutoPlay).toBe(false)
  })
})

describe('createFirebaseProgressService', () => {
  it('writes a payload free of undefined values', async () => {
    const writes: Array<{ path: string; payload: Record<string, unknown> }> = []
    const service = createFirebaseProgressService({
      read: async () => null,
      write: async (path, payload) => {
        writes.push({ path, payload: payload as Record<string, unknown> })
      },
    })

    await service.save(
      'user-1',
      { ...baseSnapshot, bestWpm: undefined },
      1_700_000_000_000,
    )

    expect(writes).toHaveLength(1)
    expect(writes[0].path).toBe(progressPathForUser('user-1'))
    const saved = writes[0].payload
    for (const key of Object.keys(saved)) {
      expect(saved[key]).not.toBeUndefined()
    }
  })
})
