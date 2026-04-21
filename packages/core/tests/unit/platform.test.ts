import { describe, expect, it } from 'vitest'
import { createNoopPlatform, type Platform } from '../../src/platform'

describe('createNoopPlatform', () => {
  it('provides callable no-op adapters for every capability', async () => {
    const platform = createNoopPlatform()

    expect(await platform.storage.getItem('any')).toBeNull()
    await expect(platform.storage.setItem('k', 'v')).resolves.toBeUndefined()
    await expect(platform.storage.removeItem('k')).resolves.toBeUndefined()

    const unsubscribe = platform.appLifecycle.subscribe(() => {})
    expect(typeof unsubscribe).toBe('function')
    expect(() => unsubscribe()).not.toThrow()

    expect(() => platform.dialog.alert('title')).not.toThrow()
    expect(() => platform.dialog.confirm('t', 'm', [])).not.toThrow()

    await expect(platform.auth.signInWithGoogle()).resolves.toBeUndefined()
    await expect(platform.auth.signOut()).resolves.toBeUndefined()
    await expect(platform.auth.prepareAccountDeletion('u', false)).resolves.toBeUndefined()
  })

  it('accepts partial overrides and merges them over the defaults', async () => {
    const setItemCalls: Array<[string, string]> = []
    const platform: Platform = createNoopPlatform({
      storage: {
        getItem: async (key) => (key === 'seeded' ? 'value' : null),
        setItem: async (key, value) => {
          setItemCalls.push([key, value])
        },
        removeItem: async () => {},
      },
    })

    expect(await platform.storage.getItem('seeded')).toBe('value')
    expect(await platform.storage.getItem('other')).toBeNull()

    await platform.storage.setItem('a', '1')
    expect(setItemCalls).toEqual([['a', '1']])

    // Non-overridden adapters fall through to the no-op defaults.
    expect(() => platform.dialog.alert('x')).not.toThrow()
  })
})
