import { useCallback, useEffect, useState } from 'react'
import { usePlatform } from '../platform'
import type { LearnerProfile } from '../types'
import {
  INTRO_HINTS_KEY,
  LEGACY_INTRO_HINTS_KEY,
  LOCAL_PROGRESS_KEY,
  NUX_STATE_KEY,
  NUX_STATUS_KEY,
  type IntroHintStep,
  type NuxStatus,
  type NuxStep,
} from '../utils/appState'

export type PersistedNuxState = {
  step: NuxStep
  learnerProfile: LearnerProfile | null
  didCompleteSoundCheck: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
}

const NUX_STEP_VALUES: readonly NuxStep[] = [
  'welcome',
  'profile',
  'sound_check',
  'button_tutorial',
  'known_tour',
  'beginner_stages',
  'beginner_intro',
  'reminder',
]

export const isNuxStep = (value: unknown): value is NuxStep =>
  typeof value === 'string' && NUX_STEP_VALUES.includes(value as NuxStep)

export const isLearnerProfile = (value: unknown): value is LearnerProfile =>
  value === 'known' || value === 'beginner'

export const parsePersistedNuxState = (raw: string | null): PersistedNuxState | null => {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!isNuxStep(parsed.step)) {
      return null
    }
    const learnerProfile = isLearnerProfile(parsed.learnerProfile)
      ? parsed.learnerProfile
      : null
    return {
      step: parsed.step,
      learnerProfile,
      didCompleteSoundCheck: parsed.didCompleteSoundCheck === true,
      tutorialTapCount:
        typeof parsed.tutorialTapCount === 'number' &&
        Number.isFinite(parsed.tutorialTapCount)
          ? Math.max(0, Math.floor(parsed.tutorialTapCount))
          : 0,
      tutorialHoldCount:
        typeof parsed.tutorialHoldCount === 'number' &&
        Number.isFinite(parsed.tutorialHoldCount)
          ? Math.max(0, Math.floor(parsed.tutorialHoldCount))
          : 0,
    }
  } catch {
    return null
  }
}

/**
 * Returns true only if stored progress looks like a real returning user — not
 * the defaults-only snapshot the app writes on first launch. This is the
 * migration signal used to skip NUX for users who predate it.
 */
