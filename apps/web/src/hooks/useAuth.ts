import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'

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
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(
      auth,
      (next) => {
        setUser(next)
        setInitializing(false)
      },
      (error) => {
        const code = getAuthErrorCode(error)
        if (code && DELETED_ACCOUNT_CODES.has(code)) {
          void signOut(auth)
        }
      },
    )
    return unsubscribe
  }, [])

  return { user, initializing }
}
