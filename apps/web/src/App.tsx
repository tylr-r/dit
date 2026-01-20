import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Footer } from './components/Footer';
import { PrivacyPolicy, TermsOfService } from './components/LegalPage';
import { ListenControls } from './components/ListenControls';
import { MorseButton } from './components/MorseButton';
import { Page404 } from './components/Page404';
import { ReferenceModal } from './components/ReferenceModal';
import { SettingsPanel } from './components/SettingsPanel';
import { StageDisplay } from './components/StageDisplay';
import {
  AUDIO_FREQUENCY,
  AUDIO_VOLUME,
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
  getRandomLetter,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  parseProgress,
  type Letter,
  type ProgressSnapshot,
} from '@dit/core';
import { firebaseService } from './firebase';
import { useAudio } from './hooks/useAudio';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { useMorseInput } from './hooks/useMorseInput';
import {
  readStoredBoolean,
  readStoredNumber,
  readStoredScores,
  useProgress,
} from './hooks/useProgress';
import { vibrate } from './platform/haptics';
import { readStorageItem } from './platform/storage';

const LETTERS = Object.keys(MORSE_CODE) as Letter[];
const LEVELS = [1, 2, 3, 4] as const;
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
const DOT_THRESHOLD_MS = DASH_THRESHOLD;
const UNIT_MS = UNIT_TIME_MS;
const [LISTEN_WPM_MIN, LISTEN_WPM_MAX] = WPM_RANGE;
const INTER_CHAR_GAP_MS = UNIT_MS * INTER_LETTER_UNITS;
const WORD_GAP_MS = UNIT_MS * INTER_WORD_UNITS;
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS;
const PRACTICE_WORD_UNITS = 5;
const TONE_FREQUENCY = AUDIO_FREQUENCY;
const TONE_GAIN = AUDIO_VOLUME;
const ERROR_LOCKOUT_MS = 1000;
const PROGRESS_SAVE_DEBOUNCE_MS = DEBOUNCE_DELAY;
const STORAGE_KEYS = {
  mode: 'morse-mode',
  showHint: 'morse-show-hint',
  showMnemonic: 'morse-show-mnemonic',
  wordMode: 'morse-word-mode',
  practiceWordMode: 'morse-practice-word-mode',
  maxLevel: 'morse-max-level',
  scores: 'morse-scores',
  listenWpm: 'morse-listen-wpm',
};

const clearTimer = (ref: { current: number | null }) => {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
};

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'SELECT' ||
    element.tagName === 'TEXTAREA'
  );
};

const shouldIgnoreShortcutEvent = (event: KeyboardEvent) =>
  event.repeat ||
  event.ctrlKey ||
  event.metaKey ||
  event.altKey ||
  isEditableTarget(event.target);

