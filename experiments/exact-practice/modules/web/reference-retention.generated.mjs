// ../../../dit/packages/core/src/data/morse.ts
var MORSE_DATA = {
  A: { code: ".-", mnemonic: "a-PART", level: 1 },
  B: { code: "-...", mnemonic: "BOB-is-the-uncle", level: 3 },
  C: { code: "-.-.", mnemonic: "CO-ca-CO-la", level: 3 },
  D: { code: "-..", mnemonic: "DOG-did-it", level: 2 },
  E: { code: ".", mnemonic: "eh?", level: 1 },
  F: { code: "..-.", mnemonic: "fetch-a-FIRE-man", level: 3 },
  G: { code: "--.", mnemonic: "GRAND-MA-g", level: 2 },
  H: { code: "....", mnemonic: "hip-pi-ty-hop", level: 3 },
  I: { code: "..", mnemonic: "i-bid", level: 1 },
  J: { code: ".---", mnemonic: "let's JUMP, JUMP, JUMP", level: 3 },
  K: { code: "-.-", mnemonic: "KICK the CAN", level: 2 },
  L: { code: ".-..", mnemonic: "a LIGHT is lit", level: 3 },
  M: { code: "--", mnemonic: "MA-MA", level: 1 },
  N: { code: "-.", mnemonic: "NA-vy", level: 1 },
  O: { code: "---", mnemonic: "OH-MY-GOD", level: 2 },
  P: { code: ".--.", mnemonic: "a-POO-PY-smell", level: 3 },
  Q: { code: "--.-", mnemonic: "GOD-SAVE-the-QUEEN", level: 3 },
  R: { code: ".-.", mnemonic: "ro-TA-tion", level: 2 },
  S: { code: "...", mnemonic: "su-per-man", level: 2 },
  T: { code: "-", mnemonic: "TALL", level: 1 },
  U: { code: "..-", mnemonic: "u-ni-FORM", level: 2 },
  V: { code: "...-", mnemonic: "vee-vee-vee-VAH", level: 3 },
  W: { code: ".--", mnemonic: "the-WORLD-WAR", level: 2 },
  X: { code: "-..-", mnemonic: "X-marks-the-SPOT", level: 3 },
  Y: { code: "-.--", mnemonic: "WHY did I DIE?", level: 3 },
  Z: { code: "--..", mnemonic: "ZSA ZSA did it", level: 3 },
  "1": { code: ".----", mnemonic: "ONE-dot-then-DASHES", level: 4 },
  "2": { code: "..---", mnemonic: "TWO-dots-then-DASHES", level: 4 },
  "3": { code: "...--", mnemonic: "THREE-dots-then-DASHES", level: 4 },
  "4": { code: "....-", mnemonic: "FOUR-dots-then-DASH", level: 4 },
  "5": { code: ".....", mnemonic: "FIVE-dots", level: 4 },
  "6": { code: "-....", mnemonic: "DASH-then-FOUR-dots", level: 4 },
  "7": { code: "--...", mnemonic: "TWO-DASHES-then-THREE-dots", level: 4 },
  "8": { code: "---..", mnemonic: "THREE-DASHES-then-TWO-dots", level: 4 },
  "9": { code: "----.", mnemonic: "FOUR-DASHES-then-DOT", level: 4 },
  "0": { code: "-----", mnemonic: "FIVE-DASHES", level: 4 }
};

