import { clearCustomListenStorage } from '../hooks/useCustomListenSession'
import { getLocalStorage } from './storage'

const MILESTONE_PREFIX = 'dit:milestone:'

export const clearWebResetStorage = () => {
  clearCustomListenStorage()

  const storage = getLocalStorage()
  if (!storage) return

  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i)
    if (key?.startsWith(MILESTONE_PREFIX)) {
      storage.removeItem(key)
    }
  }
}
