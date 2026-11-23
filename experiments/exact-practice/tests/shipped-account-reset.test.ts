// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { deleteUser, type User } from '@firebase/auth'
import { useAccountActions } from '../../../packages/core/src/hooks/useAccountActions'
import { createNoopPlatform, PlatformProvider, type DialogAction } from '../../../packages/core/src/platform'
import { RESET_APP_STORAGE_KEYS } from '../../../packages/core/src/utils/appState'

vi.mock('@firebase/auth', () => ({ deleteUser: vi.fn() }))

it.each(['cancel', 'cancel offline', 'offline', 'online', 'local error', 'remote error'])(
  'pinned signed-in Reset App with %s', async outcome => {
    const steps: string[] = []
    const removedKeys: string[] = []
    let buttons: DialogAction[] = []
    const platform = createNoopPlatform()
    const offline = outcome.includes('offline')
    platform.network.isAvailable = async () => { steps.push('reachability'); return !offline }
    platform.dialog.confirm = (title, message, choices) => {
      steps.push(title)
      buttons = choices
      expect(choices.map(choice => choice.style)).toEqual(['cancel', 'destructive'])
      if (title === 'No internet connection') {
        expect(message).toContain('server will not be cleared while you are offline')
        expect(choices[1].text).toBe('Reset Device')
      } else expect(message).toContain('Your account is not deleted.')
    }
    platform.dialog.alert = (title, message) => {
      steps.push(title)
      expect(message).toBe('Some local data could not be cleared. Relaunch Dit and try again.')
    }
    platform.storage.removeItem = async key => { removedKeys.push(key) }
    platform.auth.signOut = async () => { steps.push('sign out') }
    const {result, unmount} = renderHook(() => useAccountActions({
      user: {uid:'synthetic-a',providerData:[]} as unknown as User,
      isDeletingAccount:false,
      setIsDeletingAccount:vi.fn(),
      setShowSettings:open => { expect(open).toBe(false); steps.push('close Settings') },
      clearLocalProgress:async () => {
        steps.push('clear local')
        if (outcome === 'local error') throw Error('synthetic local refusal')
      },
      clearAdditionalLocalData:async () => { steps.push('clear additional') },
      resetProgressState:() => { steps.push('reset view') },
      deleteRemoteProgress:async id => {
        expect(id).toBe('synthetic-a')
        steps.push('clear remote')
        if (outcome === 'remote error') throw Error('synthetic remote refusal')
      },
    }), {wrapper:({children}:{children:ReactNode}) => createElement(PlatformProvider,{value:platform},children)})
    act(() => result.current.handleResetApp())
    expect(steps).toEqual(['Reset App?'])
    await act(async () => { buttons[outcome === 'cancel' ? 0 : 1].onPress?.() })
    const confirmations = ['Reset App?']
    if (outcome !== 'cancel') confirmations.push('reachability')
    if (offline) {
      confirmations.push('No internet connection')
      expect(steps).toEqual(confirmations)
      await act(async () => { buttons[outcome === 'cancel offline' ? 0 : 1].onPress?.() })
    }
    const cancelled = outcome.startsWith('cancel')
    const expected = [...confirmations]
    if (!cancelled) {
      expected.push('close Settings','clear local')
      if (outcome === 'local error') expected.push('Could Not Reset App')
      else {
        expected.push('clear additional','reset view')
        if (!offline) expected.push('clear remote')
        expected.push('sign out')
      }
    }
    expect(steps).toEqual(expected)
    expect(removedKeys).toEqual(cancelled || outcome === 'local error' ? [] : RESET_APP_STORAGE_KEYS)
    expect(deleteUser).not.toHaveBeenCalled()
    unmount()
  },
)
