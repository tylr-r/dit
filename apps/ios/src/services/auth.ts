import { requireNativeModule } from 'expo-modules-core'
import { GoogleAuthProvider, signInWithCredential } from '@firebase/auth'
import { auth } from '../firebase'

// Access the native module directly
const DitNative = requireNativeModule('DitNative')

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

export const signOut = async () => {
  // We only sign out of Firebase JS SDK here.
  // Native Google session might persist but that's usually desired for SSO.
  await auth.signOut()
}
