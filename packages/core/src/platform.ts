import { createContext, useContext } from 'react'

/**
 * Async key-value storage. iOS wraps AsyncStorage; web wraps localStorage with Promise adapters.
 * Every method must be non-throwing (return null / resolve on error) so hooks don't need
 * platform-specific error handling.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type AppLifecycleState = 'active' | 'background'

/**
 * App / document lifecycle events. iOS subscribes via React Native's `AppState`; web subscribes
 * via `document.visibilitychange` on the Page Visibility API. Consumers care about two things:
 * the app going to the background (flush state) and coming back to foreground (refresh).
 */
export interface AppLifecycleAdapter {
  subscribe(listener: (state: AppLifecycleState) => void): () => void
}

export type DialogActionStyle = 'default' | 'cancel' | 'destructive'

export interface DialogAction {
  text: string
  style?: DialogActionStyle
  onPress?: () => void
}

/**
 * User-facing dialogs. iOS uses `Alert.alert`; web can use `window.confirm` / `window.alert` or
 * a custom modal component wired through this adapter. `confirm` must preserve the action order
 * and honor the destructive style so screen readers announce it correctly.
 */
export interface DialogAdapter {
  alert(title: string, message?: string): void
  confirm(title: string, message: string, actions: DialogAction[]): void
}

/**
 * Third-party sign-in. Firebase Auth itself is cross-platform, but obtaining Apple/Google
 * credentials requires native flows on iOS (via `DitNative`) or web flows (Google popup,
 * Apple web redirect). Platforms that do not support a method omit it from this adapter; the
 * UI must gate its affordances on adapter capability.
 *
 * `signOut` is intentionally part of the adapter because some platforms need extra cleanup
 * (revoking native sessions) beyond Firebase's `auth.signOut()`.
 */
export interface AuthAdapter {
  signInWithGoogle(): Promise<void>
  signInWithApple?(): Promise<void>
  signOut(): Promise<void>
  /**
   * Platform-specific preparation that must run before `deleteUser` on the Firebase side.
   * iOS uses this to revoke Apple ID tokens via DitNative. Web impls can be a no-op.
   */
  prepareAccountDeletion(userId: string, isAppleUser: boolean): Promise<void>
}

export interface Platform {
  storage: StorageAdapter
  appLifecycle: AppLifecycleAdapter
  dialog: DialogAdapter
  auth: AuthAdapter
}

const PlatformContext = createContext<Platform | null>(null)

export const PlatformProvider = PlatformContext.Provider

export function usePlatform(): Platform {
  const platform = useContext(PlatformContext)
  if (!platform) {
    throw new Error(
      'usePlatform() called outside <PlatformProvider>. Mount the provider at your app root with platform-specific adapters.',
    )
  }
  return platform
}

/**
 * No-op adapters for tests. Individual adapters can be overridden when a test needs to assert
 * on observable behavior (e.g. verifying storage.setItem was called with the expected key).
 */
export const createNoopPlatform = (overrides: Partial<Platform> = {}): Platform => ({
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
  appLifecycle: {
    subscribe: () => () => {},
  },
  dialog: {
    alert: () => {},
    confirm: () => {},
  },
  auth: {
    signInWithGoogle: async () => {},
    signOut: async () => {},
    prepareAccountDeletion: async () => {},
  },
  ...overrides,
})
