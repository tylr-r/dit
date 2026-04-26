import {
  PlatformProvider as CorePlatformProvider,
  type AppLifecycleAdapter,
  type AuthAdapter,
  type DialogAdapter,
  type Platform,
  type StorageAdapter,
} from '@dit/core'
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import type { ReactNode } from 'react'
import { getLocalStorage } from './platform/storage'

const storage: StorageAdapter = {
  getItem: async (key) => {
    const ls = getLocalStorage()
    if (!ls) {
      return null
    }
    try {
      return ls.getItem(key)
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    const ls = getLocalStorage()
    if (!ls) {
      return
    }
    try {
      ls.setItem(key, value)
    } catch {
      // storage full or blocked; hooks tolerate write failures silently
    }
  },
  removeItem: async (key) => {
    const ls = getLocalStorage()
    if (!ls) {
      return
    }
    try {
      ls.removeItem(key)
    } catch {
      // ignore
    }
  },
}

const appLifecycle: AppLifecycleAdapter = {
  subscribe: (listener) => {
    if (typeof document === 'undefined') {
      return () => {}
    }
    const handler = () => {
      listener(document.visibilityState === 'visible' ? 'active' : 'background')
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  },
}

const dialog: DialogAdapter = {
  alert: (title, message) => {
    if (typeof window === 'undefined') {
      return
    }
    const text = message ? `${title}\n\n${message}` : title
    window.alert(text)
  },
  confirm: (title, message, actions) => {
    if (typeof window === 'undefined' || actions.length === 0) {
      return
    }
    const proceed = window.confirm(`${title}\n\n${message}`)
    const chosen = proceed
      ? actions.find((a) => a.style !== 'cancel') ?? actions[actions.length - 1]
      : actions.find((a) => a.style === 'cancel') ?? actions[0]
    chosen.onPress?.()
  },
}

const isPopupFallbackError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'auth/popup-blocked' ||
    error.code === 'auth/operation-not-supported-in-this-environment')

const authAdapter: AuthAdapter = {
  signInWithGoogle: async () => {
    const auth = getAuth()
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      if (isPopupFallbackError(error)) {
        await signInWithRedirect(auth, provider)
        return
      }
      throw error
    }
  },
  signInWithApple: async () => {
    const auth = getAuth()
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      if (isPopupFallbackError(error)) {
        await signInWithRedirect(auth, provider)
        return
      }
      throw error
    }
  },
  signInWithEmail: async (email, password) => {
    await signInWithEmailAndPassword(getAuth(), email, password)
  },
  createAccountWithEmail: async (email, password) => {
    await createUserWithEmailAndPassword(getAuth(), email, password)
  },
  signOut: async () => {
    await signOut(getAuth())
  },
  prepareAccountDeletion: async () => {
    // Web has no native session to revoke; useAccountActions handles
    // deleteUser() itself after this resolves.
  },
}

const webPlatform: Platform = {
  storage,
  appLifecycle,
  dialog,
  auth: authAdapter,
}

type WebPlatformProviderProps = {
  children: ReactNode
}

/** Mounts the web-backed Platform adapters consumed by @dit/core hooks. */
export const WebPlatformProvider = ({ children }: WebPlatformProviderProps) => (
  <CorePlatformProvider value={webPlatform}>{children}</CorePlatformProvider>
)
