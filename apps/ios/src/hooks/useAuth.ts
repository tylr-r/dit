import { onAuthStateChanged, signOut, type User } from '@firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '../firebase'

const DELETED_ACCOUNT_CODES = new Set([
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/user-token-revoked',
])

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user)
        if (initializing) setInitializing(false)
      },
      (error) => {
        if (DELETED_ACCOUNT_CODES.has(error.code)) {
          void signOut(auth)
        }
      },
    )
    return unsubscribe
  }, [initializing])

  return { user, initializing }
}
