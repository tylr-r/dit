import {
  PlatformProvider as CorePlatformProvider,
  type AppLifecycleAdapter,
  type AuthAdapter,
  type DialogAction,
  type DialogAdapter,
  type NetworkAdapter,
  type Platform,
  type StorageAdapter,
} from '@dit/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert, AppState, InteractionManager, type AppStateStatus } from 'react-native'
import type { ReactNode } from 'react'
import { auth } from './firebase'
import {
  createAccountWithEmail as authCreateAccountWithEmail,
  prepareCurrentUserAccountDeletion,
  signInWithApple as nativeSignInWithApple,
  signInWithEmail as authSignInWithEmail,
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

const showAlert = (title: string, message: string | undefined, actions: DialogAction[]) => {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => {
      Alert.alert(title, message, actions)
    })
  })
}

const dialog: DialogAdapter = {
  alert: (title, message) => {
    showAlert(title, message, [{ text: 'OK' }])
  },
  confirm: (title, message, actions) => {
    showAlert(
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

const NETWORK_PROBE_URL = 'https://connectivitycheck.gstatic.com/generate_204'
const NETWORK_PROBE_TIMEOUT_MS = 3000

const network: NetworkAdapter = {
  isAvailable: async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), NETWORK_PROBE_TIMEOUT_MS)
      const response = await fetch(`${NETWORK_PROBE_URL}?t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response.status === 204
    } catch {
      return false
    }
  },
}

const authAdapter: AuthAdapter = {
  signInWithGoogle: async () => {
    await nativeSignInWithGoogle()
  },
  signInWithApple: async () => {
    await nativeSignInWithApple()
  },
  signInWithEmail: async (email, password) => {
    await authSignInWithEmail(email, password)
  },
  createAccountWithEmail: async (email, password) => {
    await authCreateAccountWithEmail(email, password)
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
  network,
}

type IosPlatformProviderProps = {
  children: ReactNode
}

/** Wraps the app with the iOS-backed Platform adapters consumed by @dit/core hooks. */
export const IosPlatformProvider = ({ children }: IosPlatformProviderProps) => (
  <CorePlatformProvider value={iosPlatform}>{children}</CorePlatformProvider>
)
