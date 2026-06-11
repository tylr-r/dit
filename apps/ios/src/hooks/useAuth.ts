import { onAuthStateChanged, signOut, type User } from '@firebase/auth'
import { useEffect, useState } from 'react'
import { analyticsClient } from '../analytics'
import { auth } from '../firebase'

const DELETED_ACCOUNT_CODES = new Set([
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/user-token-revoked',
])

const getAuthErrorCode = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user)
        void analyticsClient.setUserId(user?.uid ?? null)
        if (initializing) setInitializing(false)
      },
      (error) => {
        const code = getAuthErrorCode(error)
        if (code && DELETED_ACCOUNT_CODES.has(code)) {
          void signOut(auth)
        }
      },
    )
    return unsubscribe
  }, [initializing])

  return { user, initializing }
}
