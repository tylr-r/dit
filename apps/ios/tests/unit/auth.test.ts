import type { User } from '@firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockDeleteUser,
  mockSignOut,
  mockAuth,
  mockNativeSignInWithGoogle,
} = vi.hoisted(() => ({
  mockDeleteUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockAuth: {
    currentUser: null as { uid: string } | null,
    signOut: vi.fn(),
  },
  mockNativeSignInWithGoogle: vi.fn(),
}))

mockAuth.signOut = mockSignOut

vi.mock('@firebase/auth', () => ({
  deleteUser: mockDeleteUser,
  GoogleAuthProvider: {
    credential: vi.fn(),
  },
  signInWithCredential: vi.fn(),
}))

vi.mock('expo-modules-core', () => ({
  requireNativeModule: vi.fn(() => ({
    signInWithGoogle: mockNativeSignInWithGoogle,
  })),
}))

vi.mock('../../src/firebase', () => ({
  auth: mockAuth,
}))

import {
  deleteCurrentUserAccount,
  signOut,
} from '../../src/services/auth'

describe('auth service', () => {
  beforeEach(() => {
    mockDeleteUser.mockReset()
    mockNativeSignInWithGoogle.mockReset()
    mockSignOut.mockReset()
    mockAuth.currentUser = null
  })

  it('deletes the provided user account', async () => {
    const user = { uid: 'user-123' } as unknown as User

    await deleteCurrentUserAccount(user)

    expect(mockDeleteUser).toHaveBeenCalledWith(user)
  })

  it('falls back to the current auth user', async () => {
    const currentUser = { uid: 'current-user-123' } as unknown as User
    mockAuth.currentUser = currentUser

    await deleteCurrentUserAccount()

    expect(mockDeleteUser).toHaveBeenCalledWith(currentUser)
  })

  it('throws when no signed-in user is available', async () => {
    await expect(deleteCurrentUserAccount()).rejects.toThrow(
      'No signed-in user to delete',
    )
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('signs out through Firebase auth', async () => {
    await signOut()

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})
