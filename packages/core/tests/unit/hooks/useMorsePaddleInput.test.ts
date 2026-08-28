// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMorsePaddleInput } from '../../../src/hooks/useMorsePaddleInput'

describe('useMorsePaddleInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keys and commits a held paddle using the configured Morse timing', () => {
    const onSymbol = vi.fn()
    const startTone = vi.fn()
    const stopTone = vi.fn()
    const { result } = renderHook(() =>
      useMorsePaddleInput({
        canStart: () => true,
        getUnitMs: () => 100,
        onSymbol,
        onActiveChange: vi.fn(),
        startTone,
        stopTone,
      }),
    )

    act(() => {
      expect(result.current.pressIn('-')).toBe(true)
    })
    expect(startTone).toHaveBeenCalledOnce()

    act(() => {
      vi.advanceTimersByTime(300)
      result.current.pressOut('-')
    })

    expect(stopTone).toHaveBeenCalledOnce()
    expect(onSymbol).toHaveBeenCalledWith('-')
  })

  it('repeats the same symbol while the paddle remains held', () => {
    const onSymbol = vi.fn()
    const { result } = renderHook(() =>
      useMorsePaddleInput({
        canStart: () => true,
        getUnitMs: () => 100,
        onSymbol,
        onActiveChange: vi.fn(),
        startTone: vi.fn(),
        stopTone: vi.fn(),
      }),
    )

    act(() => {
      result.current.pressIn('.')
      vi.advanceTimersByTime(500)
      result.current.pressOut('.')
    })

    expect(onSymbol).toHaveBeenCalledTimes(3)
    expect(onSymbol).toHaveBeenNthCalledWith(1, '.')
    expect(onSymbol).toHaveBeenNthCalledWith(2, '.')
    expect(onSymbol).toHaveBeenNthCalledWith(3, '.')
  })

  it('switches to the other paddle after the active symbol completes', () => {
    const onSymbol = vi.fn()
    const { result } = renderHook(() =>
      useMorsePaddleInput({
        canStart: () => true,
        getUnitMs: () => 100,
        onSymbol,
        onActiveChange: vi.fn(),
        startTone: vi.fn(),
        stopTone: vi.fn(),
      }),
    )

    act(() => {
      result.current.pressIn('.')
      result.current.pressIn('-')
      vi.advanceTimersByTime(500)
      result.current.pressOut('-')
    })

    expect(onSymbol.mock.calls).toEqual([['.'], ['-']])
  })
})
