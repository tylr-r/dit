import { act, renderHook } from '@testing-library/react'
import { MORSE_DATA, type Letter, type ListenPhrase } from '@dit/core'
import { describe, expect, it, vi } from 'vitest'
import {
  useListenPhraseSession,
  type UseListenPhraseSessionOptions,
} from '../../../src/hooks/useListenPhraseSession'

const phrases: readonly ListenPhrase[] = [
  {
    id: 'one',
    text: 'QRS',
    meaning: 'Send slower',
    difficulty: 'medium',
    parts: [{ code: 'QRS', meaning: 'send slower' }],
  },
  {
    id: 'two',
    text: 'AGN',
    meaning: 'Again',
    difficulty: 'medium',
    parts: [{ code: 'AGN', meaning: 'again' }],
  },
  {
    id: 'three',
    text: 'TNX',
    meaning: 'Thanks',
    difficulty: 'medium',
    parts: [{ code: 'TNX', meaning: 'thanks' }],
  },
  {
    id: 'four',
    text: 'QRL',
    meaning: 'The frequency is in use',
    difficulty: 'medium',
    parts: [{ code: 'QRL', meaning: 'frequency is in use' }],
  },
] as const

const allLetters = Object.keys(MORSE_DATA) as Letter[]

const baseOptions = (): UseListenPhraseSessionOptions => ({
  isActive: true,
  availableLetters: allLetters,
  characterWpm: 20,
  effectiveWpm: 15,
  toneFrequency: 600,
  phrases,
  random: () => 0,
  playMorseTone: vi.fn(async ({ onComplete }) => onComplete?.()),
  stopMorseTone: vi.fn().mockResolvedValue(undefined),
})

