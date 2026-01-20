import { describe, expect, it } from 'vitest';
import { MORSE_CODE } from '../../src/data/morse';

describe('MORSE_CODE', () => {
  it('contains 36 characters', () => {
    expect(Object.keys(MORSE_CODE)).toHaveLength(36);
  });

  it('uses unique morse codes', () => {
    const codes = Object.values(MORSE_CODE).map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses only dots and dashes in codes', () => {
    Object.values(MORSE_CODE).forEach((entry) => {
      expect(entry.code).toMatch(/^[.-]+$/);
    });
  });
});
