import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}))
