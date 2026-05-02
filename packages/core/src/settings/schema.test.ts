import { describe, expect, it } from 'vitest'
import {
  isRowAvailable,
  resolveSchemaFor,
  SETTINGS_SCHEMA,
  type SettingsRowId,
} from './schema'

describe('settings schema', () => {
  it('declares every row in SETTINGS_SCHEMA inside ROW_AVAILABILITY', () => {
    const declared = new Set<SettingsRowId>(
      SETTINGS_SCHEMA.flatMap((s) => s.rows),
    )
    for (const row of declared) {
      expect(typeof isRowAvailable(row, 'ios')).toBe('boolean')
      expect(typeof isRowAvailable(row, 'web')).toBe('boolean')
    }
  })

  describe('resolveSchemaFor("web", ...)', () => {
    it('drops iOS-only rows and the now-empty reminder section', () => {
      const sections = resolveSchemaFor('web', 'practice')
      const ids = sections.map((s) => s.id)

      expect(ids).not.toContain('reminder')

      const playback = sections.find((s) => s.id === 'playback')
      expect(playback).toBeDefined()
      expect(playback!.rows).not.toContain('playback-haptics')
      expect(playback!.rows).toContain('playback-wpm')
      expect(playback!.rows).toContain('playback-tone')
      expect(playback!.rows).toContain('sound-check')
    })

    it('hides word-mode outside Freestyle and surfaces it in Freestyle', () => {
      const inListen = resolveSchemaFor('web', 'listen').map((s) => s.id)
      expect(inListen).not.toContain('word-mode')

      const inFreestyle = resolveSchemaFor('web', 'freestyle').map((s) => s.id)
      expect(inFreestyle).toContain('word-mode')
    })

    it('marks practice expanded in Practice and collapsed otherwise', () => {
      const inPractice = resolveSchemaFor('web', 'practice')
      const practiceInPractice = inPractice.find((s) => s.id === 'practice')!
      expect(practiceInPractice.collapsed).toBe(false)

      const inListen = resolveSchemaFor('web', 'listen')
      const practiceInListen = inListen.find((s) => s.id === 'practice')!
      expect(practiceInListen.collapsed).toBe(true)
    })

    it('marks helpers always collapsed', () => {
      for (const mode of ['practice', 'freestyle', 'listen'] as const) {
        const helpers = resolveSchemaFor('web', mode).find(
          (s) => s.id === 'helpers',
        )!
        expect(helpers.collapsed).toBe(true)
      }
    })

    it('returns sections in the canonical order', () => {
      const ids = resolveSchemaFor('web', 'practice').map((s) => s.id)
      expect(ids).toEqual([
        'playback',
        'learning',
        'practice',
        'helpers',
        'app-actions',
        'account',
      ])
    })
  })

  describe('resolveSchemaFor("ios", ...)', () => {
    it('keeps every iOS-only row', () => {
      const sections = resolveSchemaFor('ios', 'practice')
      const allRows = sections.flatMap((s) => s.rows)
      expect(allRows).toContain('playback-haptics')
      expect(allRows).toContain('daily-reminder')
      expect(allRows).toContain('daily-reminder-time')
    })

    it('drops the web-only sound-check row', () => {
      const sections = resolveSchemaFor('ios', 'practice')
      const allRows = sections.flatMap((s) => s.rows)
      expect(allRows).not.toContain('sound-check')
    })

    it('preserves the reminder section on iOS', () => {
      const ids = resolveSchemaFor('ios', 'listen').map((s) => s.id)
      expect(ids).toContain('reminder')
    })
  })
})
