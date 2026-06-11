// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { User } from '@firebase/auth'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useAccountActions } from '../../src/hooks/useAccountActions'
import { createNoopPlatform, PlatformProvider, type DialogAction, type Platform } from '../../src/platform'
import { RESET_APP_STORAGE_KEYS } from '../../src/utils/appState'

type Options = Parameters<typeof useAccountActions>[0]

const makePlatform = (overrides: Partial<Platform> = {}): Platform =>
  createNoopPlatform(overrides)

const renderAccountActions = (options: Options, platform: Platform) => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(PlatformProvider, { value: platform }, children)
  return renderHook(() => useAccountActions(options), { wrapper })
}

const makeOptions = (overrides: Partial<Options> = {}): Options => ({
  user: null,
  isDeletingAccount: false,
  setIsDeletingAccount: vi.fn(),
  setShowSettings: vi.fn(),
  clearLocalProgress: vi.fn(async () => {}),
  deleteRemoteProgress: vi.fn(async () => {}),
  resetProgressState: vi.fn(),
  ...overrides,
})

const autoConfirm = vi.fn(
  (_title: string, _message: string, actions: DialogAction[]) => {
    actions.find((action) => action.style === 'destructive')?.onPress?.()
  },
)

const confirmThroughOfflineWarning = vi.fn(
  (title: string, message: string, actions: DialogAction[]) => {
    if (title === 'No internet connection') {
      expect(message).toMatch(/server will not be cleared/i)
      actions.find((action) => action.text === 'Reset Device')?.onPress?.()
      return
    }
    actions.find((action) => action.style === 'destructive')?.onPress?.()
  },
)

describe('useAccountActions', () => {
  it('resets local app state and onboarding storage when signed out', async () => {
    const removeItem = vi.fn(async () => {})
    const signOut = vi.fn(async () => {})
    const options = makeOptions()
    const platform = makePlatform({
      auth: {
        ...makePlatform().auth,
        signOut,
      },
      dialog: {
        alert: vi.fn(),
        confirm: autoConfirm,
      },
      storage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem,
      },
    })
    const { result } = renderAccountActions(options, platform)

    await act(async () => {
      result.current.handleResetApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(options.clearLocalProgress).toHaveBeenCalledTimes(1)
    expect(removeItem).toHaveBeenCalledTimes(RESET_APP_STORAGE_KEYS.length)
    for (const key of RESET_APP_STORAGE_KEYS) {
      expect(removeItem).toHaveBeenCalledWith(key)
    }
    expect(options.resetProgressState).toHaveBeenCalledTimes(1)
    expect(options.deleteRemoteProgress).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('clears remote progress and signs out when resetting a signed-in app', async () => {
    const signOut = vi.fn(async () => {})
    const options = makeOptions({
      user: { uid: 'user-1', providerData: [] } as unknown as User,
    })
    const platform = makePlatform({
      auth: {
        ...makePlatform().auth,
        signOut,
      },
      dialog: {
        alert: vi.fn(),
        confirm: autoConfirm,
      },
      network: {
        isAvailable: async () => true,
      },
    })
    const { result } = renderAccountActions(options, platform)

    await act(async () => {
      result.current.handleResetApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(options.deleteRemoteProgress).toHaveBeenCalledWith('user-1')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(options.clearLocalProgress).toHaveBeenCalledTimes(1)
    expect(options.resetProgressState).toHaveBeenCalledTimes(1)
  })

  it('shows an offline server warning after the first confirmation', async () => {
    const confirm = vi.fn(confirmThroughOfflineWarning)
    const signOut = vi.fn(async () => {})
    const options = makeOptions({
      user: { uid: 'user-1', providerData: [] } as unknown as User,
    })
    const platform = makePlatform({
      auth: {
        ...makePlatform().auth,
        signOut,
      },
      dialog: {
        alert: vi.fn(),
        confirm,
      },
      network: {
        isAvailable: async () => false,
      },
    })
    const { result } = renderAccountActions(options, platform)

    await act(async () => {
      result.current.handleResetApp()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(options.deleteRemoteProgress).not.toHaveBeenCalled()
    expect(options.clearLocalProgress).toHaveBeenCalledTimes(1)
    expect(options.resetProgressState).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
