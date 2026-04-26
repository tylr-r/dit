// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKnownTour } from '../../src/hooks/useKnownTour'

function setup(overrides?: Partial<Parameters<typeof useKnownTour>[0]>) {
  const onFinish = vi.fn()
  const result = renderHook(() =>
    useKnownTour({
      active: true,
      onFinish,
      ...overrides,
    }),
  )
  return { ...result, onFinish }
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useKnownTour', () => {
  it('starts at stop index 0 on the mode target', async () => {
    const { result } = setup()
    await flush()
    expect(result.current.stopIndex).toBe(0)
    expect(result.current.totalStops).toBe(3)
    expect(result.current.currentStop?.target).toBe('mode')
  })

  it('walks through three guided stops: mode, settings, logo', async () => {
    const { result } = setup()
    await flush()
    expect(result.current.currentStop?.target).toBe('mode')

    await act(async () => result.current.advance())
    await flush()
    expect(result.current.currentStop?.target).toBe('settings')

    await act(async () => result.current.advance())
    await flush()
    expect(result.current.currentStop?.target).toBe('logo')
  })

  it('calls onFinish after advancing past the final stop', async () => {
    const { result, onFinish } = setup()
    await flush()
    for (let i = 0; i < 3; i++) {
      await act(async () => result.current.advance())
      await flush()
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(result.current.currentStop).toBeNull()
  })

  it('exposes isFinalStop on the last stop', async () => {
    const { result } = setup()
    await flush()
    for (let i = 0; i < 2; i++) {
      await act(async () => result.current.advance())
      await flush()
    }
    expect(result.current.isFinalStop).toBe(true)
    expect(result.current.currentStop?.target).toBe('logo')
  })

  it('does nothing while inactive', async () => {
    const { result, onFinish } = setup({ active: false })
    await flush()
    expect(result.current.currentStop).toBeNull()
    await act(async () => result.current.advance())
    await flush()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('resets to stop 0 when re-activated after finishing', async () => {
    const onFinish = vi.fn()
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useKnownTour({
          active,
          onFinish,
        }),
      { initialProps: { active: true } },
    )
    await flush()
    for (let i = 0; i < 3; i++) {
      await act(async () => result.current.advance())
      await flush()
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(result.current.currentStop).toBeNull()

    rerender({ active: false })
    await flush()
    rerender({ active: true })
    await flush()

    expect(result.current.stopIndex).toBe(0)
    expect(result.current.currentStop?.target).toBe('mode')

    await act(async () => result.current.advance())
    await flush()
    expect(result.current.currentStop?.target).toBe('settings')
  })
})
