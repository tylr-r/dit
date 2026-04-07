import type { LearnerProfile } from '@dit/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import {
  INTRO_HINTS_KEY,
  LEGACY_INTRO_HINTS_KEY,
  LOCAL_PROGRESS_KEY,
  NUX_STATUS_KEY,
  type IntroHintStep,
  type NuxStatus,
  type NuxStep,
} from '../utils/appState'

/** Loads and persists first-run hint and onboarding state. */
export const useOnboardingState = () => {
  const [introHintStep, setIntroHintStep] = useState<IntroHintStep>('morse')
  const [nuxStatus, setNuxStatus] = useState<NuxStatus>('pending')
  const [nuxStep, setNuxStep] = useState<NuxStep>('welcome')
  const [nuxReady, setNuxReady] = useState(false)
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null)
  const [didCompleteSoundCheck, setDidCompleteSoundCheck] = useState(false)
  const [didCompleteTutorialTap, setDidCompleteTutorialTap] = useState(false)
  const [didCompleteTutorialHold, setDidCompleteTutorialHold] = useState(false)

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
        const stored = await AsyncStorage.getItem(NUX_STATUS_KEY)
        if (!isActive) {
          return
        }
        if (stored === 'completed' || stored === 'skipped') {
          setNuxStatus(stored)
          return
        }

        const progressStored = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY)
        if (!isActive) {
          return
        }
        if (progressStored) {
          setNuxStatus('skipped')
          void AsyncStorage.setItem(NUX_STATUS_KEY, 'skipped')
          return
        }

        setNuxStatus('pending')
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
    didCompleteTutorialTap,
    setDidCompleteTutorialTap,
    didCompleteTutorialHold,
    setDidCompleteTutorialHold,
  }
}
