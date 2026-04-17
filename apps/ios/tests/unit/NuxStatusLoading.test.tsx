import AsyncStorage from '@react-native-async-storage/async-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const NUX_STATUS_KEY = 'dit-nux-status'
const LOCAL_PROGRESS_KEY = 'dit-progress'

type NuxStatus = 'pending' | 'completed' | 'skipped';

const hasMeaningfulProgress = (raw: string | null) => {
  if (!raw) {
    return false
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.learnerProfile === 'known' || parsed.learnerProfile === 'beginner') {
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

/**
 * Simulates the loadNuxStatus logic from useOnboardingState.
 */
async function loadNuxStatus(): Promise<{
  nuxStatus: NuxStatus;
  nuxReady: boolean;
}> {
  try {
    const stored = await AsyncStorage.getItem(NUX_STATUS_KEY)

    if (stored === 'completed' || stored === 'skipped') {
      return { nuxStatus: stored, nuxReady: true }
    }

    if (stored === 'pending') {
      return { nuxStatus: 'pending', nuxReady: true }
    }

    const progressStored = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY)

    if (hasMeaningfulProgress(progressStored)) {
      await AsyncStorage.setItem(NUX_STATUS_KEY, 'skipped')
      return { nuxStatus: 'skipped', nuxReady: true }
    }

    return { nuxStatus: 'pending', nuxReady: true }
  } catch (error) {
    console.error('Failed to load NUX status', error)
    return { nuxStatus: 'pending', nuxReady: true }
  }
}

describe('App - NUX Status Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads completed NUX status from storage', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return 'completed'
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('completed')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(NUX_STATUS_KEY)
    expect(mockGetItem).not.toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
  })

  it('loads skipped NUX status from storage', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return 'skipped'
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('skipped')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(NUX_STATUS_KEY)
  })

  it('migrates pre-NUX users with real practice progress to skipped', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    const mockSetItem = vi.mocked(AsyncStorage.setItem)

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return null
      if (key === LOCAL_PROGRESS_KEY)
        return JSON.stringify({ maxLevel: 3, scores: { A: 5, B: 3 } })
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('skipped')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(NUX_STATUS_KEY)
    expect(mockGetItem).toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
    expect(mockSetItem).toHaveBeenCalledWith(NUX_STATUS_KEY, 'skipped')
  })

  it('keeps NUX pending on replay even when prior progress exists', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    const mockSetItem = vi.mocked(AsyncStorage.setItem)

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return 'pending'
      if (key === LOCAL_PROGRESS_KEY)
        return JSON.stringify({
          learnerProfile: 'beginner',
          scores: { A: 7, B: 4 },
        })
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
    expect(mockSetItem).not.toHaveBeenCalledWith(NUX_STATUS_KEY, 'skipped')
  })

  it('does not skip NUX for the defaults-only snapshot written on first launch', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    const mockSetItem = vi.mocked(AsyncStorage.setItem)

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return null
      if (key === LOCAL_PROGRESS_KEY)
        return JSON.stringify({ maxLevel: 3, scores: { A: 0, B: 0, C: 0 } })
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
    expect(mockSetItem).not.toHaveBeenCalledWith(NUX_STATUS_KEY, 'skipped')
  })

  it('shows NUX for fresh installs', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    mockGetItem.mockResolvedValue(null)

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(NUX_STATUS_KEY)
    expect(mockGetItem).toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
  })

  it('defaults to pending on AsyncStorage error', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    mockGetItem.mockRejectedValue(new Error('Storage unavailable'))

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load NUX status',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })

  it('handles null vs undefined from AsyncStorage', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    // AsyncStorage.getItem returns Promise<string | null>, not undefined
    mockGetItem.mockResolvedValue(null)

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
  })

  it('ignores invalid NUX status values', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return 'invalid-value'
      return null
    })

    const result = await loadNuxStatus()

    // Invalid values should fall through to the progress check
    expect(result.nuxStatus).toBe('pending')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
  })
})