function MainApp() {
  const initialConfig = useMemo(() => {
    const maxLevel = readStoredNumber(STORAGE_KEYS.maxLevel, 4, 1, 4);
    const practiceWordMode = readStoredBoolean(
      STORAGE_KEYS.practiceWordMode,
      false,
    );
    const availableLetters = getLettersForLevel(maxLevel);
    const practiceWord = getRandomWord(
      getWordsForLetters(availableLetters),
    );
    const letter = practiceWordMode
      ? (practiceWord[0] as Letter)
      : getRandomLetter(availableLetters);
    return {
      letter,
      maxLevel,
      practiceWord,
      practiceWordMode,
    };
  }, []);

  const [maxLevel, setMaxLevel] = useState(initialConfig.maxLevel);
  const [letter, setLetter] = useState<Letter>(initialConfig.letter);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showHint, setShowHint] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.showHint, true),
  );
  const [showMnemonic, setShowMnemonic] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.showMnemonic, false),
  );
  const [mode, setMode] = useState<'practice' | 'freestyle' | 'listen'>(() => {
    if (typeof window === 'undefined') {
      return 'practice';
    }
    const stored = readStorageItem(STORAGE_KEYS.mode);
    if (stored === 'freestyle') {
      return 'freestyle';
    }
    if (stored === 'listen') {
      return 'listen';
    }
    return 'practice';
  });
  const [showHintOnce, setShowHintOnce] = useState(false);
  const [practiceWordMode, setPracticeWordMode] = useState(
    initialConfig.practiceWordMode,
  );
  const [practiceWord, setPracticeWord] = useState(initialConfig.practiceWord);
  const [practiceWordIndex, setPracticeWordIndex] = useState(0);
  const [practiceWpm, setPracticeWpm] = useState<number | null>(null);
  const [freestyleInput, setFreestyleInput] = useState('');
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null);
  const [freestyleWordMode, setFreestyleWordMode] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.wordMode, false),
  );
  const [freestyleWord, setFreestyleWord] = useState('');
  const [listenWpm, setListenWpm] = useState(() =>
    readStoredNumber(
      STORAGE_KEYS.listenWpm,
      20,
      LISTEN_WPM_MIN,
      LISTEN_WPM_MAX,
    ),
  );
  const [useCustomKeyboard, setUseCustomKeyboard] = useState(false);
  const [listenStatus, setListenStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [listenReveal, setListenReveal] = useState<Letter | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [scores, setScores] = useState(() =>
    readStoredScores(STORAGE_KEYS.scores),
  );
  const maxLevelRef = useRef(maxLevel);
  const inputRef = useRef(input);
  const freestyleInputRef = useRef('');
  const freestyleWordModeRef = useRef(freestyleWordMode);
  const practiceWordModeRef = useRef(practiceWordMode);
  const practiceWordRef = useRef(practiceWord);
  const practiceWordIndexRef = useRef(practiceWordIndex);
  const practiceWordStartRef = useRef<number | null>(null);
  const showReferenceRef = useRef(showReference);
  const letterRef = useRef(letter);
  const scoresRef = useRef(scores);
  const errorLockoutUntilRef = useRef(0);
  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  const letterTimeoutRef = useRef<number | null>(null);
  const wordSpaceTimeoutRef = useRef<number | null>(null);
  const listenTimeoutRef = useRef<number | null>(null);
  const morseButtonRef = useRef<HTMLButtonElement | null>(null);
  const availableLetters = useMemo(
    () => getLettersForLevel(maxLevel),
    [maxLevel],
  );
  const availablePracticeWords = useMemo(
    () => getWordsForLetters(availableLetters),
    [availableLetters],
  );
  const progressSnapshot = useMemo<ProgressSnapshot>(
    () => ({
      listenWpm,
      maxLevel,
      practiceWordMode,
      scores,
      showHint,
      showMnemonic,
      wordMode: freestyleWordMode,
    }),
    [
      freestyleWordMode,
      listenWpm,
      maxLevel,
      practiceWordMode,
      scores,
      showHint,
      showMnemonic,
    ],
  );
  const triggerHaptics = useCallback((pattern: number | number[]) => {
    vibrate(pattern);
  }, []);
  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => applyScoreDelta(prev, targetLetter, delta));
  }, []);
  const handleResetScores = useCallback(() => {
    setScores(initializeScores());
  }, []);
  const isErrorLocked = useCallback(
    () => performance.now() < errorLockoutUntilRef.current,
    [],
  );
  const startErrorLockout = useCallback(() => {
    errorLockoutUntilRef.current = performance.now() + ERROR_LOCKOUT_MS;
  }, []);
  const canScoreAttempt = useCallback(
    () => !(showHint || showHintOnce),
    [showHint, showHintOnce],
  );
  const trackEvent = useCallback(
    (name: string, params?: Record<string, unknown>) => {
      if (typeof window === 'undefined' || !window.gtag) {
        return;
      }
      window.gtag('event', name, params ?? {});
    },
    [],
  );
  useProgress({
    storageKeys: STORAGE_KEYS,
    mode,
    showHint,
    showMnemonic,
    wordMode: freestyleWordMode,
    practiceWordMode,
    maxLevel,
    listenWpm,
    scores,
  });

  const {
    handleSoundCheck,
    playListenSequence,
    soundCheckStatus,
    startTone,
    stopListenPlayback,
    stopTone,
  } = useAudio({
    listenWpm,
    onHaptics: triggerHaptics,
    onTrackEvent: trackEvent,
    toneFrequency: TONE_FREQUENCY,
    toneGain: TONE_GAIN,
    useCustomKeyboard,
  });

  useEffect(() => {
    freestyleInputRef.current = freestyleInput;
  }, [freestyleInput]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    freestyleWordModeRef.current = freestyleWordMode;
  }, [freestyleWordMode]);

  useEffect(() => {
    maxLevelRef.current = maxLevel;
  }, [maxLevel]);

  useEffect(() => {
    practiceWordModeRef.current = practiceWordMode;
  }, [practiceWordMode]);

  useEffect(() => {
    practiceWordRef.current = practiceWord;
  }, [practiceWord]);

  useEffect(() => {
    practiceWordIndexRef.current = practiceWordIndex;
  }, [practiceWordIndex]);

  useEffect(() => {
    showReferenceRef.current = showReference;
  }, [showReference]);

  useEffect(() => {
    letterRef.current = letter;
  }, [letter]);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateKeyboardMode = () => {
      setUseCustomKeyboard(mediaQuery.matches);
    };
    updateKeyboardMode();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateKeyboardMode);
    } else {
      mediaQuery.addListener(updateKeyboardMode);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateKeyboardMode);
      } else {
        mediaQuery.removeListener(updateKeyboardMode);
      }
    };
  }, []);

  useEffect(() => {
    if (!showReference) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowReference(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showReference]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    if (!showReference) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showReference]);

  const isFreestyle = mode === 'freestyle';
  const isListen = mode === 'listen';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const heightValue = `${height}px`;
      document.documentElement.style.setProperty('--app-height', heightValue);
      document.documentElement.style.height = heightValue;
      if (document.body) {
        document.body.style.height = heightValue;
      }
      if (window.scrollY) {
        window.scrollTo(0, 0);
      }
    };
    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateAppHeight);
      window.visualViewport.addEventListener('scroll', updateAppHeight);
    }
    return () => {
      window.removeEventListener('resize', updateAppHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateAppHeight);
        window.visualViewport.removeEventListener('scroll', updateAppHeight);
      }
    };
  }, []);

  useEffect(() => {
    const button = morseButtonRef.current;
    if (!button) {
      return;
    }
    const preventTouchDefault = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    };
    const preventContextMenu = (event: Event) => {
      event.preventDefault();
    };
    button.addEventListener('touchstart', preventTouchDefault, {
      passive: false,
    });
    button.addEventListener('touchmove', preventTouchDefault, {
      passive: false,
    });
    button.addEventListener('touchend', preventTouchDefault, {
      passive: false,
    });
    button.addEventListener('touchcancel', preventTouchDefault, {
      passive: false,
    });
    button.addEventListener('dblclick', preventTouchDefault, {
      passive: false,
    });
    button.addEventListener('contextmenu', preventContextMenu);
    return () => {
      button.removeEventListener('touchstart', preventTouchDefault);
      button.removeEventListener('touchmove', preventTouchDefault);
      button.removeEventListener('touchend', preventTouchDefault);
      button.removeEventListener('touchcancel', preventTouchDefault);
      button.removeEventListener('dblclick', preventTouchDefault);
      button.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [isListen]);

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(letterTimeoutRef);
      clearTimer(wordSpaceTimeoutRef);
      clearTimer(listenTimeoutRef);
      stopListenPlayback();
    };
  }, [stopListenPlayback]);

  const resetListenState = useCallback(() => {
    clearTimer(listenTimeoutRef);
    setListenStatus('idle');
    setListenReveal(null);
  }, []);

  useEffect(() => {
    if (showHint || isFreestyle || isListen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.key.toLowerCase() !== 'n') {
        return;
      }
      if (showHintOnce) {
        return;
      }
      event.preventDefault();
      setShowHintOnce(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFreestyle, isListen, showHint, showHintOnce]);

  const applyModeChange = useCallback(
    (nextMode: 'practice' | 'freestyle' | 'listen') => {
      trackEvent('mode_change', { mode: nextMode });
      if (nextMode !== 'practice') {
        practiceWordStartRef.current = null;
        setPracticeWpm(null);
      }
      setMode(nextMode);
      stopListenPlayback();
      setFreestyleInput('');
      setFreestyleResult(null);
      setFreestyleWord('');
      clearTimer(letterTimeoutRef);
      clearTimer(wordSpaceTimeoutRef);
      setInput('');
      setStatus('idle');
      setShowHintOnce(false);
      resetListenState();
      if (nextMode === 'freestyle') {
        return;
      }
      if (nextMode === 'listen') {
        const nextLetter = availableLetters.includes(letter)
          ? letter
          : getRandomWeightedLetter(availableLetters, scores);
        setLetter(nextLetter);
        void playListenSequence(MORSE_CODE[nextLetter].code);
        return;
      }
      if (practiceWordModeRef.current) {
        const nextWord = getRandomWord(
          availablePracticeWords,
          practiceWordRef.current,
        );
        practiceWordStartRef.current = null;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextWord[0] as Letter);
        return;
      }
      setLetter((current) =>
        availableLetters.includes(current)
          ? current
          : getRandomWeightedLetter(availableLetters, scores),
      );
    },
    [
      availableLetters,
      availablePracticeWords,
      letter,
      playListenSequence,
      resetListenState,
      scores,
      stopListenPlayback,
      trackEvent,
    ],
  );

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    const nextMode =
      value === 'freestyle'
        ? 'freestyle'
        : value === 'listen'
          ? 'listen'
          : 'practice';
    applyModeChange(nextMode);
  };

  const handleShowHintToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setShowHint(event.target.checked);
    },
    [],
  );

  const handleShowMnemonicToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setShowMnemonic(event.target.checked);
    },
    [],
  );

  const handlePracticeWordModeChange = useCallback(
    (nextValue: boolean) => {
      trackEvent('practice_word_mode_toggle', { enabled: nextValue });
      setPracticeWordMode(nextValue);
      practiceWordStartRef.current = null;
      setPracticeWpm(null);
      clearTimer(letterTimeoutRef);
      clearTimer(errorTimeoutRef);
      clearTimer(successTimeoutRef);
      setInput('');
      setStatus('idle');
      setShowHintOnce(false);
      if (!nextValue) {
        const nextLetter = getRandomWeightedLetter(
          availableLetters,
          scoresRef.current,
          letterRef.current,
        );
        setPracticeWordIndex(0);
        setLetter(nextLetter);
        return;
      }
      const nextWord = getRandomWord(
        availablePracticeWords,
        practiceWordRef.current,
      );
      setPracticeWord(nextWord);
      setPracticeWordIndex(0);
      setLetter(nextWord[0] as Letter);
    },
    [availableLetters, availablePracticeWords, trackEvent],
  );

  const handlePracticeWordModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlePracticeWordModeChange(event.target.checked);
    },
    [handlePracticeWordModeChange],
  );

  const handleMaxLevelChange = useCallback(
    (nextLevel: number) => {
      setMaxLevel(nextLevel);
      setInput('');
      setStatus('idle');
      setShowHintOnce(false);
      resetListenState();
      const nextLetters = getLettersForLevel(nextLevel);
      if (!isListen && practiceWordModeRef.current) {
        const nextWord = getRandomWord(
          getWordsForLetters(nextLetters),
          practiceWordRef.current,
        );
        practiceWordStartRef.current = null;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextWord[0] as Letter);
        return;
      }
      const nextLetter = nextLetters.includes(letter)
        ? letter
        : getRandomWeightedLetter(nextLetters, scores);
      setLetter(nextLetter);
      if (isListen) {
        void playListenSequence(MORSE_CODE[nextLetter].code);
      }
    },
    [
      isListen,
      letter,
      playListenSequence,
      resetListenState,
      scores,
      setMaxLevel,
    ],
  );

  const handleMaxLevelSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      handleMaxLevelChange(Number(event.target.value));
    },
    [handleMaxLevelChange],
  );

  const handleListenWpmChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setListenWpm(Number(event.target.value));
    },
    [],
  );

  const applyRemoteProgress = useCallback((raw: unknown) => {
    const progress = parseProgress(raw, {
      listenWpmMin: LISTEN_WPM_MIN,
      listenWpmMax: LISTEN_WPM_MAX,
    });
    if (!progress) {
      return;
    }
    const nextScores = progress.scores ?? scoresRef.current;
    const resolvedMaxLevel =
      typeof progress.maxLevel === 'number'
        ? progress.maxLevel
        : maxLevelRef.current;
    if (progress.scores) {
      setScores(progress.scores);
    }
    if (typeof progress.showHint === 'boolean') {
      setShowHint(progress.showHint);
    }
    if (typeof progress.showMnemonic === 'boolean') {
      setShowMnemonic(progress.showMnemonic);
    }
    if (typeof progress.wordMode === 'boolean') {
      setFreestyleWordMode(progress.wordMode);
    }
    if (typeof progress.listenWpm === 'number') {
      setListenWpm(progress.listenWpm);
    }
    if (typeof progress.maxLevel === 'number') {
      const nextLetters = getLettersForLevel(progress.maxLevel);
      const currentLetter = letterRef.current;
      const nextLetter = nextLetters.includes(currentLetter)
        ? currentLetter
        : getRandomWeightedLetter(nextLetters, nextScores, currentLetter);
      setMaxLevel(progress.maxLevel);
      setLetter(nextLetter);
    }
    if (typeof progress.practiceWordMode === 'boolean') {
      setPracticeWordMode(progress.practiceWordMode);
      practiceWordStartRef.current = null;
      if (!progress.practiceWordMode) {
        setPracticeWpm(null);
      }
      if (progress.practiceWordMode) {
        const nextLetters = getLettersForLevel(resolvedMaxLevel);
        const nextWord = getRandomWord(getWordsForLetters(nextLetters));
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextWord[0] as Letter);
      }
    }
  }, []);

  const { authReady, handleSignIn, handleSignOut, user } = useFirebaseSync({
    firebaseService,
    onRemoteProgress: applyRemoteProgress,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    progressSnapshot,
    trackEvent,
  });

  const scheduleWordSpace = useCallback(() => {
    clearTimer(wordSpaceTimeoutRef);
    wordSpaceTimeoutRef.current = window.setTimeout(() => {
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
  }, []);

  const submitFreestyleInput = useCallback(
    (value: string) => {
      if (!value) {
        setFreestyleResult('No input');
        return;
      }
      const match = Object.entries(MORSE_CODE).find(
        ([, data]) => data.code === value,
      );
      const result = match ? match[0] : 'No match';
      if (result !== 'No match') {
        if (freestyleWordMode) {
          setFreestyleWord((prev) => prev + result);
          scheduleWordSpace();
        }
      }
      setFreestyleResult(result);
      setFreestyleInput('');
    },
    [freestyleWordMode, scheduleWordSpace],
  );

  const scheduleLetterReset = useCallback(
    (nextMode: 'practice' | 'freestyle') => {
      clearTimer(letterTimeoutRef);
      letterTimeoutRef.current = window.setTimeout(() => {
        if (nextMode === 'freestyle') {
          submitFreestyleInput(freestyleInputRef.current);
          return;
        }
        const attempt = inputRef.current;
        if (!attempt) {
          return;
        }
        clearTimer(errorTimeoutRef);
        clearTimer(successTimeoutRef);
        const target = MORSE_CODE[letterRef.current].code;
        const isCorrect = attempt === target;
        if (isCorrect) {
          if (canScoreAttempt()) {
            bumpScore(letterRef.current, 1);
          }
          setInput('');
          if (practiceWordModeRef.current) {
            const currentWord = practiceWordRef.current;
            if (!currentWord) {
              const nextWord = getRandomWord(availablePracticeWords);
              const nextLetter = nextWord[0] as Letter;
              practiceWordStartRef.current = null;
              practiceWordRef.current = nextWord;
              practiceWordIndexRef.current = 0;
              letterRef.current = nextLetter;
              setPracticeWord(nextWord);
              setPracticeWordIndex(0);
              setLetter(nextLetter);
              setShowHintOnce(false);
              setStatus('idle');
              return;
            }
            const nextIndex = practiceWordIndexRef.current + 1;
            if (nextIndex >= currentWord.length) {
              const startTime = practiceWordStartRef.current;
              if (startTime && currentWord.length > 0) {
                const elapsedMs = performance.now() - startTime;
                if (elapsedMs > 0) {
                  const nextWpm =
                    (currentWord.length / PRACTICE_WORD_UNITS) *
                    (60000 / elapsedMs);
                  setPracticeWpm(Math.round(nextWpm * 10) / 10);
                }
              }
              const nextWord = getRandomWord(availablePracticeWords, currentWord);
              const nextLetter = nextWord[0] as Letter;
              practiceWordStartRef.current = null;
              practiceWordRef.current = nextWord;
              practiceWordIndexRef.current = 0;
              letterRef.current = nextLetter;
              setPracticeWord(nextWord);
              setPracticeWordIndex(0);
              setLetter(nextLetter);
              setShowHintOnce(false);
              setStatus('idle');
              return;
            }
            const nextLetter = currentWord[nextIndex] as Letter;
            practiceWordIndexRef.current = nextIndex;
            letterRef.current = nextLetter;
            setPracticeWordIndex(nextIndex);
            setLetter(nextLetter);
            setShowHintOnce(false);
            setStatus('idle');
            return;
          }
          setStatus('success');
          successTimeoutRef.current = window.setTimeout(() => {
            setLetter((current) =>
              getRandomWeightedLetter(availableLetters, scoresRef.current, current),
            );
            setShowHintOnce(false);
            setStatus('idle');
          }, 650);
          return;
        }
        startErrorLockout();
        if (canScoreAttempt()) {
          bumpScore(letterRef.current, -1);
        }
        setStatus('error');
        setInput('');
        errorTimeoutRef.current = window.setTimeout(() => {
          setStatus('idle');
        }, ERROR_LOCKOUT_MS);
      }, INTER_CHAR_GAP_MS);
    },
    [
      availableLetters,
      bumpScore,
      canScoreAttempt,
      availablePracticeWords,
      setLetter,
      setShowHintOnce,
      startErrorLockout,
      submitFreestyleInput,
    ],
  );

  const handleFreestyleClear = useCallback(() => {
    clearTimer(letterTimeoutRef);
    clearTimer(wordSpaceTimeoutRef);
    setFreestyleResult(null);
    setFreestyleInput('');
    setFreestyleWord('');
  }, []);

  const handleFreestyleBackspace = useCallback(() => {
    clearTimer(letterTimeoutRef);
    clearTimer(wordSpaceTimeoutRef);
    setFreestyleResult(null);
    if (freestyleInputRef.current) {
      setFreestyleInput((prev) => {
        const next = prev.slice(0, -1);
        freestyleInputRef.current = next;
        return next;
      });
      return;
    }
    if (!freestyleWordModeRef.current) {
      return;
    }
    setFreestyleWord((prev) => {
      const trimmed = prev.replace(/\s+$/, '');
      if (!trimmed) {
        return '';
      }
      return trimmed.slice(0, -1);
    });
  }, []);

  const handleWordModeChange = useCallback(
    (nextValue: boolean) => {
      setFreestyleWordMode(nextValue);
      handleFreestyleClear();
    },
    [handleFreestyleClear],
  );

  const handleWordModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleWordModeChange(event.target.checked);
    },
    [handleWordModeChange],
  );

  const submitListenAnswer = useCallback(
    (value: Letter) => {
      if (listenStatus !== 'idle') {
        return;
      }
      if (!/^[A-Z0-9]$/.test(value)) {
        return;
      }
      if (useCustomKeyboard) {
        triggerHaptics(10);
      }
      clearTimer(listenTimeoutRef);
      stopListenPlayback();
      const isCorrect = value === letter;
      setListenStatus(isCorrect ? 'success' : 'error');
      setListenReveal(letter);
      bumpScore(letter, isCorrect ? 1 : -1);
      listenTimeoutRef.current = window.setTimeout(
        () => {
          const nextLetter = getRandomWeightedLetter(
            availableLetters,
            scores,
            letter,
          );
          setListenStatus('idle');
          setListenReveal(null);
          setLetter(nextLetter);
          void playListenSequence(MORSE_CODE[nextLetter].code);
        },
        isCorrect ? 650 : ERROR_LOCKOUT_MS,
      );
    },
    [
      availableLetters,
      bumpScore,
      letter,
      listenStatus,
      playListenSequence,
      scores,
      stopListenPlayback,
      triggerHaptics,
      useCustomKeyboard,
    ],
  );

  const handleListenReplay = useCallback(() => {
    if (listenStatus !== 'idle') {
      return;
    }
    setListenReveal(null);
    if (useCustomKeyboard) {
      triggerHaptics(12);
    }
    void playListenSequence(MORSE_CODE[letter].code);
  }, [
    letter,
    listenStatus,
    playListenSequence,
    triggerHaptics,
    useCustomKeyboard,
  ]);

  const handleShowReference = useCallback(() => {
    setShowReference(true);
    trackEvent('reference_open');
  }, [trackEvent]);

  useEffect(() => {
    if (!isFreestyle) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.key.toLowerCase() !== 'n') {
        return;
      }
      event.preventDefault();
      handleFreestyleClear();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFreestyleClear, isFreestyle]);

  useEffect(() => {
    if (isListen) {
      return;
    }
    const handleShortcut = (event: KeyboardEvent) => {
      if (showReference) {
        return;
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
        applyModeChange('freestyle');
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        applyModeChange('listen');
        return;
      }
      if (key === 'l') {
        event.preventDefault();
        applyModeChange('practice');
        return;
      }
      if (key === 'h') {
        if (mode === 'practice') {
          event.preventDefault();
          setShowHint((prev) => !prev);
        }
        return;
      }
      if (key === 'w') {
        if (mode === 'freestyle') {
          event.preventDefault();
          handleWordModeChange(!freestyleWordMode);
        }
        return;
      }
      if (event.key === 'Backspace') {
        if (mode === 'freestyle') {
          event.preventDefault();
          handleFreestyleBackspace();
        }
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [
    applyModeChange,
    freestyleWordMode,
    handleFreestyleBackspace,
    handleWordModeChange,
    isListen,
    mode,
    showReference,
  ]);

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      if (!isFreestyle && isErrorLocked()) {
        return;
      }
      clearTimer(errorTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(letterTimeoutRef);

      if (isFreestyle) {
        setFreestyleInput((prev) => {
          const next = prev + symbol;
          scheduleLetterReset('freestyle');
          return next;
        });
        setFreestyleResult(null);
        return;
      }

      if (
        practiceWordModeRef.current &&
        practiceWordIndexRef.current === 0 &&
        practiceWordStartRef.current === null &&
        practiceWordRef.current
      ) {
        practiceWordStartRef.current = performance.now();
      }

      setStatus('idle');
      setInput((prev) => prev + symbol);
      scheduleLetterReset('practice');
    },
    [isErrorLocked, isFreestyle, scheduleLetterReset],
  );
  const handlePressStart = useCallback(() => {
    clearTimer(letterTimeoutRef);
    clearTimer(wordSpaceTimeoutRef);
    void startTone();
  }, [startTone]);

  const handlePressEnd = useCallback(() => {
    stopTone();
  }, [stopTone]);

  const handlePressCancel = useCallback(() => {
    const hasInput = isFreestyle ? freestyleInput : input;
    if (hasInput) {
      scheduleLetterReset(isFreestyle ? 'freestyle' : 'practice');
    }
  }, [freestyleInput, input, isFreestyle, scheduleLetterReset]);

  const canStartPress = useCallback(
    () => (isFreestyle ? true : !isErrorLocked()),
    [isErrorLocked, isFreestyle],
  );

  const isGlobalShortcutBlocked = useCallback(
    () => showReferenceRef.current,
    [],
  );

  const {
    handleKeyDown,
    handleKeyUp,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp,
    isPressing,
  } = useMorseInput({
    canStartPress,
    dotThresholdMs: DOT_THRESHOLD_MS,
    enableGlobalKeyboard: !isFreestyle && !isListen,
    isGlobalShortcutBlocked,
    onCancel: handlePressCancel,
    onPressEnd: handlePressEnd,
    onPressStart: handlePressStart,
    onSymbol: registerSymbol,
  });

  useEffect(() => {
    if (!isListen) {
      return;
    }
    const handleListenKey = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
        return;
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return;
      }
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        handleListenReplay();
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      const next = event.key.toUpperCase();
      if (!/^[A-Z0-9]$/.test(next)) {
        return;
      }
      event.preventDefault();
      submitListenAnswer(next as Letter);
    };
    window.addEventListener('keydown', handleListenKey);
    return () => {
      window.removeEventListener('keydown', handleListenKey);
    };
  }, [handleListenReplay, isListen, submitListenAnswer]);

  const hintVisible = !isFreestyle && !isListen && (showHint || showHintOnce);
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic;
  const target = MORSE_CODE[letter].code;
  const mnemonic = MORSE_CODE[letter].mnemonic;
  const baseStatusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
        ? 'Missed. Start over.'
        : mnemonicVisible
          ? mnemonic
          : ' ';
  const practiceProgressText =
    !isFreestyle &&
    !isListen &&
    practiceWordMode &&
    status === 'idle' &&
    !hintVisible &&
    !mnemonicVisible &&
    practiceWord
      ? `Letter ${practiceWordIndex + 1} of ${practiceWord.length}`
      : null;
  const statusText = practiceProgressText ?? baseStatusText;
  const practiceWpmText =
    !isFreestyle && !isListen && practiceWordMode && practiceWpm !== null
      ? `${formatWpm(practiceWpm)} WPM`
      : null;
  const targetSymbols = target.split('');
  const isInputOnTrack =
    !isFreestyle && !isListen && Boolean(input) && target.startsWith(input);
  const highlightCount =
    status === 'success'
      ? targetSymbols.length
      : isInputOnTrack
        ? input.length
        : 0;
  const pips = targetSymbols.map((symbol, index) => {
    const isHit = index < highlightCount;
    return (
      <span
        key={`${symbol}-${index}`}
        className={`pip ${symbol === '.' ? 'dot' : 'dah'} ${
          isHit ? 'hit' : 'expected'
        }`}
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
      : freestyleResult
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
  const listenStatusText =
    listenStatus === 'success'
      ? 'Correct'
      : listenStatus === 'error'
        ? 'Incorrect'
        : 'Listen and type the character';
  const listenDisplay = listenReveal ?? '?';
  const listenDisplayClass = `letter ${
    listenReveal ? '' : 'letter-placeholder'
  }`;
  const listenFocused = isListen && useCustomKeyboard;
  const userLabel = user ? (user.displayName ?? user.email ?? 'Signed in') : '';
  const userInitial = user
    ? userLabel
      ? userLabel[0].toUpperCase()
      : '?'
    : '';

  return (
    <div
      className={`app status-${status} mode-${mode}${
        listenFocused ? ' listen-focused' : ''
      }`}
    >
      <header className="top-bar">
        <div className="logo">
          <button
            type="button"
            className="logo-button"
            onClick={() => setShowAbout((prev) => !prev)}
            aria-label="About Dit"
            aria-haspopup="dialog"
            aria-expanded={showAbout}
          >
            <img src="/Dit-logo.svg" alt="Dit" />
          </button>
        </div>
        <select
          className="mode-select"
          value={mode}
          onChange={handleModeChange}
          aria-label="Mode"
        >
          <option value="practice">Practice</option>
          <option value="freestyle">Freestyle</option>
          <option value="listen">Listen</option>
        </select>
        <div className="settings">
          <button
            type="button"
            className="settings-button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.86a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.71 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </button>
          {showSettings ? (
            <SettingsPanel
              showHint={showHint}
              onShowHintChange={handleShowHintToggle}
              showMnemonic={showMnemonic}
              onShowMnemonicChange={handleShowMnemonicToggle}
              isFreestyle={isFreestyle}
              isListen={isListen}
              levels={LEVELS}
              maxLevel={maxLevel}
              onMaxLevelChange={handleMaxLevelSelectChange}
              practiceWordMode={practiceWordMode}
              onPracticeWordModeChange={handlePracticeWordModeToggle}
              listenWpm={listenWpm}
              listenWpmMin={LISTEN_WPM_MIN}
              listenWpmMax={LISTEN_WPM_MAX}
              onListenWpmChange={handleListenWpmChange}
              onShowReference={handleShowReference}
              freestyleWordMode={freestyleWordMode}
              onWordModeChange={handleWordModeToggle}
              onSoundCheck={handleSoundCheck}
              soundCheckStatus={soundCheckStatus}
              user={user}
              userLabel={userLabel}
              userInitial={userInitial}
              authReady={authReady}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          ) : null}
        </div>
      </header>
      <StageDisplay
        freestyleDisplay={freestyleDisplay}
        hasFreestyleDisplay={hasFreestyleDisplay}
        hintVisible={hintVisible}
        isFreestyle={isFreestyle}
        isListen={isListen}
        letter={letter}
        listenDisplay={listenDisplay}
        listenDisplayClass={listenDisplayClass}
        listenStatusText={listenStatusText}
        pips={pips}
        practiceWord={practiceWord}
        practiceWordIndex={practiceWordIndex}
        practiceWordMode={practiceWordMode}
        practiceWpmText={practiceWpmText}
        statusText={statusText}
        target={target}
      />
      <div className="controls">
        {isFreestyle ? (
          <>
            <div className="freestyle-status" aria-live="polite">
              {freestyleStatus}
            </div>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={handleFreestyleClear}
            >
              Clear
            </button>
          </>
        ) : null}
        {!showHint && !isFreestyle && !isListen ? (
          <button
            type="button"
            className="hint-button"
            onClick={() => setShowHintOnce(true)}
            disabled={showHintOnce}
          >
            Show this hint
          </button>
        ) : null}
        {isListen ? (
          <ListenControls
            listenStatus={listenStatus}
            onReplay={handleListenReplay}
            onSubmitAnswer={submitListenAnswer}
            useCustomKeyboard={useCustomKeyboard}
          />
        ) : (
          <MorseButton
            buttonRef={morseButtonRef}
            isPressing={isPressing}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handlePointerCancel}
          />
        )}
      </div>
      {showReference ? (
        <ReferenceModal
          letters={REFERENCE_LETTERS}
          morseData={MORSE_CODE}
          numbers={REFERENCE_NUMBERS}
          onClose={() => setShowReference(false)}
          onResetScores={handleResetScores}
          scores={scores}
        />
      ) : null}
      {showAbout ? (
        <div
          className="about-overlay"
          role="presentation"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="about-card"
            role="dialog"
            aria-modal="true"
            aria-label="About Dit"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="about-title">Dit</p>
            <p className="about-instruction">
              Tap that big button. Quick taps make dots, longer presses make
              dashes.
            </p>
            <p className="about-instruction about-instruction-secondary">
              Use <strong>settings</strong> to adjust difficulty, check the
              reference chart, enable hints, and sign in to save your progress.
            </p>
            <p className="about-instruction about-instruction-secondary">
              <strong>Modes:</strong> Practice for guided learning, Freestyle to
              translate on your own, or Listen to test your copy skills.
            </p>
            <Footer />
            <button
              type="button"
              className="about-close"
              onClick={() => setShowAbout(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Routes between the main app and legal pages. */
function App() {
  if (typeof window === 'undefined') {
    return <MainApp />;
  }
  const trimmedPath = window.location.pathname.replace(/\/+$/, '');
  const path = trimmedPath === '' ? '/' : trimmedPath;
  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/terms') {
    return <TermsOfService />;
  }
  if (path === '/') {
    return <MainApp />;
  }
  // Show 404 page for all other routes
  return <Page404 />;
}

export default App;
