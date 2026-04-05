import AsyncStorage from '@react-native-async-storage/async-storage'
import { createGuidedLessonProgress, initializeScores, type Progress } from '@dit/core'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { useProgressPersistence } from '../../src/hooks/useProgressPersistence'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const baseProps = {
  progressSnapshot: {
    listenWpm: 20,
    listenEffectiveWpm: 15,
    listenAutoTightening: false,
    listenAutoTighteningCorrectCount: 0,
    listenTtr: {},
    maxLevel: 1,
    practiceWordMode: false,
    practiceIfrMode: false,
    practiceReviewMisses: false,
    guidedCourseActive: false,
    guidedPackIndex: 0,
    guidedPhase: 'teach' as const,
    guidedProgress: createGuidedLessonProgress(),
    scores: initializeScores(),
    showHint: false,
    showMnemonic: false,
    wordMode: false,
  },
  progressSaveDebounceMs: 50,
  listenWpmMin: 5,
  listenWpmMax: 60,
  listenEffectiveWpmMin: 5,
  listenEffectiveWpmMax: 60,
  levelMin: 1,
  levelMax: 4,
}

describe('useProgressPersistence', () => {
  it('does not reload local progress when applyProgress identity changes', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        showHint: true,
        updatedAt: 123,
      }),
    )

    const applyProgressA = vi.fn()
    let testRenderer: ReactTestRenderer | null = null

    const flushEffects = async () => {
      await Promise.resolve()
      await Promise.resolve()
    }

    const TestHarness = ({ applyProgress }: { applyProgress: (progress: Progress) => void }) => {
      useProgressPersistence({
        ...baseProps,
        applyProgress,
      })
      return null
    }

    await act(async () => {
      testRenderer = create(<TestHarness applyProgress={applyProgressA} />)
      await flushEffects()
    })

    expect(mockGetItem).toHaveBeenCalledTimes(1)
    expect(applyProgressA).toHaveBeenCalledTimes(1)

    const applyProgressB = vi.fn()
    await act(async () => {
      testRenderer?.update(<TestHarness applyProgress={applyProgressB} />)
      await flushEffects()
    })

    expect(mockGetItem).toHaveBeenCalledTimes(1)
    expect(applyProgressB).not.toHaveBeenCalled()
  })
})
