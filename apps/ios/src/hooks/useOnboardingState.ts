import {
  INTRO_HINTS_KEY,
  LEGACY_INTRO_HINTS_KEY,
  type IntroHintStep,
  type LearnerProfile,
  LOCAL_PROGRESS_KEY,
  NUX_STATE_KEY,
  NUX_STATUS_KEY,
  type NuxStatus,
  type NuxStep,
} from '@dit/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

type PersistedNuxState = {
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

const isNuxStep = (value: unknown): value is NuxStep =>
  typeof value === 'string' && NUX_STEP_VALUES.includes(value as NuxStep)

const isLearnerProfile = (value: unknown): value is LearnerProfile =>
  value === 'known' || value === 'beginner'

const parsePersistedNuxState = (raw: string | null): PersistedNuxState | null => {
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
const hasMeaningfulProgress = (raw: string | null) => {
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
        const stored = await AsyncStorage.getItem(INTRO_HINTS_KEY)
        if (!isActive) {
          return
        }
        if (stored === 'morse' || stored === 'settings' || stored === 'done') {
          setIntroHintStep(stored)
          return
        }

        const legacy = await AsyncStorage.getItem(LEGACY_INTRO_HINTS_KEY)
        if (legacy === 'true') {
          setIntroHintStep('done')
          void AsyncStorage.setItem(INTRO_HINTS_KEY, 'done')
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
  }, [])

  useEffect(() => {
    let isActive = true

    const loadNuxStatus = async () => {
      try {
        const [statusRaw, stateRaw, progressRaw] = await Promise.all([
          AsyncStorage.getItem(NUX_STATUS_KEY),
          AsyncStorage.getItem(NUX_STATE_KEY),
          AsyncStorage.getItem(LOCAL_PROGRESS_KEY),
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
          void AsyncStorage.setItem(NUX_STATUS_KEY, 'skipped')
        }

        if (resolvedStatus === 'pending') {
          const persisted = parsePersistedNuxState(stateRaw)
          if (persisted) {
            setNuxStep(persisted.step)
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
  }, [])

  useEffect(() => {
    if (!nuxReady) {
      return
    }
    if (nuxStatus !== 'pending') {
      void AsyncStorage.removeItem(NUX_STATE_KEY).catch((error: unknown) => {
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
    void AsyncStorage.setItem(NUX_STATE_KEY, JSON.stringify(payload)).catch(
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
    tutorialHoldCount,
    tutorialTapCount,
  ])

  const persistIntroHintStep = useCallback((next: IntroHintStep) => {
    setIntroHintStep(next)
    void AsyncStorage.setItem(INTRO_HINTS_KEY, next).catch((error: unknown) => {
      console.error('Failed to save intro hints', error)
    })
  }, [])

  const persistNuxStatus = useCallback((next: NuxStatus) => {
    setNuxStatus(next)
    void AsyncStorage.setItem(NUX_STATUS_KEY, next).catch((error: unknown) => {
      console.error('Failed to save NUX status', error)
    })
  }, [])

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
