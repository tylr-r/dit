import { afterEach, describe, expect, it, vi } from 'vitest';
import { MORSE_DATA, type Letter } from '@dit/core';
import {
  applyScoreDelta,
  clamp,
  formatWpm,
  getLettersForLevel,
  getRandomWeightedLetter,
  initializeScores,
  parseFirebaseScores,
  parseLocalStorageScores,
  parseProgress,
} from '@dit/core';

const LETTERS = Object.keys(MORSE_DATA) as Letter[];

describe('morse utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps and rounds values', () => {
    expect(clamp(2.4, 1, 4)).toBe(2);
    expect(clamp(2.6, 1, 4)).toBe(3);
    expect(clamp(9, 1, 4)).toBe(4);
    expect(clamp(-5, 1, 4)).toBe(1);
  });

  it('formats WPM values to a single decimal when needed', () => {
    expect(formatWpm(20)).toBe('20');
    expect(formatWpm(18.25)).toBe('18.3');
    expect(formatWpm(18.2)).toBe('18.2');
  });

  it('returns letters only at or below the requested level', () => {
    const levelOneLetters = getLettersForLevel(1);
    expect(levelOneLetters).toContain('A');
    expect(levelOneLetters).not.toContain('B');
    levelOneLetters.forEach((letter) => {
      expect(MORSE_DATA[letter].level).toBeLessThanOrEqual(1);
    });
  });

  it('initializes scores for every letter', () => {
    const scores = initializeScores();
    expect(Object.keys(scores)).toHaveLength(LETTERS.length);
    LETTERS.forEach((letter) => {
      expect(scores[letter]).toBe(0);
    });
  });

  it('applies score deltas without mutating the original map', () => {
    const scores = initializeScores();
    const updated = applyScoreDelta(scores, 'A', 2);
    expect(scores.A).toBe(0);
    expect(updated.A).toBe(2);
    expect(applyScoreDelta(updated, 'A', -3).A).toBe(-1);
  });

  it('avoids repeating the previous weighted letter', () => {
    const scores = initializeScores();
    scores.A = 10;
    scores.B = 0;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = getRandomWeightedLetter(['A', 'B'], scores, 'A');
    expect(result).toBe('B');
  });

  it('parses firebase scores and ignores invalid entries', () => {
    const parsed = parseFirebaseScores({ A: 2, B: 'nope' });
    expect(parsed).not.toBeNull();
    expect(parsed?.A).toBe(2);
    expect(parsed?.B).toBe(0);
  });

  it('returns null when firebase scores contain no valid numbers', () => {
    const parsed = parseFirebaseScores({ A: 'nope' });
    expect(parsed).toBeNull();
  });

  it('parses progress values with clamping and scores', () => {
    const progress = parseProgress(
      {
        listenWpm: 100,
        maxLevel: 9,
        showHint: true,
        showMnemonic: false,
        wordMode: true,
        practiceWordMode: true,
        scores: { A: 3, Z: 1 },
      },
      { listenWpmMin: 10, listenWpmMax: 30 },
    );
    expect(progress).not.toBeNull();
    expect(progress?.listenWpm).toBe(30);
    expect(progress?.maxLevel).toBe(4);
    expect(progress?.showHint).toBe(true);
    expect(progress?.scores?.A).toBe(3);
    expect(progress?.scores?.Z).toBe(1);
  });

  it('parses local storage scores with fallbacks', () => {
    const parsed = parseLocalStorageScores(
      JSON.stringify({ A: 4, B: 'nope' }),
    );
    expect(parsed.A).toBe(4);
    expect(parsed.B).toBe(0);
  });

  it('returns defaults when local storage scores are invalid', () => {
    const parsed = parseLocalStorageScores('not-json');
    LETTERS.forEach((letter) => {
      expect(parsed[letter]).toBe(0);
    });
  });
});
