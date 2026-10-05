import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const cliRoot = dirname(require.resolve('@expo/cli/package.json'))

// Exercise the installed CLI so a dependency refresh cannot silently drop the patch.
function loadCli<T>(relativePath: string, mocks: Record<string, unknown>): T {
  const filename = join(cliRoot, 'build/src', relativePath)
  const localRequire = createRequire(filename)
  const exports = {}
  runInNewContext(readFileSync(filename, 'utf8'), {
    exports,
    require: (id: string) => mocks[id] ?? localRequire(id),
  }, { filename })
  return exports as T
}

interface PrerequisiteExports {
  SimulatorAppPrerequisite: { instance: { assertImplementation(): Promise<void> } }
}

interface RunningExports {
  ensureSimulatorAppRunningAsync(device: { udid?: string }): Promise<void>
}

describe('Expo CLI simulator compatibility patch', () => {
  it.each(['com.apple.iphonesimulator', 'com.apple.CoreSimulator.SimulatorTrampoline', 'com.apple.dt.Devices'])(
    'accepts installed simulator application %s', async (bundleId) => {
      const safeIdOfAppAsync = vi.fn(async (name: string) => name === (bundleId === 'com.apple.dt.Devices' ? 'DeviceHub' : 'Simulator') ? bundleId : null)
      const spawn = vi.fn(async () => ({ stdout: '' }))
      const { SimulatorAppPrerequisite } = loadCli<PrerequisiteExports>('start/doctor/apple/SimulatorAppPrerequisite.js', {
        '@expo/osascript': { safeIdOfAppAsync },
        '@expo/spawn-async': spawn,
      })
      await SimulatorAppPrerequisite.instance.assertImplementation()
      expect(spawn).toHaveBeenCalledWith('xcrun', ['simctl', 'help'])
    },
  )

  it('finds an unregistered Device Hub in the selected Xcode bundle', async () => {
    const spawn = vi.fn(async (command: string, args: string[]) => {
      if (command === 'xcode-select') return { stdout: '/Applications/Xcode-beta.app/Contents/Developer\n' }
      if (command === 'defaults') {
        if (args[1].includes('/Simulator.app/')) throw new Error('Missing app')
        return { stdout: 'com.apple.dt.Devices\n' }
      }
      return { stdout: '' }
    })
    const { SimulatorAppPrerequisite } = loadCli<PrerequisiteExports>('start/doctor/apple/SimulatorAppPrerequisite.js', {
      '@expo/osascript': { safeIdOfAppAsync: vi.fn(async () => null) },
      '@expo/spawn-async': spawn,
    })
    await SimulatorAppPrerequisite.instance.assertImplementation()
    expect(spawn).toHaveBeenCalledWith('defaults', [
      'read', '/Applications/Xcode-beta.app/Contents/Applications/DeviceHub.app/Contents/Info.plist', 'CFBundleIdentifier',
    ])
  })

  it.each([
    [{ udid: 'test-device' }, ['devices://device/open?id=test-device']],
    [{}, ['-a', 'DeviceHub']],
  ])('opens Device Hub when Simulator is unavailable for %j', async (device, expectedArgs) => {
    const execAsync = vi.fn().mockResolvedValueOnce('0').mockResolvedValueOnce('1')
    const spawn = vi.fn().mockRejectedValueOnce(new Error('Missing Simulator')).mockResolvedValueOnce({})
    const { ensureSimulatorAppRunningAsync } = loadCli<RunningExports>('start/platforms/ios/ensureSimulatorAppRunning.js', {
      '@expo/osascript': { execAsync },
      '@expo/spawn-async': spawn,
      '../../../log': { log: vi.fn() },
      '../../../utils/delay': { waitForActionAsync: ({ action }: { action(): Promise<boolean> }) => action() },
    })
    await ensureSimulatorAppRunningAsync(device)
    expect(spawn).toHaveBeenNthCalledWith(2, 'open', expectedArgs)
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('or name is "DeviceHub"'))
  })

  it('keeps an already running Device Hub open', async () => {
    const spawn = vi.fn()
    const { ensureSimulatorAppRunningAsync } = loadCli<RunningExports>('start/platforms/ios/ensureSimulatorAppRunning.js', {
      '@expo/osascript': { execAsync: vi.fn(async () => '1') },
      '@expo/spawn-async': spawn,
    })
    await ensureSimulatorAppRunningAsync({ udid: 'test-device' })
    expect(spawn).not.toHaveBeenCalled()
  })

  it('opens Device Hub directly when its URL handler is unavailable', async () => {
    const execAsync = vi.fn().mockResolvedValueOnce('0').mockResolvedValueOnce('1')
    const spawn = vi.fn()
      .mockRejectedValueOnce(new Error('Missing Simulator'))
      .mockRejectedValueOnce(new Error('Unregistered URL handler'))
      .mockResolvedValueOnce({})
    const { ensureSimulatorAppRunningAsync } = loadCli<RunningExports>('start/platforms/ios/ensureSimulatorAppRunning.js', {
      '@expo/osascript': { execAsync },
      '@expo/spawn-async': spawn,
      '../../../log': { log: vi.fn() },
      '../../../utils/delay': { waitForActionAsync: ({ action }: { action(): Promise<boolean> }) => action() },
    })
    await ensureSimulatorAppRunningAsync({ udid: 'test-device' })
    expect(spawn).toHaveBeenNthCalledWith(3, 'open', ['-a', 'DeviceHub'])
  })

  it('does not fail an app launch when window focus is unavailable', async () => {
    const execAsync = vi.fn().mockRejectedValue(new Error('Focus unavailable'))
    const { AppleDeviceManager } = loadCli<{
      AppleDeviceManager: { prototype: { activateWindowAsync(): Promise<void> } }
    }>('start/platforms/ios/AppleDeviceManager.js', {
      '@expo/osascript': { execAsync },
      './ensureSimulatorAppRunning': { ensureSimulatorAppRunningAsync: vi.fn(async () => {}) },
    })
    await expect(AppleDeviceManager.prototype.activateWindowAsync()).resolves.toBeUndefined()
    expect(execAsync).toHaveBeenCalledWith(expect.arrayContaining(['tell application "DeviceHub" to activate']))
  })
})
