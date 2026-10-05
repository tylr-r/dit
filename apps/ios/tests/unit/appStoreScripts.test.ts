import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const appRoot = resolve(import.meta.dirname, '../..')
const buildScript = join(appRoot, 'scripts/build-app-store.sh')
const uploadScript = join(appRoot, 'scripts/upload-app-store.sh')
const temporaryDirectories: string[] = []
const createTemporaryDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), 'dit-release-test-'))
  temporaryDirectories.push(directory)
  return directory
}
afterEach(() => temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })))

const runBuild = (xcodeBuild: string, args: string[]) => {
  const directory = createTemporaryDirectory()
  writeFileSync(join(directory, 'xcodebuild'), `#!/bin/sh\nif [ "$1" != "-version" ]; then exit 99; fi\nprintf 'Xcode 27.0\\nBuild version ${xcodeBuild}\\n'\n`, { mode: 0o755 })
  return spawnSync('bash', [buildScript, ...args], {
    cwd: directory,
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, VERSION: '' },
    encoding: 'utf8',
  })
}

describe('App Store preparation scripts', () => {
  it('rejects beta Xcode before modifying configuration or starting an archive', () => {
    const before = ['app.json', 'package.json'].map((name) => readFileSync(join(appRoot, name), 'utf8'))
    const result = runBuild('27A5218g', ['1'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('release or RC Xcode')
    expect(['app.json', 'package.json'].map((name) => readFileSync(join(appRoot, name), 'utf8'))).toEqual(before)
  })

  it('checks a release toolchain from any directory without starting an archive', () => {
    const result = runBuild('27A123', ['--check', '1'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No files changed')
    expect(result.stdout).toContain('(1)')
  })

  it('rejects invalid build numbers instead of silently choosing another', () => {
    const result = runBuild('27A123', ['not-a-build'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('positive integer')
  })

  it.skipIf(process.platform !== 'darwin')('rejects an older IPA before validating or uploading it', () => {
    const directory = createTemporaryDirectory()
    const application = join(directory, 'Payload/Dit.app')
    mkdirSync(application, { recursive: true })
    writeFileSync(join(application, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
      <key>CFBundleShortVersionString</key><string>1.0.0</string>
      <key>CFBundleVersion</key><string>1</string>
      <key>CFBundleIdentifier</key><string>com.tylerobinson.dit</string>
    </dict></plist>`)
    const ipa = join(directory, 'old.ipa')
    execFileSync('zip', ['-qr', ipa, 'Payload'], { cwd: directory })
    const result = spawnSync('bash', [uploadScript, '--validate', ipa], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('IPA does not match the prepared release')
  })
})
