import type { User } from '@firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockDeleteUser,
  mockGoogleCredential,
  mockOAuthCredential,
  mockOAuthProviderInstance,
  MockOAuthProvider,
  mockReauthenticateWithCredential,
  mockSignInWithCredential,
  mockSignOut,
  mockAuth,
  mockNativeSignInWithApple,
  mockNativeSignInWithGoogle,
  mockPrepareAppleAccountDeletion,
  mockRevokeAppleTokenForAccountDeletion,
} = vi.hoisted(() => ({
  mockDeleteUser: vi.fn(),
  mockGoogleCredential: vi.fn(),
  mockOAuthCredential: vi.fn(),
  mockOAuthProviderInstance: {
    credential: vi.fn(),
  },
  MockOAuthProvider: vi.fn(),
  mockReauthenticateWithCredential: vi.fn(),
  mockSignInWithCredential: vi.fn(),
  mockSignOut: vi.fn(),
  mockAuth: {
    currentUser: null as { uid: string } | null,
    signOut: vi.fn(),
  },
  mockNativeSignInWithApple: vi.fn(),
  mockNativeSignInWithGoogle: vi.fn(),
  mockPrepareAppleAccountDeletion: vi.fn(),
  mockRevokeAppleTokenForAccountDeletion: vi.fn(),
}))

mockAuth.signOut = mockSignOut
mockOAuthProviderInstance.credential = mockOAuthCredential
MockOAuthProvider.mockImplementation(() => mockOAuthProviderInstance)

vi.mock('@firebase/auth', () => ({
  deleteUser: mockDeleteUser,
  GoogleAuthProvider: {
    credential: mockGoogleCredential,
  },
  OAuthProvider: MockOAuthProvider,
  reauthenticateWithCredential: mockReauthenticateWithCredential,
  signInWithCredential: mockSignInWithCredential,
}))

vi.mock('expo-modules-core', () => ({
  requireNativeModule: vi.fn(() => ({
    prepareAppleAccountDeletion: mockPrepareAppleAccountDeletion,
    revokeAppleTokenForAccountDeletion: mockRevokeAppleTokenForAccountDeletion,
    signInWithApple: mockNativeSignInWithApple,
    signInWithGoogle: mockNativeSignInWithGoogle,
  })),
}))

vi.mock('../../src/firebase', () => ({
  auth: mockAuth,
}))

import {
  deleteCurrentUserAccount,
  prepareCurrentUserAccountDeletion,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from '../../src/services/auth'

describe('auth service', () => {
  beforeEach(() => {
    mockDeleteUser.mockReset()
    mockGoogleCredential.mockReset()
    mockNativeSignInWithGoogle.mockReset()
    mockNativeSignInWithApple.mockReset()
    mockOAuthCredential.mockReset()
    mockPrepareAppleAccountDeletion.mockReset()
    mockReauthenticateWithCredential.mockReset()
    mockRevokeAppleTokenForAccountDeletion.mockReset()
    mockSignInWithCredential.mockReset()
    mockSignOut.mockReset()
    mockAuth.currentUser = null
    MockOAuthProvider.mockClear()
  })

  it('signs in with Google using the native token payload', async () => {
    const googleCredential = { provider: 'google' }
    const userCredential = { user: { uid: 'firebase-user' } }
    mockNativeSignInWithGoogle.mockResolvedValue({
      idToken: 'google-id-token',
      accessToken: 'google-access-token',
    })
    mockGoogleCredential.mockReturnValue(googleCredential)
    mockSignInWithCredential.mockResolvedValue(userCredential)

    const result = await signInWithGoogle()

    expect(mockNativeSignInWithGoogle).toHaveBeenCalledTimes(1)
    expect(mockGoogleCredential).toHaveBeenCalledWith(
      'google-id-token',
      'google-access-token',
    )
    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      mockAuth,
      googleCredential,
    )
    expect(result).toBe(userCredential)
  })

  it('signs in with Apple using Firebase OAuthProvider', async () => {
    const appleCredential = { provider: 'apple' }
    const userCredential = { user: { uid: 'firebase-user' } }
    mockNativeSignInWithApple.mockResolvedValue({
      idToken: 'apple-id-token',
      rawNonce: 'raw-nonce',
    })
    mockOAuthCredential.mockReturnValue(appleCredential)
    mockSignInWithCredential.mockResolvedValue(userCredential)

    const result = await signInWithApple()

    expect(MockOAuthProvider).toHaveBeenCalledWith('apple.com')
    expect(mockOAuthCredential).toHaveBeenCalledWith({
      idToken: 'apple-id-token',
      rawNonce: 'raw-nonce',
    })
    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      mockAuth,
      appleCredential,
    )
    expect(result).toBe(userCredential)
  })

  it('deletes the provided user account', async () => {
    const user = {
      uid: 'user-123',
      providerData: [],
    } as unknown as User

    await deleteCurrentUserAccount(user)

    expect(mockDeleteUser).toHaveBeenCalledWith(user)
    expect(mockPrepareAppleAccountDeletion).not.toHaveBeenCalled()
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled()
    expect(mockRevokeAppleTokenForAccountDeletion).not.toHaveBeenCalled()
  })

  it('prepares Apple account deletion before deleting an Apple user', async () => {
    const user = {
      uid: 'apple-user-123',
      providerData: [{ providerId: 'apple.com' }],
    } as unknown as User

    mockPrepareAppleAccountDeletion.mockResolvedValue({
      idToken: 'apple-id-token',
      rawNonce: 'raw-nonce',
      authorizationCode: 'auth-code',
    })

    await prepareCurrentUserAccountDeletion(user)

    expect(mockPrepareAppleAccountDeletion).toHaveBeenCalledWith('apple-user-123')
    expect(mockRevokeAppleTokenForAccountDeletion).toHaveBeenCalledWith(
      'auth-code',
      'apple-user-123',
    )
    expect(MockOAuthProvider).not.toHaveBeenCalled()
    expect(mockOAuthCredential).not.toHaveBeenCalled()
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('falls back to the current auth user', async () => {
    const currentUser = {
      uid: 'current-user-123',
      providerData: [],
    } as unknown as User
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

  it('deletes an Apple user after preparation succeeds', async () => {
    const user = {
      uid: 'apple-user-123',
      providerData: [{ providerId: 'apple.com' }],
    } as unknown as User

    await deleteCurrentUserAccount(user)

    expect(mockDeleteUser).toHaveBeenCalledWith(user)
    expect(mockPrepareAppleAccountDeletion).not.toHaveBeenCalled()
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled()
    expect(mockRevokeAppleTokenForAccountDeletion).not.toHaveBeenCalled()
  })

  it('signs out through Firebase auth', async () => {
    await signOut()

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})
