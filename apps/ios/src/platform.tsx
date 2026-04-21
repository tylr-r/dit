import {
  PlatformProvider as CorePlatformProvider,
  type AppLifecycleAdapter,
  type AuthAdapter,
  type DialogAdapter,
  type Platform,
  type StorageAdapter,
} from '@dit/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert, AppState, type AppStateStatus } from 'react-native'
import type { ReactNode } from 'react'
import { auth } from './firebase'
import {
  prepareCurrentUserAccountDeletion,
  signInWithApple as nativeSignInWithApple,
  signInWithGoogle as nativeSignInWithGoogle,
} from './services/auth'

const storage: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value)
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key)
  },
}

const appLifecycle: AppLifecycleAdapter = {
  subscribe: (listener) => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      listener(next === 'active' ? 'active' : 'background')
    })
    return () => {
      subscription.remove()
    }
  },
}

const dialog: DialogAdapter = {
  alert: (title, message) => {
    Alert.alert(title, message)
  },
  confirm: (title, message, actions) => {
    Alert.alert(
      title,
      message,
      actions.map((action) => ({
        text: action.text,
        style: action.style,
        onPress: action.onPress,
      })),
    )
  },
}

const authAdapter: AuthAdapter = {
  signInWithGoogle: async () => {
    await nativeSignInWithGoogle()
  },
  signInWithApple: async () => {
    await nativeSignInWithApple()
  },
  signOut: async () => {
    await auth.signOut()
  },
  prepareAccountDeletion: async (userId, isAppleUser) => {
    if (!isAppleUser) {
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser || currentUser.uid !== userId) {
      return
    }
    await prepareCurrentUserAccountDeletion(currentUser)
  },
}

export const iosPlatform: Platform = {
  storage,
  appLifecycle,
  dialog,
  auth: authAdapter,
}

type IosPlatformProviderProps = {
  children: ReactNode
}

/** Wraps the app with the iOS-backed Platform adapters consumed by @dit/core hooks. */
export const IosPlatformProvider = ({ children }: IosPlatformProviderProps) => (
  <CorePlatformProvider value={iosPlatform}>{children}</CorePlatformProvider>
)