export const hasMeaningfulProgress = (raw: string | null) => {
  if (!raw) {
    return false
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (isLearnerProfile(parsed.learnerProfile)) {
      return true
    }
    if (parsed.guidedCourseActive === true) {
      return true
    }
    const scores = parsed.scores
    if (scores && typeof scores === 'object') {
      for (const value of Object.values(scores as Record<string, unknown>)) {
        if (typeof value === 'number' && value > 0) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/** Loads and persists first-run hint and onboarding state. */
export const useOnboardingState = () => {
  const platform = usePlatform()
  const [introHintStep, setIntroHintStep] = useState<IntroHintStep>('morse')
  const [nuxStatus, setNuxStatus] = useState<NuxStatus>('pending')
  const [nuxStep, setNuxStep] = useState<NuxStep>('welcome')
  const [nuxReady, setNuxReady] = useState(false)
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null)
  const [didCompleteSoundCheck, setDidCompleteSoundCheck] = useState(false)
  const [tutorialTapCount, setTutorialTapCount] = useState(0)
  const [tutorialHoldCount, setTutorialHoldCount] = useState(0)

  useEffect(() => {
    let isActive = true

    const loadIntroHints = async () => {
      try {
        const stored = await platform.storage.getItem(INTRO_HINTS_KEY)
        if (!isActive) {
          return
        }
        if (stored === 'morse' || stored === 'settings' || stored === 'done') {
          setIntroHintStep(stored)
          return
        }

        const legacy = await platform.storage.getItem(LEGACY_INTRO_HINTS_KEY)
        if (legacy === 'true') {
          setIntroHintStep('done')
          void platform.storage.setItem(INTRO_HINTS_KEY, 'done')
          return
        }

        setIntroHintStep('morse')
      } catch (error) {
        console.error('Failed to load intro hints', error)
      }
    }

    void loadIntroHints()

    return () => {
      isActive = false
    }
  }, [platform])

  useEffect(() => {
    let isActive = true

    const loadNuxStatus = async () => {
      try {
        const [statusRaw, stateRaw, progressRaw] = await Promise.all([
          platform.storage.getItem(NUX_STATUS_KEY),
          platform.storage.getItem(NUX_STATE_KEY),
          platform.storage.getItem(LOCAL_PROGRESS_KEY),
        ])
        if (!isActive) {
          return
        }

        let resolvedStatus: NuxStatus = 'pending'
        if (statusRaw === 'completed' || statusRaw === 'skipped') {
          resolvedStatus = statusRaw
        } else if (statusRaw === 'pending') {
          resolvedStatus = 'pending'
        } else if (hasMeaningfulProgress(progressRaw)) {
          // Only migrate when NUX_STATUS_KEY has never been written — i.e.,
          // a pre-NUX user with real practice data. An explicit 'pending'
          // (e.g., from replay) must never be auto-flipped to 'skipped'.
          resolvedStatus = 'skipped'
          void platform.storage.setItem(NUX_STATUS_KEY, 'skipped')
        }

        if (resolvedStatus === 'pending') {
          const persisted = parsePersistedNuxState(stateRaw)
          if (persisted) {
            // Welcome is always the first beat on a cold launch. Other
            // per-step progress still restores so the user resumes at the
            // right place once they tap through welcome.
            setNuxStep('welcome')
            setLearnerProfile(persisted.learnerProfile)
            setDidCompleteSoundCheck(persisted.didCompleteSoundCheck)
            setTutorialTapCount(persisted.tutorialTapCount)
            setTutorialHoldCount(persisted.tutorialHoldCount)
          }
        }

        setNuxStatus(resolvedStatus)
      } catch (error) {
        console.error('Failed to load NUX status', error)
        setNuxStatus('pending')
      } finally {
        if (isActive) {
          setNuxReady(true)
        }
      }
    }

    void loadNuxStatus()

    return () => {
      isActive = false
    }
  }, [platform])

  useEffect(() => {
    if (!nuxReady) {
      return
    }
    if (nuxStatus !== 'pending') {
      void platform.storage.removeItem(NUX_STATE_KEY).catch((error: unknown) => {
        console.error('Failed to clear NUX state', error)
      })
      return
    }
    const payload: PersistedNuxState = {
      step: nuxStep,
      learnerProfile,
      didCompleteSoundCheck,
      tutorialTapCount,
      tutorialHoldCount,
    }
    void platform.storage.setItem(NUX_STATE_KEY, JSON.stringify(payload)).catch(
      (error: unknown) => {
        console.error('Failed to save NUX state', error)
      },
    )
  }, [
    didCompleteSoundCheck,
    learnerProfile,
    nuxReady,
    nuxStatus,
    nuxStep,
    platform,
    tutorialHoldCount,
    tutorialTapCount,
  ])

  const persistIntroHintStep = useCallback(
    (next: IntroHintStep) => {
      setIntroHintStep(next)
      void platform.storage.setItem(INTRO_HINTS_KEY, next).catch((error: unknown) => {
        console.error('Failed to save intro hints', error)
      })
    },
    [platform],
  )

  const persistNuxStatus = useCallback(
    (next: NuxStatus) => {
      setNuxStatus(next)
      void platform.storage.setItem(NUX_STATUS_KEY, next).catch((error: unknown) => {
        console.error('Failed to save NUX status', error)
      })
    },
    [platform],
  )

  const dismissMorseHint = useCallback(() => {
    if (introHintStep !== 'morse') {
      return
    }
    persistIntroHintStep('settings')
  }, [introHintStep, persistIntroHintStep])

  const dismissSettingsHint = useCallback(() => {
    if (introHintStep !== 'settings') {
      return
    }
    persistIntroHintStep('done')
  }, [introHintStep, persistIntroHintStep])

  return {
    introHintStep,
    setIntroHintStep,
    persistIntroHintStep,
    dismissMorseHint,
    dismissSettingsHint,
    nuxStatus,
    setNuxStatus,
    persistNuxStatus,
    nuxStep,
    setNuxStep,
    nuxReady,
    learnerProfile,
    setLearnerProfile,
    didCompleteSoundCheck,
    setDidCompleteSoundCheck,
    tutorialTapCount,
    setTutorialTapCount,
    tutorialHoldCount,
    setTutorialHoldCount,
  }
}
