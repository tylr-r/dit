import { describe, expect, it } from 'vitest'
import { shouldSkipNuxForRemoteProgress } from '../../src/hooks/useProgressSyncController'
import type { Progress } from '../../src/types'

describe('shouldSkipNuxForRemoteProgress', () => {
  it('skips when nuxCompleted is true and NUX is pending', () => {
    expect(
      shouldSkipNuxForRemoteProgress({ nuxCompleted: true } as Progress, 'pending'),
    ).toBe(true)
  })

  it('skips when the remote snapshot looks meaningful and NUX is pending', () => {
    expect(
      shouldSkipNuxForRemoteProgress(
        { guidedCourseActive: true } as Progress,
        'pending',
      ),
    ).toBe(true)
  })

  it('does not skip when NUX is not pending (user is mid-replay)', () => {
    expect(
      shouldSkipNuxForRemoteProgress(
        { nuxCompleted: true } as Progress,
        'completed',
      ),
    ).toBe(false)
    expect(
      shouldSkipNuxForRemoteProgress(
        { nuxCompleted: true } as Progress,
        'skipped',
      ),
    ).toBe(false)
  })

  it('does not skip for an empty remote snapshot', () => {
    expect(shouldSkipNuxForRemoteProgress({} as Progress, 'pending')).toBe(false)
  })

  it('does not skip when nuxCompleted is explicitly false and no other signal', () => {
    expect(
      shouldSkipNuxForRemoteProgress(
        { nuxCompleted: false } as Progress,
        'pending',
      ),
    ).toBe(false)
  })
})
