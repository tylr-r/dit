// Generated from core/apple-session.mjs by tools/bundle-apple-session.mjs.
var DitSession = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // core/apple-session.mjs
  var apple_session_exports = {};
  __export(apple_session_exports, {
    accountPayload: () => accountPayload,
    convertLegacy: () => convertLegacy,
    create: () => create,
    createAccount: () => createAccount
  });

  // modules/web/reference-morse.generated.mjs
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

  // modules/web/progression.mjs
  var PRACTICE_POOL = "TENRA";
  var delay = 3;
  var maxQueue = 24;
  function pickWeighted(pool, scores, previous, roll) {
    return pickWithWeights(pool, scores, previous, roll, () => 0);
  }
  function pickLatencyAware(pool, scores, ttr, previous, roll) {
    return pickWithWeights(pool, scores, previous, roll, (letter) => {
      const entry = ttr[letter];
      return entry?.samples >= 5 ? Math.min(2, Math.max(0, Math.round((entry.averageMs - 1e3) / 700))) : 0;
    });
  }
  function pickWithWeights(pool, scores, previous, roll, extra) {
    if (!pool.length) return previous;
    if (pool.length === 1) return pool[0];
    const max = Math.max(...[...pool].map((letter) => scores[letter] ?? 0));
    const weights = [...pool].map((letter) => 3 + Math.max(0, max - (scores[letter] ?? 0)) + extra(letter));
    let remaining = Math.max(0, Math.min(1, Number.isFinite(roll) ? roll : 0)) * weights.reduce((sum, n) => sum + n, 0);
    for (const [i, weight] of weights.entries()) {
      remaining -= weight;
      if (remaining <= 0) return pool[i] === previous ? pool[(i + 1) % pool.length] : pool[i];
    }
    return pool[pool.length - 1];
  }
  function enqueueReview(queue, letter) {
    if (queue.some((item) => item.letter === letter)) {
      return queue.map((item) => item.letter === letter ? { ...item, remaining: Math.min(delay, item.remaining) } : item);
    }
    return [...queue, { letter, remaining: delay }].slice(-maxQueue);
  }
  function pullReview(queue) {
    const stepped = queue.map((item) => ({ ...item, remaining: item.remaining - 1 }));
    const index = stepped.findIndex((item) => item.remaining <= 0);
    return index < 0 ? { queue: stepped, letter: null } : { queue: stepped.filter((_, i) => i !== index), letter: stepped[index].letter };
  }

  // modules/web/selection.mjs
  var own = (value, key2) => Object.hasOwn(value, key2);
  var tierSelection = (level) => ({ kind: "tier", level });
  var tierPool = (level) => Object.keys(MORSE_DATA).filter((char) => MORSE_DATA[char].level <= level).join("");
  var selectionPool = (selection, completed = false) => selection?.kind === "custom" ? selection.letters.join("") : selection?.kind === "tier" ? tierPool(selection.level) : completed ? tierPool(4) : PRACTICE_POOL;
  function normalizeSelection(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (value.kind === "tier" && Number.isInteger(value.level) && value.level >= 1 && value.level <= 4)
      return tierSelection(value.level);
    if (value.kind === "custom" && Array.isArray(value.letters) && value.letters.length && value.letters.length <= 36 && new Set(value.letters).size === value.letters.length && value.letters.every((ch) => typeof ch === "string" && own(MORSE_DATA, ch)))
      return { kind: "custom", letters: [...value.letters] };
    return null;
  }
  function protectedSelection(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = value.kind === "tier" ? ["kind", "level"] : value.kind === "custom" ? ["kind", "letters"] : null;
    return keys ? Object.keys(value).some((key2) => !keys.includes(key2)) : typeof value.kind === "string";
  }
  function scopeCommand(command) {
    if (typeof command !== "string") return null;
    if (/^scope-tier:[1-4]$/.test(command)) return tierSelection(Number(command.at(-1)));
    if (command.startsWith("scope-custom:")) return normalizeSelection({ kind: "custom", letters: [...command.slice(13)] });
    return null;
  }

  // modules/web/listen-speed.generated.mjs
  var WPM_RANGE = {
    min: 10,
    max: 30
  };
  var EFFECTIVE_WPM_RANGE = {
    min: 6,
    max: 30
  };
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
    const characterUnitMs2 = getListenUnitMs(characterWpm, minUnitMs);
    if (effectiveWpm >= characterWpm) {
      return characterUnitMs2;
    }
    const tFditSeconds = (300 * characterWpm - 186 * effectiveWpm) / (95 * characterWpm * effectiveWpm);
    return Math.max(Math.round(tFditSeconds * 1e3), characterUnitMs2, minUnitMs);
  };

  // modules/web/tempo.mjs
  var MIN_UNIT_MS = 40;
  var int = (value, fallback) => Number.isSafeInteger(value) ? value : fallback;
  function normalizeTempo(value) {
    const initialSpeed = int(value.speed, 12);
    const autoTighten = typeof value.autoTighten === "boolean" ? value.autoTighten : true;
    const autoCorrect = Math.max(0, Math.min(1e9, int(value.autoCorrect, 0)));
    const { characterWpm: speed, effectiveWpm: effectiveSpeed } = normalizeListenSpeeds(
      initialSpeed,
      int(value.effectiveSpeed, initialSpeed - 4)
    );
    return {
      speed,
      effectiveSpeed: autoTighten ? getAutoEffectiveWpm(speed, autoCorrect) : effectiveSpeed,
      autoTighten,
      autoCorrect
    };
  }
  function tempoStep(settings, command) {
    if (command === "toggle-auto-tighten") {
      const autoTighten = !settings.autoTighten;
      return {
        ...settings,
        autoTighten,
        effectiveSpeed: autoTighten ? getAutoEffectiveWpm(settings.speed, settings.autoCorrect) : settings.effectiveSpeed
      };
    }
    if (command === "auto-correct") {
      if (!settings.autoTighten) return settings;
      const autoCorrect = Math.min(1e9, settings.autoCorrect + 1);
      if (autoCorrect === settings.autoCorrect) return settings;
      return { ...settings, autoCorrect, effectiveSpeed: getAutoEffectiveWpm(settings.speed, autoCorrect) };
    }
    const changes = {
      "speed-up": [1, 0],
      "speed-down": [-1, 0],
      "effective-up": [0, 1],
      "effective-down": [0, -1]
    };
    if (!Object.hasOwn(changes, command)) return settings;
    const [character, effective] = changes[command];
    const { characterWpm: speed, effectiveWpm: effectiveSpeed } = normalizeListenSpeeds(
      settings.speed + character,
      settings.effectiveSpeed + effective
    );
    if (speed === settings.speed && effectiveSpeed === settings.effectiveSpeed) return settings;
    return { ...settings, speed, effectiveSpeed, autoTighten: false };
  }
  var characterUnitMs = (speed) => getListenUnitMs(speed, MIN_UNIT_MS);
  function tempoTiming(speed, effective) {
    const { characterWpm, effectiveWpm } = normalizeListenSpeeds(speed, effective);
    const unitMs = characterUnitMs(characterWpm);
    const spacing = getFarnsworthUnitMs(characterWpm, effectiveWpm, MIN_UNIT_MS);
    return { unitMs, characterGapMs: 3 * spacing, wordGapMs: 7 * spacing };
  }

  // modules/web/practice-store.mjs
  var STORE_KEY = "dit.exact-spike.practice.v1";
  var HISTORY_LIMIT = 200;
  var VERSION = 1;
  var MAX_INPUT_BYTES = 1e5;
  var MAX_SCORE = 1e9;
  var defaultSettings = () => ({
    ...normalizeTempo({}),
    pitch: 600,
    ifr: true,
    words: false,
    strategy: "sequential",
    reviewMisses: true
  });
  var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var bool = (value, fallback) => typeof value === "boolean" ? value : fallback;
  var int2 = (value, min, max, fallback) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  var activityModes = /* @__PURE__ */ new Set(["practice", "listen"]);
  var dateKeyValid = (key2) => {
    if (typeof key2 !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key2)) return false;
    const stamp = Date.parse(key2 + "T00:00:00Z");
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === key2;
  };
  var known = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  function normalizePractice(value) {
    const input = record(value) ? value : {};
    const raw = record(input.settings) ? input.settings : {};
    const settings = {
      ...normalizeTempo({ ...raw, speed: int2(raw.speed, 10, 30, 12) }),
      pitch: raw.pitch % 20 === 0 ? int2(raw.pitch, 400, 800, 600) : 600,
      ifr: bool(raw.ifr, true),
      words: bool(raw.words, false),
      strategy: raw.strategy === "weighted" ? "weighted" : "sequential",
      reviewMisses: bool(raw.reviewMisses, true)
    };
    for (const key2 of ["autoPlay", "showHint", "showMnemonic", "practiceWords"])
      if (typeof raw[key2] === "boolean") settings[key2] = raw[key2];
    const selection = normalizeSelection(raw.selection);
    if (selection) settings.selection = selection;
    if ([1, 2, 3, 4].includes(raw.maxLevel)) settings.maxLevel = raw.maxLevel;
    const scores = {};
    for (const letter of known) {
      if (!record(input.scores) || !Object.hasOwn(input.scores, letter)) continue;
      const score = int2(input.scores[letter], -MAX_SCORE, MAX_SCORE, void 0);
      if (score !== void 0) scores[letter] = score;
    }
    const history = (Array.isArray(input.history) ? input.history : []).slice(-HISTORY_LIMIT).filter((item) => record(item) && known.has(item.letter) && typeof item.correct === "boolean" && Number.isSafeInteger(item.atMs) && item.atMs >= 0).map(({ letter, correct, atMs, mode }) => ({ letter, correct, atMs, ...mode === "listen" ? { mode } : {} }));
    const letterAccuracy = {};
    if (record(input.letterAccuracy)) for (const letter of known) {
      const entry = input.letterAccuracy[letter];
      if (!record(entry) || !Array.isArray(entry.recent)) continue;
      if (entry.recent.every((item) => typeof item === "boolean"))
        letterAccuracy[letter] = { recent: entry.recent.slice(-10) };
    }
    const listenTtr = {};
    if (record(input.listenTtr)) for (const letter of known) {
      const entry = input.listenTtr[letter];
      if (!record(entry)) continue;
      const averageMs = int2(entry.averageMs, 0, 1e4, void 0);
      const samples = int2(entry.samples, 1, 300, void 0);
      if (averageMs !== void 0 && samples !== void 0) listenTtr[letter] = { averageMs, samples };
    }
    const metrics2 = {};
    if (Number.isFinite(input.bestWpm) && input.bestWpm >= 0) metrics2.bestWpm = input.bestWpm;
    if (record(input.dailyActivity)) {
      metrics2.dailyActivity = {};
      for (const [day, entry] of Object.entries(input.dailyActivity)) {
        if (!dateKeyValid(day) || !record(entry) || !Array.isArray(entry.modes) || entry.modes.length < 1 || new Set(entry.modes).size !== entry.modes.length || !entry.modes.every((mode) => activityModes.has(mode))) continue;
        const correct = int2(entry.correct, 1, Number.MAX_SAFE_INTEGER, void 0);
        if (correct !== void 0) metrics2.dailyActivity[day] = { correct, modes: entry.modes };
      }
    }
    if (record(input.streak)) {
      const { current, longest, lastCountedDate } = input.streak;
      if (int2(current, 0, Number.MAX_SAFE_INTEGER, void 0) !== void 0 && int2(longest, current, Number.MAX_SAFE_INTEGER, void 0) !== void 0 && (current === 0 ? lastCountedDate === null : dateKeyValid(lastCountedDate)))
        metrics2.streak = { current, longest, lastCountedDate };
    }
    return { settings, scores, history, letterAccuracy, listenTtr, ...metrics2 };
  }
  function loadPractice(storage) {
    let raw;
    try {
      raw = storage.getItem(STORE_KEY);
    } catch {
      return { status: "unavailable", data: normalizePractice(null) };
    }
    if (raw === null) return { status: "empty", data: normalizePractice(null) };
    if (raw.length > MAX_INPUT_BYTES) return { status: "oversized", data: normalizePractice(null) };
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
    }
    if (!record(value)) return { status: "reset", data: normalizePractice(null) };
    if (value.version !== VERSION) return { status: "newer", data: normalizePractice(null) };
    const data = normalizePractice(value);
    const practiceKeys = ["version", "settings", "scores", "history", "letterAccuracy", "listenTtr", "dailyActivity", "streak", "bestWpm"];
    const settingKeys = { ...defaultSettings(), selection: null, maxLevel: 3, autoPlay: true, showHint: false, showMnemonic: false, practiceWords: false };
    if (Object.keys(value).some((key2) => !practiceKeys.includes(key2)) || record(value.settings) && Object.keys(value.settings).some((key2) => !Object.hasOwn(settingKeys, key2)))
      return { status: "newer", data };
    if (protectedSelection(value.settings?.selection)) return { status: "newer", data };
    if (record(value.letterAccuracy) && Object.entries(value.letterAccuracy).some(([letter, entry]) => known.has(letter) && record(entry) && Object.keys(entry).some((key2) => key2 !== "recent")))
      return { status: "newer", data };
    if (record(value.listenTtr) && Object.entries(value.listenTtr).some(([letter, entry]) => known.has(letter) && record(entry) && Object.keys(entry).some((key2) => key2 !== "averageMs" && key2 !== "samples")))
      return { status: "newer", data };
    if (record(value.dailyActivity) && Object.entries(value.dailyActivity).some(([day, entry]) => dateKeyValid(day) && record(entry) && (Object.keys(entry).some((key2) => key2 !== "correct" && key2 !== "modes") || Array.isArray(entry.modes) && entry.modes.some((mode) => typeof mode === "string" && !activityModes.has(mode)))))
      return { status: "newer", data };
    if (record(value.streak) && Object.keys(value.streak).some((key2) => !["current", "longest", "lastCountedDate"].includes(key2)))
      return { status: "newer", data };
    const fields = (actual, normalized) => Object.entries(actual).every(([key2, entry]) => Object.hasOwn(normalized, key2) && JSON.stringify(entry) === JSON.stringify(normalized[key2]));
    const valid = record(value.settings) && fields(value.settings, data.settings) && record(value.scores) && fields(value.scores, data.scores) && Array.isArray(value.history) && JSON.stringify(value.history) === JSON.stringify(data.history) && (!Object.hasOwn(value, "letterAccuracy") || record(value.letterAccuracy) && fields(value.letterAccuracy, data.letterAccuracy)) && (!Object.hasOwn(value, "listenTtr") || record(value.listenTtr) && fields(value.listenTtr, data.listenTtr)) && (!Object.hasOwn(value, "dailyActivity") || record(value.dailyActivity) && fields(value.dailyActivity, data.dailyActivity)) && (!Object.hasOwn(value, "bestWpm") || value.bestWpm === data.bestWpm) && (!Object.hasOwn(value, "streak") || record(value.streak) && record(data.streak) && fields(value.streak, data.streak));
    return { status: valid ? "saved" : "reset", data };
  }
  function savePractice(storage, state) {
    const latest = loadPractice(storage).status;
    if (latest === "newer" || latest === "oversized" || latest === "unavailable") return latest;
    try {
      storage.setItem(STORE_KEY, JSON.stringify({ version: VERSION, ...normalizePractice(state) }));
      return "saved";
    } catch {
      return "unavailable";
    }
  }

  // modules/web/guided.mjs
  var GUIDED_PACKS = Object.freeze(["ET", "AN", "IM", "RS", "OD", "UW", "GK", "HL", "BC", "FP", "VX", "QYZ", "12345", "67890"].map((pack) => Object.freeze([...pack])));
  var COURSE_POOL = GUIDED_PACKS.flat().join("") + "J";
  var teachPraise = ["Got it \u{1F44D}", "Nice \u2728", "Good \u{1F64C}", "That's it \u{1F44F}", "Nailed it \u{1F3AF}"];
  var LAST_PACK = GUIDED_PACKS.length - 1;
  var GUIDED_KEY = "dit.exact-spike.guided.v1";
  var VERSION2 = 1;
  var PHASES = /* @__PURE__ */ new Set(["teach", "gate-practice", "practice", "gate-listen", "listen", "gate-retry", "gate-next", "complete"]);
  var progress = (teachCounts = {}) => ({
    teachCounts,
    practiceAttempts: 0,
    practiceCorrect: 0,
    practiceLetterCorrect: {},
    listenAttempts: 0,
    listenCorrect: 0,
    listenLetterCorrect: {}
  });
  var beginGuide = (pack = 0) => ({ pack, phase: "teach", progress: progress() });
  var completeGuide = () => ({ pack: LAST_PACK, phase: "complete", maxPackReached: GUIDED_PACKS.length, progress: progress() });
  var every = (pack, counts, min) => pack.every((letter) => (counts[letter] ?? 0) >= min);
  var add = (counts, letter) => ({ ...counts, [letter]: (counts[letter] ?? 0) + 1 });
  var guidePack = (state) => GUIDED_PACKS[state.pack];
  var guideReached = (state) => state.maxPackReached ?? state.pack;
  function selectGuidePack(state, pack) {
    if (!Number.isInteger(pack) || pack < 0 || pack > LAST_PACK) return state;
    return { ...beginGuide(pack), maxPackReached: Math.max(guideReached(state), pack) };
  }
  var guideUnlocked = (state) => GUIDED_PACKS.slice(0, state.pack + 1).flat();
  var guidePracticePool = (state, roll) => state.pack > 0 && roll >= 0.6 ? GUIDED_PACKS.slice(0, state.pack).flat() : guidePack(state);
  var teachTarget = (state) => guidePack(state).find((letter) => (state.progress.teachCounts[letter] ?? 0) < 2) ?? guidePack(state)[0];
  function guideAttempt(state, letter, correct) {
    const pack = guidePack(state);
    if (!(state.phase === "teach" ? pack : guideUnlocked(state)).includes(letter)) return state;
    const p2 = state.progress;
    if (state.phase === "teach") {
      if (!correct || (p2.teachCounts[letter] ?? 0) >= 2) return state;
      const teachCounts = add(p2.teachCounts, letter);
      return { ...state, phase: every(pack, teachCounts, 2) ? "gate-practice" : "teach", progress: { ...p2, teachCounts } };
    }
    if (state.phase === "practice") {
      const practiceAttempts = p2.practiceAttempts + 1;
      const practiceCorrect = p2.practiceCorrect + Number(correct);
      const practiceLetterCorrect = correct ? add(p2.practiceLetterCorrect, letter) : p2.practiceLetterCorrect;
      const done = correct && practiceAttempts >= 10 && practiceCorrect >= 8 && every(pack, practiceLetterCorrect, 2);
      return { ...state, phase: done ? "gate-listen" : "practice", progress: { ...p2, practiceAttempts, practiceCorrect, practiceLetterCorrect } };
    }
    if (state.phase === "listen") {
      const listenAttempts = p2.listenAttempts + 1;
      const listenCorrect = p2.listenCorrect + Number(correct);
      const listenLetterCorrect = correct ? add(p2.listenLetterCorrect, letter) : p2.listenLetterCorrect;
      const done = listenAttempts >= 6;
      const pass = listenCorrect >= 4 && every(pack, listenLetterCorrect, 1);
      return { ...state, phase: done ? pass ? "gate-next" : "gate-retry" : "listen", progress: { ...p2, listenAttempts, listenCorrect, listenLetterCorrect } };
    }
    return state;
  }
  function continueGuide(state) {
    switch (state.phase) {
      case "gate-practice":
      case "gate-retry":
        return { ...state, phase: "practice", progress: progress(state.progress.teachCounts) };
      case "gate-listen":
        return { ...state, phase: "listen" };
      case "gate-next":
        return state.pack + 1 < GUIDED_PACKS.length ? selectGuidePack(state, state.pack + 1) : completeGuide();
      default:
        return state;
    }
  }
  function decodeGuide(data) {
    if (!data || !Number.isInteger(data.pack) || data.pack < 0 || data.pack >= GUIDED_PACKS.length || !PHASES.has(data.phase)) return null;
    const pack = guidePack(data);
    const p2 = data.progress;
    const count = (n) => Number.isInteger(n) && n >= 0 && n <= 1e6;
    if (!p2 || !["practiceAttempts", "practiceCorrect", "listenAttempts", "listenCorrect"].every((key2) => count(p2[key2]))) return null;
    if (p2.practiceCorrect > p2.practiceAttempts || p2.listenCorrect > p2.listenAttempts || p2.listenAttempts > 6) return null;
    const counts = {};
    for (const key2 of ["teachCounts", "practiceLetterCorrect", "listenLetterCorrect"]) {
      const value = p2[key2];
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const allowed = key2 === "teachCounts" ? pack : guideUnlocked(data);
      if (Object.keys(value).some((letter) => !allowed.includes(letter) || !count(value[letter]))) return null;
      counts[key2] = Object.fromEntries(Object.entries(value));
    }
    if (Object.values(counts.teachCounts).some((value) => value > 2)) return null;
    if (Object.values(counts.practiceLetterCorrect).reduce((a, b2) => a + b2, 0) !== p2.practiceCorrect || Object.values(counts.listenLetterCorrect).reduce((a, b2) => a + b2, 0) !== p2.listenCorrect) return null;
    const reached = data.maxPackReached;
    if (reached !== void 0 && (!Number.isInteger(reached) || reached < data.pack || reached > GUIDED_PACKS.length || data.phase === "complete" && reached !== GUIDED_PACKS.length)) return null;
    if (data.phase === "complete" && data.pack === LAST_PACK && data.maxPackReached === GUIDED_PACKS.length && p2.practiceAttempts === 0 && p2.listenAttempts === 0 && !Object.keys(counts.teachCounts).length && !Object.keys(counts.practiceLetterCorrect).length && !Object.keys(counts.listenLetterCorrect).length)
      return completeGuide();
    const teachDone = every(pack, counts.teachCounts, 2);
    const practiceDone = p2.practiceAttempts >= 10 && p2.practiceCorrect >= 8 && every(pack, counts.practiceLetterCorrect, 2);
    const listenPass = p2.listenAttempts === 6 && p2.listenCorrect >= 4 && every(pack, counts.listenLetterCorrect, 1);
    const phase = data.phase;
    if (phase !== "teach" && !teachDone) return null;
    if (["gate-listen", "listen", "gate-next", "gate-retry", "complete"].includes(phase) && !practiceDone) return null;
    if ((phase === "gate-next" || phase === "complete") && !listenPass) return null;
    if (phase === "complete" && data.pack !== GUIDED_PACKS.length - 1) return null;
    if (phase === "gate-retry" && (p2.listenAttempts !== 6 || listenPass)) return null;
    if (phase === "listen" && p2.listenAttempts >= 6) return null;
    if (data.pack === LAST_PACK && (phase === "complete" || phase === "gate-next")) return completeGuide();
    return { pack: data.pack, phase, ...reached === void 0 ? {} : { maxPackReached: reached }, progress: {
      teachCounts: counts.teachCounts,
      practiceAttempts: p2.practiceAttempts,
      practiceCorrect: p2.practiceCorrect,
      practiceLetterCorrect: counts.practiceLetterCorrect,
      listenAttempts: p2.listenAttempts,
      listenCorrect: p2.listenCorrect,
      listenLetterCorrect: counts.listenLetterCorrect
    } };
  }
  var hasUnknownFields = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((key2) => !keys.includes(key2));
  function futureGuide(value) {
    const data = value.data;
    return hasUnknownFields(value, ["version", "data"]) || hasUnknownFields(data, ["pack", "phase", "maxPackReached", "progress"]) || typeof data?.phase === "string" && !PHASES.has(data.phase) || hasUnknownFields(data?.progress, Object.keys(progress()));
  }
  function readGuide(storage) {
    try {
      const raw = storage.getItem(GUIDED_KEY);
      if (raw === null) return { status: "empty", data: beginGuide() };
      if (raw.length > 1e5) return { status: "unsupported", data: beginGuide() };
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        return { status: "damaged", data: beginGuide() };
      }
      if (value?.version !== VERSION2 || futureGuide(value)) return { status: "unsupported", data: beginGuide() };
      const data = decodeGuide(value.data);
      return data ? { status: "saved", data, ...data.phase === "complete" && value.data.maxPackReached === void 0 ? { migrated: true } : {} } : { status: "damaged", data: beginGuide() };
    } catch {
      return { status: "unavailable", data: beginGuide() };
    }
  }
  function saveGuide(storage, data) {
    const { status } = readGuide(storage);
    if (status === "unsupported" || status === "unavailable") return status;
    try {
      storage.setItem(GUIDED_KEY, JSON.stringify({ version: VERSION2, data }));
      return "saved";
    } catch {
      return "unavailable";
    }
  }
  var TITLES = {
    teach: "Teach",
    practice: "Practice",
    listen: "Listen",
    "gate-practice": "Next up: Practice",
    "gate-listen": "Ready to listen",
    "gate-retry": "Keep going: Practice again",
    "gate-next": "New letters unlocked",
    complete: "Course complete"
  };
  function createGuide({ storage, setTimer, clearTimer, project, decode: decode2, play, score, pick, pickListenWeighted = pick, random = Math.random, startListen, stopListen, lock, completed = () => {
  } }) {
    const initial = readGuide(storage);
    let state = initial.data;
    let active = false;
    let allowed = false;
    let status = initial.migrated ? saveGuide(storage, state) : initial.status;
    let target = teachTarget(state);
    let waiting = false;
    let listenOn = false;
    let timer;
    let generation = 0;
    function projectCatalog() {
      const reached = guideReached(state);
      project("course-packs:" + GUIDED_PACKS.map((pack) => pack.join(" ")).join(";"));
      project("course-current:" + (state.pack + 1));
      project("course-lesson-mode:" + (state.phase === "listen" ? "listen" : "practice"));
      project("course-reached:" + Math.min(GUIDED_PACKS.length, reached + 1));
      project("course-learned:" + GUIDED_PACKS.slice(0, reached).map((_, i) => i + 1).join(","));
      project("course-graduated:" + Number(reached === GUIDED_PACKS.length));
      project("course-finished:" + Number(state.phase === "complete"));
    }
    const persist = (next2) => {
      if (next2 === state) return;
      state = next2;
      status = saveGuide(storage, state);
      project("guide-storage:" + status);
      projectCatalog();
    };
    const practiceTarget = (previous) => pick(guidePracticePool(state, state.pack > 0 ? random() : 0), previous);
    function render() {
      if (!active) return;
      const phase = state.phase;
      if (phase === "teach") project("teach-remaining:" + Math.max(0, 2 - (state.progress.teachCounts[target] ?? 0)));
      project("guide-phase:" + phase);
      project("guide-title:" + TITLES[phase]);
      const nextPack = phase === "gate-next" ? GUIDED_PACKS[state.pack + 1] : null;
      project("guide-pack:" + (nextPack ?? guidePack(state)).join(","));
      project("guide-pool:" + guideUnlocked(state).join(","));
      project("guide-target:" + (phase === "teach" || phase === "practice" ? target : ""));
    }
    function stop() {
      generation++;
      clearTimer(timer);
      waiting = false;
      lock(false);
      if (listenOn) stopListen();
      listenOn = false;
    }
    function finishCourse() {
      if (state.phase === "complete") return false;
      persist(completeGuide());
      active = allowed = false;
      completed(status);
      return true;
    }
    function activate() {
      if (active && allowed && !listenOn && state.phase === "gate-next" && state.pack === LAST_PACK) {
        finishCourse();
        return;
      }
      render();
      if (active && allowed && state.phase === "listen" && !listenOn) {
        listenOn = true;
        startListen();
      }
    }
    return {
      completed: () => state.phase === "complete",
      graduated: () => guideReached(state) === GUIDED_PACKS.length,
      projectCatalog,
      selectPack(pack) {
        const next2 = selectGuidePack(state, pack);
        if (next2 === state) return false;
        stop();
        persist(next2);
        target = teachTarget(state);
        project("guide-feedback:");
        activate();
        return true;
      },
      enter(canPlay) {
        if (state.phase === "complete") return false;
        active = true;
        allowed = canPlay;
        target = state.phase === "teach" ? teachTarget(state) : state.phase === "practice" ? practiceTarget() : guidePack(state)[0];
        project("guide-storage:" + status);
        activate();
      },
      leave() {
        stop();
        active = allowed = false;
      },
      blocked(blocked) {
        if (!active || blocked === !allowed) return;
        allowed = !blocked;
        if (blocked) {
          stop();
          project("guide-feedback:");
        } else {
          if (state.phase === "teach") target = teachTarget(state);
          activate();
        }
      },
      replay() {
        if (!active || !allowed || waiting || !["teach", "practice"].includes(state.phase)) return false;
        play(target);
        return true;
      },
      accept(code) {
        if (!active || !allowed || waiting || !["teach", "practice"].includes(state.phase)) return;
        const phase = state.phase;
        const correct = decode2(code) === target;
        persist(guideAttempt(state, target, correct));
        if (phase === "teach" && correct) {
          const total = Object.values(state.progress.teachCounts).reduce((sum, count) => sum + count, 0);
          project("teach-praise:" + teachPraise[(total - 1) % teachPraise.length]);
        }
        if (phase === "practice") score(target, correct, "practice");
        project("guide-feedback:" + (correct ? "Correct" : "Try again"));
        waiting = true;
        lock(true);
        if (!correct) play(target);
        const ticket = ++generation;
        timer = setTimer(() => {
          if (ticket !== generation) return;
          waiting = false;
          lock(false);
          project("guide-feedback:");
          if (state.phase === "teach") target = teachTarget(state);
          if (state.phase === "practice" && correct) target = practiceTarget(target);
          render();
        }, 1e3);
      },
      continue() {
        if (!active || !allowed || waiting || listenOn) return false;
        if (state.phase === "gate-next" && state.pack === LAST_PACK) return finishCourse();
        const next2 = continueGuide(state);
        if (next2 === state) return false;
        stop();
        persist(next2);
        target = state.phase === "teach" ? teachTarget(state) : state.phase === "practice" ? practiceTarget(target) : guidePack(state)[0];
        project("guide-feedback:");
        activate();
        return true;
      },
      recordListen(letter, correct, sample) {
        if (!listenOn || state.phase !== "listen") return;
        const next2 = guideAttempt(state, letter, correct);
        if (next2 === state) return;
        persist(next2);
        score(letter, correct, "listen", sample);
      },
      finishListenRound() {
        if (!listenOn || state.phase === "listen") return true;
        listenOn = false;
        stopListen();
        if (state.phase === "gate-next" && state.pack === LAST_PACK) {
          finishCourse();
        } else render();
        return false;
      },
      canKey: () => active && allowed && !waiting && ["teach", "practice"].includes(state.phase),
      isListening: () => listenOn,
      pool: () => guideUnlocked(state),
      pickListen(previous) {
        const pack = guidePack(state);
        return pack.find((letter) => (state.progress.listenLetterCorrect[letter] ?? 0) < 1) ?? pickListenWeighted(guideUnlocked(state), previous);
      }
    };
  }

  // modules/web/custom-text.generated.mjs
  var MORSE_DATA2 = {
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
  var SUPPORTED = /^[A-Z0-9]$/;
  var normalizeCustomText = (input, options = {}) => {
    const maxChars = options.maxChars ?? 2e3;
    let ignored = 0;
    let out = "";
    let lastWasSpace = true;
    for (const raw of input) {
      const upper = raw.toUpperCase();
      if (SUPPORTED.test(upper)) {
        out += upper;
        lastWasSpace = false;
        continue;
      }
      if (raw === " " || raw === `
` || raw === "	" || raw === "\r") {
        if (!lastWasSpace) {
          out += " ";
          lastWasSpace = true;
        }
        continue;
      }
      ignored += 1;
    }
    let truncated = false;
    if (out.length > maxChars) {
      out = out.slice(0, maxChars).trimEnd();
      truncated = true;
    } else {
      out = out.trimEnd();
    }
    return { normalized: out, ignored, truncated };
  };
  var textToMorseCode = (input, options = {}) => {
    const { normalized, ignored, truncated } = normalizeCustomText(input, options);
    if (normalized.length === 0) {
      return { code: "", normalized, ignored, truncated };
    }
    const words = normalized.split(" ");
    const code = words.map((word) => word.split("").map((char) => MORSE_DATA2[char].code).join(" ")).join(" / ");
    return { code, normalized, ignored, truncated };
  };

  // modules/web/custom-diff.generated.mjs
  var customListenDiff = (source, typed) => {
    const m2 = source.length;
    const n = typed.length;
    if (m2 === 0 && n === 0) {
      return { tokens: [], matched: 0, missed: 0, extra: 0, total: 0 };
    }
    if (m2 === 0) {
      return {
        tokens: [{ kind: "extra", text: typed }],
        matched: 0,
        missed: 0,
        extra: n,
        total: 0
      };
    }
    if (n === 0) {
      return {
        tokens: [{ kind: "miss", text: source }],
        matched: 0,
        missed: m2,
        extra: 0,
        total: m2
      };
    }
    const dp = Array.from({ length: m2 + 1 }, () => new Array(n + 1).fill(0));
    for (let i2 = m2 - 1; i2 >= 0; i2 -= 1) {
      for (let j3 = n - 1; j3 >= 0; j3 -= 1) {
        if (source[i2] === typed[j3]) {
          dp[i2][j3] = dp[i2 + 1][j3 + 1] + 1;
        } else {
          dp[i2][j3] = Math.max(dp[i2 + 1][j3], dp[i2][j3 + 1]);
        }
      }
    }
    const ops = [];
    let i = 0;
    let j2 = 0;
    while (i < m2 && j2 < n) {
      if (source[i] === typed[j2]) {
        ops.push({ kind: "eq", ch: source[i] });
        i += 1;
        j2 += 1;
      } else if (dp[i + 1][j2] >= dp[i][j2 + 1]) {
        ops.push({ kind: "src", ch: source[i] });
        i += 1;
      } else {
        ops.push({ kind: "tgt", ch: typed[j2] });
        j2 += 1;
      }
    }
    while (i < m2) {
      ops.push({ kind: "src", ch: source[i] });
      i += 1;
    }
    while (j2 < n) {
      ops.push({ kind: "tgt", ch: typed[j2] });
      j2 += 1;
    }
    const tokens = [];
    let matched = 0;
    let missed = 0;
    let extra = 0;
    let k2 = 0;
    while (k2 < ops.length) {
      const op = ops[k2];
      if (op.kind === "eq") {
        let run2 = "";
        while (k2 < ops.length && ops[k2].kind === "eq") {
          run2 += ops[k2].ch;
          matched += 1;
          k2 += 1;
        }
        tokens.push({ kind: "ok", text: run2 });
        continue;
      }
      if (op.kind === "src") {
        let run2 = "";
        while (k2 < ops.length && ops[k2].kind === "src") {
          run2 += ops[k2].ch;
          missed += 1;
          k2 += 1;
        }
        tokens.push({ kind: "miss", text: run2 });
        continue;
      }
      let run = "";
      while (k2 < ops.length && ops[k2].kind === "tgt") {
        run += ops[k2].ch;
        extra += 1;
        k2 += 1;
      }
      tokens.push({ kind: "extra", text: run });
    }
    return {
      tokens,
      matched,
      missed,
      extra,
      total: m2
    };
  };

  // modules/web/custom.mjs
  var CUSTOM_KEY = "dit.exact-spike.custom.v1";
  var LIMIT = 2e3;
  var DRAFT_LIMIT = 8e3;
  function customPlan(text, speed, effective) {
    const { unitMs: unit, characterGapMs, wordGapMs } = tempoTiming(speed, effective);
    const tokens = textToMorseCode(text).code.split(" ").filter(Boolean);
    const plan = [];
    let offset = 0;
    for (const [index, token] of tokens.entries()) {
      if (token === "/") {
        offset += wordGapMs;
        continue;
      }
      for (const [symbolIndex, symbol] of [...token].entries()) {
        const start = offset;
        offset += symbol === "." ? unit : 3 * unit;
        plan.push([start, offset]);
        if (symbolIndex < token.length - 1) offset += unit;
      }
      if (index < tokens.length - 1 && tokens[index + 1] !== "/") offset += characterGapMs;
    }
    return plan;
  }
  function load(storage) {
    try {
      const raw = storage.getItem(CUSTOM_KEY);
      if (raw === null) return { text: "", typeAlong: true, status: "empty" };
      if (raw.length > 2e4) return { text: "", typeAlong: true, status: "unsupported" };
      let v2;
      try {
        v2 = JSON.parse(raw);
      } catch {
        return { text: "", typeAlong: true, status: "damaged" };
      }
      if (v2?.version !== 1) return { text: "", typeAlong: true, status: "unsupported" };
      if (typeof v2.text !== "string" || typeof v2.typeAlong !== "boolean") return { text: "", typeAlong: true, status: "damaged" };
      return { text: normalizeCustomText(v2.text).normalized, typeAlong: v2.typeAlong, status: "saved" };
    } catch {
      return { text: "", typeAlong: true, status: "unavailable" };
    }
  }
  function createCustom({ storage, project, play, stop, pause, resume }) {
    let { text, typeAlong, status } = load(storage);
    let active = false;
    let phase = "editor";
    let typed = "";
    let lastResult = null;
    let generation = 0;
    let clockOperation = 0;
    const proj = (key2, value) => project("custom-" + key2 + ":" + value);
    const setPhase = (value) => {
      phase = value;
      proj("phase", phase);
    };
    function cancel() {
      generation++;
      clockOperation++;
      stop();
    }
    const clearReveal = () => {
      proj("reveal", "");
      proj("summary", "");
      proj("diff", "");
    };
    function prep() {
      cancel();
      typed = "";
      proj("copy", "");
      proj("typealong", Number(typeAlong));
      proj("chars", text.length);
      proj("words", text ? text.split(" ").length : 0);
      proj("storage", status);
      clearReveal();
      if (text) {
        proj("editor", "");
        setPhase("setup");
      } else {
        proj("editor", "");
        setPhase("editor");
      }
    }
    function saveLocal() {
      const before = load(storage).status;
      if (before === "unsupported" || before === "unavailable") {
        status = before;
        return;
      }
      try {
        storage.setItem(CUSTOM_KEY, JSON.stringify({ version: 1, text, typeAlong }));
        status = "saved";
      } catch {
        status = "unavailable";
      }
    }
    function edit(raw) {
      if (!active || phase !== "editor") return;
      lastResult = normalizeCustomText(raw.slice(0, DRAFT_LIMIT));
      proj("ignored", lastResult.ignored);
      proj("truncated", Number(lastResult.truncated || raw.length > DRAFT_LIMIT));
    }
    function start() {
      if (!active || !text || phase === "editor") return false;
      cancel();
      const token = generation;
      typed = "";
      proj("copy", "");
      clearReveal();
      setPhase("playing");
      play(text, () => {
        if (token === generation && active && (phase === "playing" || phase === "paused")) setPhase("ended");
      }, () => {
        if (token === generation && active && (phase === "playing" || phase === "paused")) setPhase("audio-error");
      });
      return true;
    }
    return {
      enter() {
        active = true;
        prep();
      },
      leave() {
        active = false;
        cancel();
        typed = "";
        proj("copy", "");
        proj("editor", "");
        clearReveal();
        setPhase("editor");
      },
      suspend() {
        if (active && phase !== "editor") prep();
      },
      edit(raw) {
        if (!active) return;
        if (typeof raw === "string") {
          edit(raw);
          return;
        }
        cancel();
        typed = "";
        proj("copy", "");
        clearReveal();
        setPhase("editor");
        proj("editor", text);
        edit(text);
      },
      discard() {
        if (active) prep();
      },
      toggleType() {
        if (!active || phase !== "editor") return;
        proj("typealong", Number(!typeAlong));
      },
      save(src, nextType = typeAlong) {
        if (!active || phase !== "editor") return;
        edit(src);
        text = lastResult?.normalized ?? "";
        typeAlong = Boolean(nextType);
        saveLocal();
        prep();
      },
      clear() {
        if (!active) return;
        text = "";
        saveLocal();
        prep();
      },
      play: start,
      copy(value) {
        if (!active || !typeAlong || !["playing", "ended"].includes(phase)) return false;
        typed = value.slice(0, LIMIT);
        return true;
      },
      async pause() {
        if (!active || phase !== "playing") return;
        const token = ++clockOperation;
        setPhase("paused");
        try {
          await pause();
        } catch {
          if (token === clockOperation && phase === "paused") setPhase("playing");
        }
      },
      async resume() {
        if (!active || phase !== "paused") return;
        const token = ++clockOperation;
        setPhase("playing");
        try {
          await resume();
        } catch {
          if (token === clockOperation && phase === "playing") setPhase("paused");
        }
      },
      reveal() {
        if (!active || !["playing", "paused", "ended"].includes(phase)) return;
        cancel();
        setPhase("reveal");
        proj("reveal", text);
        if (!typeAlong) return;
        const diff = customListenDiff(text, typed.toUpperCase().slice(0, LIMIT));
        proj("summary", diff.matched + "/" + diff.total + " matched \xB7 " + diff.missed + " missed \xB7 " + diff.extra + " extra");
        const esc = (value) => value.replaceAll("%", "%25").replaceAll("|", "%7C");
        proj("diff", diff.tokens.map((token) => token.kind + ":" + esc(token.text)).join("|"));
      }
    };
  }

  // modules/web/nux.mjs
  var NUX_KEY = "dit.exact-spike.onboarding.v1";
  var steps = ["welcome", "profile", "intro_fluency", "intro_listen", "intro_speed", "sound_check", "button_tutorial", "beginner_stages", "beginner_intro", "reminder", "known_tour"];
  var statuses = ["pending", "completed", "skipped"];
  var fresh = (status = "pending") => ({ version: 1, status, step: "welcome", profile: null, soundComplete: false, taps: 0, holds: 0 });
  var clamp = (n) => Number.isInteger(n) ? Math.max(0, Math.min(3, n)) : 0;
  var hasLegacyData = (storage) => [STORE_KEY, GUIDED_KEY, CUSTOM_KEY].some((key2) => storage.getItem(key2) !== null);
  function read(storage, hasPriorProgress = hasLegacyData) {
    try {
      const raw = storage.getItem(NUX_KEY);
      if (raw === null) {
        const existing = hasPriorProgress(storage);
        return { data: fresh(existing ? "skipped" : "pending"), saved: false, readOnly: false, storageStatus: "empty" };
      }
      if (raw.length > 16e3) return { data: fresh("skipped"), saved: false, readOnly: true, storageStatus: "unsupported" };
      let v2;
      try {
        v2 = JSON.parse(raw);
      } catch {
        return { data: fresh(), saved: false, readOnly: false, storageStatus: "empty" };
      }
      if (v2?.version !== 1 || Object.keys(v2).some((key2) => !Object.hasOwn(fresh(), key2))) return { data: fresh("skipped"), saved: false, readOnly: true, storageStatus: "unsupported" };
      const status = statuses.includes(v2.status) ? v2.status : "pending";
      const profile = ["beginner", "known"].includes(v2.profile) ? v2.profile : null;
      let step = steps.includes(v2.step) ? v2.step : "welcome";
      if (!profile && !["welcome", "profile"].includes(step)) step = "profile";
      if (step === "known_tour" && profile !== "known" || step.startsWith("beginner_") && profile !== "beginner") step = "profile";
      const soundComplete = v2.soundComplete === true;
      if (["button_tutorial", "beginner_stages", "beginner_intro", "reminder", "known_tour"].includes(step) && !soundComplete) step = "sound_check";
      const taps = clamp(v2.taps), holds = clamp(v2.holds);
      if (["beginner_stages", "beginner_intro", "reminder", "known_tour"].includes(step) && (taps !== 3 || holds !== 3)) step = "button_tutorial";
      return { data: { version: 1, status, step, profile, soundComplete, taps, holds }, saved: true, readOnly: false, storageStatus: "saved" };
    } catch {
      return { data: fresh(), saved: false, readOnly: true, storageStatus: "unavailable" };
    }
  }
  var readNux = (storage, hasPriorProgress) => read(storage, hasPriorProgress).data;
  function createNux({ storage, project, play, stop, warm = () => {
  }, setTimer, clearTimer, hasPriorProgress, ownsFresh = false, persistInferred = false, checkSound, reminder }) {
    const restored = read(storage, hasPriorProgress);
    let state = restored.data;
    let storageStatus = restored.storageStatus;
    let resume = state.status === "pending" && state.step !== "welcome" ? state.step : null;
    let owned = state.status === "pending" && (restored.saved || ownsFresh);
    if (state.status === "pending") state = { ...state, step: "welcome" };
    if (resume === "reminder" && !reminder) resume = state.profile === "known" ? "known_tour" : "beginner_intro";
    let reminderTime = "19:00";
    let exiting = false;
    let sound = state.soundComplete ? "heard" : "idle";
    let timer;
    let ticket = 0;
    let tourIndex = 0;
    const proj = (k2, v2) => project("nux-" + k2 + ":" + v2);
    const publish = () => {
      if (reminder) {
        proj("reminder-time", reminderTime);
        proj("reminder-exiting", Number(exiting));
      }
      proj("step", state.step);
      proj("profile", state.profile ?? "");
      proj("taps", state.taps);
      proj("holds", state.holds);
      proj("sound", sound);
      proj("resume", Number(Boolean(resume)));
      proj("tour", tourIndex);
      proj("owned", Number(owned));
      proj("storage", storageStatus);
      proj("status", state.status);
    };
    function save() {
      const available = read(storage, hasPriorProgress);
      if (available.readOnly) {
        storageStatus = available.storageStatus;
        return;
      }
      try {
        storage.setItem(NUX_KEY, JSON.stringify(state));
        storageStatus = "saved";
      } catch {
        storageStatus = "unavailable";
      }
    }
    function update(patch) {
      state = { ...state, ...patch };
      owned = state.status === "pending";
      save();
      publish();
    }
    function clearTicket() {
      ticket++;
      clearTimer(timer);
      timer = void 0;
      exiting = false;
    }
    function move(step, patch = {}) {
      clearTicket();
      stop();
      if (step === "button_tutorial") warm();
      if (step === "known_tour" || state.step === "known_tour") tourIndex = 0;
      update({ step, ...patch });
      if (step === "button_tutorial") ready();
    }
    function exitReminder(enable) {
      if (exiting) return;
      exiting = true;
      publish();
      const current = ++ticket;
      const perform = () => {
        if (current !== ticket || state.step !== "reminder") return;
        timer = void 0;
        if (enable) reminder.enable(reminderTime, (ok) => {
          if (current !== ticket) return;
          exiting = false;
          if (ok) afterReminder();
          else publish();
        });
        else afterReminder();
      };
      if (reminder.reducedMotion()) perform();
      else timer = setTimer(perform, 280);
    }
    function afterReminder() {
      if (state.status !== "pending" || state.step !== "reminder") return;
      if (state.profile === "known") move("known_tour");
      else finish("completed", "guided");
    }
    function finish(status, mode) {
      clearTicket();
      stop();
      resume = null;
      proj("enter", mode);
      update({ status, step: "welcome" });
    }
    function ready() {
      if (state.step !== "button_tutorial" || state.taps !== 3 || state.holds !== 3 || timer !== void 0) return;
      const current = ++ticket;
      timer = setTimer(() => {
        if (current !== ticket || state.step !== "button_tutorial") return;
        move(state.profile === "known" ? reminder ? "reminder" : "known_tour" : "beginner_stages");
      }, 600);
    }
    if (persistInferred && !restored.saved && !restored.readOnly && state.status === "skipped") save();
    return {
      project: publish,
      profile: () => state.profile,
      canKey: () => state.status === "pending" && state.step === "button_tutorial",
      symbol(symbol) {
        if (state.status !== "pending" || state.step !== "button_tutorial" || ![".", "-"].includes(symbol)) return;
        const k2 = symbol === "." ? "taps" : "holds";
        if (state[k2] < 3) update({ [k2]: state[k2] + 1 });
        ready();
      },
      act(command) {
        if (command === "replay") {
          reminder?.cancel();
          reminderTime = "19:00";
          clearTicket();
          stop();
          sound = "idle";
          resume = null;
          tourIndex = 0;
          update(fresh());
          return;
        }
        if (state.status !== "pending") return;
        if (command === "skip") {
          reminder?.cancel();
          finish("skipped", "practice");
          return;
        }
        if (command === "resume" && state.step === "welcome" && resume) {
          const step = resume;
          resume = null;
          move(step);
          return;
        }
        if (command === "start" && state.step === "welcome") {
          resume = null;
          move("profile");
          return;
        }
        if (["known", "beginner"].includes(command) && state.step === "profile") {
          move("intro_fluency", { profile: command });
          return;
        }
        if (command === "play" && state.step === "sound_check") {
          if (checkSound) {
            const result = checkSound();
            if (result === "heard") {
              sound = "heard";
              update({ soundComplete: true });
            } else if (!state.soundComplete) {
              sound = result;
              publish();
            }
            return;
          }
          if (sound !== "heard") sound = "played";
          publish();
          play();
          return;
        }
        if (command === "heard" && state.step === "sound_check" && sound !== "idle") {
          sound = "heard";
          update({ soundComplete: true });
          return;
        }
        if (command === "no-sound" && state.step === "sound_check" && sound !== "idle") {
          sound = "not_heard";
          update({ soundComplete: false });
          return;
        }
        if (reminder && state.step === "reminder") {
          if (command === "reminder-skip") {
            exitReminder(false);
            return;
          }
          if (command === "reminder-enable") {
            exitReminder(true);
            return;
          }
          if (!exiting && command.startsWith("reminder-time:") && reminder.validTime(command.slice(14))) {
            reminderTime = command.slice(14);
            publish();
            return;
          }
        }
        if (command === "tour-next" && state.step === "known_tour") {
          if (tourIndex < 2) {
            tourIndex++;
            publish();
          } else finish("completed", "practice");
          return;
        }
        if (command === "back") {
          if (state.step === "known_tour" && tourIndex > 0) {
            tourIndex--;
            publish();
            return;
          }
          if (reminder && state.step === "reminder") {
            reminder.cancel();
            if (state.profile === "known") move("button_tutorial", { taps: 0, holds: 0 });
            else move("beginner_intro");
            return;
          }
          if (reminder && state.step === "known_tour") {
            move("reminder");
            return;
          }
          const previous = {
            profile: "welcome",
            intro_fluency: "profile",
            intro_listen: "intro_fluency",
            intro_speed: "intro_listen",
            sound_check: "intro_speed",
            button_tutorial: "sound_check",
            beginner_stages: "button_tutorial",
            beginner_intro: "beginner_stages",
            known_tour: "button_tutorial"
          }[state.step];
          if (!previous) return;
          if (state.step === "sound_check") {
            sound = "idle";
            move(previous, { soundComplete: false });
            return;
          }
          if (["button_tutorial", "beginner_stages", "known_tour"].includes(state.step)) {
            move(previous, { taps: 0, holds: 0 });
            return;
          }
          move(previous);
          return;
        }
        if (command === "continue") {
          const next2 = {
            intro_fluency: "intro_listen",
            intro_listen: "intro_speed",
            intro_speed: "sound_check",
            beginner_stages: "beginner_intro",
            sound_check: sound === "heard" ? "button_tutorial" : void 0
          }[state.step];
          if (next2) {
            move(next2);
            return;
          }
          if (state.step === "beginner_intro") {
            if (reminder) move("reminder");
            else finish("completed", "guided");
          }
        }
      },
      close() {
        reminder?.cancel();
        clearTicket();
        stop();
      }
    };
  }

  // modules/web/reference-retention.generated.mjs
  var MORSE_DATA3 = {
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
  var STREAK_DAILY_GOAL = 15;
  var MASTERY_SCORE_MIN = 5;
  var MASTERY_RECENT_WINDOW = 10;
  var MASTERY_ACCURACY_MIN = 8;
  var DAILY_ACTIVITY_RETENTION_DAYS = 60;
  var TOTAL_CHARACTERS = Object.keys(MORSE_DATA3).length;
  var pad = (n) => String(n).padStart(2, "0");
  var dateKey = (at) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  var daysBetween = (earlier, later) => {
    const [ey, em, ed] = earlier.split("-").map(Number);
    const [ly, lm, ld] = later.split("-").map(Number);
    const a = Date.UTC(ey, em - 1, ed);
    const b2 = Date.UTC(ly, lm - 1, ld);
    return Math.round((b2 - a) / 864e5);
  };
  var countsAnswer = (mode, isCorrect) => isCorrect && (mode === "practice" || mode === "listen");
  var pruneDailyActivity = (activity, today) => {
    const pruned = {};
    Object.entries(activity).forEach(([key2, entry]) => {
      if (daysBetween(key2, today) < DAILY_ACTIVITY_RETENTION_DAYS) {
        pruned[key2] = entry;
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
    const next2 = gap === 1 ? current + 1 : 1;
    return {
      current: next2,
      longest: Math.max(longest, next2),
      lastCountedDate: today
    };
  };
  var recordCorrectAnswer = (progress2, input) => {
    const when = input.at ?? /* @__PURE__ */ new Date();
    const today = dateKey(when);
    const previousActivity = progress2.dailyActivity ?? {};
    const existing = previousActivity[today] ?? { correct: 0, modes: [] };
    const modes = existing.modes.includes(input.mode) ? existing.modes : [...existing.modes, input.mode];
    const updatedDay = { correct: existing.correct + 1, modes };
    const mergedActivity = {
      ...previousActivity,
      [today]: updatedDay
    };
    const dailyActivity = pruneDailyActivity(mergedActivity, today);
    const letterAccuracy = appendAttempt(progress2.letterAccuracy, input.letter, true);
    const hitGoalToday = updatedDay.correct === STREAK_DAILY_GOAL;
    const alreadyHitGoal = progress2.streak?.lastCountedDate === today && (progress2.streak?.current ?? 0) > 0;
    const streak = hitGoalToday && !alreadyHitGoal ? bumpStreak(progress2.streak, today) : progress2.streak ?? {
      current: 0,
      longest: 0,
      lastCountedDate: null
    };
    return {
      ...progress2,
      dailyActivity,
      letterAccuracy,
      streak
    };
  };
  var recordLetterAttempt = (progress2, letter, isCorrect) => ({
    ...progress2,
    letterAccuracy: appendAttempt(progress2.letterAccuracy, letter, isCorrect)
  });
  var appendAttempt = (accuracy, letter, isCorrect) => {
    const previous = accuracy?.[letter]?.recent ?? [];
    const recent = [...previous, isCorrect].slice(-MASTERY_RECENT_WINDOW);
    return {
      ...accuracy ?? {},
      [letter]: { recent }
    };
  };
  var isMastered = (progress2, letter) => {
    const score = progress2.scores?.[letter] ?? 0;
    if (score < MASTERY_SCORE_MIN) {
      return false;
    }
    const recent = progress2.letterAccuracy?.[letter]?.recent ?? [];
    if (recent.length < MASTERY_RECENT_WINDOW) {
      return false;
    }
    const correct = recent.filter(Boolean).length;
    return correct >= MASTERY_ACCURACY_MIN;
  };
  var masteredCount = (progress2) => {
    let count = 0;
    Object.keys(MORSE_DATA3).forEach((key2) => {
      if (isMastered(progress2, key2)) {
        count += 1;
      }
    });
    return count;
  };
  var computeHero = (progress2) => {
    if (progress2.learnerProfile === "known") {
      return { kind: "wpm", value: progress2.bestWpm ?? 0 };
    }
    return {
      kind: "mastered",
      count: masteredCount(progress2),
      total: TOTAL_CHARACTERS
    };
  };
  var todayStreakContribution = (progress2, at = /* @__PURE__ */ new Date()) => {
    const today = dateKey(at);
    const correct = progress2.dailyActivity?.[today]?.correct ?? 0;
    const streakDate = progress2.streak?.lastCountedDate ?? null;
    const current = progress2.streak?.current ?? 0;
    const atRisk = current > 0 && streakDate !== today && correct < STREAK_DAILY_GOAL;
    return { correct, goal: STREAK_DAILY_GOAL, atRisk };
  };
  var classifyLetter = (progress2, letter) => {
    if (isMastered(progress2, letter))
      return "mastered";
    const attempts = progress2.letterAccuracy?.[letter]?.recent.length ?? 0;
    return attempts > 0 ? "learning" : "not-yet";
  };
  var RECOGNITION_FAST_MS = 200;
  var RECOGNITION_SLOW_MS = 2e3;
  var getRecognitionFillRatio = (ttrMs) => {
    if (ttrMs == null || !Number.isFinite(ttrMs))
      return 0;
    if (ttrMs <= RECOGNITION_FAST_MS)
      return 1;
    if (ttrMs >= RECOGNITION_SLOW_MS)
      return 0;
    return 1 - (ttrMs - RECOGNITION_FAST_MS) / (RECOGNITION_SLOW_MS - RECOGNITION_FAST_MS);
  };
  var getAverageRecognitionMs = (progress2, listenTtr) => {
    if (!listenTtr)
      return null;
    let sum = 0;
    let count = 0;
    for (const key2 of Object.keys(MORSE_DATA3)) {
      const letter = key2;
      if (!isMastered(progress2, letter))
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

  // core/apple-reminder.mjs
  var REMINDER_KEY = "dit.exact-spike.reminder.v1";
  var validTime = (time) => typeof time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  function clockLabel(time) {
    const [hour, minute] = time.split(":");
    return (Number(hour) % 12 || 12) + ":" + minute + (Number(hour) < 12 ? " AM" : " PM");
  }
  function nextReminder(time, progress2, now) {
    const [hour, minute] = time.split(":").map(Number);
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    const { correct, goal } = todayStreakContribution(progress2, now);
    if (correct >= goal || target <= now) target.setDate(target.getDate() + 1);
    const streak = progress2.streak?.current ?? 0;
    return { at: target.getTime(), body: streak >= 1 ? "Keep your " + streak + "-day streak." : "Ready for a quick Morse session?" };
  }
  function read2(storage) {
    try {
      const raw = storage.getItem(REMINDER_KEY);
      if (raw === null) return { enabled: false, time: "19:00", writable: true };
      const v2 = JSON.parse(raw);
      if (v2?.version === 1 && typeof v2.enabled === "boolean" && validTime(v2.time) && Object.keys(v2).every((key2) => ["version", "enabled", "time"].includes(key2)))
        return { enabled: v2.enabled, time: v2.time, writable: true };
    } catch {
    }
    return { enabled: false, time: "19:00", writable: false };
  }
  function createReminder({ storage, host, project, progress: progress2 }) {
    let state = read2(storage);
    let serial = 0;
    let pending = null;
    let syncID = 0;
    let error = state.writable ? "" : "Saved reminder settings are unavailable.";
    function publish() {
      project("reminder-enabled:" + Number(state.enabled));
      project("reminder-time:" + state.time);
      project("reminder-busy:" + Number(Boolean(pending)));
      project("reminder-error:" + error);
    }
    function sync() {
      if (!state.writable) return;
      const plan = state.enabled ? nextReminder(state.time, progress2(), /* @__PURE__ */ new Date()) : null;
      host.syncReminder(++syncID, plan?.at ?? 0, plan?.body ?? "");
    }
    function save(enabled, time) {
      if (!validTime(time)) return false;
      try {
        if (!read2(storage).writable) throw Error("protected");
        storage.setItem(REMINDER_KEY, JSON.stringify({ version: 1, enabled, time }));
      } catch {
        ++syncID;
        error = "Could not save the reminder. Try again or continue without it.";
        publish();
        return false;
      }
      state = { enabled, time, writable: true };
      error = "";
      publish();
      sync();
      return true;
    }
    function cancel() {
      if (!pending) return;
      pending = null;
      host.cancelReminderRequest();
      publish();
    }
    return {
      publish,
      sync,
      cancel,
      enable(time, done) {
        if (pending || !validTime(time)) return;
        if (!read2(storage).writable) {
          error = "Saved reminder settings are unavailable.";
          publish();
          done?.(false);
          return;
        }
        pending = { id: ++serial, time, done };
        error = "";
        publish();
        host.requestReminder(serial);
      },
      permission(id, result) {
        if (id !== pending?.id) return;
        const { done, time } = pending;
        pending = null;
        if (result !== "granted" && result !== "denied") {
          error = "Could not check notification permission. Try again or continue without it.";
          publish();
          done?.(false);
        } else {
          const saved = save(result === "granted", time);
          done?.(saved);
        }
      },
      scheduled(id, result) {
        if (id !== syncID) return;
        const message = result === "error" ? "Could not schedule the reminder. Check notification settings and try again." : result === "denied" && state.enabled ? "Allow notifications in iOS Settings to receive your reminder." : "";
        if (message !== error && (message || state.enabled) && !pending) {
          error = message;
          publish();
        }
      },
      settings(command) {
        if (command === "reminder-on" && !state.enabled) this.enable(state.time);
        else if (command === "reminder-off") {
          cancel();
          save(false, state.time);
        } else if (command.startsWith("reminder-time:") && state.enabled) save(true, command.slice(14));
      }
    };
  }

  // core/apple-legacy.mjs
  var settingsMap = {
    practiceWordMode: "practiceWords",
    showHint: "showHint",
    showMnemonic: "showMnemonic",
    practiceAutoPlay: "autoPlay",
    toneFrequency: "pitch",
    listenWpm: "speed",
    listenEffectiveWpm: "effectiveSpeed",
    listenAutoTightening: "autoTighten",
    listenAutoTighteningCorrectCount: "autoCorrect",
    practiceIfrMode: "ifr",
    practiceReviewMisses: "reviewMisses",
    wordMode: "words"
  };
  var metrics = ["bestWpm", "scores", "letterAccuracy", "listenTtr", "dailyActivity", "streak"];
  var retained = ["bestWpm", "practiceAutoPlay", "practiceWordMode", "showHint", "showMnemonic", "nuxCompleted", "maxLevel"];
  var guideFields = ["guidedCourseActive", "guidedPackIndex", "guidedMaxPackReached", "guidedPhase", "guidedProgress"];
  var known2 = /* @__PURE__ */ new Set([
    ...Object.keys(settingsMap),
    ...metrics,
    ...retained,
    ...guideFields,
    "practiceLearnMode",
    "learnerProfile",
    "hapticsEnabled",
    "reminder",
    "customLetters",
    "updatedAt"
  ]);
  var record2 = (v2) => v2 !== null && typeof v2 === "object" && !Array.isArray(v2);
  var has = (v2, k2) => Object.hasOwn(v2, k2);
  function requireValue(ok) {
    if (!ok) throw Error("Unsupported legacy progress");
  }
  function same(a, b2) {
    if (a === b2) return true;
    if (!a || !b2 || typeof a !== "object" || typeof b2 !== "object" || Array.isArray(a) !== Array.isArray(b2)) return false;
    return Object.keys(a).length === Object.keys(b2).length && Object.keys(a).every((k2) => has(b2, k2) && same(a[k2], b2[k2]));
  }
  function object(raw) {
    const value = JSON.parse(raw);
    requireValue(record2(value));
    return value;
  }
  function practiceRecord(p2) {
    const settings = {};
    for (const [source, target] of Object.entries(settingsMap)) if (has(p2, source)) settings[target] = p2[source];
    if (has(p2, "practiceLearnMode")) {
      requireValue(typeof p2.practiceLearnMode === "boolean");
      settings.strategy = p2.practiceLearnMode ? "sequential" : "weighted";
    }
    if (has(p2, "maxLevel")) requireValue([1, 2, 3, 4].includes(p2.maxLevel));
    if (has(p2, "customLetters")) requireValue(Array.isArray(p2.customLetters));
    settings.selection = p2.customLetters?.length ? { kind: "custom", letters: p2.customLetters } : { kind: "tier", level: p2.maxLevel ?? 3 };
    if (settings.selection.kind === "custom") settings.maxLevel = p2.maxLevel ?? 3;
    const input = { settings };
    for (const k2 of metrics) if (has(p2, k2)) input[k2] = p2[k2];
    const normalized = normalizePractice(input);
    for (const k2 of Object.keys(settings)) requireValue(same(settings[k2], normalized.settings[k2]));
    for (const k2 of metrics) if (has(p2, k2)) requireValue(same(p2[k2], normalized[k2]));
    const value = JSON.stringify({ version: 1, ...normalized });
    requireValue(loadPractice({ getItem: () => value }).status === "saved");
    return value;
  }
  function guideRecord(p2) {
    const pack = has(p2, "guidedPackIndex") ? p2.guidedPackIndex : 0;
    requireValue(Number.isInteger(pack) && pack >= 0 && pack < GUIDED_PACKS.length);
    let phase = has(p2, "guidedPhase") ? p2.guidedPhase : "teach";
    requireValue(["teach", "practice", "listen", "complete"].includes(phase));
    const counters = has(p2, "guidedProgress") ? p2.guidedProgress : beginGuide(pack).progress;
    requireValue(record2(counters));
    const every2 = (counts, n) => GUIDED_PACKS[pack].every((l) => (counts?.[l] ?? 0) >= n);
    if (phase === "teach" && every2(counters.teachCounts, 2)) phase = "gate-practice";
    if (phase === "practice" && counters.practiceAttempts >= 10 && counters.practiceCorrect >= 8 && every2(counters.practiceLetterCorrect, 2))
      phase = "gate-listen";
    if (phase === "listen" && counters.listenAttempts === 6)
      phase = counters.listenCorrect >= 4 && every2(counters.listenLetterCorrect, 1) ? "gate-next" : "gate-retry";
    const data = { pack, phase, progress: counters, maxPackReached: has(p2, "guidedMaxPackReached") ? p2.guidedMaxPackReached : phase === "complete" ? GUIDED_PACKS.length : pack };
    const raw = JSON.stringify({ version: 1, data });
    const result = readGuide({ getItem: () => raw });
    requireValue(result.status === "saved" && same(data, result.data));
    return raw;
  }
  function onboarding(values, p2) {
    const explicit = values["dit-nux-status"];
    const returning = p2.guidedCourseActive || p2.learnerProfile || Object.values(p2.scores ?? {}).some((n) => n > 0);
    const status = explicit ?? (returning ? "skipped" : "pending");
    requireValue(["pending", "completed", "skipped"].includes(status));
    const result = { version: 1, status, step: "welcome", profile: p2.learnerProfile ?? null, soundComplete: false, taps: 0, holds: 0 };
    if (status === "pending" && has(values, "dit-nux-state")) {
      const state = object(values["dit-nux-state"]);
      requireValue(Object.keys(state).every((k2) => ["step", "learnerProfile", "didCompleteSoundCheck", "tutorialTapCount", "tutorialHoldCount"].includes(k2)));
      requireValue([
        "welcome",
        "profile",
        "intro_fluency",
        "intro_listen",
        "intro_speed",
        "sound_check",
        "button_tutorial",
        "beginner_stages",
        "beginner_intro",
        "reminder",
        "known_tour"
      ].includes(state.step));
      result.step = state.step;
      result.profile = state.learnerProfile ?? result.profile;
      requireValue([null, "beginner", "known"].includes(result.profile));
      result.soundComplete = state.didCompleteSoundCheck ?? false;
      requireValue(typeof result.soundComplete === "boolean");
      result.taps = state.tutorialTapCount ?? 0;
      result.holds = state.tutorialHoldCount ?? 0;
      for (const n of [result.taps, result.holds]) requireValue(Number.isInteger(n) && n >= 0 && n <= 3);
    }
    const raw = JSON.stringify(result);
    requireValue(same(readNux({ getItem: () => raw }), result));
    return raw;
  }
  function convertLegacy(values) {
    const p2 = has(values, "dit-progress") ? object(values["dit-progress"]) : {};
    requireValue(Object.keys(p2).every((k2) => known2.has(k2)));
    if (has(p2, "learnerProfile")) requireValue(["known", "beginner"].includes(p2.learnerProfile));
    if (has(p2, "guidedCourseActive")) requireValue(typeof p2.guidedCourseActive === "boolean");
    const preserved = {};
    for (const k2 of retained) if (has(p2, k2)) {
      if (k2 === "bestWpm") requireValue(typeof p2[k2] === "number" && Number.isFinite(p2[k2]) && p2[k2] >= 0);
      else if (k2 !== "maxLevel") requireValue(typeof p2[k2] === "boolean");
      preserved[k2] = p2[k2];
    }
    if (has(p2, "learnerProfile")) preserved.learnerProfile = p2.learnerProfile;
    if (has(p2, "updatedAt")) requireValue(Number.isSafeInteger(p2.updatedAt) && p2.updatedAt >= 0);
    const result = { [NUX_KEY]: onboarding(values, p2) };
    const hint = values["dit-intro-hint-step"];
    result["dit.exact-spike.intro-hint.v1"] = ["morse", "settings", "done"].includes(hint) ? hint : "morse";
    if (has(values, "dit-progress")) {
      result[STORE_KEY] = practiceRecord(p2);
      if (guideFields.some((k2) => has(p2, k2))) {
        requireValue(!(p2.guidedCourseActive && p2.guidedPhase === "complete"));
        result[GUIDED_KEY] = guideRecord(p2);
        result["dit.exact-spike.method.v1"] = p2.guidedCourseActive ? "guided" : "open";
      }
      if (has(p2, "hapticsEnabled")) {
        requireValue(typeof p2.hapticsEnabled === "boolean");
        result["dit.exact-spike.haptics.v1"] = String(p2.hapticsEnabled);
      }
      if (has(p2, "reminder")) {
        requireValue(record2(p2.reminder) && Object.keys(p2.reminder).every((k2) => ["time", "enabled"].includes(k2)) && typeof p2.reminder.enabled === "boolean" && validTime(p2.reminder.time));
        result[REMINDER_KEY] = JSON.stringify({ version: 1, ...p2.reminder });
      }
    }
    result["dit.exact-spike.legacy.v1"] = JSON.stringify({ version: 1, sourceUpdatedAt: p2.updatedAt ?? null, preserved });
    return result;
  }
  var methodKey = "dit.exact-spike.method.v1";
  var hapticsKey = "dit.exact-spike.haptics.v1";
  var receiptKey = "dit.exact-spike.legacy.v1";
  var wirePhase = { "gate-practice": "teach", "gate-listen": "practice", "gate-next": "listen", "gate-retry": "listen" };
  function accountOnboarding(records) {
    const storage = { getItem: (key2) => records[key2] ?? null };
    return readNux(storage, () => records[methodKey] === "guided" || !has(records, methodKey) && readGuide(storage).status === "saved" || Object.values(loadPractice(storage).data.scores).some((n) => n > 0));
  }
  function accountPayload(records) {
    const storage = { getItem: (key2) => records[key2] ?? null };
    const practice = loadPractice(storage);
    const guide = readGuide(storage);
    requireValue([practice, guide].every((item) => ["saved", "empty"].includes(item.status)));
    const { settings, ...data } = practice.data;
    const nux = accountOnboarding(records);
    if (has(records, NUX_KEY)) {
      const saved2 = object(records[NUX_KEY]);
      requireValue(saved2.version === 1 && Object.keys(saved2).every((k2) => same(saved2[k2], nux[k2])));
    }
    const receipt = has(records, receiptKey) ? object(records[receiptKey]) : null;
    if (receipt) requireValue(receipt.version === 1 && record2(receipt.preserved));
    const saved = receipt?.preserved ?? {};
    const level = settings.selection?.kind === "tier" ? settings.selection.level : settings.maxLevel ?? saved.maxLevel ?? 3;
    const result = {
      practiceAutoPlay: saved.practiceAutoPlay ?? true,
      practiceWordMode: saved.practiceWordMode ?? false,
      showHint: saved.showHint ?? false,
      showMnemonic: saved.showMnemonic ?? false,
      practiceLearnMode: settings.strategy === "sequential",
      maxLevel: level
    };
    for (const [source, target] of Object.entries(settingsMap)) if (has(settings, target)) result[source] = settings[target];
    for (const field of metrics) if (has(data, field)) result[field] = data[field];
    if (!has(result, "bestWpm") && has(saved, "bestWpm")) result.bestWpm = saved.bestWpm;
    if (settings.selection?.kind === "custom") result.customLetters = settings.selection.letters;
    if (nux.profile) result.learnerProfile = nux.profile;
    if (nux.status !== "pending") result.nuxCompleted = true;
    const method = records[methodKey];
    requireValue(method === void 0 || ["open", "guided"].includes(method));
    if (guide.status === "saved" || method) {
      const { phase, pack, progress: progress2, maxPackReached } = guide.data;
      Object.assign(result, {
        guidedCourseActive: phase !== "complete" && method !== "open",
        guidedPhase: wirePhase[phase] ?? phase,
        guidedPackIndex: pack,
        guidedProgress: progress2,
        guidedMaxPackReached: maxPackReached
      });
    }
    requireValue(!has(records, hapticsKey) || ["true", "false"].includes(records[hapticsKey]));
    result.hapticsEnabled = records[hapticsKey] !== "false";
    if (has(records, REMINDER_KEY)) {
      const { version, ...pref } = object(records[REMINDER_KEY]);
      requireValue(version === 1 && Object.keys(pref).length === 2 && validTime(pref.time) && typeof pref.enabled === "boolean");
      result.reminder = pref;
    } else result.reminder = { time: "19:00", enabled: false };
    return result;
  }
  function applyAccountPatch(records, patch) {
    requireValue(record2(patch) && Object.keys(patch).some((k2) => k2 !== "updatedAt") && Object.keys(patch).every((k2) => known2.has(k2)));
    const local = accountPayload(records);
    const merged = { ...local, ...patch };
    if (has(patch, "guidedMaxPackReached")) {
      requireValue(Number.isSafeInteger(patch.guidedMaxPackReached) && patch.guidedMaxPackReached >= 0 && patch.guidedMaxPackReached <= GUIDED_PACKS.length);
      merged.guidedMaxPackReached = Math.max(local.guidedMaxPackReached ?? 0, patch.guidedMaxPackReached);
    }
    if (["listenWpm", "listenAutoTightening", "listenAutoTighteningCorrectCount"].some((k2) => has(patch, k2)) && !has(patch, "listenEffectiveWpm")) merged.listenEffectiveWpm = normalizeTempo({
      speed: merged.listenWpm,
      effectiveSpeed: local.listenEffectiveWpm,
      autoTighten: merged.listenAutoTightening,
      autoCorrect: merged.listenAutoTighteningCorrectCount
    }).effectiveSpeed;
    const converted = convertLegacy({ "dit-progress": JSON.stringify(merged) });
    const next2 = { ...records };
    const previous = loadPractice({ getItem: (key2) => records[key2] ?? null }).data;
    const practice = JSON.parse(converted[STORE_KEY]);
    practice.history = previous.history;
    next2[STORE_KEY] = JSON.stringify(practice);
    for (const key2 of [GUIDED_KEY, methodKey, hapticsKey, REMINDER_KEY]) if (has(converted, key2)) next2[key2] = converted[key2];
    const nux = accountOnboarding(records);
    if (has(patch, "learnerProfile") && nux.profile !== patch.learnerProfile) {
      nux.profile = patch.learnerProfile;
      nux.step = "welcome";
    }
    if (nux.status === "pending" && (patch.nuxCompleted === true || patch.learnerProfile || patch.guidedCourseActive || Object.values(patch.scores ?? {}).some((n) => n > 0))) nux.status = "skipped";
    if (!has(next2, NUX_KEY) || !same(object(next2[NUX_KEY]), nux)) next2[NUX_KEY] = JSON.stringify(nux);
    return next2;
  }

  // core/apple-account.mjs
  var waitToSave = 800;
  var waitToRetry = 3e4;
  var syncTimer = -1;
  var validTime2 = (value) => Number.isSafeInteger(value) && value >= 0;
  function createAccountSession(host, createLocal, initial) {
    let state = JSON.parse(initial);
    if (state.version !== 1 || typeof state.dirty !== "boolean" || state.updatedAt !== null && !validTime2(state.updatedAt) || !state.records || Array.isArray(state.records) || typeof state.records !== "object" || Object.values(state.records).some((v2) => typeof v2 !== "string")) throw Error("Unsupported account store");
    accountPayload(state.records);
    let revision = null;
    let pending;
    let serial = 0;
    let closed = false;
    let replacing = false;
    let ready = false;
    let props;
    let interrupted = false;
    const project = (status) => host.project("account-sync:" + status);
    function commit(next2) {
      if (!host.accountCommit(JSON.stringify(next2))) throw Error("Account storage unavailable");
      state = next2;
    }
    function schedule(delay2) {
      host.cancelTimer(syncTimer);
      host.schedule(syncTimer, delay2);
    }
    const localHost = Object.create(host);
    localHost.read = (key2) => Object.hasOwn(state.records, key2) ? ["ok", state.records[key2]] : ["missing"];
    localHost.write = (key2, value) => {
      if (replacing || closed) return false;
      if (state.records[key2] === value) return true;
      try {
        const records = { ...state.records, [key2]: value };
        const changed = JSON.stringify(accountPayload(records)) !== JSON.stringify(accountPayload(state.records));
        const next2 = changed ? { version: 1, records, updatedAt: Math.max(host.wallTime(), (state.updatedAt ?? -1) + 1), dirty: true } : { ...state, records };
        commit(next2);
        if (changed && !pending && revision !== null) schedule(waitToSave);
        return true;
      } catch {
        project("storage-unavailable");
        return false;
      }
    };
    localHost.requestLocalReset = () => host.project("local-reset:error");
    let local = createLocal(localHost);
    function replaceLocal() {
      replacing = true;
      try {
        local.dispose();
        host.invalidateLocal();
      } finally {
        replacing = false;
      }
      local = createLocal(localHost);
      if (interrupted) local.interrupt(true);
      local.bootstrap();
      if (props) local.setProps(props);
    }
    function request() {
      if (pending || closed) return;
      if (revision !== null && !state.dirty) {
        project("current");
        return;
      }
      const kind = revision === null ? "read" : "save";
      const id = ++serial;
      pending = { kind, id, stamp: state.updatedAt };
      project(kind === "read" ? "loading" : "saving");
      const payload = kind === "save" ? JSON.stringify({ ...accountPayload(state.records), updatedAt: state.updatedAt }) : "";
      host.accountRequest(id, kind, revision ?? "", payload);
    }
    function response(id, status, token, raw) {
      if (closed || !pending || pending.id !== id) return;
      const { kind, stamp } = pending;
      pending = null;
      if (status !== "ok" || !token) {
        revision = null;
        project("retry");
        schedule(status === "conflict" ? 0 : waitToRetry);
        return;
      }
      try {
        if (kind === "save") {
          if (state.updatedAt === stamp) commit({ ...state, dirty: false });
        } else {
          const remote = raw === "" ? null : JSON.parse(raw);
          if (remote !== null && (typeof remote !== "object" || Array.isArray(remote) || remote.updatedAt !== void 0 && !validTime2(remote.updatedAt))) throw Error("Unsupported account progress");
          const records = remote === null ? null : applyAccountPatch(state.records, remote);
          if (remote === null || state.updatedAt !== null && (remote.updatedAt === void 0 || remote.updatedAt < state.updatedAt)) {
            if (state.updatedAt !== null && !state.dirty) commit({ ...state, dirty: true });
          } else {
            const changed = Object.entries(records).some(([k2, v2]) => state.records[k2] !== v2);
            commit({ version: 1, records, updatedAt: remote.updatedAt ?? host.wallTime(), dirty: false });
            if (changed) replaceLocal();
          }
        }
        revision = token;
        if (state.dirty) schedule(waitToSave);
        else project("current");
      } catch {
        revision = null;
        project("unavailable");
        schedule(waitToRetry);
      }
    }
    return {
      accountResult: response,
      bootstrap() {
        local.bootstrap();
        if (!ready) {
          ready = true;
          request();
        }
      },
      setProps(next2) {
        props = next2;
        local.setProps(next2);
      },
      timer(id) {
        if (id === syncTimer) request();
        else local.timer(id);
      },
      input(...args) {
        local.input(...args);
      },
      interrupt(value) {
        interrupted = value;
        local.interrupt(value);
      },
      permissionResult(...args) {
        local.permissionResult(...args);
      },
      scheduleResult(...args) {
        local.scheduleResult(...args);
      },
      foreground() {
        local.foreground();
        if (ready && !pending) {
          host.cancelTimer(syncTimer);
          revision = null;
          request();
        }
      },
      configuration() {
        return local.configuration();
      },
      dispose() {
        closed = true;
        pending = null;
        host.cancelTimer(syncTimer);
        local.dispose();
      }
    };
  }

  // modules/web/word-bank.generated.mjs
  var PRACTICE_WORDS = [
    "TIME",
    "TEAM",
    "TAME",
    "MEAN",
    "MEET",
    "TENT",
    "MINT",
    "NAME",
    "MEANT",
    "TEA",
    "EAT",
    "MET",
    "TEN",
    "HELLO",
    "WORLD",
    "MORSE",
    "CODE",
    "SIGNAL",
    "RADIO",
    "MESSAGE",
    "OPERATOR",
    "STATION",
    "CALL",
    "CALLSIGN",
    "CONTACT",
    "COPY",
    "REPEAT",
    "AGAIN",
    "READY",
    "STANDBY",
    "OVER",
    "OUT",
    "ROGER",
    "CONFIRM",
    "CHECK",
    "TEST",
    "REPORT",
    "STATUS",
    "RESPONSE",
    "ANSWER",
    "QUERY",
    "QUESTION",
    "UPDATE",
    "VERIFY",
    "CONFIRMED",
    "APPROVE",
    "CANCEL",
    "ABORT",
    "RETRY",
    "RESEND",
    "RELAY",
    "SEND",
    "LISTEN",
    "TRANSMIT",
    "RECEIVE",
    "EMERGENCY",
    "SOS",
    "URGENT",
    "PRIORITY",
    "HELP",
    "RESCUE",
    "MEDICAL",
    "INJURY",
    "SAFE",
    "DANGER",
    "WARNING",
    "ALERT",
    "MAYDAY",
    "WEATHER",
    "STORM",
    "WIND",
    "RAIN",
    "FOG",
    "SNOW",
    "FLOOD",
    "FIRE",
    "SMOKE",
    "POWER",
    "BATTERY",
    "CHARGE",
    "SOLAR",
    "GENERATOR",
    "LIGHT",
    "BEACON",
    "LOCATION",
    "POSITION",
    "LATITUDE",
    "LONGITUDE",
    "BEARING",
    "HEADING",
    "COURSE",
    "SPEED",
    "DISTANCE",
    "MILES",
    "KILOMETERS",
    "MAP",
    "COMPASS",
    "NORTH",
    "SOUTH",
    "EAST",
    "WEST",
    "GRID",
    "ROUTE",
    "PATH",
    "TRAIL",
    "CAMP",
    "BASE",
    "SHELTER",
    "SUPPLY",
    "WATER",
    "FOOD",
    "MEDICINE",
    "TOOL",
    "ENGINE",
    "MOTOR",
    "VEHICLE",
    "TRUCK",
    "BOAT",
    "SHIP",
    "PLANE",
    "DRONE",
    "HELICOPTER",
    "TRAVEL",
    "ARRIVAL",
    "DEPART",
    "DELAY",
    "WAIT",
    "GO",
    "STOP",
    "START",
    "BEGIN",
    "END",
    "CONTINUE",
    "HOLD",
    "PAUSE",
    "FAST",
    "SLOW",
    "QUIET",
    "LOUD",
    "CLEAR",
    "STRONG",
    "WEAK",
    "GOOD",
    "BAD",
    "YES",
    "NO",
    "OK",
    "THANKS",
    "PLEASE",
    "SORRY",
    "FRIEND",
    "FAMILY",
    "HOME",
    "WORK",
    "SCHOOL",
    "OFFICE",
    "NIGHT",
    "DAY",
    "MORNING",
    "EVENING",
    "LATE",
    "EARLY",
    "DATE",
    "HOUR",
    "MINUTE",
    "SECOND",
    "TODAY",
    "TOMORROW",
    "YESTERDAY",
    "NUMBER",
    "COUNT",
    "TOTAL",
    "FREQUENCY",
    "CHANNEL",
    "BAND",
    "ANTENNA",
    "RECEIVER",
    "TUNE",
    "VOLUME",
    "AUDIO",
    "STATIC",
    "NOISE",
    "DATA",
    "PACKET",
    "SECURE",
    "OPEN",
    "CLOSE",
    "GATE",
    "PORT",
    "HARBOR",
    "DOCK",
    "LAUNCH",
    "LAND",
    "SEA",
    "RIVER",
    "LAKE",
    "MOUNTAIN",
    "VALLEY",
    "HILL",
    "FOREST",
    "DESERT",
    "ISLAND",
    "COAST",
    "BEACH",
    "ROAD",
    "BRIDGE",
    "TUNNEL",
    "CITY",
    "TOWN",
    "VILLAGE",
    "FARM",
    "FIELD",
    "SITE",
    "ZONE",
    "AREA",
    "REGION",
    "BORDER",
    "LIMIT",
    "RANGE",
    "TARGET",
    "PERSON",
    "CREW",
    "UNIT",
    "GROUP",
    "LEADER",
    "COMMAND",
    "CONTROL",
    "CENTER",
    "CQ",
    "DE",
    "QSO",
    "QTH",
    "QSL",
    "RST"
  ];
  var LISTEN_PHRASES = [
    {
      id: "cq",
      text: "CQ",
      meaning: "Calling any station",
      difficulty: "short",
      parts: [{ code: "CQ", meaning: "calling any station" }]
    },
    {
      id: "de",
      text: "DE",
      meaning: "From, or this is",
      difficulty: "short",
      parts: [{ code: "DE", meaning: "from or this is" }]
    },
    {
      id: "r",
      text: "R",
      meaning: "Received correctly",
      difficulty: "short",
      parts: [{ code: "R", meaning: "received correctly" }]
    },
    {
      id: "73",
      text: "73",
      meaning: "Best regards",
      difficulty: "short",
      parts: [{ code: "73", meaning: "best regards" }]
    },
    {
      id: "fb",
      text: "FB",
      meaning: "Fine business; excellent",
      difficulty: "short",
      parts: [{ code: "FB", meaning: "fine business or excellent" }]
    },
    {
      id: "wx",
      text: "WX",
      meaning: "Weather",
      difficulty: "short",
      parts: [{ code: "WX", meaning: "weather" }]
    },
    {
      id: "pse",
      text: "PSE",
      meaning: "Please",
      difficulty: "medium",
      parts: [{ code: "PSE", meaning: "please" }]
    },
    {
      id: "tnx",
      text: "TNX",
      meaning: "Thanks",
      difficulty: "medium",
      parts: [{ code: "TNX", meaning: "thanks" }]
    },
    {
      id: "agn",
      text: "AGN",
      meaning: "Again",
      difficulty: "medium",
      parts: [{ code: "AGN", meaning: "again" }]
    },
    {
      id: "sri",
      text: "SRI",
      meaning: "Sorry",
      difficulty: "medium",
      parts: [{ code: "SRI", meaning: "sorry" }]
    },
    {
      id: "rig",
      text: "RIG",
      meaning: "Station equipment",
      difficulty: "medium",
      parts: [{ code: "RIG", meaning: "station equipment" }]
    },
    {
      id: "ant",
      text: "ANT",
      meaning: "Antenna",
      difficulty: "medium",
      parts: [{ code: "ANT", meaning: "antenna" }]
    },
    {
      id: "qrl",
      text: "QRL",
      meaning: "The frequency is in use",
      difficulty: "medium",
      parts: [{ code: "QRL", meaning: "frequency is in use; I am busy" }]
    },
    {
      id: "qrm",
      text: "QRM",
      meaning: "Interference from another station",
      difficulty: "medium",
      parts: [{ code: "QRM", meaning: "other-station interference" }]
    },
    {
      id: "qrn",
      text: "QRN",
      meaning: "Static or atmospheric noise",
      difficulty: "medium",
      parts: [{ code: "QRN", meaning: "static or atmospheric noise" }]
    },
    {
      id: "qrs",
      text: "QRS",
      meaning: "Send slower",
      difficulty: "medium",
      parts: [{ code: "QRS", meaning: "send slower" }]
    },
    {
      id: "qrq",
      text: "QRQ",
      meaning: "Send faster",
      difficulty: "medium",
      parts: [{ code: "QRQ", meaning: "send faster" }]
    },
    {
      id: "qrt",
      text: "QRT",
      meaning: "Stop sending",
      difficulty: "medium",
      parts: [{ code: "QRT", meaning: "stop sending or close the station" }]
    },
    {
      id: "qrv",
      text: "QRV",
      meaning: "Ready",
      difficulty: "medium",
      parts: [{ code: "QRV", meaning: "ready" }]
    },
    {
      id: "qrz",
      text: "QRZ",
      meaning: "Who is calling me?",
      difficulty: "medium",
      parts: [{ code: "QRZ", meaning: "who is calling me?" }]
    },
    {
      id: "qsl",
      text: "QSL",
      meaning: "Receipt acknowledged",
      difficulty: "medium",
      parts: [{ code: "QSL", meaning: "I acknowledge receipt" }]
    },
    {
      id: "qso",
      text: "QSO",
      meaning: "Radio contact",
      difficulty: "medium",
      parts: [{ code: "QSO", meaning: "radio contact or conversation" }]
    },
    {
      id: "qsy",
      text: "QSY",
      meaning: "Change frequency",
      difficulty: "medium",
      parts: [{ code: "QSY", meaning: "change frequency" }]
    },
    {
      id: "qth",
      text: "QTH",
      meaning: "Location",
      difficulty: "medium",
      parts: [{ code: "QTH", meaning: "location" }]
    }
  ];
  var radioSignals = /* @__PURE__ */ new Set(["CQ", "DE", "QSO", "QTH", "QSL", "RST", "SOS"]);
  var LISTEN_WORD_BANKS = {
    common: PRACTICE_WORDS.filter((word) => !radioSignals.has(word)).map((word) => ({
      id: `word-${word.toLowerCase()}`,
      text: word,
      difficulty: word.length <= 4 ? "short" : word.length <= 6 ? "medium" : "long",
      parts: []
    })),
    "q-codes": LISTEN_PHRASES.filter((word) => /^Q[A-Z]{2}$/.test(word.text))
  };

  // modules/web/recognition.generated.mjs
  var p = 200;
  var f = 1;
  var S = 7;
  var T = { min: 10, max: 30 };
  var m = { min: 6, max: 30 };
  var E = { A: { code: ".-", mnemonic: "a-PART", level: 1 }, B: { code: "-...", mnemonic: "BOB-is-the-uncle", level: 3 }, C: { code: "-.-.", mnemonic: "CO-ca-CO-la", level: 3 }, D: { code: "-..", mnemonic: "DOG-did-it", level: 2 }, E: { code: ".", mnemonic: "eh?", level: 1 }, F: { code: "..-.", mnemonic: "fetch-a-FIRE-man", level: 3 }, G: { code: "--.", mnemonic: "GRAND-MA-g", level: 2 }, H: { code: "....", mnemonic: "hip-pi-ty-hop", level: 3 }, I: { code: "..", mnemonic: "i-bid", level: 1 }, J: { code: ".---", mnemonic: "let's JUMP, JUMP, JUMP", level: 3 }, K: { code: "-.-", mnemonic: "KICK the CAN", level: 2 }, L: { code: ".-..", mnemonic: "a LIGHT is lit", level: 3 }, M: { code: "--", mnemonic: "MA-MA", level: 1 }, N: { code: "-.", mnemonic: "NA-vy", level: 1 }, O: { code: "---", mnemonic: "OH-MY-GOD", level: 2 }, P: { code: ".--.", mnemonic: "a-POO-PY-smell", level: 3 }, Q: { code: "--.-", mnemonic: "GOD-SAVE-the-QUEEN", level: 3 }, R: { code: ".-.", mnemonic: "ro-TA-tion", level: 2 }, S: { code: "...", mnemonic: "su-per-man", level: 2 }, T: { code: "-", mnemonic: "TALL", level: 1 }, U: { code: "..-", mnemonic: "u-ni-FORM", level: 2 }, V: { code: "...-", mnemonic: "vee-vee-vee-VAH", level: 3 }, W: { code: ".--", mnemonic: "the-WORLD-WAR", level: 2 }, X: { code: "-..-", mnemonic: "X-marks-the-SPOT", level: 3 }, Y: { code: "-.--", mnemonic: "WHY did I DIE?", level: 3 }, Z: { code: "--..", mnemonic: "ZSA ZSA did it", level: 3 }, "1": { code: ".----", mnemonic: "ONE-dot-then-DASHES", level: 4 }, "2": { code: "..---", mnemonic: "TWO-dots-then-DASHES", level: 4 }, "3": { code: "...--", mnemonic: "THREE-dots-then-DASHES", level: 4 }, "4": { code: "....-", mnemonic: "FOUR-dots-then-DASH", level: 4 }, "5": { code: ".....", mnemonic: "FIVE-dots", level: 4 }, "6": { code: "-....", mnemonic: "DASH-then-FOUR-dots", level: 4 }, "7": { code: "--...", mnemonic: "TWO-DASHES-then-THREE-dots", level: 4 }, "8": { code: "---..", mnemonic: "THREE-DASHES-then-TWO-dots", level: 4 }, "9": { code: "----.", mnemonic: "FOUR-DASHES-then-DOT", level: 4 }, "0": { code: "-----", mnemonic: "FIVE-DASHES", level: 4 } };
  var O = ["TIME", "TEAM", "TAME", "MEAN", "MEET", "TENT", "MINT", "NAME", "MEANT", "TEA", "EAT", "MET", "TEN", "HELLO", "WORLD", "MORSE", "CODE", "SIGNAL", "RADIO", "MESSAGE", "OPERATOR", "STATION", "CALL", "CALLSIGN", "CONTACT", "COPY", "REPEAT", "AGAIN", "READY", "STANDBY", "OVER", "OUT", "ROGER", "CONFIRM", "CHECK", "TEST", "REPORT", "STATUS", "RESPONSE", "ANSWER", "QUERY", "QUESTION", "UPDATE", "VERIFY", "CONFIRMED", "APPROVE", "CANCEL", "ABORT", "RETRY", "RESEND", "RELAY", "SEND", "LISTEN", "TRANSMIT", "RECEIVE", "EMERGENCY", "SOS", "URGENT", "PRIORITY", "HELP", "RESCUE", "MEDICAL", "INJURY", "SAFE", "DANGER", "WARNING", "ALERT", "MAYDAY", "WEATHER", "STORM", "WIND", "RAIN", "FOG", "SNOW", "FLOOD", "FIRE", "SMOKE", "POWER", "BATTERY", "CHARGE", "SOLAR", "GENERATOR", "LIGHT", "BEACON", "LOCATION", "POSITION", "LATITUDE", "LONGITUDE", "BEARING", "HEADING", "COURSE", "SPEED", "DISTANCE", "MILES", "KILOMETERS", "MAP", "COMPASS", "NORTH", "SOUTH", "EAST", "WEST", "GRID", "ROUTE", "PATH", "TRAIL", "CAMP", "BASE", "SHELTER", "SUPPLY", "WATER", "FOOD", "MEDICINE", "TOOL", "ENGINE", "MOTOR", "VEHICLE", "TRUCK", "BOAT", "SHIP", "PLANE", "DRONE", "HELICOPTER", "TRAVEL", "ARRIVAL", "DEPART", "DELAY", "WAIT", "GO", "STOP", "START", "BEGIN", "END", "CONTINUE", "HOLD", "PAUSE", "FAST", "SLOW", "QUIET", "LOUD", "CLEAR", "STRONG", "WEAK", "GOOD", "BAD", "YES", "NO", "OK", "THANKS", "PLEASE", "SORRY", "FRIEND", "FAMILY", "HOME", "WORK", "SCHOOL", "OFFICE", "NIGHT", "DAY", "MORNING", "EVENING", "LATE", "EARLY", "DATE", "HOUR", "MINUTE", "SECOND", "TODAY", "TOMORROW", "YESTERDAY", "NUMBER", "COUNT", "TOTAL", "FREQUENCY", "CHANNEL", "BAND", "ANTENNA", "RECEIVER", "TUNE", "VOLUME", "AUDIO", "STATIC", "NOISE", "DATA", "PACKET", "SECURE", "OPEN", "CLOSE", "GATE", "PORT", "HARBOR", "DOCK", "LAUNCH", "LAND", "SEA", "RIVER", "LAKE", "MOUNTAIN", "VALLEY", "HILL", "FOREST", "DESERT", "ISLAND", "COAST", "BEACH", "ROAD", "BRIDGE", "TUNNEL", "CITY", "TOWN", "VILLAGE", "FARM", "FIELD", "SITE", "ZONE", "AREA", "REGION", "BORDER", "LIMIT", "RANGE", "TARGET", "PERSON", "CREW", "UNIT", "GROUP", "LEADER", "COMMAND", "CONTROL", "CENTER", "CQ", "DE", "QSO", "QTH", "QSL", "RST"];
  var A = Object.keys(E);
  var g = (e) => A.filter((t) => E[t].level <= e);
  var y = (e, t) => {
    if (e.length === 0) return A[0];
    if (e.length === 1) return e[0];
    if (!t || !e.includes(t)) return e[Math.floor(Math.random() * e.length)];
    let n = t;
    while (n === t) n = e[Math.floor(Math.random() * e.length)];
    return n;
  };
  var P = (e) => {
    let t = new Set(e), n = O.filter((o) => o.split("").every((r) => t.has(r)));
    return n.length > 0 ? n : e.map((o) => o);
  };
  var D = (e, t) => {
    if (e.length === 0) return A[0];
    if (e.length === 1) return e[0];
    if (!t || !e.includes(t)) return e[Math.floor(Math.random() * e.length)];
    let n = t;
    while (n === t) n = e[Math.floor(Math.random() * e.length)];
    return n;
  };
  var G = 3;
  var U = p * f;
  var F = p * S;
  var Ae = F - U;
  var Le = T.min;
  var fe = T.max;
  var Se = m.min;
  var Ne = m.max;
  var W = 0.25;
  var H = 1e4;
  var w = 300;
  var v = 1200;
  var k = 2200;
  var Me = 24;
  var Ie = 3;
  var Ge = Object.keys(E).filter((e) => /^[A-Z]$/.test(e));
  var b = (e) => Math.max(0, Math.min(H, Math.round(e)));
  var ke = (e, t, n, o = 1) => {
    if (!Number.isFinite(n) || o <= 0) return e;
    let r = b(n), c = Math.max(1, Math.round(o)), s = e[t];
    if (!s) return { ...e, [t]: { averageMs: r, samples: c } };
    let u = Math.min(0.85, W * c), a = b(s.averageMs * (1 - u) + r * u), l = Math.min(w, s.samples + c);
    return { ...e, [t]: { averageMs: a, samples: l } };
  };
  var Ye = (e) => {
    if (e >= k) return 2;
    if (e >= v) return 1;
    return 0;
  };
  var Be = (e, t, n, o) => {
    if (n <= 0 || e.length >= o) return e;
    let r = [...e];
    for (let c = 0; c < n && r.length < o; c += 1) r.push(t);
    return r;
  };
  var Ve = (e, t, n) => {
    if (e.length === 0) return { nextQueue: e, reviewLetter: null };
    let o = new Set(t), r = e.filter((a) => o.has(a));
    if (r.length === 0) return { nextQueue: r, reviewLetter: null };
    let c = r.findIndex((a) => a !== n), s = c >= 0 ? c : 0, u = r[s];
    return { nextQueue: r.filter((a, l) => l !== s), reviewLetter: u };
  };
  var j = () => {
    let e = g(G), t = D(P(e));
    return { letter: y(e), practiceWord: t };
  };
  var Ke = j();

  // modules/web/reference.mjs
  var ordered = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var referencePattern = (letter) => typeof letter === "string" && Object.hasOwn(MORSE_DATA, letter) ? MORSE_DATA[letter].code : null;
  function buildReference({ scores, letterAccuracy, history }) {
    const result = { mastered: [], learning: [], noEvidence: [], recentSend: 0, recentListen: 0 };
    const buckets = { mastered: "mastered", learning: "learning", "not-yet": "noEvidence" };
    for (const letter of ordered) result[buckets[classifyLetter({ scores, letterAccuracy }, letter)]].push(letter);
    for (const attempt of history) result[attempt.mode === "listen" ? "recentListen" : "recentSend"]++;
    return result;
  }
  function buildRecognition({ scores, letterAccuracy, listenTtr }) {
    return {
      average: getAverageRecognitionMs({ scores, letterAccuracy }, listenTtr),
      bars: [...ordered].flatMap((letter) => {
        const entry = listenTtr?.[letter];
        if (!entry) return [];
        const floor = classifyLetter({ scores, letterAccuracy }, letter) === "mastered" ? 0.05 : 0;
        const fill = Math.round(Math.max(floor, getRecognitionFillRatio(entry.averageMs)) * 100);
        return [{ letter, ...entry, fill }];
      })
    };
  }

  // modules/web/session.mjs
  var codes = [
    ".-",
    "-...",
    "-.-.",
    "-..",
    ".",
    "..-.",
    "--.",
    "....",
    "..",
    ".---",
    "-.-",
    ".-..",
    "--",
    "-.",
    "---",
    ".--.",
    "--.-",
    ".-.",
    "...",
    "-",
    "..-",
    "...-",
    ".--",
    "-..-",
    "-.--",
    "--..",
    "-----",
    ".----",
    "..---",
    "...--",
    "....-",
    ".....",
    "-....",
    "--...",
    "---..",
    "----."
  ];
  var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var byCharacter = new Map([...alphabet].map((char, i) => [char, codes[i]]));
  var byCode = new Map(codes.map((code, i) => [code, alphabet[i]]));
  var decode = (code) => byCode.get(code) ?? null;
  var playbackUnitMs = characterUnitMs;
  var feedbackMs = 1e3;
  var extraWordGapMs = 1200;
  var next = (pool, target) => pool[(pool.indexOf(target) + 1) % pool.length];
  function replayPlan(char, unitMs) {
    const code = byCharacter.get(char);
    if (!code) return [];
    let offset = 0;
    return [...code].map((symbol) => {
      const start = offset;
      const end = start + (symbol === "-" ? 3 : 1) * unitMs;
      offset = end + unitMs;
      return [start, end];
    });
  }
  function newPracticeWord(pool, previous, roll = 0) {
    const available = new Set(pool);
    let choices = PRACTICE_WORDS.filter((word2) => [...word2].every((letter) => available.has(letter)));
    if (!choices.length) choices = [...pool];
    if (choices.length > 1) choices = choices.filter((word2) => word2 !== previous);
    const word = choices[Math.min(choices.length - 1, Math.floor(roll * choices.length))];
    return { practiceWord: word, practiceIndex: 0, wordStartMs: null, target: word[0] };
  }
  function advanceWord(state, event) {
    const nextIndex = state.practiceIndex + 1;
    if (nextIndex < state.practiceWord.length)
      return { practiceIndex: nextIndex, target: state.practiceWord[nextIndex] };
    const next2 = newPracticeWord(state.studyPool, state.practiceWord, event.roll);
    const elapsed = event.monoMs - state.wordStartMs;
    if (Number.isFinite(state.wordStartMs) && Number.isFinite(elapsed) && elapsed > 0) {
      next2.practiceWpm = Math.round(state.practiceWord.length / 5 * 6e4 / elapsed * 10) / 10;
      if (next2.practiceWpm > (state.bestWpm ?? 0)) next2.bestWpm = next2.practiceWpm;
    }
    return next2;
  }
  function initialSession(data, courseComplete = false, cleanInstall = false, initialRoll = 0) {
    const { settings, scores, history, letterAccuracy, listenTtr, dailyActivity, streak, bestWpm } = normalizePractice(data);
    if (cleanInstall && !settings.selection) settings.selection = tierSelection(courseComplete ? 4 : 3);
    const studyPool = selectionPool(settings.selection, courseComplete);
    const draw = Math.max(0, Math.min(studyPool.length - 1, Math.floor(initialRoll * studyPool.length)));
    const target = cleanInstall ? studyPool[draw] : settings.selection?.kind === "custom" ? studyPool[0] : studyPool.includes(PRACTICE_POOL[0]) ? PRACTICE_POOL[0] : studyPool[0];
    return {
      mode: "practice",
      studyPool,
      target,
      score: Object.values(scores).reduce((a, b2) => a + b2, 0),
      scores,
      history,
      letterAccuracy,
      listenTtr,
      dailyActivity,
      streak,
      settings,
      reviewQueue: [],
      feedback: "",
      outcome: null,
      transcript: "",
      freestyleInput: "",
      advance: false,
      bestWpm,
      ...settings.practiceWords ? newPracticeWord(studyPool, null, initialRoll) : {}
    };
  }
  function stepSession(state, event) {
    const keep = { state, effects: [] };
    const update = (patch, ...effects) => ({ state: { ...state, ...patch }, effects });
    const scored = (letter, correct, mode) => {
      const delta = correct ? 1 : -1;
      const at = new Date(event.atMs ?? NaN);
      const retention = countsAnswer(mode, correct) && Number.isFinite(at.getTime()) ? recordCorrectAnswer({ dailyActivity: state.dailyActivity, streak: state.streak, letterAccuracy: state.letterAccuracy }, { letter, mode, at }) : { letterAccuracy: recordLetterAttempt(state, letter, correct).letterAccuracy, dailyActivity: state.dailyActivity, streak: state.streak };
      return {
        ...retention,
        score: state.score + delta,
        listenTtr: mode === "listen" && Number.isFinite(event.sample) ? ke(state.listenTtr, letter, event.sample) : state.listenTtr,
        settings: mode === "listen" && correct ? tempoStep(state.settings, "auto-correct") : state.settings,
        scores: { ...state.scores, [letter]: (state.scores[letter] ?? 0) + delta },
        history: [...state.history, {
          letter,
          correct,
          atMs: event.atMs ?? 0,
          ...mode === "listen" ? { mode } : {}
        }].slice(-HISTORY_LIMIT)
      };
    };
    const clearFeedback = { feedback: "", outcome: null, advance: false };
    const changeSelection = (selection, extra = {}) => {
      const studyPool = selectionPool(selection);
      return update({
        ...clearFeedback,
        ...extra,
        settings: { ...state.settings, ...extra.settings, selection },
        studyPool,
        target: studyPool.includes(state.target) ? state.target : state.settings.strategy === "weighted" ? pickWeighted(studyPool, state.scores, state.target, event.roll) : studyPool[0],
        ...state.settings.practiceWords && state.mode === "practice" ? { ...newPracticeWord(studyPool, state.practiceWord, event.roll), practiceWpm: null } : {},
        reviewQueue: state.reviewQueue.filter((item) => studyPool.includes(item.letter))
      }, { type: "cancelFeedback" }, { type: "cancelWord" });
    };
    switch (event.type) {
      case "selection": {
        const selection = normalizeSelection(event.selection);
        if (!selection) return keep;
        if (event.rememberLevel && selection.kind === "custom") {
          const maxLevel = state.settings.selection?.level ?? state.settings.maxLevel ?? 3;
          return changeSelection(selection, { settings: { maxLevel } });
        }
        return changeSelection(selection);
      }
      case "coursePool": {
        const studyPool = event.letters ? event.letters.join("") : selectionPool(state.settings.selection);
        if (studyPool === state.studyPool || !studyPool.length) return keep;
        return update({
          ...clearFeedback,
          studyPool,
          target: studyPool.includes(state.target) ? state.target : studyPool[0],
          reviewQueue: state.reviewQueue.filter((item) => studyPool.includes(item.letter))
        }, { type: "cancelFeedback" });
      }
      case "openPractice":
        if (state.settings.selection?.kind === "custom" || state.studyPool.length >= 26) return keep;
        return changeSelection(tierSelection(3));
      case "courseComplete":
        return state.settings.selection?.kind === "custom" ? keep : changeSelection(tierSelection(4));
      case "mode":
        if (event.mode === state.mode) return keep;
        return update({
          mode: event.mode,
          transcript: "",
          freestyleInput: "",
          ...clearFeedback,
          ...event.mode === "guided" && state.settings.practiceWords ? { settings: { ...state.settings, practiceWords: false } } : {},
          ...event.mode === "practice" && state.settings.practiceWords ? newPracticeWord(state.studyPool, state.practiceWord, event.roll) : {},
          wordStartMs: null,
          practiceWpm: null
        }, { type: "cancelFeedback" }, { type: "cancelWord" });
      case "recommended": {
        const current = state.settings;
        const known3 = event.profile === "known";
        const maxLevel = known3 ? 3 : 1;
        const desired = {
          ...normalizeTempo({}),
          showHint: !known3,
          showMnemonic: !known3,
          strategy: "sequential",
          autoPlay: true,
          ifr: known3,
          reviewMisses: known3,
          maxLevel
        };
        const effective = {
          ...current,
          showHint: current.showHint ?? false,
          showMnemonic: current.showMnemonic ?? false,
          autoPlay: current.autoPlay ?? event.inheritedAutoPlay,
          maxLevel: current.selection?.level ?? current.maxLevel ?? 3
        };
        if (Object.entries(desired).every(([key2, value]) => effective[key2] === value)) return keep;
        const tier = tierSelection(maxLevel);
        const selection = current.selection?.kind === "custom" ? current.selection : tier;
        const targetPool = selectionPool(tier);
        return update(
          {
            ...clearFeedback,
            settings: { ...current, ...desired, selection, practiceWords: false },
            studyPool: selectionPool(selection),
            target: targetPool.includes(state.target) ? state.target : targetPool[0],
            practiceWord: "",
            practiceIndex: 0,
            practiceWpm: null,
            wordStartMs: null,
            reviewQueue: [],
            freestyleInput: "",
            transcript: ""
          },
          { type: "cancelFeedback" },
          { type: "cancelWord" }
        );
      }
      case "practiceControl": {
        const { control, enabled } = event;
        const { settings } = state;
        if (control === "sequential") {
          const strategy = enabled ? "sequential" : "weighted";
          if (settings.practiceWords || settings.strategy === strategy) return keep;
          const patch = { settings: { ...settings, strategy } };
          if (enabled && state.mode === "practice")
            return update({ ...patch, ...clearFeedback, target: state.studyPool[0] }, { type: "cancelFeedback" });
          return update(patch);
        }
        if (control === "review" && settings.ifr && settings.reviewMisses !== enabled)
          return update({ settings: { ...settings, reviewMisses: enabled }, ...!enabled && { reviewQueue: [] } });
        if (control === "ifr" && settings.ifr !== enabled) {
          const patch = { settings: { ...settings, ifr: enabled }, ...!enabled && { reviewQueue: [] } };
          return state.mode === "practice" ? update({ ...patch, ...clearFeedback }, { type: "cancelFeedback" }) : update(patch);
        }
        return keep;
      }
      case "ifr":
        if (state.settings.ifr === event.enabled) return keep;
        return update({ settings: { ...state.settings, ifr: event.enabled } });
      case "words":
        if (state.settings.words === event.enabled) return keep;
        return update({
          settings: { ...state.settings, words: event.enabled },
          ...state.mode === "freestyle" ? { transcript: "", freestyleInput: "", ...clearFeedback } : {}
        }, { type: "cancelWord" });
      case "freshBeginnerDefaults":
        return changeSelection(tierSelection(1), { settings: { ifr: false, reviewMisses: false, showHint: false, showMnemonic: false, autoPlay: true, strategy: "weighted" } });
      case "preference": {
        const s = state.settings;
        switch (event.command) {
          case "practice-words-on":
          case "practice-words-off": {
            const enabled = event.command === "practice-words-on";
            if (enabled === Boolean(s.practiceWords) || state.mode === "guided") return keep;
            return update(
              {
                ...clearFeedback,
                practiceWpm: null,
                wordStartMs: null,
                settings: { ...s, practiceWords: enabled },
                ...enabled ? newPracticeWord(state.studyPool, null, event.roll) : { practiceWord: "", practiceIndex: 0 }
              },
              { type: "cancelFeedback" }
            );
          }
          case "hint-on":
          case "hint-off":
          case "mnemonic-on":
          case "mnemonic-off": {
            const key2 = event.command.startsWith("hint-") ? "showHint" : "showMnemonic";
            const enabled = event.command.endsWith("-on");
            return s[key2] === enabled ? keep : update({ settings: { ...s, [key2]: enabled } });
          }
          case "autoplay-on":
          case "autoplay-off": {
            const autoPlay = event.command === "autoplay-on";
            return autoPlay === s.autoPlay ? keep : update({ settings: { ...s, autoPlay } });
          }
          case "toggle-ifr":
            return stepSession(state, { type: "ifr", enabled: !s.ifr });
          case "toggle-words":
            return stepSession(state, { type: "words", enabled: !s.words });
          case "toggle-strategy":
            return update({ settings: { ...s, strategy: s.strategy === "weighted" ? "sequential" : "weighted" } });
          case "toggle-review":
            return update({ settings: { ...s, reviewMisses: !s.reviewMisses } });
          case "speed-up":
          case "speed-down":
          case "effective-up":
          case "effective-down":
          case "toggle-auto-tighten": {
            const settings = tempoStep(s, event.command);
            return settings === s ? keep : update({ settings });
          }
          case "pitch-up":
          case "pitch-down": {
            const pitch = Math.max(400, Math.min(800, s.pitch + (event.command === "pitch-up" ? 20 : -20)));
            return pitch === s.pitch ? keep : update({ settings: { ...s, pitch } });
          }
          default:
            return keep;
        }
      }
      case "clear":
        return update({ transcript: "", freestyleInput: "", ...clearFeedback }, { type: "cancelFeedback" }, { type: "cancelWord" });
      case "replay":
        if (state.mode !== "practice") return keep;
        if (state.outcome === "wrong") return update({ feedback: "", advance: false });
        return update(clearFeedback, { type: "cancelFeedback" });
      case "routeBoundary":
        return update({ transcript: "", freestyleInput: "", ...clearFeedback }, { type: "cancelFeedback" }, { type: "cancelWord" });
      case "cancel":
        if (state.mode === "practice" && state.settings.practiceWords)
          return update({ ...clearFeedback, wordStartMs: null }, { type: "cancelFeedback" });
        return state.mode === "freestyle" ? update({ freestyleInput: "" }, { type: "cancelWord" }) : keep;
      case "toneStart":
        return state.mode === "freestyle" ? { state, effects: [{ type: "cancelWord" }] } : keep;
      case "symbol":
        if (state.mode === "practice" && state.settings.practiceWords && (!state.outcome || state.settings.ifr)) {
          const start = state.practiceIndex === 0 && state.wordStartMs == null && Number.isFinite(event.monoMs) ? event.monoMs : state.wordStartMs;
          return update({ ...clearFeedback, wordStartMs: start }, { type: "cancelFeedback" });
        }
        if (state.mode === "practice" && state.outcome === "correct")
          return update(clearFeedback, { type: "cancelFeedback" });
        if (state.mode === "freestyle" && (event.symbol === "." || event.symbol === "-"))
          return update({ feedback: "", freestyleInput: (state.freestyleInput + event.symbol).slice(-64) });
        if (state.mode === "freestyle" && state.feedback) return update({ feedback: "" });
        return keep;
      case "resetScores":
        return update({ scores: {}, score: 0 });
      case "guidedScore":
        return state.mode === "guided" && byCharacter.has(event.letter) ? update(scored(event.letter, event.correct, event.mode)) : keep;
      case "listenScore":
        return state.mode === "listen" && state.studyPool.includes(event.letter) && event.letter.length === 1 ? update(scored(event.letter, event.correct, "listen")) : keep;
      case "sequence": {
        const letter = decode(event.code);
        if (state.mode === "freestyle") {
          if (!letter || !state.settings.words) return update({ freestyleInput: "", feedback: letter ?? "No match" }, { type: "cancelWord" });
          return update(
            { freestyleInput: "", feedback: letter, transcript: (state.transcript + letter).slice(-1e3) },
            { type: "scheduleWord", ms: extraWordGapMs }
          );
        }
        if (state.mode !== "practice" || state.outcome === "wrong") return keep;
        const correct = letter === state.target;
        if (correct && state.settings.practiceWords)
          return update(
            { ...clearFeedback, ...advanceWord(state, event), ...state.settings.showHint ? {} : scored(state.target, true, "practice") },
            { type: "cancelFeedback" }
          );
        return update({
          feedback: correct ? "Correct" : "Try again",
          outcome: correct ? "correct" : "wrong",
          advance: correct || state.settings.ifr,
          ...state.settings.showHint ? {} : scored(state.target, correct, "practice"),
          reviewQueue: !correct && state.settings.ifr && state.settings.reviewMisses ? enqueueReview(state.reviewQueue, state.target) : state.reviewQueue
        }, { type: "scheduleFeedback", ms: feedbackMs });
      }
      case "feedbackElapsed":
        if (state.outcome === null) return keep;
        if (!state.advance) return update(clearFeedback);
        if (state.settings.practiceWords) return update({ ...clearFeedback, ...advanceWord(state, event) });
        const useReview = state.settings.ifr && state.settings.reviewMisses;
        const picked = useReview ? pullReview(state.reviewQueue) : { queue: state.reviewQueue, letter: null };
        const target = picked.letter ?? (state.settings.strategy === "sequential" ? next(state.studyPool, state.target) : pickWeighted(state.studyPool, state.scores, state.target, event.roll));
        return update({ ...clearFeedback, target, reviewQueue: picked.queue });
      case "wordElapsed":
        if (state.mode !== "freestyle" || !state.settings.words || !state.transcript || state.transcript.endsWith(" ")) return keep;
        return update({ transcript: state.transcript + " " });
      default:
        return keep;
    }
  }
  function createSession({
    setTimer,
    clearTimer,
    project,
    onLock,
    data,
    courseComplete = false,
    cleanInstall = false,
    onChange = () => {
    },
    random = Math.random,
    wallNow = Date.now,
    monotonicNow = () => globalThis.performance?.now?.() ?? NaN
  }) {
    let state = initialSession(data, courseComplete, cleanInstall, cleanInstall || data?.settings?.practiceWords ? random() : 0);
    const timers = /* @__PURE__ */ new Map();
    const clear = (kind) => {
      clearTimer(timers.get(kind)?.id);
      timers.delete(kind);
    };
    const names = { cancelFeedback: "feedback", scheduleFeedback: "feedback", cancelWord: "word", scheduleWord: "word" };
    function dispatch(event) {
      const before = state;
      const enriched = { ...event };
      if (["sequence", "listenScore", "guidedScore"].includes(event.type)) enriched.atMs = wallNow();
      if (state.settings.practiceWords && ["symbol", "sequence", "feedbackElapsed"].includes(event.type)) enriched.monoMs = monotonicNow();
      if (event.type === "feedbackElapsed" || event.type === "selection" || event.command === "practice-words-on" || state.settings.practiceWords && (event.type === "mode" || event.type === "sequence"))
        enriched.roll = random();
      const result = stepSession(state, enriched);
      state = result.state;
      for (const effect of result.effects) {
        const kind = names[effect.type];
        clear(kind);
        if (effect.type.startsWith("schedule")) {
          const token = {};
          token.id = setTimer(() => {
            if (timers.get(kind) !== token) return;
            timers.delete(kind);
            dispatch({ type: kind + "Elapsed" });
          }, effect.ms);
          timers.set(kind, token);
        }
      }
      if (before.bestWpm !== state.bestWpm || before.settings !== state.settings || before.scores !== state.scores || before.history !== state.history || before.letterAccuracy !== state.letterAccuracy || before.listenTtr !== state.listenTtr || before.dailyActivity !== state.dailyActivity || before.streak !== state.streak) onChange(state);
      const errorLocked = (snapshot) => snapshot.outcome === "wrong" && !(snapshot.settings.practiceWords && snapshot.settings.ifr);
      if (errorLocked(before) !== errorLocked(state)) onLock(errorLocked(state));
      projectState(before);
    }
    function projectDaily() {
      const tracked = Object.keys(state.dailyActivity ?? {}).length > 0 || state.streak !== void 0;
      const { correct, goal, atRisk } = todayStreakContribution(state, new Date(wallNow()));
      project("ref-streak-today:" + (tracked ? `${Math.min(correct, goal)}/${goal}` : ""));
      project("ref-day-label:" + (correct >= goal ? "Today counted" : correct + " / " + goal + " today"));
      project("ref-day-fill:" + Math.round(Math.min(correct, goal) * 100 / goal) + "%");
      project("ref-streak-current:" + (state.streak?.current ?? ""));
      project("ref-streak-best:" + (state.streak?.longest ?? ""));
      project("ref-streak-risk:" + (atRisk ? "1" : "0"));
    }
    function projectState(before) {
      if (!before || before.dailyActivity !== state.dailyActivity || before.streak !== state.streak) projectDaily();
      if (!before || before.practiceWord !== state.practiceWord || before.practiceIndex !== state.practiceIndex)
        project("practice-prefix:" + (state.practiceWord?.slice(0, state.practiceIndex) ?? ""));
      for (const key2 of ["practiceWord", "practiceWpm"])
        if (!before || before[key2] !== state[key2]) project(key2 + ":" + (state[key2] ?? ""));
      if (!before || before.bestWpm !== state.bestWpm) project("bestWpm:" + (state.bestWpm > 0 ? state.bestWpm.toFixed(1) : ""));
      for (const key2 of ["target", "score", "feedback", "transcript", "freestyleInput"]) {
        if (!before || before[key2] !== state[key2]) project(key2 + ":" + state[key2]);
      }
      if (!before || before.studyPool !== state.studyPool) project("study-pool:" + Array.from(state.studyPool).join(","));
      if (!before || before.history.length !== state.history.length) project("history:" + state.history.length);
      if (!before || before.scores !== state.scores || before.history !== state.history || before.letterAccuracy !== state.letterAccuracy || before.listenTtr !== state.listenTtr) {
        const model = buildReference(state);
        for (const [key2, value] of Object.entries(model))
          project("ref-" + key2 + ":" + (Array.isArray(value) ? value.join(",") : value));
        const recognition = buildRecognition(state);
        project("ref-ttr-average:" + (recognition.average === null ? "" : recognition.average));
        project("ref-ttr-bars:" + recognition.bars.map(({ letter, averageMs, samples, fill }) => [letter, averageMs, samples, fill].join(",")).join(";"));
      }
      if (!before || before.settings.selection !== state.settings.selection) {
        const choice = state.settings.selection;
        project("scope-selection:" + (choice?.kind === "tier" ? "tier-" + choice.level : choice?.kind ?? "legacy"));
        project("scope-letters:" + (choice?.kind === "custom" ? choice.letters.join("") : ""));
      }
      for (const key2 of Object.keys(state.settings)) {
        if (key2 === "selection") continue;
        if (!before || before.settings[key2] !== state.settings[key2]) project(key2 + ":" + state.settings[key2]);
      }
    }
    return { dispatch, projectState, projectDaily, current: () => state, dispose: () => {
      clear("feedback");
      clear("word");
    } };
  }

  // modules/web/listen.mjs
  var REVEAL_MS = { correct: 1650, wrong: 2e3 };
  var NEXT_GAP_MS = 540;
  var RECOGNITION_MS = 2600;
  function createListen({ setTimer, clearTimer, play, stop, project, record: record3, pick, getPool = () => PRACTICE_POOL, onRoundEnd = () => true, isGuided = () => false }) {
    let enabled = false;
    let phase = "ready";
    let target = PRACTICE_POOL[0];
    let timing = null;
    let generation = 0;
    let nextTimer;
    let recognitionTimer;
    const setPhase = (next2) => {
      phase = next2;
      project("listen-phase:" + next2);
    };
    const fields = (reveal = "", feedback = "") => {
      project("listen-reveal:" + reveal);
      project("listen-feedback:" + feedback);
    };
    function cancelTimers() {
      generation++;
      clearTimer(nextTimer);
      clearTimer(recognitionTimer);
      nextTimer = recognitionTimer = void 0;
      timing = null;
    }
    function prompt() {
      if (!enabled) return false;
      if (!getPool().includes(target)) target = pick(void 0);
      const ticket = ++generation;
      timing = null;
      fields();
      project("listen-prompt:" + ticket);
      setPhase("answering");
      play(target, (duration, readElapsed) => {
        if (ticket === generation && phase === "answering") timing = { duration, readElapsed };
      });
      return true;
    }
    function suspend() {
      if (!enabled) return;
      cancelTimers();
      stop();
      fields();
      project("listen-recognition:");
      setPhase("ready");
    }
    return {
      enter({ autoplay = true, keepTarget = false } = {}) {
        enabled = true;
        project("listen-submitted:0");
        if (!keepTarget || !getPool().includes(target)) target = pick(void 0);
        if (!autoplay) {
          cancelTimers();
          fields();
          project("listen-recognition:");
          setPhase("ready");
          return true;
        }
        return prompt();
      },
      suspend,
      exit() {
        suspend();
        enabled = false;
      },
      replay() {
        return enabled && (phase === "answering" || phase === "ready") ? prompt() : false;
      },
      answer(input, promptId = String(generation)) {
        if (promptId !== String(generation)) return false;
        const letter = typeof input === "string" ? input.toUpperCase() : "";
        if (!enabled || phase !== "answering" || letter.length !== 1 || !getPool().includes(letter)) return false;
        if (!getPool().includes(target)) {
          suspend();
          return false;
        }
        const elapsed = timing?.readElapsed?.();
        const sample = Number.isFinite(elapsed) && elapsed >= 0 && Number.isFinite(timing.duration) && timing.duration >= 0 ? Math.max(0, elapsed - timing.duration) : null;
        const recognition = sample === null ? "" : (sample / 1e3).toFixed(1) + "s";
        cancelTimers();
        stop();
        const correct = letter === target;
        project("listen-submitted:1");
        setPhase("reveal");
        fields(target, correct ? "Correct" : isGuided() ? "It was " + target : "Incorrect");
        project("listen-recognition:" + recognition);
        record3(target, correct, sample);
        recognitionTimer = setTimer(() => {
          recognitionTimer = void 0;
          project("listen-recognition:");
        }, RECOGNITION_MS);
        const ticket = generation;
        nextTimer = setTimer(() => {
          if (ticket !== generation || !enabled) return;
          if (!onRoundEnd()) {
            fields();
            setPhase("ready");
            return;
          }
          target = pick(target);
          fields();
          setPhase("gap");
          nextTimer = setTimer(() => {
            if (ticket === generation && enabled) prompt();
          }, NEXT_GAP_MS);
        }, correct ? REVEAL_MS.correct : REVEAL_MS.wrong);
        return true;
      }
    };
  }

  // core/apple-listen-practice.mjs
  function createAppleListenPractice(current) {
    let queue = [];
    let last = null;
    let count = 0;
    function enqueue(letter, repeats) {
      queue = Be(queue, letter, repeats, Me);
    }
    return {
      miss(letter, averageMs) {
        enqueue(letter, Ye(averageMs));
      },
      reset() {
        queue = [];
        last = null;
        count = 0;
      },
      pick(previous) {
        const { studyPool, scores, listenTtr } = current();
        const { reviewLetter, nextQueue } = Ve(queue, studyPool, previous);
        queue = nextQueue;
        const choose = (pool, avoid) => pickLatencyAware(pool, scores, listenTtr, avoid, Math.random());
        let next2 = reviewLetter ?? choose(studyPool, previous);
        if (next2 === previous && last === previous && count >= Ie && studyPool.length > 1) {
          if (reviewLetter === previous) enqueue(previous, 1);
          next2 = choose([...studyPool].filter((letter) => letter !== previous));
        }
        count = next2 === last ? count + 1 : 1;
        last = next2;
        return next2;
      }
    };
  }

  // modules/web/qso-codec.generated.mjs
  var MORSE_DATA4 = {
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
  var CONVERSATION_PROSIGNS = [
    ["K", "Go ahead"],
    ["KN", "Named station only"],
    ["BK", "Quick handoff"],
    ["AR", "End of message"],
    ["SK", "End of contact"],
    ["BT", "Separator"],
    ["AS", "Wait"],
    ["HH", "Correction"]
  ];
  var SUPPORTED2 = /^[A-Z0-9]$/;
  var normalizeCustomText2 = (input, options = {}) => {
    const maxChars = options.maxChars ?? 2e3;
    let ignored = 0;
    let out = "";
    let lastWasSpace = true;
    for (const raw of input) {
      const upper = raw.toUpperCase();
      if (SUPPORTED2.test(upper)) {
        out += upper;
        lastWasSpace = false;
        continue;
      }
      if (raw === " " || raw === `
` || raw === "	" || raw === "\r") {
        if (!lastWasSpace) {
          out += " ";
          lastWasSpace = true;
        }
        continue;
      }
      ignored += 1;
    }
    let truncated = false;
    if (out.length > maxChars) {
      out = out.slice(0, maxChars).trimEnd();
      truncated = true;
    } else {
      out = out.trimEnd();
    }
    return { normalized: out, ignored, truncated };
  };
  var isMorseSymbol = (value) => {
    "worklet";
    return value === "." || value === "-";
  };
  var tokenize = (code) => {
    "worklet";
    return code.split(" ").filter((token) => token === "/" || /^[.\-]+$/.test(token));
  };
  var getReceivedTextAtElapsedMs = (text, code, unitMs, elapsedMs, interCharacterGapMs = unitMs * 3, interWordGapMs = interCharacterGapMs * 7 / 3) => {
    if (unitMs <= 0 || elapsedMs < 0 || text.length === 0) {
      return "";
    }
    const tokens = tokenize(code);
    let cursorMs = 0;
    let textIndex = 0;
    let received = "";
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      const token = tokens[tokenIndex];
      if (token === "/") {
        cursorMs += interWordGapMs;
        if (elapsedMs < cursorMs) {
          return received;
        }
        if (text[textIndex] === " ") {
          received += " ";
          textIndex += 1;
        }
        continue;
      }
      const symbols = token.split("").filter(isMorseSymbol);
      for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
        cursorMs += symbols[symbolIndex] === "." ? unitMs : unitMs * 3;
        if (symbolIndex < symbols.length - 1) {
          cursorMs += unitMs;
        }
      }
      if (elapsedMs < cursorMs) {
        return received;
      }
      if (textIndex < text.length && text[textIndex] !== " ") {
        received += text[textIndex];
        textIndex += 1;
      }
      if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== "/") {
        cursorMs += interCharacterGapMs;
      }
    }
    return received;
  };
  var LETTERS = Object.keys(MORSE_DATA4);
  var decodeMorseCode = (code) => {
    const match = Object.entries(MORSE_DATA4).find(([, data]) => data.code === code);
    return match ? match[0] : null;
  };
  var prosignCodes = new Map(CONVERSATION_PROSIGNS.map(([name]) => [
    name,
    [...name].map((letter) => MORSE_DATA4[letter].code).join("")
  ]));
  var prosignNames = new Map([...prosignCodes].map(([name, code]) => [code, name]));
  var tokenizeConversationText = (text) => text.split(/( )/).flatMap((word) => word === " " || prosignCodes.has(word) ? [word] : [...word]);
  var textToConversationMorseCode = (input) => {
    const result = normalizeCustomText2(input);
    const code = tokenizeConversationText(result.normalized).map((token) => token === " " ? "/" : prosignCodes.get(token) ?? MORSE_DATA4[token].code).join(" ");
    return { ...result, code };
  };
  var decodeConversationMorseCode = (code) => prosignNames.get(code) ?? decodeMorseCode(code);
  var getReceivedConversationTextAtElapsedMs = (text, code, unitMs, elapsedMs, interCharacterGapMs = unitMs * 3, interWordGapMs = interCharacterGapMs * 7 / 3) => getReceivedTextAtElapsedMs(tokenizeConversationText(text), code, unitMs, elapsedMs, interCharacterGapMs, interWordGapMs);

  // modules/web/qso.mjs
  async function fixtureReply({ outgoing, turn }) {
    return !outgoing ? "CQ K" : turn === 1 ? "R K" : "73 SK";
  }
  function qsoPlan(text, speed) {
    const unit = characterUnitMs(speed);
    const tokens = textToConversationMorseCode(text).code.split(" ").filter(Boolean);
    const plan = [];
    let offset = 0;
    for (const [index, token] of tokens.entries()) {
      if (token === "/") {
        offset += 7 * unit;
        continue;
      }
      for (const [i, symbol] of [...token].entries()) {
        const start = offset;
        offset += symbol === "." ? unit : 3 * unit;
        plan.push([start, offset]);
        if (i < token.length - 1) offset += unit;
      }
      if (index < tokens.length - 1 && tokens[index + 1] !== "/") offset += 3 * unit;
    }
    return plan;
  }
  var fixtureCall = (number) => "K" + number % 10 + "DI" + String.fromCharCode(65 + Math.floor(number / 10) % 26);
  var typedLimit = 2e3;
  var draftLimit = 2e3;
  var transcriptLimit = 40;
  var spaceMs = 1200;
  function createQso({ project, reply, play, stop, pause, resume, setTimer, clearTimer, platform = "web" }) {
    const apple = platform === "ios";
    let active = false;
    let phase = "idle";
    let operation = 0;
    let clockOperation = 0;
    let contacts = 0;
    let callsign = "";
    let pendingDirection = null;
    let live = false;
    let liveText = null;
    let copyChecked = false;
    let outgoingTurn = 0;
    let draft = "";
    let autoSpace = false;
    let wordTimer;
    let wordGeneration = 0;
    let incoming = null;
    let incomingSerial = 0;
    let copy = "";
    let turns = [];
    let retryRequest = null;
    let recovery = "";
    const proj = (key2, value) => project("qso-" + key2 + ":" + value);
    let replyStarted = false;
    let lastTranscript = "";
    function publishTurns() {
      const receiving = ["receiving", "paused", "rx-ready"].includes(phase);
      const latest = apple && turns.findLast((turn) => turn.speaker === "Station");
      const lines = turns.map((turn) => {
        const visible = !apple || turn.speaker === "You" || phase === "ended" || turn.revealed || turn === latest && !receiving && (replyStarted || copyChecked || live);
        return visible ? turn.speaker + ": " + turn.text : "Hidden:" + turn.id;
      }).join("\n");
      if (lines !== lastTranscript) {
        lastTranscript = lines;
        proj("transcript", lines);
      }
    }
    function setPhase(value) {
      phase = value;
      proj("phase", value);
      if (apple) publishTurns();
    }
    function clearWord() {
      wordGeneration++;
      clearTimer(wordTimer);
      wordTimer = void 0;
    }
    function clearDraft() {
      clearWord();
      draft = "";
      autoSpace = false;
      proj("draft", "");
    }
    function showLive(value) {
      if (value === liveText) return;
      liveText = value;
      proj("live", value);
    }
    function clearCopy() {
      copy = "";
      copyChecked = false;
      proj("copy-checked", "0");
      proj("copy", "");
      proj("rx-text", "");
      proj("copy-summary", "");
      proj("copy-diff", "");
    }
    function stopFlight() {
      operation++;
      clockOperation++;
      clearWord();
      stop();
    }
    function addTurn(speaker, text, id) {
      turns.push({ speaker, text, id });
      if (!apple && turns.length > transcriptLimit) turns.shift();
      publishTurns();
    }
    function commitIncoming() {
      if (!incoming || incoming.committed) return;
      incoming.committed = true;
      addTurn("Station", incoming.text, incoming.id);
    }
    function reset() {
      stopFlight();
      clearDraft();
      clearCopy();
      callsign = "";
      pendingDirection = null;
      outgoingTurn = 0;
      incoming = null;
      turns = [];
      replyStarted = false;
      lastTranscript = "";
      retryRequest = null;
      recovery = "";
      proj("callsign", "");
      proj("transcript", "");
      proj("error", "");
      proj("replayable", "0");
      showLive("");
      setPhase("idle");
    }
    function playback() {
      if (!incoming) return false;
      stopFlight();
      const ticket = operation;
      replyStarted = false;
      showLive("");
      clearCopy();
      recovery = "";
      proj("error", "");
      setPhase("receiving");
      const onComplete = () => {
        if (active && ticket === operation && ["receiving", "paused"].includes(phase)) {
          if (live) showLive(incoming.text);
          setPhase("rx-ready");
        }
      };
      const onProgress = (elapsedMs, speed) => {
        if (!active || !live || ticket !== operation || phase !== "receiving") return;
        const unit = characterUnitMs(speed);
        showLive(getReceivedConversationTextAtElapsedMs(incoming.text, incoming.code, unit, elapsedMs, 3 * unit, 7 * unit));
      };
      const onError = () => {
        if (!active || ticket !== operation || !["receiving", "paused"].includes(phase)) return;
        stopFlight();
        recovery = "audio";
        proj("error", "Could not play the accepted transmission.");
        setPhase("error");
      };
      try {
        play(incoming.text, onComplete, onError, onProgress);
      } catch {
        onError();
      }
      return true;
    }
    async function request(payload) {
      stopFlight();
      incoming = null;
      showLive("");
      retryRequest = payload;
      recovery = "";
      proj("error", "");
      proj("replayable", "0");
      clearCopy();
      const ticket = operation;
      setPhase("sending");
      try {
        const result = await reply(payload);
        if (!active || ticket !== operation) return;
        const { normalized: text, code } = textToConversationMorseCode(result);
        if (!text) throw Error("Empty local fixture response");
        incoming = { id: ++incomingSerial, text, code };
        proj("replayable", "1");
        retryRequest = null;
        playback();
      } catch {
        if (!active || ticket !== operation) return;
        recovery = "request";
        proj("error", "The local practice station could not answer.");
        setPhase("error");
      }
    }
    function reveal() {
      if (!["rx-ready", "tx"].includes(phase) || !incoming) return false;
      proj("rx-text", incoming.text);
      return true;
    }
    function checkCopy() {
      if (!reveal()) return false;
      copyChecked = true;
      if (apple) publishTurns();
      proj("copy-checked", "1");
      const diff = customListenDiff(incoming.text, copy.toUpperCase().slice(0, typedLimit));
      proj("copy-summary", diff.matched + "/" + diff.total + " matched \xB7 " + diff.missed + " missed \xB7 " + diff.extra + " extra");
      const esc = (text) => text.replaceAll("%", "%25").replaceAll("|", "%7C");
      proj("copy-diff", diff.tokens.map((token) => token.kind + ":" + esc(token.text)).join("|"));
      return true;
    }
    function setLive(value) {
      live = Boolean(value);
      if (apple) publishTurns();
      proj("live-enabled", Number(live));
      if (!live) showLive("");
      else if (phase === "rx-ready" && incoming) showLive(incoming.text);
    }
    return {
      enter() {
        active = true;
        reset();
      },
      leave() {
        active = false;
        reset();
        if (apple) setLive(false);
      },
      canKey: () => active && phase === "tx",
      activity() {
        if (phase !== "tx") return;
        clearWord();
        if (apple && !replyStarted) {
          replyStarted = true;
          publishTurns();
        }
      },
      revealTurn(id) {
        const turn = turns.find((turn2) => turn2.speaker === "Station" && turn2.id === id);
        if (!active || !turn || !apple) return false;
        turn.revealed = true;
        publishTurns();
        return true;
      },
      start(direction) {
        if (!active || phase !== "idle" || !["send", "receive"].includes(direction)) return false;
        pendingDirection = direction;
        setPhase("consent");
        return true;
      },
      confirm(allowed) {
        if (!active || phase !== "consent" || !pendingDirection) return false;
        const direction = pendingDirection;
        pendingDirection = null;
        if (!allowed) {
          setPhase("idle");
          return true;
        }
        callsign = fixtureCall(++contacts);
        proj("callsign", callsign);
        if (direction === "send") setPhase("tx");
        else void request({ outgoing: "", turn: 0, callsign });
        return true;
      },
      setLive,
      key(code) {
        if (!active || phase !== "tx") return false;
        const letter = decodeConversationMorseCode(code);
        clearWord();
        if (letter) {
          draft = (draft + letter).slice(0, draftLimit);
          autoSpace = false;
          proj("draft", draft);
        }
        const ticket = wordGeneration;
        wordTimer = setTimer(() => {
          if (ticket !== wordGeneration || phase !== "tx" || !draft || draft.endsWith(" ") || draft.length >= draftLimit) return;
          draft += " ";
          autoSpace = true;
          proj("draft", draft);
        }, spaceMs);
        return Boolean(letter);
      },
      backspace() {
        if (!active || phase !== "tx") return false;
        clearWord();
        if (!draft) return false;
        draft = draft.slice(0, autoSpace ? -2 : -1);
        autoSpace = false;
        proj("draft", draft);
        return true;
      },
      clear() {
        if (active && phase === "tx") clearDraft();
      },
      send() {
        const tx = draft.trim();
        if (!active || phase !== "tx" || !tx) return false;
        clearDraft();
        addTurn("You", tx);
        void request({ outgoing: tx, turn: ++outgoingTurn, callsign });
        return true;
      },
      copy(value) {
        if (!active || !["receiving", "rx-ready", "tx"].includes(phase) && !(apple && phase === "paused") || !incoming) return false;
        copy = String(value).slice(0, typedLimit);
        if (apple && copyChecked && phase === "rx-ready") checkCopy();
        return true;
      },
      reveal,
      check: checkCopy,
      startTurn() {
        if (!active || phase !== "rx-ready") return false;
        commitIncoming();
        proj("copy", copy);
        proj("copy-checked", Number(copyChecked));
        showLive("");
        setPhase("tx");
        return true;
      },
      replay() {
        if (!active || !incoming || !["receiving", "paused", "rx-ready", "tx"].includes(phase)) return false;
        if (!apple && phase === "tx" && draft) return false;
        return playback();
      },
      retry() {
        if (!active || phase !== "error") return false;
        if (recovery === "audio") return playback();
        if (recovery === "request" && retryRequest) {
          void request(retryRequest);
          return true;
        }
        return false;
      },
      async pause() {
        if (phase !== "receiving") return;
        const ticket = ++clockOperation;
        setPhase("paused");
        try {
          await pause();
        } catch {
          if (ticket !== clockOperation || phase !== "paused") return;
          stopFlight();
          recovery = "audio";
          proj("error", "Could not pause audio.");
          setPhase("error");
        }
      },
      async resume() {
        if (phase !== "paused") return;
        const ticket = ++clockOperation;
        setPhase("receiving");
        try {
          await resume();
        } catch {
          if (ticket !== clockOperation || phase !== "receiving") return;
          stopFlight();
          recovery = "audio";
          proj("error", "Could not resume audio.");
          setPhase("error");
        }
      },
      interrupt() {
        if (!active) return;
        clearWord();
        if (["receiving", "paused", "sending"].includes(phase)) {
          recovery = phase === "sending" ? "request" : "audio";
          stopFlight();
          proj("error", "Contact paused. Retry when you are ready.");
          setPhase("error");
        }
      },
      end() {
        if (!active || phase === "idle" || phase === "ended") return;
        stopFlight();
        commitIncoming();
        clearDraft();
        clearCopy();
        showLive("");
        retryRequest = null;
        recovery = "";
        setPhase("ended");
      },
      new() {
        if (active) reset();
      }
    };
  }

  // core/apple-conversation.mjs
  function createAppleConversation({ project, host, clock, current }) {
    let timer;
    let poll;
    function stop() {
      clock.clearTimer(timer);
      poll = void 0;
      host.passageControl?.("stop");
    }
    const contact = createQso({
      ...clock,
      project,
      reply: fixtureReply,
      stop,
      platform: "ios",
      play(text, complete, fail, progress2) {
        const { speed, pitch } = current().settings;
        const plan = qsoPlan(text, speed);
        const finalGap = 3 * characterUnitMs(speed);
        if (!plan.length || !host.passageStart?.(plan, pitch, finalGap)) {
          fail();
          return;
        }
        const duration = plan.at(-1)[1] + finalGap;
        let lastPercent;
        const publishProgress = (percent) => {
          if (lastPercent !== percent) project("qso-percent:" + percent);
          lastPercent = percent;
        };
        publishProgress(0);
        poll = () => {
          const ms = host.passagePosition();
          if (ms === -2) {
            poll = void 0;
            publishProgress(100);
            complete();
            return;
          }
          if (!Number.isFinite(ms) || ms < 0) {
            fail();
            return;
          }
          publishProgress(duration > 0 ? Math.min(100, Math.floor(100 * ms / duration)) : 0);
          progress2(ms, speed);
          timer = clock.setTimer(poll, 50);
        };
        timer = clock.setTimer(poll, 50);
      },
      pause() {
        if (!host.passageControl("pause")) throw Error("Audio pause failed");
        clock.clearTimer(timer);
      },
      resume() {
        if (!poll || !host.passageControl("resume")) throw Error("Audio resume failed");
        timer = clock.setTimer(poll, 50);
      }
    });
    return {
      ...contact,
      update(props, changed) {
        if (changed("qso-copy-value")) contact.copy(props["qso-copy-value"] || "");
        if (!changed("qso-token")) return;
        const action = props["qso-command"];
        if (action === "send-first" || action === "receive-first") contact.start(action === "send-first" ? "send" : "receive");
        else if (action === "consent-allow" || action === "consent-cancel") {
          const allow = action === "consent-allow";
          if (contact.confirm(allow) && allow) host.warm();
        } else if (action?.startsWith("reveal-turn-")) contact.revealTurn(Number(action.slice(12)));
        else if (action === "live-on" || action === "live-off") contact.setLive(action === "live-on");
        else if (action === "start-turn") contact.startTurn();
        else if (["clear", "end", "new", "backspace", "send", "reveal", "check", "pause", "resume", "replay", "retry"].includes(action)) {
          if (action === "clear" || action === "end") host.cancelInput();
          contact[action]();
        }
      }
    };
  }

  // ../../packages/core/src/utils/referenceTint.ts
  var REFERENCE_SCORE_TINT_MAX_ALPHA = 0.18;
  var REFERENCE_RELATIVE_TINT_MIN_DEVIATION = 3;
  var computeReferenceScoreMedian = (scores) => {
    if (scores.length === 0) {
      return 0;
    }
    const sorted = [...scores].sort((a, b2) => a - b2);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  var computeReferenceScoreMaxDeviation = (scores, median) => scores.reduce((max, score) => Math.max(max, Math.abs(score - median)), 0);
  var getReferenceRelativeScoreTint = (scoreValue, medianScore, maxDeviation) => {
    if (maxDeviation < REFERENCE_RELATIVE_TINT_MIN_DEVIATION) {
      return null;
    }
    const relative = (scoreValue - medianScore) / maxDeviation;
    const intensity = Math.abs(relative);
    if (intensity < 0.1) {
      return null;
    }
    const alpha = REFERENCE_SCORE_TINT_MAX_ALPHA * intensity;
    return relative > 0 ? { red: 56, green: 242, blue: 162, alpha } : { red: 255, green: 90, blue: 96, alpha };
  };

  // core/apple-reference.mjs
  function projectReferenceCards(state, project) {
    const groups = buildReference(state);
    const recognition = new Map(buildRecognition(state).bars.map((entry) => [entry.letter, entry]));
    const scores = groups.mastered.map((letter) => state.scores[letter]);
    const median = computeReferenceScoreMedian(scores);
    const deviation = computeReferenceScoreMaxDeviation(scores, median);
    for (const [kind, letters] of [["mastered", groups.mastered], ["learning", groups.learning], ["not-yet", groups.noEvidence]]) {
      const records = letters.map((letter) => {
        const mastered = kind === "mastered";
        const score = state.scores[letter] ?? 0;
        const code = mastered ? referencePattern(letter) : "";
        const sample = recognition.get(letter);
        const label = [letter, kind];
        if (mastered) label.push([...code].map((symbol) => symbol === "." ? "dit" : "dah").join(" "), "score plus " + score);
        if (sample) label.push("recognition " + Math.round(sample.averageMs) + " milliseconds");
        const tint = mastered ? getReferenceRelativeScoreTint(score, median, deviation) : null;
        const border = tint ? "rgba(" + [tint.red, tint.green, tint.blue, tint.alpha].join(",") + ")" : "rgba(255,255,255,0.12)";
        return [
          letter,
          mastered ? "+" + score : "",
          code.replaceAll(".", "\u2022").replaceAll("-", "\u2014"),
          sample && kind !== "not-yet" ? sample.fill + "%" : "",
          label.join(", "),
          border
        ].join("|");
      });
      project("ref-cards-" + kind + ":" + records.join(";"));
    }
  }

  // core/apple-custom.mjs
  function createAppleCustom({ storage, project, host, clock, current }) {
    let chars = 0;
    let timer, poll;
    let duration = 0;
    let elapsed = "";
    let fill = -1;
    function describeDraft(raw) {
      const { normalized, ignored } = normalizeCustomText(raw);
      const { speed, effectiveSpeed } = current().settings;
      const plan = customPlan(normalized, speed, effectiveSpeed);
      const { characterGapMs } = tempoTiming(speed, effectiveSpeed);
      const seconds = plan.length ? Math.ceil((plan.at(-1)[1] + characterGapMs) / 1e3) : 0;
      project("custom-estimate:" + normalized.length + " / 2000 chars \xB7 " + ignored + " ignored \xB7 about " + seconds + " seconds");
    }
    function showTime(ms) {
      const percent = duration > 0 ? Math.min(100, Math.floor(ms * 100 / duration)) : 0;
      if (percent !== fill) {
        fill = percent;
        project("custom-fill:" + percent + "%");
      }
      const text = Math.floor(ms / 1e3) + " / " + Math.ceil(duration / 1e3) + " seconds";
      if (text !== elapsed) {
        elapsed = text;
        project("custom-time:" + text);
      }
    }
    function stop() {
      clock.clearTimer(timer);
      poll = void 0;
      host.passageControl?.("stop");
    }
    const custom = createCustom({
      storage,
      stop,
      project(message) {
        if (message.startsWith("custom-chars:")) chars = Number(message.slice(13));
        if (message.startsWith("custom-editor:")) describeDraft(message.slice(14));
        project(message);
      },
      play(text, done, fail) {
        const { speed, effectiveSpeed, pitch } = current().settings;
        const plan = customPlan(text, speed, effectiveSpeed);
        const { characterGapMs } = tempoTiming(speed, effectiveSpeed);
        if (!plan.length || !host.passageStart?.(plan, pitch, characterGapMs)) {
          fail();
          return;
        }
        duration = plan.at(-1)[1] + characterGapMs;
        showTime(0);
        poll = () => {
          const ms = host.passagePosition();
          if (ms === -2) {
            done();
            custom.reveal();
            return;
          }
          if (!Number.isFinite(ms) || ms < 0) {
            stop();
            fail();
            return;
          }
          showTime(Math.min(ms, duration));
          timer = clock.setTimer(poll, 60);
        };
        timer = clock.setTimer(poll, 60);
      },
      pause() {
        if (!host.passageControl("pause")) throw Error("pause failed");
        clock.clearTimer(timer);
        const ms = host.passagePosition();
        if (ms >= 0) showTime(Math.min(ms, duration));
      },
      resume() {
        if (!host.passageControl("resume")) throw Error("resume failed");
        timer = clock.setTimer(poll, 60);
      }
    });
    return {
      enter() {
        custom.enter();
        project("custom-active:1");
      },
      leave() {
        project("custom-active:0");
        custom.leave();
      },
      suspend: custom.suspend,
      update(props, changed) {
        const raw = props["custom-source-value"] || "";
        if (changed("custom-source-value")) {
          custom.edit(raw);
          describeDraft(raw);
        }
        if (changed("custom-copy-value")) custom.copy(props["custom-copy-value"] || "");
        if (!changed("custom-token")) return;
        const action = props["custom-command"];
        if (action === "save") custom.save(raw, String(props["custom-type-value"]) === "true");
        else if (["edit", "discard", "clear", "play", "pause", "resume", "reveal"].includes(action)) custom[action]();
        if (!chars && ["discard", "clear", "save"].includes(action)) project("custom-done");
      }
    };
  }

  // modules/web/word-round.generated.mjs
  var getEligibleListenPhrases = (phrases, availableLetters) => {
    const available = new Set(availableLetters);
    return phrases.filter((phrase) => [...phrase.text].every((character) => character === " " || available.has(character)));
  };
  var pickIndex = (length, random) => Math.min(length - 1, Math.floor(random() * length));
  var shuffle = (values, random) => {
    const next2 = [...values];
    for (let index = next2.length - 1; index > 0; index -= 1) {
      const swapIndex = pickIndex(index + 1, random);
      const current = next2[index];
      next2[index] = next2[swapIndex];
      next2[swapIndex] = current;
    }
    return next2;
  };
  var createListenPhraseRound = (phrases, options = {}) => {
    if (phrases.length < 4) {
      return null;
    }
    const random = options.random ?? Math.random;
    const targetPool = phrases.filter((phrase) => phrase.id !== options.previousTargetId);
    const target = targetPool[pickIndex(targetPool.length, random)];
    const sameDifficulty = phrases.filter((phrase) => phrase.id !== target.id && phrase.difficulty === target.difficulty);
    const otherDifficulties = phrases.filter((phrase) => phrase.id !== target.id && phrase.difficulty !== target.difficulty);
    const distractors = [
      ...shuffle(sameDifficulty, random),
      ...shuffle(otherDifficulties, random)
    ].slice(0, 3);
    return {
      target,
      options: shuffle([target, ...distractors], random)
    };
  };

  // modules/web/words.mjs
  var ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var eligible = (vocabulary, all, pool = PRACTICE_POOL) => getEligibleListenPhrases(LISTEN_WORD_BANKS[vocabulary], [...all ? ALL : pool]);
  var wordEligibility = (vocabulary, all, pool) => eligible(vocabulary, all, pool).length;
  function wordPlan(text, speed, effective) {
    const { unitMs: unit, characterGapMs } = tempoTiming(speed, effective);
    let offset = 0;
    return [...text].flatMap((char) => {
      const pulses = replayPlan(char, unit);
      if (!pulses.length) return [];
      const shifted = pulses.map(([start, end]) => [offset + start, offset + end]);
      offset = shifted.at(-1)[1] + characterGapMs;
      return shifted;
    });
  }
  function createWords({ play, stop, project, getPool = () => PRACTICE_POOL, initialVocabulary = "common", random = Math.random }) {
    let active = false;
    let all = false;
    let vocabulary = initialVocabulary;
    let phase = "ready";
    let round = null;
    let selected = null;
    let previous;
    let correctCount = 0;
    let attemptCount = 0;
    let ticket = 0;
    function render() {
      const choices = phase === "choosing" || phase === "answered";
      const answered = phase === "answered";
      project("word-phase:" + phase);
      project("word-vocab:" + vocabulary);
      project("word-pool:" + Number(all));
      project("word-ready:" + Number(wordEligibility(vocabulary, all, getPool()) >= 4));
      project("word-options:" + (choices ? round.options.map((item) => item.text).join(",") : ""));
      project("word-picked:" + (answered ? round.options.indexOf(selected) + 1 : ""));
      project("word-correct:" + (answered ? round.options.indexOf(round.target) + 1 : ""));
      project("word-target:" + (answered ? round.target.text : ""));
      project("word-feedback:" + (answered ? selected.id === round.target.id ? "Correct" : "Incorrect: " + round.target.text : ""));
      project("word-meaning:" + (answered && vocabulary === "q-codes" ? round.target.meaning ?? "" : ""));
      project("word-count:" + correctCount + "/" + attemptCount);
    }
    function reset() {
      ticket++;
      stop();
      phase = "ready";
      round = null;
      selected = null;
      if (active) render();
    }
    function playRound() {
      const operation = ++ticket;
      phase = "playing";
      render();
      stop();
      play(round.target, () => {
        if (!active || ticket !== operation || phase !== "playing") return;
        phase = selected ? "answered" : "choosing";
        render();
      }, () => {
        if (!active || ticket !== operation || phase !== "playing") return;
        phase = "audio-error";
        render();
      });
    }
    function start() {
      const result = createListenPhraseRound(eligible(vocabulary, all, getPool()), { previousTargetId: previous, random });
      if (!result) return false;
      previous = result.target.id;
      round = result;
      selected = null;
      playRound();
      return true;
    }
    return {
      enter() {
        active = true;
        reset();
      },
      leave() {
        active = false;
        reset();
      },
      suspend: reset,
      vocabulary(value) {
        if (!Object.hasOwn(LISTEN_WORD_BANKS, value) || vocabulary === value) return;
        vocabulary = value;
        reset();
      },
      pool(value) {
        if (all === value) return;
        all = value;
        reset();
      },
      start() {
        return active && phase === "ready" ? start() : false;
      },
      replay() {
        if (!active || !round) return false;
        playRound();
        return true;
      },
      answer(index) {
        if (!active || phase !== "choosing" || !Number.isInteger(index) || index < 1 || index > 4) return false;
        ++ticket;
        stop();
        selected = round.options[index - 1];
        attemptCount++;
        if (selected.id === round.target.id) correctCount++;
        phase = "answered";
        render();
        return true;
      },
      next() {
        return active && phase === "answered" ? start() : false;
      }
    };
  }

  // core/apple-words.mjs
  var key = "dit.exact-spike.listen.v1";
  var contents = ["characters", "words", "custom"];
  var vocabularies = ["common", "q-codes"];
  function createAppleWords({ storage, clock, host, project, current, nextPrompt }) {
    let preferred = "characters";
    let vocabulary = "common";
    let writable = true;
    try {
      const value = storage.getItem(key);
      if (value !== null) {
        const saved = JSON.parse(value);
        writable = saved?.version === 1 && contents.includes(saved.content) && vocabularies.includes(saved.vocabulary) && Object.keys(saved).length === 3;
        if (writable) {
          preferred = saved.content;
          vocabulary = saved.vocabulary;
        }
      }
    } catch {
      writable = false;
    }
    function saveChoice() {
      if (!writable) return;
      try {
        storage.setItem(key, JSON.stringify({ version: 1, content: preferred, vocabulary }));
      } catch {
        project("storage:unavailable");
      }
    }
    let effective, offered, guided;
    let poll, watchdog;
    let phase = "ready";
    function stop() {
      clock.clearTimer(poll);
      clock.clearTimer(watchdog);
      host.stop();
    }
    const words = createWords({
      getPool: () => current().studyPool,
      initialVocabulary: vocabulary,
      project(message) {
        if (message.startsWith("word-phase:")) phase = message.slice(11);
        project(message);
      },
      stop,
      play(target, done, failed) {
        const { speed, effectiveSpeed, pitch } = current().settings;
        const { characterGapMs } = tempoTiming(speed, effectiveSpeed);
        const plan = wordPlan(target.text, speed, effectiveSpeed);
        const id = nextPrompt();
        if (!host.play(plan, pitch, id)) {
          failed();
          return;
        }
        function check(expired) {
          if (host.promptTailMs(id) >= characterGapMs) {
            clock.clearTimer(poll);
            clock.clearTimer(watchdog);
            done();
          } else if (expired) {
            stop();
            failed();
          } else poll = clock.setTimer(() => check(false), 40);
        }
        poll = clock.setTimer(() => check(false), 40);
        watchdog = clock.setTimer(() => check(true), plan.at(-1)[1] + characterGapMs + 3e3);
      }
    });
    return {
      content: () => effective,
      refresh(courseActive, choice) {
        const pool = current().studyPool;
        const available = vocabularies.some((bank) => wordEligibility(bank, false, pool) >= 4);
        if (contents.includes(choice) && !courseActive && (choice !== "words" || available) && preferred !== choice) {
          preferred = choice;
          saveChoice();
        }
        const content = courseActive || !available && preferred === "words" ? "characters" : preferred;
        if (guided !== courseActive) project("listen-course:" + Number(courseActive));
        if (offered !== available) project("words-available:" + Number(available));
        if (effective !== content || choice) project("apple-listen-content:" + content);
        guided = courseActive;
        offered = available;
        effective = content;
      },
      enter: words.enter,
      leave: words.leave,
      suspend: words.suspend,
      command(value) {
        if (vocabularies.includes(value)) {
          if (vocabulary !== value) {
            vocabulary = value;
            saveChoice();
            words.vocabulary(value);
          }
        } else if (value === "start") {
          if (phase === "audio-error") words.suspend();
          words.start();
        } else if (value === "replay" && (phase === "choosing" || phase === "answered")) words.replay();
        else if (value === "next") words.next();
        else if (/^option-[1-4]$/.test(value)) words.answer(Number(value.slice(-1)));
      }
    };
  }

  // core/apple-session.mjs
  var createAccount = (host, initial) => createAccountSession(host, create, initial);
  var HAPTICS_KEY = "dit.exact-spike.haptics.v1";
  function readHaptics(storage) {
    try {
      const value = storage.getItem(HAPTICS_KEY);
      if (value === null || value === "true" || value === "false")
        return { enabled: value !== "false", writable: true };
    } catch {
    }
    return { enabled: false, writable: false };
  }
  var METHOD_KEY = "dit.exact-spike.method.v1";
  function create(host) {
    const storage = {
      getItem(key2) {
        const [status2, value] = host.read(key2);
        if (status2 === "missing") return null;
        if (status2 !== "ok") throw Error("storage unavailable");
        return value;
      },
      setItem(key2, value) {
        if (!host.write(key2, value)) throw Error("storage unavailable");
      }
    };
    const pristine = (snapshot) => snapshot.status === "empty" || snapshot.status === "saved" && JSON.stringify(snapshot.data) === JSON.stringify(normalizePractice(null));
    const initial = loadPractice(storage);
    let inheritedAutoPlay = true;
    try {
      const raw = storage.getItem("dit.exact-spike.legacy.v1");
      if (raw !== null) {
        const receipt = JSON.parse(raw);
        inheritedAutoPlay = receipt?.version === 1 && receipt.preserved?.practiceAutoPlay !== false;
        if (receipt?.version === 1) {
          if (initial.data.settings.selection?.kind === "custom" && initial.data.settings.maxLevel === void 0 && [1, 2, 3, 4].includes(receipt.preserved?.maxLevel)) initial.data.settings.maxLevel = receipt.preserved.maxLevel;
          if (initial.data.settings.practiceWords === void 0 && typeof receipt.preserved?.practiceWordMode === "boolean")
            initial.data.settings.practiceWords = receipt.preserved.practiceWordMode;
          if (initial.data.bestWpm === void 0 && Number.isFinite(receipt.preserved?.bestWpm) && receipt.preserved.bestWpm >= 0)
            initial.data.bestWpm = receipt.preserved.bestWpm;
          for (const key2 of ["showHint", "showMnemonic"]) {
            if (initial.data.settings[key2] === void 0 && typeof receipt.preserved?.[key2] === "boolean")
              initial.data.settings[key2] = receipt.preserved[key2];
          }
        }
      }
    } catch {
      inheritedAutoPlay = false;
    }
    const savedGuide = readGuide(storage);
    const timers = /* @__PURE__ */ new Map();
    let nextID = 0;
    const clock = {
      setTimer(fn, delay2) {
        const id = ++nextID;
        timers.set(id, fn);
        host.schedule(id, delay2);
        return id;
      },
      clearTimer(id) {
        if (timers.delete(id)) host.cancelTimer(id);
      }
    };
    let guideTarget = "";
    let lastPrompt = "";
    const project = (detail) => {
      if (detail.startsWith("guide-target:")) guideTarget = detail.slice(13);
      host.project(detail);
    };
    let { enabled: hapticsEnabled, writable: hapticsSaved } = readHaptics(storage);
    function publishHaptics() {
      project("haptics-enabled:" + Number(hapticsEnabled));
      project("haptics-saved:" + Number(hapticsSaved));
    }
    function chooseHaptics(enabled) {
      hapticsEnabled = enabled;
      try {
        if (!readHaptics(storage).writable) throw Error("protected");
        storage.setItem(HAPTICS_KEY, String(enabled));
        hapticsSaved = true;
      } catch {
        hapticsSaved = false;
      }
      publishHaptics();
    }
    let method = null;
    try {
      method = storage.getItem(METHOD_KEY);
    } catch {
    }
    function remember(value) {
      if (value === method || method !== null && !["guided", "open"].includes(method)) return;
      try {
        storage.setItem(METHOD_KEY, value);
        method = value;
      } catch {
        project("storage:unavailable");
      }
    }
    const hintKey = "dit.exact-spike.intro-hint.v1";
    let hint = null;
    try {
      hint = storage.getItem(hintKey);
    } catch {
      hint = "unavailable";
    }
    const knownHint = () => ["morse", "settings", "done"].includes(hint);
    function advanceHint(next2) {
      if (hint !== null && !knownHint()) return;
      hint = next2;
      try {
        storage.setItem(hintKey, next2);
      } catch {
      }
      project("intro-hint:" + next2);
    }
    let practiceStatus = initial.status;
    let props = {};
    let ready = false;
    let locked = false;
    let guideLocked = false;
    let status = "checking";
    let replayed = false;
    let interrupted = false;
    let closed = false;
    let lastWidget = "";
    function publishWidget(force = false) {
      if (!ready || closed) return;
      const at = new Date(host.wallNow?.() ?? Date.now());
      const state = session.current();
      const hero = computeHero({ ...state, learnerProfile: nux.profile() });
      const { correct, goal } = todayStreakContribution(state, at);
      const value = JSON.stringify({
        known: hero.kind === "wpm",
        mastered: hero.kind === "mastered" ? hero.count : 0,
        bestWpm: state.bestWpm ?? 0,
        streak: state.streak?.current ?? 0,
        today: Math.min(correct, goal),
        goal,
        day: dateKey(at)
      });
      if (force || value !== lastWidget) {
        lastWidget = value;
        project("widget-summary:" + value);
      }
    }
    const session = createSession({
      ...clock,
      project,
      monotonicNow: () => host.monotonicMs?.() ?? NaN,
      data: initial.data,
      cleanInstall: pristine(initial),
      courseComplete: guideReached(savedGuide.data) === GUIDED_PACKS.length,
      onLock(value) {
        locked = value;
      },
      onChange(state) {
        practiceStatus = savePractice(storage, state);
        if (ready) {
          reminder.sync();
          publishWidget();
        }
        project("storage:" + practiceStatus);
      }
    });
    const reminder = createReminder({ storage, host, project, progress: () => session.current() });
    const pick = (pool, previous) => pickWeighted(pool, session.current().scores, previous, Math.random());
    let nextPrompt = 0;
    const play = (letter, scheduled) => {
      const { speed, effectiveSpeed, pitch } = session.current().settings;
      const { unitMs, characterGapMs } = tempoTiming(speed, effectiveSpeed);
      const id = scheduled ? ++nextPrompt : 0;
      const started = host.play(replayPlan(letter, unitMs), pitch, id);
      if (started && scheduled) {
        scheduled(characterGapMs, () => host.promptTailMs?.(id));
      }
      return started;
    };
    const listenPractice = createAppleListenPractice(session.current);
    const listen = createListen({
      ...clock,
      project,
      stop: () => host.stop(),
      play,
      getPool: () => props.mode === "guided" ? guide.pool() : session.current().studyPool,
      pick: (previous) => props.mode === "guided" ? guide.pickListen(previous) : listenPractice.pick(previous),
      isGuided: () => props.mode === "guided",
      onRoundEnd: () => props.mode !== "guided" || guide.finishListenRound(),
      record(letter, correct, sample) {
        if (props.mode === "guided") guide.recordListen(letter, correct, sample);
        else {
          const before = session.current().listenTtr;
          session.dispatch({ type: "listenScore", letter, correct, sample });
          const after = session.current().listenTtr;
          if (!correct && before !== after) listenPractice.miss(letter, after[letter].averageMs);
        }
      }
    });
    const guide = createGuide({
      ...clock,
      storage,
      project,
      decode,
      play,
      pick,
      pickListenWeighted(pool, previous) {
        const { scores, listenTtr } = session.current();
        return pickLatencyAware(pool, scores, listenTtr, previous, Math.random());
      },
      startListen: () => listen.enter(),
      stopListen: () => listen.exit(),
      score: (letter, correct, mode, sample) => session.dispatch({ type: "guidedScore", letter, correct, mode, sample }),
      lock(value) {
        guideLocked = value;
      },
      completed(status2) {
        remember("open");
        session.dispatch({ type: "coursePool" });
        session.dispatch({ type: "courseComplete" });
        project("guide-storage:" + status2);
        project("guide-completed:celebrate");
      }
    });
    const nux = createNux({
      reminder: { enable: reminder.enable, cancel: reminder.cancel, validTime, reducedMotion: () => props["reduce-motion"] === "true" },
      ...clock,
      storage,
      ownsFresh: true,
      persistInferred: true,
      play: () => play("E"),
      stop: () => host.stop(),
      warm: () => host.warm(),
      checkSound() {
        const audible = play("E");
        if (host.outputVolume() < 0.05) return "low";
        return audible ? "heard" : "failed";
      },
      // Shipped useOnboardingState treats defaults-only saves as a first launch.
      // Experiment profile/status live together in the onboarding record.
      hasPriorProgress: () => method === "guided" || Object.values(initial.data.scores).some((score) => score > 0) || method === null && savedGuide.status === "saved",
      project(detail) {
        if (detail.startsWith("nux-reminder-time:")) project("nux-reminder-label:" + clockLabel(detail.slice(18)));
        if (detail.startsWith("nux-status:")) {
          const previous = status;
          status = detail.slice(11);
          if (status === "completed" && previous === "pending") advanceHint("done");
          if (hint === null) hint = status === "completed" ? "done" : "morse";
          project("intro-hint:" + (knownHint() ? hint : "done"));
        }
        if (detail === "nux-enter:guided") {
          if (!replayed && pristine(loadPractice(storage)) && readGuide(storage).status === "empty")
            session.dispatch({ type: "freshBeginnerDefaults" });
          remember("guided");
        } else if (detail === "nux-enter:practice") remember("open");
        project(detail);
      }
    });
    const contact = createAppleConversation({ clock, host, project, current: session.current });
    const custom = createAppleCustom({ storage, clock, host, project, current: session.current });
    const words = createAppleWords({ storage, clock, host, project, current: session.current, nextPrompt: () => ++nextPrompt });
    const listenMode = (p2) => p2.mode === "listen" ? words.content() : null;
    const courseActive = () => !guide.completed() && (method === "guided" || method === null && savedGuide.status === "saved");
    const modal = (p2) => p2.blocked === "true" || p2.blocked === "1" || p2.blocked === true;
    function canKey() {
      if (!ready || closed || interrupted || modal(props) || locked || guideLocked) return false;
      if (status === "pending" && props.mode !== "nux") return false;
      return ["practice", "freestyle"].includes(props.mode) || props.mode === "guided" && guide.canKey() || props.mode === "nux" && nux.canKey() || props.mode === "conversation" && contact.canKey();
    }
    let inputSymbols = "";
    let previousHelpers = null;
    function publishHelpers() {
      const { settings, target } = session.current();
      const letter = props.mode === "guided" ? guideTarget : props.mode === "practice" ? target : "";
      const pattern = MORSE_DATA[letter];
      const code = settings.showHint ? pattern?.code ?? "" : "";
      const mnemonic = settings.showMnemonic ? pattern?.mnemonic ?? "" : "";
      const hits = code && code.startsWith(inputSymbols) ? inputSymbols.length : 0;
      const fields = [code, mnemonic, code.slice(0, hits)];
      for (const [i, key2] of ["helper-code", "helper-mnemonic", "helper-hits"].entries())
        if (previousHelpers?.[i] !== fields[i]) project(key2 + ":" + fields[i]);
      previousHelpers = fields;
    }
    function cancelInput() {
      inputSymbols = "";
      host.cancelInput();
      host.stop();
      session.dispatch({ type: "cancel" });
    }
    function playPrompt() {
      if (!canKey() || !["practice", "guided"].includes(props.mode)) return;
      if (props.mode === "practice" && !(session.current().settings.autoPlay ?? inheritedAutoPlay)) return;
      const letter = props.mode === "guided" ? guideTarget : session.current().target;
      const { speed, effectiveSpeed, pitch } = session.current().settings;
      const prompt = [props.mode, letter, speed, effectiveSpeed, pitch].join(":");
      if (!letter || lastPrompt === prompt) return;
      lastPrompt = prompt;
      play(letter);
    }
    return {
      bootstrap() {
        if (ready) return;
        ready = true;
        project("apple-session:ready");
        project("calendar-year:" + (/* @__PURE__ */ new Date()).getFullYear());
        session.projectState();
        project("autoPlay:" + (session.current().settings.autoPlay ?? inheritedAutoPlay));
        project("storage:" + practiceStatus);
        guide.projectCatalog();
        if (guide.completed()) project("guide-completed:restored");
        else if (method === "guided" || method === null && savedGuide.status === "saved")
          project(savedGuide.data.phase === "listen" ? "nux-enter:practice" : "nux-enter:guided");
        words.refresh(courseActive());
        publishHaptics();
        reminder.publish();
        reminder.sync();
        publishWidget();
        nux.project();
      },
      setProps(next2) {
        const prev = props;
        const first = prev.mode === void 0;
        const changed = (key2) => !first && prev[key2] !== next2[key2];
        const scope = first || changed("mode") || changed("route-boundary");
        const wasBlocked = modal(prev);
        const blocked = modal(next2);
        const referenceOpen = next2["reference-open"] === "true";
        const wasReferenceOpen = prev["reference-open"] === "true";
        props = next2;
        if (wasReferenceOpen && !referenceOpen) host.stop();
        if (prev["settings-open"] === "true" && next2["settings-open"] !== "true") reminder.cancel();
        if (hint === "settings" && changed("settings-open") && next2["settings-open"] === "true") advanceHint("done");
        if (scope) lastPrompt = "";
        if (scope || changed("cancel-token") || changed("clear-token") || !wasBlocked && blocked) cancelInput();
        if (scope && prev.mode === "guided") guide.leave();
        if (scope && prev.mode === "nux") nux.close();
        if (scope && prev.mode === "conversation") contact.leave();
        const previousListen = listenMode(prev);
        session.dispatch({ type: "mode", mode: next2.mode });
        if (!ready) return;
        if (referenceOpen && !wasReferenceOpen && blocked) projectReferenceCards(session.current(), project);
        if (referenceOpen && wasReferenceOpen && blocked && !scope && !interrupted && !changed("cancel-token") && changed("reference-token") && /^[A-Z0-9]$/.test(next2["reference-char"])) {
          const letter = next2["reference-char"];
          play(letter);
          project("ref-pattern:" + referencePattern(letter));
        }
        if (scope && next2.mode === "guided") remember("guided");
        if (scope && courseActive() && (next2.mode === "practice" || next2.mode === "listen"))
          session.dispatch({ type: "coursePool", letters: guide.pool() });
        let selectionChanged = false;
        if (changed("pref-token")) {
          const command = next2["pref-command"];
          const selection = scopeCommand(command);
          if (command === "reset-local-app") {
            if (!interrupted && blocked && prev["settings-open"] === "true" && next2["settings-open"] === "true") {
              if (host.requestLocalReset) host.requestLocalReset();
              else project("local-reset:error");
            }
          } else if (command === "reset-scores") {
            if (referenceOpen && wasReferenceOpen && blocked && !interrupted) {
              session.dispatch({ type: "resetScores" });
              projectReferenceCards(session.current(), project);
            }
          } else if (command === "haptics-on" || command === "haptics-off") {
            const onTutorial = next2.mode === "nux" && !blocked && nux.canKey();
            if (!interrupted && (next2["settings-open"] === "true" || onTutorial)) chooseHaptics(command === "haptics-on");
          } else if (command === "recommended") {
            if (!interrupted && next2["settings-open"] === "true" && !courseActive()) {
              const previous = session.current();
              session.dispatch({ type: "recommended", profile: nux.profile(), inheritedAutoPlay });
              if (previous !== session.current()) {
                selectionChanged = true;
                inputSymbols = "";
                host.cancelInput();
                host.stop();
                lastPrompt = "";
              }
            }
          } else if (/^(sequential|ifr|review)-(on|off)$/.test(command)) {
            if (!interrupted && next2["settings-open"] === "true" && !courseActive()) {
              const [control, value] = command.split("-");
              session.dispatch({ type: "practiceControl", control, enabled: value === "on" });
            }
          } else if (command === "practice-words-on" || command === "practice-words-off") {
            if (!interrupted && next2["settings-open"] === "true" && !courseActive()) {
              cancelInput();
              session.dispatch({ type: "preference", command });
            }
          } else if (["hint-on", "hint-off", "mnemonic-on", "mnemonic-off"].includes(command)) {
            if (!interrupted && next2["settings-open"] === "true") session.dispatch({ type: "preference", command });
          } else if (command === "test-sound") {
            if (!interrupted && next2["settings-open"] === "true") play("A");
          } else if (command === "autoplay-on" || command === "autoplay-off") {
            if (!interrupted && next2["settings-open"] === "true") {
              lastPrompt = "";
              session.dispatch({ type: "preference", command });
            }
          } else if (command?.startsWith("reminder-")) {
            if (next2["settings-open"] === "true" && !interrupted) reminder.settings(command);
          } else if (selection) {
            selectionChanged = true;
            remember("open");
            cancelInput();
            const nextSelection = selection.kind === "custom" ? { kind: "custom", letters: Object.keys(MORSE_DATA).filter((letter) => selection.letters.includes(letter)) } : selection;
            session.dispatch({ type: "selection", selection: nextSelection, rememberLevel: true });
          } else if (command === "course-open") {
            remember("open");
            session.dispatch({ type: "coursePool" });
            session.dispatch({ type: "openPractice" });
          } else if (next2.mode === "guided" && /^course-pack:(?:[1-9]|1[0-4])$/.test(command)) {
            cancelInput();
            guide.selectPack(Number(command.slice(12)) - 1);
          } else if (!["toggle-strategy", "toggle-ifr", "toggle-review"].includes(command)) session.dispatch({ type: "preference", command });
        }
        if (changed("clear-token")) session.dispatch({ type: "clear" });
        const replay = !blocked && !interrupted && changed("warm-token");
        const choice = changed("listen-choice-token") && next2.mode === "listen" && !blocked && !interrupted;
        if (scope || changed("pref-token") || choice)
          words.refresh(courseActive(), choice ? next2["listen-content"] : void 0);
        const content = listenMode(next2);
        const entering = scope || previousListen !== content;
        if (entering || selectionChanged || changed("cancel-token") || !wasBlocked && blocked) listenPractice.reset();
        if (entering && previousListen === "characters") listen.exit();
        if (entering && previousListen === "words") words.leave();
        if (entering && previousListen === "custom") custom.leave();
        if (next2.mode === "guided") {
          if (scope) guide.enter(!blocked && !interrupted);
          else guide.blocked(blocked || interrupted);
          if (!blocked && changed("guide-token")) guide.continue();
          if (replay && !guide.isListening()) guide.replay();
        }
        if (!blocked && changed("nux-token")) {
          const command = next2["nux-command"];
          if (command === "replay") {
            replayed = true;
            nux.act(command);
          } else if (next2.mode === "nux") nux.act(command);
          publishWidget();
        }
        if (next2.mode === "conversation" && status !== "pending") {
          if (scope) contact.enter();
          else if (!wasBlocked && blocked || changed("cancel-token")) contact.interrupt();
          else if (!blocked && !interrupted) contact.update(next2, changed);
        }
        if (content === "custom") {
          if (entering) custom.enter();
          else if (!wasBlocked && blocked || changed("cancel-token") || changed("clear-token")) custom.suspend();
          if (!blocked && !interrupted) custom.update(next2, changed);
        }
        if (content === "words") {
          if (entering) words.enter();
          else if (selectionChanged || changed("cancel-token") || changed("clear-token") || !wasBlocked && blocked) words.suspend();
          if (!blocked && !interrupted && changed("word-token")) words.command(next2["word-command"]);
        }
        if (content === "characters" && (blocked || interrupted) && !wasBlocked) listen.suspend();
        if (content === "characters" && !blocked && !interrupted && (entering || wasBlocked || selectionChanged))
          listen.enter({ autoplay: !guide.completed() || prev.mode !== "guided" });
        if (!blocked && !interrupted && (content === "characters" || guide.isListening())) {
          if (replay) listen.replay();
          if (changed("answer-token")) listen.answer(next2["answer-value"], next2["answer-prompt"] ?? "");
        }
        if (replay && next2.mode === "practice") {
          cancelInput();
          session.dispatch({ type: "replay" });
          play(session.current().target);
        } else playPrompt();
        publishHelpers();
      },
      input(kind, value) {
        if (!canKey()) return;
        if (props.mode === "conversation") {
          if (kind === "down") contact.activity();
          if (kind === "sequence") contact.key(value);
        } else if (props.mode === "nux") {
          if (kind === "symbol") nux.symbol(value);
        } else if (kind === "sequence") {
          inputSymbols = "";
          if (props.mode === "guided") guide.accept(value);
          else {
            session.dispatch({ type: "sequence", code: value });
            if (props.mode === "practice" && session.current().settings.practiceWords) playPrompt();
          }
        } else if (kind === "symbol") {
          if ((props.mode === "practice" || props.mode === "guided") && session.current().settings.showHint)
            inputSymbols = (inputSymbols + value).slice(0, 6);
          session.dispatch({ type: "symbol", symbol: value });
        } else if (kind === "down") {
          if (hint === "morse") advanceHint("settings");
          session.dispatch({ type: "toneStart" });
        }
        publishHelpers();
      },
      timer(id) {
        const fn = timers.get(id);
        timers.delete(id);
        fn?.();
        playPrompt();
        publishHelpers();
      },
      permissionResult(id, result) {
        reminder.permission(id, result);
      },
      scheduleResult(id, result) {
        reminder.scheduled(id, result);
      },
      foreground() {
        if (ready && !closed) {
          reminder.sync();
          publishWidget(true);
        }
      },
      interrupt(value) {
        if (value === interrupted) return;
        interrupted = value;
        if (value) {
          listenPractice.reset();
          cancelInput();
          listen.suspend();
          if (props.mode === "conversation") contact.interrupt();
          if (listenMode(props) === "words") words.suspend();
          if (listenMode(props) === "custom") custom.suspend();
        }
        if (props.mode === "guided") guide.blocked(value || modal(props));
      },
      configuration() {
        const { speed, pitch } = session.current().settings;
        return { enabled: canKey(), unit: playbackUnitMs(speed), pitch, hapticsEnabled };
      },
      dispose() {
        closed = true;
        if (props.mode === "conversation") contact.leave();
        custom.leave();
        words.leave();
        nux.close();
        guide.leave();
        listen.exit();
        session.dispose();
        for (const id of timers.keys()) clock.clearTimer(id);
      }
    };
  }
  return __toCommonJS(apple_session_exports);
})();
