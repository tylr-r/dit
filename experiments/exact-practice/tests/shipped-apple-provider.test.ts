// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { useAccountActions } from '../../../packages/core/src/hooks/useAccountActions'
import { createNoopPlatform, PlatformProvider } from '../../../packages/core/src/platform'

const appleCases = [
  ['ok', null],
  ['ERR_APPLE_SIGN_IN_CANCELLED', null],
  ['auth/network-request-failed', 'A network error interrupted sign-in. Try again on a stable connection.'],
  ['auth/account-exists-with-different-credential', 'An account already exists with a different sign-in method for this email address.'],
  ['ERR_APPLE_SIGN_IN_FAILED', 'We could not sign you in. Please try again.'],
] as const
const googleCases = [
  ['ok', null],
  ['ERR_GOOGLE_SIGN_IN', 'We could not sign you in. Please try again.'],
  ['ERR_NO_TOKEN', 'We could not sign you in. Please try again.'],
  ['auth/network-request-failed', 'A network error interrupted sign-in. Try again on a stable connection.'],
  ['auth/account-exists-with-different-credential', 'An account already exists with a different sign-in method for this email address.'],
] as const

for (const provider of ['Apple', 'Google'] as const) {
  it.each(provider === 'Apple' ? appleCases : googleCases)(`shipped ${provider} action with local outcome %s`, async (outcome, expected) => {
    const platform = createNoopPlatform()
    const alert = vi.fn()
    platform.dialog.alert = alert
    platform.auth[`signInWith${provider}`] = vi.fn(async () => {
      if (outcome !== 'ok') throw Object.assign(new Error('Synthetic provider result'), {code:outcome})
    })
    const {result, unmount} = renderHook(() => useAccountActions({
      user:null, isDeletingAccount:false, setIsDeletingAccount:vi.fn(), setShowSettings:vi.fn(),
      deleteRemoteProgress:vi.fn(), clearLocalProgress:vi.fn(), resetProgressState:vi.fn(),
    }), {wrapper:({children}:{children:ReactNode}) => createElement(PlatformProvider,{value:platform},children)})
    try {
      await act(() => result.current[`handleSignInWith${provider}`]())
      expect(platform.auth[`signInWith${provider}`]).toHaveBeenCalledTimes(1)
      expect(alert.mock.calls).toEqual(expected === null ? [] : [['Could Not Sign In', expected]])
    } finally { unmount() }
  })
}