// ../../../dit/packages/core/src/utils/retention.ts
var STREAK_DAILY_GOAL = 15;
var MASTERY_SCORE_MIN = 5;
var MASTERY_RECENT_WINDOW = 10;
var MASTERY_ACCURACY_MIN = 8;
var DAILY_ACTIVITY_RETENTION_DAYS = 60;
var TOTAL_CHARACTERS = Object.keys(MORSE_DATA).length;
var pad = (n) => String(n).padStart(2, "0");
var dateKey = (at) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
var daysBetween = (earlier, later) => {
  const [ey, em, ed] = earlier.split("-").map(Number);
  const [ly, lm, ld] = later.split("-").map(Number);
  const a = Date.UTC(ey, em - 1, ed);
  const b = Date.UTC(ly, lm - 1, ld);
  return Math.round((b - a) / 86400000);
};
var countsAnswer = (mode, isCorrect) => isCorrect && (mode === "practice" || mode === "listen");
var pruneDailyActivity = (activity, today) => {
  const pruned = {};
  Object.entries(activity).forEach(([key, entry]) => {
    if (daysBetween(key, today) < DAILY_ACTIVITY_RETENTION_DAYS) {
      pruned[key] = entry;
    }
  });
  return pruned;
};
var bumpStreak = (streak, today) => {
  const current = streak?.current ?? 0;
  const longest = streak?.longest ?? 0;
  const last = streak?.lastCountedDate ?? null;
  if (last === today) {
    return {
      current,
      longest: Math.max(longest, current),
      lastCountedDate: today
    };
  }
  const gap = last ? daysBetween(last, today) : null;
  const next = gap === 1 ? current + 1 : 1;
  return {
    current: next,
    longest: Math.max(longest, next),
    lastCountedDate: today
  };
};
var recordCorrectAnswer = (progress, input) => {
  const when = input.at ?? new Date;
  const today = dateKey(when);
  const previousActivity = progress.dailyActivity ?? {};
  const existing = previousActivity[today] ?? { correct: 0, modes: [] };
  const modes = existing.modes.includes(input.mode) ? existing.modes : [...existing.modes, input.mode];
  const updatedDay = { correct: existing.correct + 1, modes };
  const mergedActivity = {
    ...previousActivity,
    [today]: updatedDay
  };
  const dailyActivity = pruneDailyActivity(mergedActivity, today);
  const letterAccuracy = appendAttempt(progress.letterAccuracy, input.letter, true);
  const hitGoalToday = updatedDay.correct === STREAK_DAILY_GOAL;
  const alreadyHitGoal = progress.streak?.lastCountedDate === today && (progress.streak?.current ?? 0) > 0;
  const streak = hitGoalToday && !alreadyHitGoal ? bumpStreak(progress.streak, today) : progress.streak ?? {
    current: 0,
    longest: 0,
    lastCountedDate: null
  };
  return {
    ...progress,
    dailyActivity,
    letterAccuracy,
    streak
  };
};
var recordLetterAttempt = (progress, letter, isCorrect) => ({
  ...progress,
  letterAccuracy: appendAttempt(progress.letterAccuracy, letter, isCorrect)
});
var appendAttempt = (accuracy, letter, isCorrect) => {
  const previous = accuracy?.[letter]?.recent ?? [];
  const recent = [...previous, isCorrect].slice(-MASTERY_RECENT_WINDOW);
  return {
    ...accuracy ?? {},
    [letter]: { recent }
  };
};
var isMastered = (progress, letter) => {
  const score = progress.scores?.[letter] ?? 0;
  if (score < MASTERY_SCORE_MIN) {
    return false;
  }
  const recent = progress.letterAccuracy?.[letter]?.recent ?? [];
  if (recent.length < MASTERY_RECENT_WINDOW) {
    return false;
  }
  const correct = recent.filter(Boolean).length;
  return correct >= MASTERY_ACCURACY_MIN;
};
var masteredCount = (progress) => {
  let count = 0;
  Object.keys(MORSE_DATA).forEach((key) => {
    if (isMastered(progress, key)) {
      count += 1;
    }
  });
  return count;
};
var computeHero = (progress) => {
  if (progress.learnerProfile === "known") {
    return { kind: "wpm", value: progress.bestWpm ?? 0 };
  }
  return {
    kind: "mastered",
    count: masteredCount(progress),
    total: TOTAL_CHARACTERS
  };
};
var todayStreakContribution = (progress, at = new Date) => {
  const today = dateKey(at);
  const correct = progress.dailyActivity?.[today]?.correct ?? 0;
  const streakDate = progress.streak?.lastCountedDate ?? null;
  const current = progress.streak?.current ?? 0;
  const atRisk = current > 0 && streakDate !== today && correct < STREAK_DAILY_GOAL;
  return { correct, goal: STREAK_DAILY_GOAL, atRisk };
};
var updateBestWpm = (progress, wpm) => {
  if (!Number.isFinite(wpm) || wpm <= (progress.bestWpm ?? 0)) {
    return progress;
  }
  return { ...progress, bestWpm: Math.round(wpm * 10) / 10 };
};
var classifyLetter = (progress, letter) => {
  if (isMastered(progress, letter))
    return "mastered";
  const attempts = progress.letterAccuracy?.[letter]?.recent.length ?? 0;
  return attempts > 0 ? "learning" : "not-yet";
};
var RECOGNITION_FAST_MS = 200;
var RECOGNITION_SLOW_MS = 2000;
var getRecognitionFillRatio = (ttrMs) => {
  if (ttrMs == null || !Number.isFinite(ttrMs))
    return 0;
  if (ttrMs <= RECOGNITION_FAST_MS)
    return 1;
  if (ttrMs >= RECOGNITION_SLOW_MS)
    return 0;
  return 1 - (ttrMs - RECOGNITION_FAST_MS) / (RECOGNITION_SLOW_MS - RECOGNITION_FAST_MS);
};
var getAverageRecognitionMs = (progress, listenTtr) => {
  if (!listenTtr)
    return null;
  let sum = 0;
  let count = 0;
  for (const key of Object.keys(MORSE_DATA)) {
    const letter = key;
    if (!isMastered(progress, letter))
      continue;
    const entry = listenTtr[letter];
    if (!entry)
      continue;
    sum += entry.averageMs;
    count += 1;
  }
  if (count === 0)
    return null;
  return Math.round(sum / count);
};
export {
  MASTERY_ACCURACY_MIN,
  MASTERY_RECENT_WINDOW,
  MASTERY_SCORE_MIN,
  RECOGNITION_FAST_MS,
  RECOGNITION_SLOW_MS,
  STREAK_DAILY_GOAL,
  classifyLetter,
  computeHero,
  countsAnswer,
  dateKey,
  getAverageRecognitionMs,
  getRecognitionFillRatio,
  isMastered,
  recordCorrectAnswer,
  recordLetterAttempt,
  todayStreakContribution,
  updateBestWpm
};
