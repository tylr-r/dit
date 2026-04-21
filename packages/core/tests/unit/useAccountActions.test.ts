// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import type { User } from '@firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAppleUser, useAccountActions } from '../../src/hooks/useAccountActions'
import {
  PlatformProvider,
  createNoopPlatform,
  type DialogAction,
  type Platform,
} from '../../src/platform'

// deleteUser is imported from @firebase/auth inside the hook. We stub the module so
// performAccountDeletion does not hit real firebase-auth code paths during tests.
vi.mock('@firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('@firebase/auth')>('@firebase/auth')
  return {
    ...actual,
    deleteUser: vi.fn(async () => {}),
  }
})

type HookOptions = Parameters<typeof useAccountActions>[0]

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    uid: 'user-1',
    providerData: [],
    ...overrides,
  } as unknown as User)

const makePlatform = (overrides: Partial<Platform['auth' | 'dialog']> = {}) => {
  const auth = {
    signInWithGoogle: vi.fn(async () => {}),
    signInWithApple: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    prepareAccountDeletion: vi.fn(async () => {}),
  }
  const dialog = {
    alert: vi.fn(),
    confirm: vi.fn(),
  }
  const platform = createNoopPlatform({ auth, dialog, ...overrides })
  return { platform, auth, dialog }
}

const makeOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
  user: makeUser(),
  isDeletingAccount: false,
  setIsDeletingAccount: vi.fn(),
  setShowSettings: vi.fn(),
  clearLocalProgress: vi.fn(async () => {}),
  deleteRemoteProgress: vi.fn(async () => {}),
  resetProgressState: vi.fn(),
  ...overrides,
})

const wrapperFor =
  (platform: Platform) =>
  ({ children }: { children: ReactNode }) =>
    createElement(PlatformProvider, { value: platform }, children)

describe('isAppleUser', () => {
  it('returns true when providerData includes apple.com', () => {
    const user = makeUser({
      providerData: [{ providerId: 'apple.com' } as User['providerData'][number]],
    })
    expect(isAppleUser(user)).toBe(true)
  })

  it('returns false when providerData has no apple provider', () => {
    const user = makeUser({
      providerData: [{ providerId: 'google.com' } as User['providerData'][number]],
    })
    expect(isAppleUser(user)).toBe(false)
  })

  it('returns false when providerData is empty', () => {
    expect(isAppleUser(makeUser({ providerData: [] }))).toBe(false)
  })
})

describe('useAccountActions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleSignInWithGoogle calls platform.auth.signInWithGoogle', async () => {
    const { platform, auth, dialog } = makePlatform()
    const options = makeOptions()

    const { result } = renderHook(() => useAccountActions(options), {
      wrapper: wrapperFor(platform),
    })

    await act(async () => {
      await result.current.handleSignInWithGoogle()
    })

    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(dialog.alert).not.toHaveBeenCalled()
  })

  it('handleSignInWithGoogle surfaces a dialog when sign-in throws', async () => {
    const { platform, auth, dialog } = makePlatform()
    auth.signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'auth/network-request-failed' }))
    const options = makeOptions()

    const { result } = renderHook(() => useAccountActions(options), {
      wrapper: wrapperFor(platform),
    })

    await act(async () => {
      await result.current.handleSignInWithGoogle()
    })

    expect(dialog.alert).toHaveBeenCalledTimes(1)
    const [title, message] = dialog.alert.mock.calls[0]
    expect(title).toBe('Could Not Sign In')
    expect(typeof message).toBe('string')
  })

  it('handleSignInWithApple alerts when the adapter does not implement Apple sign-in', async () => {
    // Override auth to a shape without signInWithApple
    const auth = {
      signInWithGoogle: vi.fn(async () => {}),
      signOut: vi.fn(async () => {}),
      prepareAccountDeletion: vi.fn(async () => {}),
    }
    const dialog = { alert: vi.fn(), confirm: vi.fn() }
    const platform = createNoopPlatform({ auth, dialog })
    const options = makeOptions()

    const { result } = renderHook(() => useAccountActions(options), {
      wrapper: wrapperFor(platform),
    })

    await act(async () => {
      await result.current.handleSignInWithApple()
    })

    expect(dialog.alert).toHaveBeenCalledWith(
      'Apple sign-in unavailable',
      'This platform does not support Apple sign-in.',
    )
  })

  it('handleDeleteAccount shows a confirm dialog with Cancel + destructive Delete Account actions', () => {
    const { platform, dialog } = makePlatform()
    const options = makeOptions()

    const { result } = renderHook(() => useAccountActions(options), {
      wrapper: wrapperFor(platform),
    })

    act(() => {
      result.current.handleDeleteAccount()
    })

    expect(dialog.confirm).toHaveBeenCalledTimes(1)
    const [title, message, actions] = dialog.confirm.mock.calls[0] as [
      string,
      string,
      DialogAction[],
    ]
    expect(title).toBe('Delete account?')
    expect(message).toMatch(/permanently deletes/i)
    expect(actions).toHaveLength(2)
    expect(actions[0]).toMatchObject({ text: 'Cancel', style: 'cancel' })
    expect(actions[1]).toMatchObject({ text: 'Delete Account', style: 'destructive' })
    expect(typeof actions[1].onPress).toBe('function')
  })

  it('handleDeleteAccount is a no-op when there is no user', () => {
    const { platform, dialog } = makePlatform()
    const options = makeOptions({ user: null })

    const { result } = renderHook(() => useAccountActions(options), {
      wrapper: wrapperFor(platform),
    })

    act(() => {
      result.current.handleDeleteAccount()
    })

    expect(dialog.confirm).not.toHaveBeenCalled()
  })
})
