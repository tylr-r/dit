import { useEffect, useMemo } from 'react';
import type { Letter } from '@dit/core';
import { readStorageItem, writeStorageItem } from '../platform/storage';
import {
  clamp,
  initializeScores,
  parseLocalStorageScores,
} from '@dit/core';

type StorageKeys = {
  mode: string;
  showHint: string;
  showMnemonic: string;
  wordMode: string;
  practiceWordMode: string;
  maxLevel: string;
  scores: string;
  listenWpm: string;
};

type UseProgressOptions = {
  storageKeys: StorageKeys;
  mode: string;
  showHint: boolean;
  showMnemonic: boolean;
  wordMode: boolean;
  practiceWordMode: boolean;
  maxLevel: number;
  listenWpm: number;
  scores: Record<Letter, number>;
};

export const readStoredBoolean = (key: string, fallback: boolean) => {
  const stored = readStorageItem(key);
  if (stored === null) {
    return fallback;
  }
  return stored === 'true';
};

export const readStoredNumber = (
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const stored = readStorageItem(key);
  if (stored === null) {
    return fallback;
  }
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
};

export const readStoredScores = (key: string) => {
  const stored = readStorageItem(key);
  if (stored === null) {
    return initializeScores();
  }
  return parseLocalStorageScores(stored);
};

const useStoredValue = (key: string, value: string) => {
  useEffect(() => {
    writeStorageItem(key, value);
  }, [key, value]);
};

export const useProgress = ({
  storageKeys,
  mode,
  showHint,
  showMnemonic,
  wordMode,
  practiceWordMode,
  maxLevel,
  listenWpm,
  scores,
}: UseProgressOptions) => {
  const scoresStorageValue = useMemo(() => JSON.stringify(scores), [scores]);

  useStoredValue(storageKeys.mode, mode);
  useStoredValue(storageKeys.showHint, String(showHint));
  useStoredValue(storageKeys.showMnemonic, String(showMnemonic));
  useStoredValue(storageKeys.wordMode, String(wordMode));
  useStoredValue(storageKeys.practiceWordMode, String(practiceWordMode));
  useStoredValue(storageKeys.maxLevel, String(maxLevel));
  useStoredValue(storageKeys.listenWpm, String(listenWpm));
  useStoredValue(storageKeys.scores, scoresStorageValue);
};
