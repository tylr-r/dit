import AsyncStorage from '@react-native-async-storage/async-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const NUX_STATUS_KEY = 'dit-nux-status'
const LOCAL_PROGRESS_KEY = 'dit-progress'

type NuxStatus = 'pending' | 'completed' | 'skipped';

/**
 * Simulates the loadNuxStatus logic from App.tsx
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

    const progressStored = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY)

    if (progressStored) {
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

  it('migrates existing users with local progress to skipped status', async () => {
    const mockGetItem = vi.mocked(AsyncStorage.getItem)
    const mockSetItem = vi.mocked(AsyncStorage.setItem)

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === NUX_STATUS_KEY) return null
      if (key === LOCAL_PROGRESS_KEY)
        return JSON.stringify({ maxLevel: 3, scores: {} })
      return null
    })

    const result = await loadNuxStatus()

    expect(result.nuxStatus).toBe('skipped')
    expect(result.nuxReady).toBe(true)
    expect(mockGetItem).toHaveBeenCalledWith(NUX_STATUS_KEY)
    expect(mockGetItem).toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
    expect(mockSetItem).toHaveBeenCalledWith(NUX_STATUS_KEY, 'skipped')
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
