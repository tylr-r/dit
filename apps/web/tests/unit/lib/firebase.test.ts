import { afterAll, describe, expect, it, vi } from 'vitest'

const {
  firebaseApp,
  initializeAppCheckMock,
  providerKeys,
} = vi.hoisted(() => ({
  firebaseApp: {},
  initializeAppCheckMock: vi.fn(),
  providerKeys: [] as string[],
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => firebaseApp),
}))

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: initializeAppCheckMock,
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    constructor(siteKey: string) {
      providerKeys.push(siteKey)
    }
  },
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  getDatabase: vi.fn(() => ({})),
  goOffline: vi.fn(),
  goOnline: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
}))

// Exercise the configured path without depending on an untracked local .env.
vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'test-recaptcha-site-key')
await import('../../../src/firebase')
afterAll(() => vi.unstubAllEnvs())

describe('Firebase App Check', () => {
  it('initializes the Enterprise provider with the configured site key', () => {
    expect(providerKeys).toEqual([
      'test-recaptcha-site-key',
    ])
    expect(initializeAppCheckMock).toHaveBeenCalledWith(
      firebaseApp,
      expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
    )
  })
})
