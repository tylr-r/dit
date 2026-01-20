import {
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  INTER_LETTER_UNITS,
  INTER_WORD_UNITS,
  MORSE_CODE,
  UNIT_TIME_MS,
  WPM_RANGE,
  applyScoreDelta,
  formatWpm,
  getLettersForLevel,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  parseProgress,
  type Letter,
  type ProgressSnapshot,
  type ScoreRecord,
} from '@dit/core';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { GlassButton } from './components/GlassButton';
import { GlassSurface } from './components/GlassSurface';
import { useFirebaseService } from './firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { playTone, startTone, stopTone, unloadTone } from './native/audio';
import {
  triggerDashHaptic,
  triggerDotHaptic,
  triggerSuccessHaptic,
} from './native/haptics';

const LETTERS = Object.keys(MORSE_CODE) as Letter[];
const LEVELS = [1, 2, 3, 4];
const REFERENCE_LETTERS = LETTERS.filter((letter) => /^[A-Z]$/.test(letter));
const REFERENCE_NUMBERS: Letter[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
];
const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];
const CODE_TO_LETTER = Object.entries(MORSE_CODE).reduce<
  Record<string, Letter>
>((acc, [letter, data]) => {
  acc[data.code] = letter as Letter;
  return acc;
}, {});

const SCORE_INTENSITY_MAX = 15;
const INITIAL_MAX_LEVEL = 2;
const [LISTEN_WPM_MIN, LISTEN_WPM_MAX] = WPM_RANGE;
const INITIAL_WPM = Math.round((WPM_RANGE[0] + WPM_RANGE[1]) / 2);
const WORD_GAP_MS = UNIT_TIME_MS * INTER_WORD_UNITS;
const WORD_GAP_EXTRA_MS = Math.max(WORD_GAP_MS - DEBOUNCE_DELAY, 0);
const PRACTICE_WORD_UNITS = 5;
const LOGO_SVG = `<svg width="806" height="806" viewBox="0 0 806 806" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M92.1113 255.555C74.9852 291.601 63.9443 331.099 60.3145 372.72L4.51855 367.913C8.72293 319.533 21.5381 273.619 41.4258 231.712L92.1113 255.555Z" fill="white"/>
<path d="M260.393 89.8623C224.063 106.377 190.159 129.454 160.553 158.931L120.998 119.287C155.401 85.0127 194.798 58.1747 237.017 38.9598L260.393 89.8623Z" fill="white"/>
<path d="M405.179 58.9257C365.272 58.6455 324.81 65.3391 285.557 79.6465L266.323 27.0505C311.944 10.4061 358.971 2.60752 405.357 2.91256L405.179 58.9257Z" fill="white"/>
<path d="M550.068 91.9326C514.001 74.8502 474.49 63.8573 432.864 60.278L437.603 4.47627C485.988 8.62192 531.918 21.3814 573.849 41.2181L550.068 91.9326Z" fill="white"/>
<path d="M715.074 258.079C698.29 221.872 674.963 188.141 645.267 158.753L684.618 118.906C719.146 153.054 746.275 192.251 765.802 234.327L715.074 258.079Z" fill="white"/>
<path d="M735.04 493.228C745.532 454.724 749.424 413.897 745.647 372.289L801.415 367.167C805.82 415.529 801.315 462.985 789.14 507.745L735.04 493.228Z" fill="white"/>
<path d="M431.712 745.881C471.483 742.578 511.181 732.28 548.991 714.507L572.868 765.164C528.926 785.836 482.788 797.824 436.563 801.684L431.712 745.881Z" fill="white"/>
<path d="M283.877 725.802C321.308 739.645 361.633 747.118 403.412 747.02L403.602 803.022C355.04 803.151 308.165 794.483 264.651 778.413L283.877 725.802Z" fill="white"/>
<path d="M104.124 573.485C123.874 608.163 149.937 639.828 181.984 666.633L146.1 709.628C108.84 678.483 78.5317 641.69 55.558 601.392L104.124 573.485Z" fill="white"/>
<circle cx="99" cy="189" r="28" fill="white"/>
<circle cx="617" cy="99" r="28" fill="white"/>
<circle cx="615.933" cy="707.749" r="28" fill="white"/>
<circle cx="762.114" cy="306.827" r="28" fill="white"/>
<circle cx="740.405" cy="559.108" r="28" fill="white"/>
<circle cx="688.211" cy="641.467" r="28" fill="white"/>
<circle cx="215.711" cy="724.146" r="28" fill="white"/>
<circle cx="53.2655" cy="529.086" r="28" fill="white"/>
<circle cx="32.5273" cy="434.015" r="28" fill="white"/>
<circle cx="630.682" cy="508.496" r="21" fill="white"/>
<circle cx="650.503" cy="445.807" r="21" fill="white"/>
<circle cx="620.825" cy="276.778" r="21" fill="white"/>
<circle cx="379.724" cy="152.108" r="21" fill="white"/>
<circle cx="315.716" cy="166.752" r="21" fill="white"/>
<circle cx="257.693" cy="197.49" r="21" fill="white"/>
<circle cx="160.812" cy="336.686" r="21" fill="white"/>
<circle cx="176.189" cy="509.334" r="21" fill="white"/>
<circle cx="509.219" cy="629.738" r="21" fill="white"/>
<path d="M633.796 403.321C633.856 376.485 629.218 349.3 619.458 322.959L657.877 308.632C669.377 339.625 674.853 371.611 674.806 403.19L633.796 403.321Z" fill="white"/>
<path d="M579.591 254.275C562.335 233.722 541.264 215.932 516.821 202.088L536.952 166.367C565.724 182.644 590.532 203.565 610.855 227.735L579.591 254.275Z" fill="white"/>
<path d="M500.371 193.555C476.056 182.199 449.446 174.956 421.445 172.714L424.631 131.835C457.584 134.457 488.902 142.962 517.523 156.304L500.371 193.555Z" fill="white"/>
<path d="M239.571 239.382C220.558 258.321 204.62 280.827 192.901 306.357L155.6 289.33C169.376 259.28 188.115 232.785 210.473 210.484L239.571 239.382Z" fill="white"/>
<path d="M172.556 382.964C170.214 409.697 172.522 437.178 180.005 464.254L140.507 475.261C131.685 443.402 128.95 411.066 131.684 379.606L172.556 382.964Z" fill="white"/>
<path d="M213.114 534.982C228.431 557.017 247.799 576.649 270.883 592.656L247.589 626.4C220.415 607.576 197.61 584.488 179.567 558.571L213.114 534.982Z" fill="white"/>
<path d="M286.688 602.764C309.884 616.259 335.735 625.864 363.421 630.614L356.574 671.041C323.99 665.468 293.564 654.183 266.257 638.322L286.688 602.764Z" fill="white"/>
<path d="M382.018 633.093C408.744 635.519 436.232 633.297 463.331 625.898L474.214 665.43C442.328 674.152 409.984 676.787 378.532 673.955L382.018 633.093Z" fill="white"/>
<path d="M535.023 591.889C557.076 576.598 576.731 557.254 592.766 534.189L626.482 557.523C607.625 584.675 584.51 607.452 558.572 625.464L535.023 591.889Z" fill="white"/>
<circle cx="403" cy="403" r="62" fill="white"/>
</svg>`;
const COLORS = {
  bg: '#0a0c12',
  text: '#f4f7f9',
  muted: '#8d98a5',
  accent: '#38f2a2',
  accentCool: '#4cc9ff',
  error: '#ff6b6b',
};
const MODE_OPTIONS = [
  { key: 'practice', label: 'Practice' },
  { key: 'freestyle', label: 'Freestyle' },
  { key: 'listen', label: 'Listen' },
] as const;

