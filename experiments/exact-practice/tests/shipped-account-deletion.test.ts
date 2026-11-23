// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { deleteUser, type User } from '@firebase/auth'
import { useAccountActions } from '../../../packages/core/src/hooks/useAccountActions'
import { createNoopPlatform, PlatformProvider, type DialogAction } from '../../../packages/core/src/platform'

vi.mock('@firebase/auth', () => ({ deleteUser: vi.fn() }))

// Run the pinned Dit hook. No provider SDK or account transport is instantiated.
describe('shipped account deletion oracle', () => {
  for (const outcome of ['cancel', 'cancelled', 'network', 'recent-login', 'cleanup', 'deleted']) {
    it(outcome, async () => {
      const order: string[] = []
      const alerts: string[] = []
      const actions: DialogAction[] = []
      const platform = createNoopPlatform()
      platform.auth.prepareAccountDeletion = async (uid, apple) => {
        expect([uid,apple]).toEqual(['fixture',true])
        order.push('prepare')
        if (outcome === 'cancelled') throw {code:'ERR_APPLE_ACCOUNT_DELETION_CANCELLED'}
      }
      platform.dialog.confirm = (title, body, options) => {
        expect(title).toBe('Delete account?')
        expect(body).toBe('This permanently deletes your Dit account, synced progress, and local progress on this device.')
        expect(options.map(option => option.style)).toEqual(['cancel','destructive'])
        actions.push(...options)
      }
      platform.dialog.alert = (title,body) => { alerts.push(title,body) }
      vi.mocked(deleteUser).mockImplementation(async () => {
        order.push('identity')
        if (outcome === 'recent-login') throw {code:'auth/requires-recent-login'}
      })
      const {result,unmount} = renderHook(() => useAccountActions({
        user:{uid:'fixture',providerData:[{providerId:'apple.com'}]} as User,
        isDeletingAccount:false,
        setIsDeletingAccount:v => { order.push(v ? 'busy':'idle') },
        setShowSettings:v => { expect(v).toBe(false); order.push('close') },
        deleteRemoteProgress:async () => {
          order.push('remote')
          if (outcome === 'network') throw {code:'auth/network-request-failed'}
        },
        clearLocalProgress:async () => {
          order.push('local')
          if (outcome === 'cleanup') throw new Error('fixture cleanup')
        },
        resetProgressState:() => { order.push('reset') },
      }),{wrapper:({children}:{children:ReactNode}) => createElement(PlatformProvider,{value:platform},children)})
      act(() => result.current.handleDeleteAccount())
      await act(async () => { actions[outcome === 'cancel' ? 0 : 1].onPress?.() })
      const stages = ['busy','close','prepare','remote','identity','local','reset']
      const count = {cancel:0,cancelled:3,network:4,'recent-login':5,cleanup:7,deleted:7}[outcome]!
      expect(order).toEqual(outcome === 'cancel' ? [] : [...stages.slice(0,count),'idle'])
      const expected = {
        network:['Could Not Delete Account','A network error interrupted account deletion. Try again on a stable connection.'],
        'recent-login':['Could Not Delete Account','For security, sign in again and retry account deletion.'],
        cleanup:['Account Deleted','Your account was deleted, but local cleanup did not finish cleanly. Relaunch the app if any old progress remains.'],
      }
      expect(alerts).toEqual(expected[outcome as keyof typeof expected] ?? [])
      unmount()
    })
  }
})
