import { requireNativeModule } from 'expo-modules-core'
import {
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type User,
} from '@firebase/auth'
import { auth } from '../firebase'

type NativeGoogleSignInResult = {
  idToken?: string
  accessToken?: string
  email?: string
}

type NativeAppleSignInResult = {
  idToken?: string
  rawNonce?: string
  authorizationCode?: string
  email?: string
  givenName?: string
  familyName?: string
}

type DitNativeModule = {
  signInWithGoogle: () => Promise<NativeGoogleSignInResult>
  signInWithApple: () => Promise<NativeAppleSignInResult>
  prepareAppleAccountDeletion: (
    userId: string,
  ) => Promise<NativeAppleSignInResult>
  revokeAppleTokenForAccountDeletion: (
    authorizationCode: string,
    userId: string,
  ) => Promise<void>
}

const DitNative = requireNativeModule<DitNativeModule>('DitNative')

const getCurrentUserOrThrow = (user?: User | null) => {
  const currentUser = user ?? auth.currentUser

  if (!currentUser) {
    throw new Error('No signed-in user to delete')
  }

  return currentUser
}

const createAppleCredential = (result: NativeAppleSignInResult) => {
  if (!result?.idToken || !result.rawNonce) {
    throw new Error('No token returned from Apple sign-in')
  }

  const provider = new OAuthProvider('apple.com')
  return provider.credential({
    idToken: result.idToken,
    rawNonce: result.rawNonce,
  })
}

const isAppleUser = (user: User) =>
  (user.providerData ?? []).some((provider) => provider?.providerId === 'apple.com')

export const signInWithGoogle = async () => {
  const result = await DitNative.signInWithGoogle()

  if (!result || !result.idToken) {
    throw new Error('No token returned from native sign-in')
  }

  const credential = GoogleAuthProvider.credential(
    result.idToken,
    result.accessToken,
  )
  return signInWithCredential(auth, credential)
}

export const signInWithApple = async () => {
  const result = await DitNative.signInWithApple()
  const credential = createAppleCredential(result)

  return signInWithCredential(auth, credential)
}

export const signOut = async () => {
  // We only sign out of Firebase JS SDK here.
  // Native Google session might persist but that's usually desired for SSO.
  await auth.signOut()
}

export const prepareCurrentUserAccountDeletion = async (user?: User | null) => {
  const currentUser = getCurrentUserOrThrow(user)

  if (isAppleUser(currentUser)) {
    const result = await DitNative.prepareAppleAccountDeletion(currentUser.uid)

    if (!result.authorizationCode) {
      throw new Error('No authorization code returned from Apple account deletion flow')
    }

    await DitNative.revokeAppleTokenForAccountDeletion(
      result.authorizationCode,
      currentUser.uid,
    )
  }
}

export const deleteCurrentUserAccount = async (user?: User | null) => {
  const currentUser = getCurrentUserOrThrow(user)
  await deleteUser(currentUser)
}