type Mode = (typeof MODE_OPTIONS)[number]['key'];

type TimeoutRef = { current: ReturnType<typeof setTimeout> | null };

const SettingsIcon = ({ color = COLORS.text }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.86a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.71 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
      fill={color}
    />
  </Svg>
);

const pickNextLetter = (
  letters: Letter[],
  scores: ScoreRecord,
  previous?: Letter,
) => getRandomWeightedLetter(letters, scores, previous);

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const getScoreStyle = (scoreValue: number) => {
  if (scoreValue === 0) {
    return;
  }
  const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX;
  const intensity = Math.min(Math.max(normalized, 0.2), 1);
  const alpha = 0.35 * intensity;
  const tint = scoreValue > 0 ? '56, 242, 162' : '255, 90, 96';
  return {
    backgroundColor: `rgba(${tint}, ${alpha})`,
  };
};

const clearTimeoutRef = (ref: TimeoutRef) => {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export default function App() {
  const initialScores = useMemo(() => initializeScores(), []);
  const [progress, setProgress] = useState<ProgressSnapshot>(() => ({
    listenWpm: INITIAL_WPM,
    maxLevel: INITIAL_MAX_LEVEL,
    practiceWordMode: false,
    scores: initialScores,
    showHint: true,
    showMnemonic: true,
    wordMode: false,
  }));
  const availableLetters = useMemo(
    () => getLettersForLevel(progress.maxLevel),
    [progress.maxLevel],
  );
  const availablePracticeWords = useMemo(
    () => getWordsForLetters(availableLetters),
    [availableLetters],
  );
  const [practiceWord, setPracticeWord] = useState(() =>
    getRandomWord(getWordsForLetters(getLettersForLevel(INITIAL_MAX_LEVEL))),
  );
  const [practiceWordIndex, setPracticeWordIndex] = useState(0);
  const [practiceWpm, setPracticeWpm] = useState<number | null>(null);
  const [targetLetter, setTargetLetter] = useState<Letter>(() =>
    pickNextLetter(getLettersForLevel(INITIAL_MAX_LEVEL), initialScores),
  );
  const [listenTarget, setListenTarget] = useState<Letter>(() =>
    pickNextLetter(getLettersForLevel(INITIAL_MAX_LEVEL), initialScores),
  );
  const [mode, setMode] = useState<Mode>('practice');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [freestyleInput, setFreestyleInput] = useState('');
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null);
  const [freestyleWord, setFreestyleWord] = useState('');
  const [listenStatus, setListenStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [listenReveal, setListenReveal] = useState<Letter | null>(null);
  const [listenPlaying, setListenPlaying] = useState(false);
  const [showHintOnce, setShowHintOnce] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [soundCheckStatus, setSoundCheckStatus] = useState<'idle' | 'playing'>(
    'idle',
  );
  const pressStartRef = useRef<number | null>(null);
  const scoresRef = useRef(progress.scores);
  const practiceWordRef = useRef(practiceWord);
  const practiceWordIndexRef = useRef(practiceWordIndex);
  const practiceWordStartRef = useRef<number | null>(null);
  const freestyleInputRef = useRef(freestyleInput);
  const freestyleWordModeRef = useRef(progress.wordMode);
  const freestyleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordSpaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isPractice = mode === 'practice';
  const isFreestyle = mode === 'freestyle';
  const isListen = mode === 'listen';
  const isListenIdle = isListen && listenStatus === 'idle' && !listenPlaying;
  const practiceWordMode = progress.practiceWordMode;
  const freestyleWordMode = progress.wordMode;

  const practiceCode = MORSE_CODE[targetLetter].code;
  const listenCode = MORSE_CODE[listenTarget].code;

  const { firebaseService, isAuthRequestReady } = useFirebaseService();

  const handleFreestyleClear = useCallback(() => {
    clearTimeoutRef(freestyleTimeoutRef);
    clearTimeoutRef(wordSpaceTimeoutRef);
    freestyleInputRef.current = '';
    setFreestyleInput('');
    setFreestyleResult(null);
    setFreestyleWord('');
  }, []);

  const applyPracticeWordModeState = useCallback(
    (nextValue: boolean) => {
      practiceWordStartRef.current = null;
      setPracticeWpm(null);
      setInput('');
      setResult(null);
      setShowHintOnce(false);
      if (!nextValue) {
        setPracticeWordIndex(0);
        setTargetLetter((previous) =>
          pickNextLetter(availableLetters, scoresRef.current, previous),
        );
        return;
      }
      const nextWord = getRandomWord(
        availablePracticeWords,
        practiceWordRef.current,
      );
      setPracticeWord(nextWord);
      setPracticeWordIndex(0);
      setTargetLetter(nextWord[0] as Letter);
    },
    [availableLetters, availablePracticeWords],
  );

  const handleRemoteProgress = useCallback(
    (raw: unknown) => {
      const parsed = parseProgress(raw, {
        listenWpmMin: WPM_RANGE[0],
        listenWpmMax: WPM_RANGE[1],
        levelMin: 1,
        levelMax: 4,
      });
      if (!parsed) {
        return;
      }
      setProgress((prev) => ({
        ...prev,
        ...parsed,
        scores: parsed.scores ?? prev.scores,
      }));
      if (
        typeof parsed.practiceWordMode === 'boolean' &&
        parsed.practiceWordMode !== practiceWordMode
      ) {
        applyPracticeWordModeState(parsed.practiceWordMode);
      }
      if (
        typeof parsed.wordMode === 'boolean' &&
        parsed.wordMode !== freestyleWordMode
      ) {
        handleFreestyleClear();
      }
    },
    [
      applyPracticeWordModeState,
      freestyleWordMode,
      handleFreestyleClear,
      practiceWordMode,
    ],
  );

  const { authReady, handleSignIn, handleSignOut, remoteLoaded, user } =
    useFirebaseSync({
      firebaseService,
      progressSnapshot: progress,
      progressSaveDebounceMs: 900,
      onRemoteProgress: handleRemoteProgress,
      trackEvent: () => {},
    });

  useEffect(() => {
    scoresRef.current = progress.scores;
  }, [progress.scores]);

  useEffect(() => {
    practiceWordRef.current = practiceWord;
  }, [practiceWord]);

  useEffect(() => {
    practiceWordIndexRef.current = practiceWordIndex;
  }, [practiceWordIndex]);

  useEffect(() => {
    freestyleInputRef.current = freestyleInput;
  }, [freestyleInput]);

  useEffect(() => {
    freestyleWordModeRef.current = freestyleWordMode;
  }, [freestyleWordMode]);

  useEffect(() => () => void unloadTone(), []);

  useEffect(() => {
    if (practiceWordMode) {
      const currentWord = practiceWordRef.current;
      const isWordValid =
        currentWord &&
        currentWord
          .split('')
          .every((letter) => availableLetters.includes(letter as Letter));
      if (!isWordValid) {
        const nextWord = getRandomWord(availablePracticeWords);
        practiceWordStartRef.current = null;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setTargetLetter(nextWord[0] as Letter);
      } else {
        const nextIndex = Math.min(
          practiceWordIndexRef.current,
          currentWord.length - 1,
        );
        const nextLetter = currentWord[nextIndex] as Letter;
        if (nextLetter !== targetLetter) {
          setPracticeWordIndex(nextIndex);
          setTargetLetter(nextLetter);
        }
      }
    } else if (!availableLetters.includes(targetLetter)) {
      setTargetLetter(pickNextLetter(availableLetters, scoresRef.current));
    }
    if (!availableLetters.includes(listenTarget)) {
      setListenTarget(pickNextLetter(availableLetters, scoresRef.current));
    }
  }, [
    availableLetters,
    availablePracticeWords,
    listenTarget,
    practiceWordMode,
    targetLetter,
  ]);

  useEffect(() => {
    if (!isPractice) {
      return;
    }
    if (input.length === 0) {
      return;
    }
    if (input.length < practiceCode.length) {
      return;
    }
    const isMatch = input === practiceCode;
    const delta = isMatch ? 1 : -1;
    const nextScores = applyScoreDelta(scoresRef.current, targetLetter, delta);
    setProgress((prev) => ({
      ...prev,
      scores: nextScores,
    }));
    setResult(isMatch ? 'correct' : 'wrong');
    if (isMatch) {
      void triggerSuccessHaptic();
    }
    const timeout = setTimeout(
      () => {
        setInput('');
        setResult(null);
        setShowHintOnce(false);
        if (!practiceWordMode) {
          setTargetLetter(
            pickNextLetter(availableLetters, nextScores, targetLetter),
          );
          return;
        }
        if (!isMatch) {
          return;
        }
        const currentWord = practiceWordRef.current;
        if (!currentWord) {
          const nextWord = getRandomWord(availablePracticeWords);
          practiceWordStartRef.current = null;
          setPracticeWord(nextWord);
          setPracticeWordIndex(0);
          setTargetLetter(nextWord[0] as Letter);
          return;
        }
        const nextIndex = practiceWordIndexRef.current + 1;
        if (nextIndex >= currentWord.length) {
          const startTime = practiceWordStartRef.current;
          if (startTime && currentWord.length > 0) {
            const elapsedMs = Date.now() - startTime;
            if (elapsedMs > 0) {
              const nextWpm =
                (currentWord.length / PRACTICE_WORD_UNITS) *
                (60000 / elapsedMs);
              setPracticeWpm(Math.round(nextWpm * 10) / 10);
            }
          }
          const nextWord = getRandomWord(availablePracticeWords, currentWord);
          practiceWordStartRef.current = null;
          setPracticeWord(nextWord);
          setPracticeWordIndex(0);
          setTargetLetter(nextWord[0] as Letter);
          return;
        }
        const nextLetter = currentWord[nextIndex] as Letter;
        setPracticeWordIndex(nextIndex);
        setTargetLetter(nextLetter);
      },
      isMatch ? 700 : 900,
    );
    return () => clearTimeout(timeout);
  }, [
    availableLetters,
    availablePracticeWords,
    input,
    isPractice,
    practiceCode,
    practiceWordMode,
    targetLetter,
  ]);

  useEffect(() => {
    if (!isFreestyle) {
      clearTimeoutRef(freestyleTimeoutRef);
      clearTimeoutRef(wordSpaceTimeoutRef);
      return;
    }
    if (!freestyleInput) {
      return;
    }
    clearTimeoutRef(freestyleTimeoutRef);
    freestyleTimeoutRef.current = setTimeout(() => {
      const letter = CODE_TO_LETTER[freestyleInput];
      setFreestyleResult(letter ?? '?');
      freestyleInputRef.current = '';
      setFreestyleInput('');
      if (letter && freestyleWordModeRef.current) {
        setFreestyleWord((prev) => prev + letter);
        clearTimeoutRef(wordSpaceTimeoutRef);
        wordSpaceTimeoutRef.current = setTimeout(() => {
          if (!freestyleWordModeRef.current) {
            return;
          }
          if (freestyleInputRef.current) {
            return;
          }
          setFreestyleWord((prev) => {
            if (!prev || prev.endsWith(' ')) {
              return prev;
            }
            return `${prev} `;
          });
        }, WORD_GAP_EXTRA_MS);
      }
    }, DEBOUNCE_DELAY);
    return () => clearTimeoutRef(freestyleTimeoutRef);
  }, [freestyleInput, isFreestyle]);

  useEffect(() => () => clearTimeoutRef(listenTimeoutRef), []);

  useEffect(() => () => clearTimeoutRef(wordSpaceTimeoutRef), []);

  const handlePressIn = async () => {
    if (isListen) {
      return;
    }
    pressStartRef.current = Date.now();
    clearTimeoutRef(wordSpaceTimeoutRef);
    await startTone();
  };

  const handlePressOut = async () => {
    if (isListen) {
      return;
    }
    const start = pressStartRef.current;
    pressStartRef.current = null;
    await stopTone();
    if (!start) {
      return;
    }
    const duration = Date.now() - start;
    const signal = duration >= DASH_THRESHOLD ? '-' : '.';
    if (signal === '-') {
      void triggerDashHaptic();
    } else {
      void triggerDotHaptic();
    }
    if (isPractice) {
      if (
        practiceWordMode &&
        practiceWordIndexRef.current === 0 &&
        practiceWordStartRef.current === null &&
        practiceWordRef.current
      ) {
        practiceWordStartRef.current = Date.now();
      }
      setInput((previous) => previous + signal);
    } else if (isFreestyle) {
      setFreestyleInput((previous) => previous + signal);
      setFreestyleResult(null);
    }
  };

  const handleMaxLevelCycle = useCallback(() => {
    const currentIndex = LEVELS.indexOf(progress.maxLevel);
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % LEVELS.length : 0;
    const nextLevel = LEVELS[nextIndex];
    setProgress((prev) => ({
      ...prev,
      maxLevel: nextLevel,
    }));
    if (!isPractice) {
      return;
    }
    const nextLetters = getLettersForLevel(nextLevel);
    if (practiceWordMode) {
      const nextWord = getRandomWord(
        getWordsForLetters(nextLetters),
        practiceWordRef.current,
      );
      practiceWordStartRef.current = null;
      setPracticeWord(nextWord);
      setPracticeWordIndex(0);
      setTargetLetter(nextWord[0] as Letter);
      return;
    }
    if (!nextLetters.includes(targetLetter)) {
      setTargetLetter(
        pickNextLetter(nextLetters, scoresRef.current, targetLetter),
      );
    }
  }, [isPractice, practiceWordMode, progress.maxLevel, targetLetter]);

  const handlePracticeWordModeChange = useCallback(
    (nextValue: boolean) => {
      setProgress((prev) => ({
        ...prev,
        practiceWordMode: nextValue,
      }));
      applyPracticeWordModeState(nextValue);
    },
    [applyPracticeWordModeState],
  );

  const handleWordModeToggle = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      wordMode: !prev.wordMode,
    }));
    handleFreestyleClear();
  }, [handleFreestyleClear]);

  const handleListenWpmCycle = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      listenWpm:
        prev.listenWpm >= LISTEN_WPM_MAX ? LISTEN_WPM_MIN : prev.listenWpm + 1,
    }));
  }, []);

  const handleSoundCheck = useCallback(async () => {
    if (soundCheckStatus !== 'idle') {
      return;
    }
    setSoundCheckStatus('playing');
    try {
      await playTone(350);
    } finally {
      setTimeout(() => setSoundCheckStatus('idle'), 450);
    }
  }, [soundCheckStatus]);

  const listenUnitMs = useMemo(
    () => Math.max(Math.round(1200 / progress.listenWpm), 40),
    [progress.listenWpm],
  );

  const playMorseSequence = useCallback(
    async (code: string) => {
      const unitMs = listenUnitMs;
      for (let index = 0; index < code.length; index += 1) {
        const symbol = code[index];
        const duration = symbol === '-' ? unitMs * 3 : unitMs;
        await playTone(duration);
        await sleep(duration);
        if (index < code.length - 1) {
          await sleep(unitMs * INTER_LETTER_UNITS);
        }
      }
    },
    [listenUnitMs],
  );

  const handleListenReplay = useCallback(async () => {
    if (!isListenIdle) {
      return;
    }
    setListenPlaying(true);
    try {
      await playMorseSequence(listenCode);
    } finally {
      setListenPlaying(false);
    }
  }, [isListenIdle, listenCode, playMorseSequence]);

  const handleListenAnswer = useCallback(
    (answer: Letter) => {
      if (!isListenIdle) {
        return;
      }
      const isMatch = answer === listenTarget;
      setListenReveal(listenTarget);
      setListenStatus(isMatch ? 'success' : 'error');
      const delta = isMatch ? 1 : -1;
      const nextScores = applyScoreDelta(
        scoresRef.current,
        listenTarget,
        delta,
      );
      setProgress((prev) => ({
        ...prev,
        scores: nextScores,
      }));
      clearTimeoutRef(listenTimeoutRef);
      listenTimeoutRef.current = setTimeout(
        () => {
          setListenReveal(null);
          setListenStatus('idle');
          setListenTarget(
            pickNextLetter(availableLetters, nextScores, listenTarget),
          );
        },
        isMatch ? 700 : 900,
      );
    },
    [availableLetters, isListenIdle, listenTarget],
  );

  const applyModeChange = useCallback(
    (nextMode: Mode) => {
      setMode(nextMode);
      setShowSettings(false);
      setShowReference(false);
      setShowHintOnce(false);
      setInput('');
      setResult(null);
      setFreestyleInput('');
      setFreestyleResult(null);
      setFreestyleWord('');
      setListenStatus('idle');
      setListenReveal(null);
      setListenPlaying(false);
      clearTimeoutRef(freestyleTimeoutRef);
      clearTimeoutRef(listenTimeoutRef);
      clearTimeoutRef(wordSpaceTimeoutRef);
      practiceWordStartRef.current = null;
      if (nextMode !== 'practice') {
        setPracticeWpm(null);
      }
      if (nextMode === 'listen') {
        setListenTarget(
          pickNextLetter(availableLetters, scoresRef.current, listenTarget),
        );
        return;
      }
      if (nextMode === 'practice' && practiceWordMode) {
        const nextWord = getRandomWord(
          availablePracticeWords,
          practiceWordRef.current,
        );
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setTargetLetter(nextWord[0] as Letter);
      }
    },
    [availableLetters, availablePracticeWords, listenTarget, practiceWordMode],
  );

  const handleResetScores = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      scores: initializeScores(),
    }));
  }, []);

  const hasGoogleClient =
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ||
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID) ||
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const canSignIn = isAuthRequestReady && hasGoogleClient;
  const authLabel = authReady
    ? user
      ? `Signed in as ${user.displayName ?? user.email ?? 'Dit user'}`
      : 'Sign in to sync progress'
    : 'Checking account...';
  const authMeta = user
    ? remoteLoaded
      ? 'Synced'
      : 'Syncing...'
    : hasGoogleClient
      ? isAuthRequestReady
        ? 'Ready'
        : 'Preparing auth'
      : 'Add Google client IDs';
  const userLabel = user ? (user.displayName ?? user.email ?? 'Signed in') : '';
  const userInitial = user
    ? userLabel
      ? userLabel[0].toUpperCase()
      : '?'
    : '';

  const hintVisible = isPractice && (progress.showHint || showHintOnce);
  const mnemonicVisible = isPractice && progress.showMnemonic;
  const practiceStatus = isPractice
    ? result === 'correct'
      ? 'success'
      : result === 'wrong'
        ? 'error'
        : 'idle'
    : 'idle';
  const basePracticeStatusText =
    practiceStatus === 'success'
      ? 'Correct'
      : practiceStatus === 'error'
        ? 'Missed. Start over.'
        : mnemonicVisible
          ? MORSE_CODE[targetLetter].mnemonic
          : ' ';
  const practiceProgressText =
    isPractice &&
    practiceWordMode &&
    practiceStatus === 'idle' &&
    !hintVisible &&
    !mnemonicVisible &&
    practiceWord
      ? `Letter ${practiceWordIndex + 1} of ${practiceWord.length}`
      : null;
  const practiceStatusText = practiceProgressText ?? basePracticeStatusText;
  const practiceWpmText =
    isPractice && practiceWordMode && practiceWpm !== null
      ? `${formatWpm(practiceWpm)} WPM`
      : null;
  const targetSymbols = practiceCode.split('');
  const isInputOnTrack =
    isPractice && Boolean(input) && practiceCode.startsWith(input);
  const highlightCount =
    practiceStatus === 'success'
      ? targetSymbols.length
      : isInputOnTrack
        ? input.length
        : 0;
  const pips = targetSymbols.map((symbol, index) => {
    const isHit = index < highlightCount;
    return (
      <View
        key={`${symbol}-${index}`}
        style={[
          styles.pip,
          symbol === '.' ? styles.pipDot : styles.pipDash,
          isHit ? styles.pipHit : styles.pipExpected,
          practiceStatus === 'success' && styles.pipSuccess,
          practiceStatus === 'error' && styles.pipError,
        ]}
      />
    );
  });

  const isLetterResult = freestyleResult
    ? /^[A-Z0-9]$/.test(freestyleResult)
    : false;
  const freestyleStatus = freestyleResult
    ? isLetterResult
      ? freestyleWordMode
        ? `Added ${freestyleResult}`
        : `Result ${freestyleResult}`
      : 'No match'
    : freestyleInput
      ? `Input ${freestyleInput}`
      : freestyleWordMode && freestyleWord
        ? `Word ${freestyleWord}`
        : 'Tap and pause';
  const freestyleDisplay = freestyleWordMode
    ? freestyleWord || (freestyleResult && !isLetterResult ? '?' : '')
    : freestyleResult
      ? isLetterResult
        ? freestyleResult
        : '?'
      : '';
  const hasFreestyleDisplay = freestyleWordMode
    ? Boolean(freestyleWord) || (freestyleResult !== null && !isLetterResult)
    : Boolean(freestyleResult);

  const listenDisplay = listenReveal ?? '?';
  const listenStatusText =
    listenStatus === 'success'
      ? 'Correct'
      : listenStatus === 'error'
        ? 'Incorrect'
        : 'Listen and type the character';

  const wordCharacters = practiceWord ? practiceWord.split('') : ['?'];

  const renderReferenceCard = (char: Letter) => {
    const scoreValue = progress.scores[char] ?? 0;
    const scoreClass =
      scoreValue > 0
        ? styles.referenceScorePositive
        : scoreValue < 0
          ? styles.referenceScoreNegative
          : undefined;
    const code = MORSE_CODE[char].code;
    return (
      <View
        key={char}
        style={[styles.referenceCard, getScoreStyle(scoreValue)]}
      >
        <View style={styles.referenceHead}>
          <Text style={styles.referenceLetter}>{char}</Text>
          <Text style={[styles.referenceScore, scoreClass]}>
            {formatScore(scoreValue)}
          </Text>
        </View>
        <View style={styles.referenceCode}>
          {code.split('').map((symbol, index) => (
            <Text key={`${char}-${index}`} style={styles.referenceSymbol}>
              {symbol === '.' ? '.' : symbol === '-' ? '-' : symbol}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const hintToggleDisabled = !isPractice;

  return (
    <SafeAreaProvider>
      <View style={styles.screen}>
        <LinearGradient
          colors={['#0b0f15', '#0a0c12']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.glow, styles.glowOne]} />
        <View style={[styles.glow, styles.glowTwo]} />
        <View style={[styles.glow, styles.glowThree]} />
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          <View style={styles.topBar}>
            <Pressable
              style={styles.logoButton}
              onPress={() => setShowSettings(false)}
            >
              <SvgXml
                xml={LOGO_SVG}
                width={36}
                height={36}
                style={styles.logoImage}
              />
            </Pressable>
            <GlassSurface
              style={styles.modeSelect}
              contentStyle={styles.modeSelectContent}
              intensity={25}
            >
              <View style={styles.modeSelectRow}>
                {MODE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => applyModeChange(option.key)}
                    style={({ pressed }) => [
                      styles.modePill,
                      mode === option.key && styles.modePillActive,
                      pressed && styles.modePillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modePillText,
                        mode === option.key && styles.modePillTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </GlassSurface>
            <View style={styles.settings}>
              <Pressable
                onPress={() => setShowSettings((prev) => !prev)}
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && styles.settingsButtonPressed,
                  showSettings && styles.settingsButtonActive,
                ]}
              >
                <SettingsIcon />
              </Pressable>
              {showSettings ? (
                <GlassSurface
                  style={styles.settingsPanel}
                  contentStyle={styles.settingsPanelContent}
                  intensity={45}
                >
                  <Pressable
                    onPress={() => {
                      if (hintToggleDisabled) {
                        return;
                      }
                      setProgress((prev) => ({
                        ...prev,
                        showHint: !prev.showHint,
                      }));
                    }}
                    style={[
                      styles.toggleRow,
                      hintToggleDisabled && styles.toggleRowDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleLabel,
                        hintToggleDisabled && styles.toggleLabelDisabled,
                      ]}
                    >
                      Show hints
                    </Text>
                    <View
                      style={[
                        styles.toggleTrack,
                        progress.showHint && styles.toggleTrackActive,
                        hintToggleDisabled && styles.toggleTrackDisabled,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          progress.showHint && styles.toggleThumbActive,
                        ]}
                      />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (hintToggleDisabled) {
                        return;
                      }
                      setProgress((prev) => ({
                        ...prev,
                        showMnemonic: !prev.showMnemonic,
                      }));
                    }}
                    style={[
                      styles.toggleRow,
                      hintToggleDisabled && styles.toggleRowDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleLabel,
                        hintToggleDisabled && styles.toggleLabelDisabled,
                      ]}
                    >
                      Show mnemonics
                    </Text>
                    <View
                      style={[
                        styles.toggleTrack,
                        progress.showMnemonic && styles.toggleTrackActive,
                        hintToggleDisabled && styles.toggleTrackDisabled,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          progress.showMnemonic && styles.toggleThumbActive,
                        ]}
                      />
                    </View>
                  </Pressable>
                  {isFreestyle ? (
                    <Pressable
                      onPress={handleWordModeToggle}
                      style={styles.toggleRow}
                    >
                      <Text style={styles.toggleLabel}>Word mode</Text>
                      <View
                        style={[
                          styles.toggleTrack,
                          freestyleWordMode && styles.toggleTrackActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.toggleThumb,
                            freestyleWordMode && styles.toggleThumbActive,
                          ]}
                        />
                      </View>
                    </Pressable>
                  ) : null}
                  {!isFreestyle ? (
                    <View style={styles.panelGroup}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Max level</Text>
                        <Pressable onPress={handleMaxLevelCycle}>
                          <GlassSurface
                            style={styles.panelSelect}
                            contentStyle={styles.panelSelectContent}
                            intensity={35}
                          >
                            <Text style={styles.panelSelectText}>
                              Level {progress.maxLevel}
                            </Text>
                          </GlassSurface>
                        </Pressable>
                      </View>
                      {isPractice ? (
                        <Pressable
                          onPress={() =>
                            handlePracticeWordModeChange(!practiceWordMode)
                          }
                          style={styles.toggleRow}
                        >
                          <Text style={styles.toggleLabel}>Words</Text>
                          <View
                            style={[
                              styles.toggleTrack,
                              practiceWordMode && styles.toggleTrackActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.toggleThumb,
                                practiceWordMode && styles.toggleThumbActive,
                              ]}
                            />
                          </View>
                        </Pressable>
                      ) : null}
                      {isListen ? (
                        <View style={styles.toggleRow}>
                          <Text style={styles.toggleLabel}>Listen speed</Text>
                          <Pressable onPress={handleListenWpmCycle}>
                            <GlassSurface
                              style={styles.panelSelect}
                              contentStyle={styles.panelSelectContent}
                              intensity={35}
                            >
                              <Text style={styles.panelSelectText}>
                                {progress.listenWpm} WPM
                              </Text>
                            </GlassSurface>
                          </Pressable>
                        </View>
                      ) : null}
                      <GlassButton
                        label="Reference"
                        onPress={() => setShowReference(true)}
                        style={styles.panelButton}
                        contentStyle={styles.panelButtonContent}
                        labelStyle={styles.panelButtonLabel}
                      />
                    </View>
                  ) : null}
                  {isListen ? (
                    <View style={styles.panelGroup}>
                      <GlassButton
                        label={
                          soundCheckStatus === 'idle'
                            ? 'Sound check'
                            : 'Playing...'
                        }
                        onPress={handleSoundCheck}
                        style={styles.panelButton}
                        contentStyle={styles.panelButtonContent}
                        labelStyle={styles.panelButtonLabel}
                        disabled={soundCheckStatus !== 'idle'}
                      />
                      <Text style={styles.panelHint}>
                        No sound? Turn off Silent Mode.
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.settingsDivider} />
                  <View style={styles.authRow}>
                    <View style={styles.authAvatar}>
                      <Text style={styles.authAvatarText}>
                        {userInitial || '?'}
                      </Text>
                    </View>
                    <View style={styles.authText}>
                      <Text style={styles.authLabel}>Cloud Sync</Text>
                      <Text style={styles.authStatus}>{authLabel}</Text>
                      <Text style={styles.authMeta}>{authMeta}</Text>
                    </View>
                  </View>
                  <GlassButton
                    label={user ? 'Sign out' : 'Sign in'}
                    onPress={user ? handleSignOut : handleSignIn}
                    style={styles.authButton}
                    labelStyle={styles.authButtonLabel}
                    disabled={!user && !canSignIn}
                  />
                </GlassSurface>
              ) : null}
            </View>
          </View>

          <View style={styles.stage}>
            {isFreestyle ? (
              <>
                <Text
                  style={[
                    styles.letter,
                    !hasFreestyleDisplay && styles.letterPlaceholder,
                  ]}
                >
                  {freestyleDisplay}
                </Text>
                <Text style={styles.statusText}>{freestyleStatus}</Text>
              </>
            ) : isListen ? (
              <>
                <Text
                  style={[
                    styles.letter,
                    listenStatus === 'success' && styles.letterSuccess,
                    listenStatus === 'error' && styles.letterError,
                    !listenReveal && styles.letterPlaceholder,
                  ]}
                >
                  {listenDisplay}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    listenStatus === 'success' && styles.statusTextSuccess,
                    listenStatus === 'error' && styles.statusTextError,
                  ]}
                >
                  {listenStatusText}
                </Text>
              </>
            ) : (
              <>
                {practiceWordMode ? (
                  <View style={styles.wordDisplay}>
                    {wordCharacters.map((char, index) => {
                      const isDone = index < practiceWordIndex;
                      const isActive = index === practiceWordIndex;
                      return (
                        <Text
                          key={`${char}-${index}`}
                          style={[
                            styles.wordLetter,
                            isDone && styles.wordLetterDone,
                            isActive && styles.wordLetterActive,
                            isActive &&
                              practiceStatus === 'error' &&
                              styles.wordLetterError,
                          ]}
                        >
                          {char}
                        </Text>
                      );
                    })}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.letter,
                      practiceStatus === 'success' && styles.letterSuccess,
                      practiceStatus === 'error' && styles.letterError,
                    ]}
                  >
                    {targetLetter}
                  </Text>
                )}
                {hintVisible ? (
                  <View style={styles.progress}>{pips}</View>
                ) : (
                  <View style={[styles.progress, styles.progressHidden]} />
                )}
                <Text
                  style={[
                    styles.statusText,
                    practiceStatus === 'success' && styles.statusTextSuccess,
                    practiceStatus === 'error' && styles.statusTextError,
                  ]}
                >
                  {practiceStatusText}
                </Text>
                {practiceWpmText ? (
                  <Text style={styles.wpmText}>{practiceWpmText}</Text>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.controls}>
            {isPractice && !progress.showHint && !showHintOnce ? (
              <GlassButton
                label="Show this hint"
                onPress={() => setShowHintOnce(true)}
                style={styles.hintButton}
              />
            ) : null}
            {isFreestyle ? (
              <View style={styles.freestyleStatusRow}>
                <Text style={styles.freestyleStatusText}>
                  {freestyleStatus}
                </Text>
                <GlassButton
                  label="Clear"
                  onPress={handleFreestyleClear}
                  style={styles.panelButton}
                  contentStyle={styles.panelButtonContent}
                  labelStyle={styles.panelButtonLabel}
                />
              </View>
            ) : null}
            {isListen ? (
              <View style={styles.listenControls}>
                <GlassButton
                  label={listenPlaying ? 'Playing...' : 'Play'}
                  onPress={handleListenReplay}
                  style={styles.panelButton}
                  contentStyle={styles.panelButtonContent}
                  labelStyle={styles.panelButtonLabel}
                  disabled={!isListenIdle}
                />
                <View style={styles.listenKeyboard}>
                  {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
                    <View style={styles.keyboardRow} key={`row-${rowIndex}`}>
                      {row.map((key) => (
                        <Pressable
                          key={key}
                          onPress={() => handleListenAnswer(key)}
                          style={({ pressed }) => [
                            styles.keyboardKey,
                            !isListenIdle && styles.keyboardKeyDisabled,
                            pressed &&
                              isListenIdle &&
                              styles.keyboardKeyPressed,
                          ]}
                          disabled={!isListenIdle}
                        >
                          <Text style={styles.keyboardKeyText}>{key}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.morsePressable}
              >
                {({ pressed }) => (
                  <View style={styles.morseWrap}>
                    <View
                      style={[
                        styles.morseGlow,
                        pressed && styles.morseGlowPressed,
                      ]}
                    />
                    <View
                      style={[
                        styles.morseButton,
                        pressed && styles.morseButtonPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[
                          '#a8d0ff',
                          '#d0c0f0',
                          '#ffccd8',
                          '#b8d8ff',
                          '#f0d0e8',
                        ]}
                        start={{ x: 0.1, y: 0.2 }}
                        end={{ x: 0.9, y: 0.8 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.morseGlass} />
                    </View>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        </SafeAreaView>
        {showReference ? (
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowReference(false)}
            />
            <GlassSurface
              style={styles.modalCard}
              contentStyle={styles.modalContent}
              intensity={55}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reference</Text>
                <View style={styles.modalActions}>
                  <GlassButton
                    label="Reset scores"
                    onPress={handleResetScores}
                    style={styles.panelButton}
                    contentStyle={styles.panelButtonContent}
                    labelStyle={styles.panelButtonLabel}
                  />
                  <GlassButton
                    label="Close"
                    onPress={() => setShowReference(false)}
                    style={styles.panelButton}
                    contentStyle={styles.panelButtonContent}
                    labelStyle={styles.panelButtonLabel}
                  />
                </View>
              </View>
              <ScrollView
                contentContainerStyle={styles.referenceGrid}
                showsVerticalScrollIndicator={false}
              >
                {REFERENCE_LETTERS.map(renderReferenceCard)}
                <View style={styles.referenceRow}>
                  {REFERENCE_NUMBERS.map(renderReferenceCard)}
                </View>
              </ScrollView>
            </GlassSurface>
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 18,
    overflow: 'visible',
  },
  topBar: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  logoButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    opacity: 0.7,
  },
  modeSelect: {
    borderRadius: 999,
  },
  modeSelectContent: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  modeSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  modePillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modePillPressed: {
    transform: [{ scale: 0.98 }],
  },
  modePillText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modePillTextActive: {
    color: COLORS.text,
  },
  settings: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,16,20,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  settingsButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  settingsButtonActive: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  settingsPanel: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 250,
    borderRadius: 16,
    zIndex: 4,
  },
  settingsPanelContent: {
    gap: 14,
    padding: 16,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleLabel: {
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  toggleLabelDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  toggleTrack: {
    width: 48,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(9,14,18,0.8)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: 'rgba(56,242,162,0.9)',
    borderColor: 'rgba(56,242,162,0.9)',
  },
  toggleTrackDisabled: {
    backgroundColor: 'rgba(9,14,18,0.6)',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  toggleThumbActive: {
    backgroundColor: 'rgba(12,20,24,0.95)',
    transform: [{ translateX: 22 }],
  },
  panelGroup: {
    gap: 12,
  },
  panelSelect: {
    borderRadius: 999,
  },
  panelSelectContent: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  panelSelectText: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.text,
  },
  panelButton: {
    borderRadius: 12,
  },
  panelButtonContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  panelButtonLabel: {
    fontSize: 10,
    letterSpacing: 2,
  },
  panelHint: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(12,18,24,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authAvatarText: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  authText: {
    flex: 1,
  },
  authLabel: {
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  authStatus: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  authMeta: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.muted,
  },
  authButton: {
    marginTop: 6,
  },
  authButtonLabel: {
    fontSize: 10,
    letterSpacing: 2,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  letter: {
    fontSize: 96,
    lineHeight: 112,
    letterSpacing: 6,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: COLORS.text,
    textAlign: 'center',
    paddingVertical: 4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 20 },
    textShadowRadius: 60,
  },
  letterSuccess: {
    color: COLORS.accent,
  },
  letterError: {
    color: COLORS.error,
  },
  letterPlaceholder: {
    opacity: 0.35,
  },
  wordDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  wordLetter: {
    fontSize: 26,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.muted,
    fontWeight: '600',
  },
  wordLetterActive: {
    color: COLORS.text,
  },
  wordLetterDone: {
    color: COLORS.accent,
  },
  wordLetterError: {
    color: COLORS.error,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 22,
  },
  progressHidden: {
    opacity: 0,
  },
  pip: {
    borderRadius: 999,
    backgroundColor: COLORS.accentCool,
    shadowColor: COLORS.accentCool,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  pipDot: {
    width: 12,
    height: 12,
  },
  pipDash: {
    width: 34,
    height: 12,
  },
  pipExpected: {
    opacity: 0.3,
  },
  pipHit: {
    opacity: 1,
    transform: [{ translateY: -1 }],
  },
  pipSuccess: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
  },
  pipError: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    color: COLORS.muted,
    textAlign: 'center',
    minHeight: 18,
  },
  statusTextSuccess: {
    color: COLORS.accent,
  },
  statusTextError: {
    color: COLORS.error,
  },
  wpmText: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  controls: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 20,
  },
  hintButton: {
    alignSelf: 'center',
  },
  freestyleStatusRow: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  freestyleStatusText: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  listenControls: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  listenKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    marginBottom: 8,
  },
  keyboardKey: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  keyboardKeyPressed: {
    transform: [{ scale: 0.98 }],
  },
  keyboardKeyDisabled: {
    opacity: 0.5,
  },
  keyboardKeyText: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.text,
  },
  morseWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  morsePressable: {
    width: '100%',
    alignItems: 'center',
  },
  morseGlow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 6,
    bottom: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(147,197,253,0.25)',
    shadowColor: 'rgba(147,197,253,0.4)',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  morseGlowPressed: {
    opacity: 1,
  },
  morseButton: {
    width: '100%',
    height: 88,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  morseButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  morseGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,14,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 20,
  },
  modalContent: {
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  referenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  referenceRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  referenceCard: {
    width: '22%',
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(8,12,16,0.4)',
    alignItems: 'center',
    marginBottom: 10,
  },
  referenceHead: {
    alignItems: 'center',
    gap: 2,
  },
  referenceLetter: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.text,
  },
  referenceScore: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLORS.muted,
  },
  referenceScorePositive: {
    color: COLORS.accent,
  },
  referenceScoreNegative: {
    color: COLORS.error,
  },
  referenceCode: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  referenceSymbol: {
    fontSize: 12,
    color: COLORS.text,
    marginHorizontal: 2,
  },
  glow: {
    position: 'absolute',
    width: 940,
    height: 940,
    borderRadius: 470,
    opacity: 0.12,
  },
  glowOne: {
    backgroundColor: 'rgba(168,192,255,0.08)',
    left: '-45%',
    top: '55%',
    transform: [{ scaleX: 1.3 }, { scaleY: 1.05 }],
  },
  glowTwo: {
    backgroundColor: 'rgba(196,181,253,0.06)',
    right: '-50%',
    top: '-35%',
    transform: [{ scaleX: 1.2 }, { scaleY: 1.05 }],
  },
  glowThree: {
    backgroundColor: 'rgba(245,199,247,0.04)',
    left: '10%',
    top: '15%',
    transform: [{ scaleX: 1.15 }, { scaleY: 1 }],
  },
});
