// ../../../dit/packages/core/src/constants.ts
var WPM_RANGE = {
  min: 10,
  max: 30
};
var EFFECTIVE_WPM_RANGE = {
  min: 6,
  max: 30
};

// ../../../dit/packages/core/src/utils/listenSpeed.ts
var LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS = {
  medium: 12,
  tight: 24
};
var clampListenWpm = (value) => Math.max(WPM_RANGE.min, Math.min(WPM_RANGE.max, Math.round(value)));
var clampListenEffectiveWpm = (value) => Math.max(EFFECTIVE_WPM_RANGE.min, Math.min(EFFECTIVE_WPM_RANGE.max, Math.round(value)));
var normalizeListenSpeeds = (characterWpm, effectiveWpm) => {
  const resolvedCharacterWpm = clampListenWpm(characterWpm);
  const resolvedEffectiveWpm = clampListenEffectiveWpm(Math.min(effectiveWpm, resolvedCharacterWpm));
  return {
    characterWpm: resolvedCharacterWpm,
    effectiveWpm: resolvedEffectiveWpm
  };
};
var getListenAutoTighteningStage = (correctCount) => {
  if (correctCount >= LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.tight) {
    return 2;
  }
  if (correctCount >= LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.medium) {
    return 1;
  }
  return 0;
};
var getAutoEffectiveWpm = (characterWpm, correctCount) => {
  const stage = getListenAutoTighteningStage(correctCount);
  const targetGap = stage === 0 ? 4 : stage === 1 ? 2 : 0;
  return normalizeListenSpeeds(characterWpm, characterWpm - targetGap).effectiveWpm;
};
var getListenUnitMs = (wpm, minUnitMs) => Math.max(Math.round(1200 / wpm), minUnitMs);
var getFarnsworthUnitMs = (characterWpm, effectiveWpm, minUnitMs) => {
  const characterUnitMs = getListenUnitMs(characterWpm, minUnitMs);
  if (effectiveWpm >= characterWpm) {
    return characterUnitMs;
  }
  const tFditSeconds = (300 * characterWpm - 186 * effectiveWpm) / (95 * characterWpm * effectiveWpm);
  return Math.max(Math.round(tFditSeconds * 1000), characterUnitMs, minUnitMs);
};
export {
  LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS,
  clampListenEffectiveWpm,
  clampListenWpm,
  getAutoEffectiveWpm,
  getFarnsworthUnitMs,
  getListenAutoTighteningStage,
  getListenUnitMs,
  normalizeListenSpeeds
};