describe('useListenPhraseSession', () => {
  it('returns silently to ready when changing banks and ignores the previous audio completion', async () => {
    const options = baseOptions()
    let finishPreviousAudio = () => {}
    options.playMorseTone = vi.fn(async ({ onComplete }) => {
      finishPreviousAudio = onComplete!
    })
    const { result, rerender } = renderHook(
      (props: UseListenPhraseSessionOptions) => useListenPhraseSession(props),
      { initialProps: options },
    )
    await act(async () => result.current.start())
    const nextBank: ListenPhrase[] = ['TIME', 'TEAM', 'TAME', 'MEAN'].map((text) => ({
      id: text,
      text,
      difficulty: 'short',
      parts: [],
    }))
    await act(async () => {
      result.current.release()
      rerender({ ...options, phrases: nextBank })
    })
    act(() => finishPreviousAudio())
    expect(result.current.round).toBeNull()
    expect(result.current.isPlaying).toBe(false)
    expect(options.playMorseTone).toHaveBeenCalledOnce()

    await act(async () => result.current.start())
    expect(result.current.round?.target.text).toBe('TIME')
    expect(result.current.round?.options.every((word) => nextBank.includes(word))).toBe(true)
  })

  it('conceals choices and rejects answers until audio actually ends', async () => {
    const options = baseOptions()
    let finishAudio = () => {}
    options.playMorseTone = vi.fn(async ({ onComplete }) => {
      finishAudio = onComplete!
    })
    const { result } = renderHook(() => useListenPhraseSession(options))

    await act(async () => result.current.start())
    expect(result.current.isPlaying).toBe(true)
    await act(async () => result.current.submitAnswer('one'))
    expect(result.current.attemptCount).toBe(0)
    expect(result.current.status).toBe('idle')

    act(() => finishAudio())
    expect(result.current.isPlaying).toBe(false)
    await act(async () => result.current.submitAnswer('one'))
    expect(result.current.correctCount).toBe(1)
  })

  it('conceals replay immediately and ignores superseded completion callbacks', async () => {
    const options = baseOptions()
    const completions: (() => void)[] = []
    options.playMorseTone = vi.fn(async ({ onComplete }) => {
      completions.push(onComplete!)
    })
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())
    act(() => completions[0]())
    expect(result.current.isPlaying).toBe(false)

    await act(async () => result.current.replay())
    expect(result.current.isPlaying).toBe(true)
    act(() => completions[0]())
    expect(result.current.isPlaying).toBe(true)
    act(() => completions[1]())
    expect(result.current.isPlaying).toBe(false)

    await act(async () => result.current.next())
    act(() => result.current.release())
    act(() => completions[2]())
    expect(result.current.round).toBeNull()
    expect(result.current.isPlaying).toBe(false)
  })

  it('starts a four-choice round and plays its target', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.round?.target.id).toBe('one')
    expect(result.current.round?.options).toHaveLength(4)
    expect(result.current.status).toBe('idle')
    expect(options.stopMorseTone).toHaveBeenCalledOnce()
    expect(options.playMorseTone).toHaveBeenCalledWith({
      code: '--.- .-. ...',
      characterWpm: 20,
      effectiveWpm: 15,
      frequency: 600,
      onComplete: expect.any(Function),
    })
    expect(result.current.playback?.code).toBe('--.- .-. ...')
  })

  it('records incorrect feedback without changing the target', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())

    await act(async () => result.current.submitAnswer('two'))

    expect(result.current.status).toBe('error')
    expect(result.current.selectedPhraseId).toBe('two')
    expect(result.current.round?.target.id).toBe('one')
    expect(result.current.attemptCount).toBe(1)
    expect(result.current.correctCount).toBe(0)
    expect(result.current.playback).toBeNull()
  })

  it('records correct feedback', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())

    await act(async () => result.current.submitAnswer('one'))

    expect(result.current.status).toBe('success')
    expect(result.current.correctCount).toBe(1)
  })

  it('replays the current target without replacing the round', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())
    const initialRound = result.current.round
    vi.mocked(options.playMorseTone).mockClear()

    await act(async () => result.current.replay())

    expect(result.current.round).toBe(initialRound)
    expect(options.playMorseTone).toHaveBeenCalledOnce()
  })

  it('moves to a new target and resets feedback', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())
    await act(async () => result.current.submitAnswer('one'))

    await act(async () => result.current.next())

    expect(result.current.round?.target.id).toBe('two')
    expect(result.current.status).toBe('idle')
    expect(result.current.selectedPhraseId).toBeNull()
  })

  it('does not start when fewer than four phrases are available', async () => {
    const options = {
      ...baseOptions(),
      availableLetters: ['E', 'T'] as Letter[],
    }
    const { result } = renderHook(() => useListenPhraseSession(options))

    await act(async () => result.current.start())

    expect(result.current.isAvailable).toBe(false)
    expect(result.current.round).toBeNull()
    expect(options.playMorseTone).not.toHaveBeenCalled()
  })

  it('returns to the ready state when the session stops', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))
    await act(async () => result.current.start())

    await act(async () => result.current.stop())

    expect(result.current.round).toBeNull()
    expect(result.current.playback).toBeNull()
  })

  it('avoids repeating the last target when the session starts again', async () => {
    const options = baseOptions()
    const { result } = renderHook(() => useListenPhraseSession(options))

    await act(async () => result.current.start())
    const firstTargetId = result.current.round?.target.id
    await act(async () => result.current.start())

    expect(result.current.round?.target.id).not.toBe(firstTargetId)
  })

  it('replaces a round that contains phrases outside the active character set', async () => {
    const eligibilityPhrases: readonly ListenPhrase[] = [
      { id: 'q', text: 'Q', meaning: 'Q', difficulty: 'short', parts: [] },
      { id: 'e', text: 'E', meaning: 'E', difficulty: 'short', parts: [] },
      { id: 't', text: 'T', meaning: 'T', difficulty: 'short', parts: [] },
      { id: 'et', text: 'ET', meaning: 'ET', difficulty: 'short', parts: [] },
      { id: 'te', text: 'TE', meaning: 'TE', difficulty: 'short', parts: [] },
    ]
    const options = {
      ...baseOptions(),
      phrases: eligibilityPhrases,
      availableLetters: ['Q', 'E', 'T'] as Letter[],
    }
    const { result, rerender } = renderHook(
      (props: UseListenPhraseSessionOptions) => useListenPhraseSession(props),
      { initialProps: options },
    )
    await act(async () => result.current.start())
    expect(result.current.round?.target.id).toBe('q')

    await act(async () => {
      rerender({ ...options, availableLetters: ['E', 'T'] as Letter[] })
    })

    expect(result.current.round?.options.every((phrase) => phrase.id !== 'q')).toBe(true)
    expect(result.current.round?.target.id).not.toBe('q')
  })
})
