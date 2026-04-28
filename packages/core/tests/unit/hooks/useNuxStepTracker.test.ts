// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NuxStep } from '../../../src/utils/appState'
import { useNuxStepTracker } from '../../../src/hooks/useNuxStepTracker'

describe('useNuxStepTracker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires nux_step_view on first activation and nux_step_complete on advance', () => {
    vi.useFakeTimers()
    const log = vi.fn()
    const { rerender } = renderHook(
      ({ step }: { step: NuxStep }) =>
        useNuxStepTracker(step, true, log),
      { initialProps: { step: 'welcome' } },
    )

    expect(log).toHaveBeenCalledWith('nux_step_view', { step: 'welcome' })
    log.mockClear()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    rerender({ step: 'profile' })

    expect(log).toHaveBeenCalledWith('nux_step_complete', expect.objectContaining({
      step: 'welcome',
    }))
    expect(log).toHaveBeenCalledWith('nux_step_view', { step: 'profile' })
    const completeCall = log.mock.calls.find(
      (call) => call[0] === 'nux_step_complete',
    )!
    expect((completeCall[1] as { time_on_step_ms: number }).time_on_step_ms).toBeGreaterThanOrEqual(2000)
  })

  it('does not fire while inactive', () => {
    const log = vi.fn()
    renderHook(() => useNuxStepTracker('welcome', false, log))
    expect(log).not.toHaveBeenCalled()
  })

  it('resets after deactivation so re-activation fires a fresh view', () => {
    const log = vi.fn()
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useNuxStepTracker('welcome', active, log),
      { initialProps: { active: true } },
    )
    log.mockClear()

    rerender({ active: false })
    rerender({ active: true })

    expect(log).toHaveBeenCalledWith('nux_step_view', { step: 'welcome' })
  })
})
