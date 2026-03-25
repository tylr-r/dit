import { execFileSync } from 'node:child_process'

const repositoryRoot = process.cwd()
const maxReportedFindings = 10
const maxFilesPerFinding = 4

const suspiciousPathChecks = [
  {
    label: 'dotenv file',
    matches: (filePath) =>
      /(^|\/)\.env(\.[^/]+)?$/i.test(filePath) &&
      !/(^|\/)\.env\.(example|sample|template)$/i.test(filePath),
  },
  {
    label: 'Firebase iOS config',
    matches: (filePath) =>
      /(^|\/)GoogleService-Info\.plist$/i.test(filePath) &&
      !/(^|\/)GoogleService-Info\.example\.plist$/i.test(filePath),
  },
  {
    label: 'private key or certificate',
    matches: (filePath) =>
      /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i.test(filePath) ||
      /\.(pem|p8|p12|jks|keystore)$/i.test(filePath),
  },
  {
    label: 'service account export',
    matches: (filePath) =>
      /(^|\/)(service-account|firebase-adminsdk).*\.json$/i.test(filePath),
  },
]

const suspiciousContentChecks = [
  {
    label: 'generic private key',
    needle: '-----BEGIN PRIVATE KEY-----',
  },
  {
    label: 'RSA private key',
    needle: '-----BEGIN RSA PRIVATE KEY-----',
  },
  {
    label: 'OpenSSH private key',
    needle: '-----BEGIN OPENSSH PRIVATE KEY-----',
  },
]

const safeContentMatchPaths = [
  /^README\.md$/i,
  /^docs\//i,
  /^scripts\/check-private-history\.js$/i,
]

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    const stdout =
      error && typeof error === 'object' && 'stdout' in error
        ? String(error.stdout ?? '').trim()
        : ''
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr ?? '').trim()
        : ''

    if (allowFailure) {
      return stdout
    }

    throw new Error(stderr || `git ${args.join(' ')} failed`)
  }
}

function collectHistoricalPaths() {
  const output = runGit(['rev-list', '--objects', '--all'])

  return output
    .split('\n')
    .map((line) => {
      const separatorIndex = line.indexOf(' ')
      return separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim()
    })
    .filter(Boolean)
}

function collectReachableRevisions() {
  return runGit(['rev-list', '--all'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function collectDeletedPaths() {
  const output = runGit([
    'log',
    '--all',
    '--diff-filter=D',
    '--name-only',
    '--format=',
  ])

  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

function collectUnreachableObjects() {
  const output = runGit(
    ['fsck', '--unreachable', '--no-reflogs', '--no-progress'],
    { allowFailure: true },
  )

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('unreachable '))
}

function findPathMatches(paths, source) {
  const findings = []
  const seen = new Set()

  for (const filePath of paths) {
    for (const check of suspiciousPathChecks) {
      if (!check.matches(filePath)) {
        continue
      }

      const key = `${source}:${check.label}:${filePath}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      findings.push({
        source,
        label: check.label,
        detail: filePath,
      })
    }
  }

  return findings
}

function findContentMatches() {
  const findings = []
  const reachableRevisions = collectReachableRevisions()

  for (const check of suspiciousContentChecks) {
    const output = runGit(
      ['grep', '-nI', '-F', check.needle, ...reachableRevisions],
      { allowFailure: true },
    )

    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean)
    const uniqueUnsafeLocations = []
    const seenLocations = new Set()

    for (const line of lines) {
      const match = line.match(/^([0-9a-f]{40,64}):(.+?):\d+:/i)
      if (!match) {
        continue
      }

      const [, commitSha, filePath] = match
      if (safeContentMatchPaths.some((pattern) => pattern.test(filePath))) {
        continue
      }

      const locationKey = `${commitSha}:${filePath}`
      if (seenLocations.has(locationKey)) {
        continue
      }

      seenLocations.add(locationKey)
      uniqueUnsafeLocations.push(`${commitSha} | ${filePath}`)
    }

    if (uniqueUnsafeLocations.length === 0) {
      continue
    }

    findings.push({
      source: 'git content history',
      label: check.label,
      detail: uniqueUnsafeLocations.slice(0, maxFilesPerFinding).join(', '),
    })
  }

  return findings
}

function reportFindings(title, findings) {
  console.error(`\n${title}`)
  for (const finding of findings.slice(0, maxReportedFindings)) {
    console.error(`- [${finding.source}] ${finding.label}: ${finding.detail}`)
  }

  if (findings.length > maxReportedFindings) {
    console.error(`- ...and ${findings.length - maxReportedFindings} more`)
  }
}

const historicalPathFindings = findPathMatches(
  collectHistoricalPaths(),
  'git reachable history',
)
const deletedPathFindings = findPathMatches(
  collectDeletedPaths(),
  'git deleted files',
)
const contentFindings = findContentMatches()
const unreachableObjects = collectUnreachableObjects()

const allFindings = [
  ...historicalPathFindings,
  ...deletedPathFindings,
  ...contentFindings,
]

if (allFindings.length > 0) {
  console.error('Potential private material found in git history checks.')
  reportFindings('Failing findings', allFindings)

  if (unreachableObjects.length > 0) {
    console.error('\nAdditional unreachable objects detected:')
    for (const line of unreachableObjects.slice(0, maxReportedFindings)) {
      console.error(`- ${line}`)
    }
  }

  process.exit(1)
}

console.log('No suspicious private files or key material found in reachable git history.')

if (unreachableObjects.length > 0) {
  console.warn(
    `Found ${unreachableObjects.length} unreachable git object(s); review locally if needed.`,
  )
}
