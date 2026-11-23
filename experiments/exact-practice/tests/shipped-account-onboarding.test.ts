import { expect, it } from 'vitest'
import { MORSE_DATA } from '../../../packages/core/src/data/morse'
import type { Progress, ScoreRecord } from '../../../packages/core/src/types'
import { shouldSkipNuxForRemoteProgress } from '../../../packages/core/src/hooks/useProgressSyncController'
import { applyAccountPatch, convertLegacy } from '../core/apple-legacy.mjs'
import { NUX_KEY } from '../modules/web/nux.mjs'

const unscored = Object.fromEntries(Object.keys(MORSE_DATA).map(letter => [letter, 0])) as ScoreRecord

const cases: [string, Progress, boolean][] = [
  ['device preference alone', { toneFrequency: 720 }, false],
  ['first-run defaults', { nuxCompleted: false, guidedCourseActive: false, scores: unscored }, false],
  ['explicit completion', { nuxCompleted: true }, true],
  ['beginner profile without completion flag', { learnerProfile: 'beginner' }, true],
  ['experienced profile without completion flag', { learnerProfile: 'known' }, true],
  ['active guided course without completion flag', { guidedCourseActive: true }, true],
  ['earned score despite a false completion flag', { nuxCompleted: false, scores: { ...unscored, T: 3 } }, true],
]

for (const status of ['pending', 'skipped', 'completed'] as const) {
  it.each(cases)(`restores ${status} onboarding from %s as shipped`, (_name, patch, returning) => {
    const skip = shouldSkipNuxForRemoteProgress(patch, status)
    expect(skip).toBe(status === 'pending' && returning)

    const records = convertLegacy({ 'dit-nux-status': status })
    const next = applyAccountPatch(records, patch)
    expect(JSON.parse(next[NUX_KEY]).status).toBe(skip ? 'skipped' : status)
  })
}
