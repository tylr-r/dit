import { onAuthStateChanged, type User } from '@firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '../firebase'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      if (initializing) setInitializing(false)
    })
    return unsubscribe
  }, [initializing])

  return { user, initializing }
}
