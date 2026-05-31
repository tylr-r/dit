/**
 * Shared settings information architecture.
 *
 * Both apps consume this schema to keep section ordering, grouping, headers,
 * and per-row platform availability in lockstep. Control idioms (steppers vs
 * sliders, RN Switch vs HTML toggle) and modal chrome stay per-platform.
 */

export type SettingsRowId =
  | 'word-mode'
  | 'playback-wpm'
  | 'playback-tone'
  | 'playback-haptics'
  | 'sound-check'
  | 'learning-method'
  | 'practice-words'
  | 'practice-autoplay'
  | 'practice-sequential'
  | 'practice-ifr'
  | 'practice-review-misses'
  | 'helpers-hints'
  | 'helpers-mnemonics'
  | 'daily-reminder'
  | 'daily-reminder-time'
  | 'use-recommended'
  | 'about'
  | 'replay-nux'
  | 'reset-app'
  | 'account-identity'
  | 'account-signout'
  | 'account-delete'

export type SettingsPlatform = 'ios' | 'web'

export type SettingsMode = 'practice' | 'freestyle' | 'listen'

export type SettingsCollapseRule = 'always' | 'off-mode'

export type SettingsSection = {
  id: string
  title?: string
  /**
   * `always` — section is collapsible whenever it is rendered (default expanded
   * state lives with the renderer).
   * `off-mode` — section is rendered inline when `mode` matches the current
   * mode and rendered collapsed (with a header chevron) otherwise. Requires `mode`.
   */
  collapseWhen?: SettingsCollapseRule
  mode?: SettingsMode
  rows: SettingsRowId[]
}

export type ResolvedSettingsSection = SettingsSection & {
  /** True when the section should be rendered in collapsed-by-default form. */
  collapsed: boolean
}

/**
 * Canonical section order. iOS and web both follow this list; resolveSchemaFor
 * filters and annotates per platform/mode.
 */
export const SETTINGS_SCHEMA: readonly SettingsSection[] = [
  { id: 'word-mode', mode: 'freestyle', rows: ['word-mode'] },
  {
    id: 'playback',
    title: 'Playback',
    rows: ['playback-wpm', 'playback-tone', 'playback-haptics', 'sound-check'],
  },
  { id: 'learning', rows: ['learning-method'] },
  {
    id: 'practice',
    title: 'Practice settings',
    mode: 'practice',
    collapseWhen: 'off-mode',
    rows: [
      'practice-words',
      'practice-autoplay',
      'practice-sequential',
      'practice-ifr',
      'practice-review-misses',
    ],
  },
  {
    id: 'helpers',
    title: 'Helpers',
    collapseWhen: 'always',
    rows: ['helpers-hints', 'helpers-mnemonics'],
  },
  { id: 'reminder', rows: ['daily-reminder', 'daily-reminder-time'] },
  { id: 'app-actions', rows: ['use-recommended', 'about', 'replay-nux', 'reset-app'] },
  {
    id: 'account',
    title: 'Account',
    rows: ['account-identity', 'account-signout', 'account-delete'],
  },
] as const

const BOTH: SettingsPlatform[] = ['ios', 'web']

export const ROW_AVAILABILITY: Readonly<
  Record<SettingsRowId, readonly SettingsPlatform[]>
> = {
  'word-mode': BOTH,
  'playback-wpm': BOTH,
  'playback-tone': BOTH,
  'playback-haptics': ['ios'],
  'sound-check': ['web'],
  'learning-method': BOTH,
  'practice-words': BOTH,
  'practice-autoplay': BOTH,
  'practice-sequential': BOTH,
  'practice-ifr': BOTH,
  'practice-review-misses': BOTH,
  'helpers-hints': BOTH,
  'helpers-mnemonics': BOTH,
  'daily-reminder': ['ios'],
  'daily-reminder-time': ['ios'],
  'use-recommended': BOTH,
  'about': BOTH,
  'replay-nux': BOTH,
  'reset-app': BOTH,
  'account-identity': BOTH,
  'account-signout': BOTH,
  'account-delete': BOTH,
}

export function isRowAvailable(
  row: SettingsRowId,
  platform: SettingsPlatform,
): boolean {
  return ROW_AVAILABILITY[row].includes(platform)
}

/**
 * Returns the settings sections to render for a platform and current mode,
 * with rows filtered by platform availability and a `collapsed` flag set
 * according to each section's `collapseWhen` rule.
 *
 * Sections with no surviving rows are dropped. Mode-scoped sections without a
 * `collapseWhen` rule are dropped when the current mode does not match.
 */
export function resolveSchemaFor(
  platform: SettingsPlatform,
  mode: SettingsMode,
): ResolvedSettingsSection[] {
  const out: ResolvedSettingsSection[] = []
  for (const section of SETTINGS_SCHEMA) {
    const rows = section.rows.filter((r) => isRowAvailable(r, platform))
    if (rows.length === 0) continue

    const isOffMode = section.mode != null && section.mode !== mode

    if (isOffMode && !section.collapseWhen) {
      continue
    }

    let collapsed = false
    if (section.collapseWhen === 'always') {
      collapsed = true
    } else if (section.collapseWhen === 'off-mode' && isOffMode) {
      collapsed = true
    }

    out.push({ ...section, rows, collapsed })
  }
  return out
}
