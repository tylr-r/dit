import {
  applyScoreDelta,
  AUDIO_VOLUME,
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  formatWpm,
  getLettersForLevel,
  getRandomLetter,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  INTER_LETTER_UNITS,
  INTER_WORD_UNITS,
  MORSE_DATA,
  parseProgress,
  UNIT_TIME_MS,
  WPM_RANGE,
  type Letter,
  type ProgressSnapshot,
} from '@dit/core';
import { triggerHaptics } from '@dit/dit-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { AboutPanel } from './src/components/AboutPanel';
import { Button } from './src/components/DitButton';
import { ListenControls } from './src/components/ListenControls';
import { ModeSwitcher, type Mode } from './src/components/ModeSwitcher';
import { MorseButton } from './src/components/MorseButton';
import { ReferenceModal } from './src/components/ReferenceModal';
import { SettingsPanel } from './src/components/SettingsPanel';
import { StageDisplay, type StagePip } from './src/components/StageDisplay';
import { database } from './src/firebase';
import { useAuth } from './src/hooks/useAuth';
import { useFirebaseSync } from './src/hooks/useFirebaseSync';
import { signInWithGoogle, signOut } from './src/services/auth';
const SETTINGS_BUTTON_RADIUS = 42;

const LEVELS = [1, 2, 3, 4] as const;
const DOT_THRESHOLD_MS = DASH_THRESHOLD;
const INTER_CHAR_GAP_MS = UNIT_TIME_MS * INTER_LETTER_UNITS;
const ERROR_LOCKOUT_MS = 1000;
const PRACTICE_WORD_UNITS = 5;
const WORD_GAP_MS = UNIT_TIME_MS * INTER_WORD_UNITS;
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS;
const LISTEN_WPM_MIN = WPM_RANGE.min;
const LISTEN_WPM_MAX = WPM_RANGE.max;
const LISTEN_MIN_UNIT_MS = 40;
const PROGRESS_SAVE_DEBOUNCE_MS = DEBOUNCE_DELAY;
const TONE_VOLUME = AUDIO_VOLUME;
const TONE_SOURCE = require('./assets/audio/tone-640-5s.wav');
const INTRO_HINTS_KEY = 'dit-intro-hint-step';
const LEGACY_INTRO_HINTS_KEY = 'dit-intro-hints-dismissed';

type IntroHintStep = 'morse' | 'settings' | 'done';
const REFERENCE_LETTERS = (Object.keys(MORSE_DATA) as Letter[]).filter(
  (letter) => /^[A-Z]$/.test(letter),
);
const REFERENCE_NUMBERS: Letter[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];

type TimeoutHandle = ReturnType<typeof setTimeout>;

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

const now = () => Date.now();

const waitForPlayerLoad = async (player: AudioPlayer) => {
  const start = Date.now();
  while (!player.isLoaded && Date.now() - start < 1500) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const initialConfig = (() => {
  const availableLetters = getLettersForLevel(LEVELS[LEVELS.length - 1]);
  const practiceWord = getRandomWord(getWordsForLetters(availableLetters));
  return {
    letter: getRandomLetter(availableLetters),
    practiceWord,
  };
})();

const DitLogo = () => (
  <Svg width={60} height={60} viewBox="0 0 806 806" opacity={0.5}>
    <Path
      d="M92.1113 255.555C74.9852 291.601 63.9443 331.099 60.3145 372.72L4.51855 367.913C8.72293 319.533 21.5381 273.619 41.4258 231.712L92.1113 255.555Z"
      fill="white"
    />
    <Path
      d="M260.393 89.8623C224.063 106.377 190.159 129.454 160.553 158.931L120.998 119.287C155.401 85.0127 194.798 58.1747 237.017 38.9598L260.393 89.8623Z"
      fill="white"
    />
    <Path
      d="M405.179 58.9257C365.272 58.6455 324.81 65.3391 285.557 79.6465L266.323 27.0505C311.944 10.4061 358.971 2.60752 405.357 2.91256L405.179 58.9257Z"
      fill="white"
    />
    <Path
      d="M550.068 91.9326C514.001 74.8502 474.49 63.8573 432.864 60.278L437.603 4.47627C485.988 8.62192 531.918 21.3814 573.849 41.2181L550.068 91.9326Z"
      fill="white"
    />
    <Path
      d="M715.074 258.079C698.29 221.872 674.963 188.141 645.267 158.753L684.618 118.906C719.146 153.054 746.275 192.251 765.802 234.327L715.074 258.079Z"
      fill="white"
    />
    <Path
      d="M735.04 493.228C745.532 454.724 749.424 413.897 745.647 372.289L801.415 367.167C805.82 415.529 801.315 462.985 789.14 507.745L735.04 493.228Z"
      fill="white"
    />
    <Path
      d="M431.712 745.881C471.483 742.578 511.181 732.28 548.991 714.507L572.868 765.164C528.926 785.836 482.788 797.824 436.563 801.684L431.712 745.881Z"
      fill="white"
    />
    <Path
      d="M283.877 725.802C321.308 739.645 361.633 747.118 403.412 747.02L403.602 803.022C355.04 803.151 308.165 794.483 264.651 778.413L283.877 725.802Z"
      fill="white"
    />
    <Path
      d="M104.124 573.485C123.874 608.163 149.937 639.828 181.984 666.633L146.1 709.628C108.84 678.483 78.5317 641.69 55.558 601.392L104.124 573.485Z"
      fill="white"
    />
    <Circle cx="99" cy="189" r="28" fill="white" />
    <Circle cx="617" cy="99" r="28" fill="white" />
    <Circle cx="615.933" cy="707.749" r="28" fill="white" />
    <Circle cx="762.114" cy="306.827" r="28" fill="white" />
    <Circle cx="740.405" cy="559.108" r="28" fill="white" />
    <Circle cx="688.211" cy="641.467" r="28" fill="white" />
    <Circle cx="215.711" cy="724.146" r="28" fill="white" />
    <Circle cx="53.2655" cy="529.086" r="28" fill="white" />
    <Circle cx="32.5273" cy="434.015" r="28" fill="white" />
    <Circle cx="630.682" cy="508.496" r="21" fill="white" />
    <Circle cx="650.503" cy="445.807" r="21" fill="white" />
    <Circle cx="620.825" cy="276.778" r="21" fill="white" />
    <Circle cx="379.724" cy="152.108" r="21" fill="white" />
    <Circle cx="315.716" cy="166.752" r="21" fill="white" />
    <Circle cx="257.693" cy="197.49" r="21" fill="white" />
    <Circle cx="160.812" cy="336.686" r="21" fill="white" />
    <Circle cx="176.189" cy="509.334" r="21" fill="white" />
    <Circle cx="509.219" cy="629.738" r="21" fill="white" />
    <Path
      d="M633.796 403.321C633.856 376.485 629.218 349.3 619.458 322.959L657.877 308.632C669.377 339.625 674.853 371.611 674.806 403.19L633.796 403.321Z"
      fill="white"
    />
    <Path
      d="M579.591 254.275C562.335 233.722 541.264 215.932 516.821 202.088L536.952 166.367C565.724 182.644 590.532 203.565 610.855 227.735L579.591 254.275Z"
      fill="white"
    />
    <Path
      d="M500.371 193.555C476.056 182.199 449.446 174.956 421.445 172.714L424.631 131.835C457.584 134.457 488.902 142.962 517.523 156.304L500.371 193.555Z"
      fill="white"
    />
    <Path
      d="M239.571 239.382C220.558 258.321 204.62 280.827 192.901 306.357L155.6 289.33C169.376 259.28 188.115 232.785 210.473 210.484L239.571 239.382Z"
      fill="white"
    />
    <Path
      d="M172.556 382.964C170.214 409.697 172.522 437.178 180.005 464.254L140.507 475.261C131.685 443.402 128.95 411.066 131.684 379.606L172.556 382.964Z"
      fill="white"
    />
    <Path
      d="M213.114 534.982C228.431 557.017 247.799 576.649 270.883 592.656L247.589 626.4C220.415 607.576 197.61 584.488 179.567 558.571L213.114 534.982Z"
      fill="white"
    />
    <Path
      d="M286.688 602.764C309.884 616.259 335.735 625.864 363.421 630.614L356.574 671.041C323.99 665.468 293.564 654.183 266.257 638.322L286.688 602.764Z"
      fill="white"
    />
    <Path
      d="M382.018 633.093C408.744 635.519 436.232 633.297 463.331 625.898L474.214 665.43C442.328 674.152 409.984 676.787 378.532 673.955L382.018 633.093Z"
      fill="white"
    />
    <Path
      d="M535.023 591.889C557.076 576.598 576.731 557.254 592.766 534.189L626.482 557.523C607.625 584.675 584.51 607.452 558.572 625.464L535.023 591.889Z"
      fill="white"
    />
    <Circle cx="403" cy="403" r="62" fill="white" />
  </Svg>
);

/** Primary app entry for Dit iOS. */
export default function App() {
  const { user } = useAuth();
  const [isPressing, setIsPressing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [mode, setMode] = useState<Mode>('practice');
  const [showHint, setShowHint] = useState(true);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [introHintStep, setIntroHintStep] = useState<IntroHintStep>('morse');
  const [maxLevel, setMaxLevel] = useState(LEVELS[LEVELS.length - 1]);
  const [practiceWordMode, setPracticeWordMode] = useState(false);
  const [letter, setLetter] = useState<Letter>(initialConfig.letter);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [practiceWord, setPracticeWord] = useState(initialConfig.practiceWord);
  const [practiceWordIndex, setPracticeWordIndex] = useState(0);
  const [practiceWpm, setPracticeWpm] = useState<number | null>(null);
  const [freestyleInput, setFreestyleInput] = useState('');
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null);
  const [freestyleWordMode, setFreestyleWordMode] = useState(false);
  const [freestyleWord, setFreestyleWord] = useState('');
  const [listenWpm, setListenWpm] = useState(20);
  const [listenStatus, setListenStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [listenReveal, setListenReveal] = useState<Letter | null>(null);
  const [scores, setScores] = useState(() => initializeScores());
  // In listen mode, we keep the tonePlayer alive, looping, and muted/unmuted instead of loading/unloading or pausing between tones.
  // This prevents any delay or cutoff at the start/end of Morse playback, ensuring instant and accurate sound for each symbol.
  // See also: docs/NATIVE_IOS.md for more details.
  const tonePlayer = useMemo(
    () =>
      createAudioPlayer(TONE_SOURCE, {
        keepAudioSessionActive: true,
        updateInterval: 250,
        downloadFirst: true,
      }),
    [],
  );
  useEffect(() => {
    let isActive = true;
    const loadIntroHints = async () => {
      try {
        const stored = await AsyncStorage.getItem(INTRO_HINTS_KEY);
        if (!isActive) {
          return;
        }
        if (stored === 'morse' || stored === 'settings' || stored === 'done') {
          setIntroHintStep(stored);
          return;
        }
        const legacy = await AsyncStorage.getItem(LEGACY_INTRO_HINTS_KEY);
        if (legacy === 'true') {
          setIntroHintStep('done');
          void AsyncStorage.setItem(INTRO_HINTS_KEY, 'done');
          return;
        }
        setIntroHintStep('morse');
      } catch (error) {
        console.error('Failed to load intro hints', error);
      }
    };
    void loadIntroHints();
    return () => {
      isActive = false;
    };
  }, []);
  const persistIntroHintStep = useCallback((next: IntroHintStep) => {
    setIntroHintStep(next);
    void AsyncStorage.setItem(INTRO_HINTS_KEY, next).catch((error) => {
      console.error('Failed to save intro hints', error);
    });
  }, []);
  const dismissMorseHint = useCallback(() => {
    if (introHintStep !== 'morse') {
      return;
    }
    persistIntroHintStep('settings');
  }, [introHintStep, persistIntroHintStep]);
  const dismissSettingsHint = useCallback(() => {
    if (introHintStep !== 'settings') {
      return;
    }
    persistIntroHintStep('done');
  }, [introHintStep, persistIntroHintStep]);
  const isFreestyle = mode === 'freestyle';
  const isListen = mode === 'listen';
  // Also treat reference panel as a mode that requires the tone player to stay alive for instant playback
  const isReferencePanelActive = showReference;
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
  const pressStartRef = useRef<number | null>(null);
  const inputRef = useRef(input);
  const freestyleInputRef = useRef(freestyleInput);
  const letterRef = useRef(letter);
  const practiceWordRef = useRef(practiceWord);
  const practiceWordIndexRef = useRef(practiceWordIndex);
  const practiceWordModeRef = useRef(practiceWordMode);
  const practiceWordStartRef = useRef<number | null>(null);
  const freestyleWordModeRef = useRef(freestyleWordMode);
  const wordSpaceTimeoutRef = useRef<TimeoutHandle | null>(null);
  const scoresRef = useRef(scores);
  const maxLevelRef = useRef<1 | 2 | 3 | 4>(maxLevel);
  const modeRef = useRef(mode);
  const listenStatusRef = useRef(listenStatus);
  const errorLockoutUntilRef = useRef(0);
  const letterTimeoutRef = useRef<TimeoutHandle | null>(null);
  const successTimeoutRef = useRef<TimeoutHandle | null>(null);
  const errorTimeoutRef = useRef<TimeoutHandle | null>(null);
  const listenTimeoutRef = useRef<TimeoutHandle | null>(null);
  const listenPlaybackRef = useRef<{
    token: number;
    timeouts: TimeoutHandle[];
  }>({ token: 0, timeouts: [] });
  const toneUnloadTimeoutRef = useRef<TimeoutHandle | null>(null);
  const toneReadyRef = useRef(false);
  const toneLoadingRef = useRef<Promise<AudioPlayer> | null>(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    freestyleInputRef.current = freestyleInput;
  }, [freestyleInput]);

  useEffect(() => {
    letterRef.current = letter;
  }, [letter]);

  useEffect(() => {
    practiceWordRef.current = practiceWord;
  }, [practiceWord]);

  useEffect(() => {
    practiceWordIndexRef.current = practiceWordIndex;
  }, [practiceWordIndex]);

  useEffect(() => {
    practiceWordModeRef.current = practiceWordMode;
  }, [practiceWordMode]);

  useEffect(() => {
    freestyleWordModeRef.current = freestyleWordMode;
  }, [freestyleWordMode]);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    maxLevelRef.current = maxLevel;
  }, [maxLevel]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    listenStatusRef.current = listenStatus;
  }, [listenStatus]);

  const unloadTonePlayer = useCallback(() => {
    if (!toneReadyRef.current) {
      return;
    }
    tonePlayer.pause();
    tonePlayer.remove();
    toneReadyRef.current = false;
    toneLoadingRef.current = null;
  }, [tonePlayer]);

  const scheduleToneUnload = useCallback(() => {
    clearTimer(toneUnloadTimeoutRef);
    toneUnloadTimeoutRef.current = setTimeout(() => {
      unloadTonePlayer();
    }, 4000);
  }, [unloadTonePlayer]);

  const prepareTonePlayer = useCallback(async () => {
    if (toneReadyRef.current) {
      return tonePlayer;
    }
    if (toneLoadingRef.current) {
      return toneLoadingRef.current;
    }
    toneLoadingRef.current = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });
        await setIsAudioActiveAsync(true);
        await waitForPlayerLoad(tonePlayer);
        tonePlayer.loop = true;
        tonePlayer.volume = Math.min(1, Math.max(0.4, TONE_VOLUME));
        tonePlayer.muted = true;
        tonePlayer.play();
        toneReadyRef.current = true;
        return tonePlayer;
      } finally {
        toneLoadingRef.current = null;
      }
    })();
    return toneLoadingRef.current;
  }, [tonePlayer]);

  const stopTonePlayback = useCallback(() => {
    if (!toneReadyRef.current) {
      return;
    }
    tonePlayer.muted = true;
    scheduleToneUnload();
  }, [scheduleToneUnload, tonePlayer]);

  const startTonePlayback = useCallback(async () => {
    clearTimer(toneUnloadTimeoutRef);
    const player = await prepareTonePlayer();
    if (!player) {
      return;
    }
    player.muted = false;
    if (!player.playing) {
      player.play();
    }
  }, [prepareTonePlayer]);

  const clearListenPlaybackTimeouts = useCallback(() => {
    listenPlaybackRef.current.timeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    listenPlaybackRef.current.timeouts = [];
  }, []);

  const stopListenPlayback = useCallback(() => {
    listenPlaybackRef.current.token += 1;
    clearListenPlaybackTimeouts();
    stopTonePlayback();
  }, [clearListenPlaybackTimeouts, stopTonePlayback]);

  const playListenSequence = useCallback(
    (code: string, overrideWpm?: number) => {
      stopListenPlayback();
      const token = listenPlaybackRef.current.token + 1;
      listenPlaybackRef.current.token = token;
      const resolvedWpm = overrideWpm ?? listenWpm;
      const unitMs = Math.max(
        Math.round(1200 / resolvedWpm),
        LISTEN_MIN_UNIT_MS,
      );
      const pattern: number[] = [];
      for (let index = 0; index < code.length; index += 1) {
        const symbol = code[index];
        pattern.push(symbol === '.' ? unitMs : unitMs * 3);
        if (index < code.length - 1) {
          pattern.push(unitMs);
        }
      }
      void triggerHaptics(pattern);

      let currentMs = 0;
      for (const symbol of code) {
        const duration = symbol === '.' ? unitMs : unitMs * 3;
        listenPlaybackRef.current.timeouts.push(
          setTimeout(() => {
            if (listenPlaybackRef.current.token !== token) {
              return;
            }
            startTonePlayback();
          }, currentMs),
          setTimeout(() => {
            if (listenPlaybackRef.current.token !== token) {
              return;
            }
            stopTonePlayback();
          }, currentMs + duration),
        );
        currentMs += duration + unitMs;
      }
      listenPlaybackRef.current.timeouts.push(
        setTimeout(() => {
          if (listenPlaybackRef.current.token !== token) {
            return;
          }
          clearListenPlaybackTimeouts();
        }, currentMs),
      );
    },
    [
      clearListenPlaybackTimeouts,
      listenWpm,
      startTonePlayback,
      stopListenPlayback,
      stopTonePlayback,
      triggerHaptics,
    ],
  );

  const playListenSequenceRef = useRef(playListenSequence);

  useEffect(() => {
    playListenSequenceRef.current = playListenSequence;
  }, [playListenSequence]);

  const resetListenState = useCallback(() => {
    clearTimer(listenTimeoutRef);
    setListenStatus('idle');
    setListenReveal(null);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer(letterTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(errorTimeoutRef);
      clearTimer(listenTimeoutRef);
      clearTimer(wordSpaceTimeoutRef);
      clearTimer(toneUnloadTimeoutRef);
      stopListenPlayback();
      unloadTonePlayer();
    };
  }, [stopListenPlayback, unloadTonePlayer]);

  // Keep the tone player alive (looping, muted/unmuted) when listen mode or reference panel is open
  useEffect(() => {
    if (isListen || isReferencePanelActive) {
      // Prepare and start the tone player (muted, looping)
      void prepareTonePlayer();
      return;
    }
    // If neither is active, schedule unload
    scheduleToneUnload();
  }, [isListen, isReferencePanelActive, prepareTonePlayer, scheduleToneUnload]);

  useEffect(() => {
    if (mode === 'listen') {
      return;
    }
    if (!availableLetters.includes(letterRef.current)) {
      const nextLetter = getRandomLetter(availableLetters);
      letterRef.current = nextLetter;
      setLetter(nextLetter);
    }
    if (practiceWordModeRef.current) {
      const nextWord = getRandomWord(
        availablePracticeWords,
        practiceWordRef.current,
      );
      practiceWordRef.current = nextWord;
      practiceWordIndexRef.current = 0;
      practiceWordStartRef.current = null;
      setPracticeWord(nextWord);
      setPracticeWordIndex(0);
      const nextLetter = nextWord[0] as Letter;
      letterRef.current = nextLetter;
      setLetter(nextLetter);
    }
  }, [availableLetters, availablePracticeWords, mode]);

  const canScoreAttempt = useCallback(() => !showHint, [showHint]);

  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => applyScoreDelta(prev, targetLetter, delta));
  }, []);

  const isErrorLocked = useCallback(
    () => now() < errorLockoutUntilRef.current,
    [],
  );

  const startErrorLockout = useCallback(() => {
    errorLockoutUntilRef.current = now() + ERROR_LOCKOUT_MS;
  }, []);

  const handleShowReference = useCallback(() => {
    setShowSettings(false);
    setShowAbout(false);
    setShowReference(true);
  }, []);

  const handleSettingsToggle = useCallback(() => {
    setShowAbout(false);
    setShowReference(false);
    dismissSettingsHint();
    setShowSettings((prev) => !prev);
  }, [dismissSettingsHint]);

  const handleResetScores = useCallback(() => {
    setScores(initializeScores());
  }, []);

  const scheduleWordSpace = useCallback(() => {
    clearTimer(wordSpaceTimeoutRef);
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
  }, []);

  const submitFreestyleInput = useCallback(
    (value: string) => {
      if (!value) {
        setFreestyleResult('No input');
        return;
      }
      const match = Object.entries(MORSE_DATA).find(
        ([, data]) => data.code === value,
      );
      const result = match ? match[0] : 'No match';
      if (result !== 'No match' && freestyleWordMode) {
        setFreestyleWord((prev) => prev + result);
        scheduleWordSpace();
      }
      setFreestyleResult(result);
      setFreestyleInput('');
    },
    [freestyleWordMode, scheduleWordSpace],
  );

  const submitListenAnswer = useCallback(
    (value: Letter) => {
      if (listenStatus !== 'idle') {
        return;
      }
      if (!/^[A-Z0-9]$/.test(value)) {
        return;
      }
      void triggerHaptics(10);
      clearTimer(listenTimeoutRef);
      stopListenPlayback();
      const isCorrect = value === letterRef.current;
      setListenStatus(isCorrect ? 'success' : 'error');
      setListenReveal(letterRef.current);
      bumpScore(letterRef.current, isCorrect ? 1 : -1);
      listenTimeoutRef.current = setTimeout(
        () => {
          const nextLetter = getRandomWeightedLetter(
            availableLetters,
            scoresRef.current,
            letterRef.current,
          );
          letterRef.current = nextLetter;
          setListenStatus('idle');
          setListenReveal(null);
          setLetter(nextLetter);
          playListenSequence(MORSE_DATA[nextLetter].code);
        },
        isCorrect ? 650 : ERROR_LOCKOUT_MS,
      );
    },
    [
      availableLetters,
      bumpScore,
      listenStatus,
      playListenSequence,
      stopListenPlayback,
      triggerHaptics,
    ],
  );

  const handleListenReplay = useCallback(() => {
    if (listenStatus !== 'idle') {
      return;
    }
    setListenReveal(null);
    void triggerHaptics(12);
    playListenSequence(MORSE_DATA[letterRef.current].code);
  }, [listenStatus, playListenSequence, triggerHaptics]);

  const scheduleLetterReset = useCallback(
    (nextMode: 'practice' | 'freestyle') => {
      clearTimer(letterTimeoutRef);
      letterTimeoutRef.current = setTimeout(() => {
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
        const target = MORSE_DATA[letterRef.current].code;
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
              setStatus('idle');
              return;
            }
            const nextIndex = practiceWordIndexRef.current + 1;
            if (nextIndex >= currentWord.length) {
              const startTime = practiceWordStartRef.current;
              if (startTime && currentWord.length > 0) {
                const elapsedMs = now() - startTime;
                if (elapsedMs > 0) {
                  const nextWpm =
                    (currentWord.length / PRACTICE_WORD_UNITS) *
                    (60000 / elapsedMs);
                  setPracticeWpm(Math.round(nextWpm * 10) / 10);
                }
              }
              const nextWord = getRandomWord(
                availablePracticeWords,
                currentWord,
              );
              const nextLetter = nextWord[0] as Letter;
              practiceWordStartRef.current = null;
              practiceWordRef.current = nextWord;
              practiceWordIndexRef.current = 0;
              letterRef.current = nextLetter;
              setPracticeWord(nextWord);
              setPracticeWordIndex(0);
              setLetter(nextLetter);
              setStatus('idle');
              return;
            }
            const nextLetter = currentWord[nextIndex] as Letter;
            practiceWordIndexRef.current = nextIndex;
            letterRef.current = nextLetter;
            setPracticeWordIndex(nextIndex);
            setLetter(nextLetter);
            setStatus('idle');
            return;
          }
          setStatus('success');
          successTimeoutRef.current = setTimeout(() => {
            setLetter((current) =>
              getRandomWeightedLetter(
                availableLetters,
                scoresRef.current,
                current,
              ),
            );
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
        errorTimeoutRef.current = setTimeout(() => {
          setStatus('idle');
        }, ERROR_LOCKOUT_MS);
      }, INTER_CHAR_GAP_MS);
    },
    [
      availableLetters,
      availablePracticeWords,
      bumpScore,
      canScoreAttempt,
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

  const handleFreestyleWordModeChange = useCallback(
    (value: boolean) => {
      setFreestyleWordMode(value);
      handleFreestyleClear();
    },
    [handleFreestyleClear],
  );

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      if (!isFreestyle && isErrorLocked()) {
        return;
      }
      void triggerHaptics(symbol === '.' ? 12 : 28);
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
        practiceWordStartRef.current = now();
      }

      setStatus('idle');
      setInput((prev) => prev + symbol);
      scheduleLetterReset('practice');
    },
    [isErrorLocked, isFreestyle, scheduleLetterReset],
  );

  const handlePressIn = useCallback(() => {
    if (pressStartRef.current !== null) {
      return;
    }
    if (isListen) {
      return;
    }
    if (!isFreestyle && isErrorLocked()) {
      return;
    }
    setIsPressing(true);
    pressStartRef.current = now();
    clearTimer(letterTimeoutRef);
    startTonePlayback();
  }, [isErrorLocked, isFreestyle, isListen, startTonePlayback]);
  const handleIntroPressIn = useCallback(() => {
    dismissMorseHint();
    handlePressIn();
  }, [dismissMorseHint, handlePressIn]);

  const handlePressOut = useCallback(() => {
    setIsPressing(false);
    stopTonePlayback();
    if (isListen) {
      pressStartRef.current = null;
      return;
    }
    const start = pressStartRef.current;
    pressStartRef.current = null;
    if (start === null) {
      return;
    }
    const duration = now() - start;
    const symbol = duration < DOT_THRESHOLD_MS ? '.' : '-';
    registerSymbol(symbol);
  }, [isListen, registerSymbol, stopTonePlayback]);

  const handleMaxLevelChange = useCallback(
    (value: number) => {
      setMaxLevel(value as (typeof LEVELS)[number]);
      setInput('');
      setStatus('idle');
      clearTimer(letterTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(errorTimeoutRef);
      practiceWordStartRef.current = null;
      const nextLetters = getLettersForLevel(value);
      if (isListen) {
        resetListenState();
        const currentLetter = letterRef.current;
        const nextLetter = nextLetters.includes(currentLetter)
          ? currentLetter
          : getRandomWeightedLetter(
              nextLetters,
              scoresRef.current,
              currentLetter,
            );
        letterRef.current = nextLetter;
        setLetter(nextLetter);
        playListenSequence(MORSE_DATA[nextLetter].code);
        return;
      }
      if (practiceWordModeRef.current) {
        const nextWord = getRandomWord(
          getWordsForLetters(nextLetters),
          practiceWordRef.current,
        );
        practiceWordRef.current = nextWord;
        practiceWordIndexRef.current = 0;
        const nextLetter = nextWord[0] as Letter;
        letterRef.current = nextLetter;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextLetter);
        return;
      }
      const nextLetter = nextLetters.includes(letterRef.current)
        ? letterRef.current
        : getRandomWeightedLetter(
            nextLetters,
            scoresRef.current,
            letterRef.current,
          );
      letterRef.current = nextLetter;
      setLetter(nextLetter);
    },
    [isListen, playListenSequence, resetListenState],
  );

  const handlePracticeWordModeChange = useCallback(
    (value: boolean) => {
      setPracticeWordMode(value);
      practiceWordModeRef.current = value;
      practiceWordStartRef.current = null;
      clearTimer(letterTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(errorTimeoutRef);
      setPracticeWpm(null);
      setInput('');
      setStatus('idle');
      if (value) {
        const nextWord = getRandomWord(availablePracticeWords);
        const nextLetter = nextWord[0] as Letter;
        practiceWordRef.current = nextWord;
        practiceWordIndexRef.current = 0;
        letterRef.current = nextLetter;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextLetter);
      } else {
        const nextLetter = getRandomWeightedLetter(
          availableLetters,
          scoresRef.current,
          letterRef.current,
        );
        letterRef.current = nextLetter;
        setLetter(nextLetter);
      }
    },
    [availableLetters, availablePracticeWords],
  );

  const handleListenWpmChange = useCallback(
    (value: number) => {
      setListenWpm(value);
      if (!isListen || listenStatus !== 'idle') {
        return;
      }
      playListenSequence(MORSE_DATA[letterRef.current].code, value);
    },
    [isListen, listenStatus, playListenSequence],
  );

  const handleModeChange = useCallback(
    (nextMode: Mode) => {
      stopListenPlayback();
      setMode(nextMode);
      setShowSettings(false);
      setShowAbout(false);
      setIsPressing(false);
      setInput('');
      setFreestyleInput('');
      setFreestyleResult(null);
      setFreestyleWord('');
      clearTimer(wordSpaceTimeoutRef);
      setStatus('idle');
      clearTimer(letterTimeoutRef);
      clearTimer(successTimeoutRef);
      clearTimer(errorTimeoutRef);
      practiceWordStartRef.current = null;
      resetListenState();
      if (nextMode !== 'practice') {
        setPracticeWpm(null);
      }
      if (nextMode === 'freestyle') {
        return;
      }
      if (nextMode === 'listen') {
        const nextLetter = availableLetters.includes(letterRef.current)
          ? letterRef.current
          : getRandomWeightedLetter(
              availableLetters,
              scoresRef.current,
              letterRef.current,
            );
        letterRef.current = nextLetter;
        setLetter(nextLetter);
        playListenSequence(MORSE_DATA[nextLetter].code);
        return;
      }
      if (practiceWordModeRef.current) {
        const nextWord = getRandomWord(
          availablePracticeWords,
          practiceWordRef.current,
        );
        practiceWordStartRef.current = null;
        practiceWordRef.current = nextWord;
        practiceWordIndexRef.current = 0;
        const nextLetter = nextWord[0] as Letter;
        letterRef.current = nextLetter;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextLetter);
        return;
      }
      const nextLetter = availableLetters.includes(letterRef.current)
        ? letterRef.current
        : getRandomWeightedLetter(
            availableLetters,
            scoresRef.current,
            letterRef.current,
          );
      letterRef.current = nextLetter;
      setLetter(nextLetter);
    },
    [
      availableLetters,
      availablePracticeWords,
      playListenSequence,
      resetListenState,
      stopListenPlayback,
    ],
  );

  const applyRemoteProgress = useCallback((raw: unknown) => {
    const progress = parseProgress(raw, {
      listenWpmMin: LISTEN_WPM_MIN,
      listenWpmMax: LISTEN_WPM_MAX,
      levelMin: LEVELS[0],
      levelMax: LEVELS[LEVELS.length - 1],
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
      scoresRef.current = progress.scores;
      setScores(progress.scores);
    }
    if (typeof progress.showHint === 'boolean') {
      setShowHint(progress.showHint);
    }
    if (typeof progress.showMnemonic === 'boolean') {
      setShowMnemonic(progress.showMnemonic);
    }
    if (typeof progress.wordMode === 'boolean') {
      if (freestyleWordModeRef.current !== progress.wordMode) {
        freestyleWordModeRef.current = progress.wordMode;
        clearTimer(wordSpaceTimeoutRef);
        setFreestyleWordMode(progress.wordMode);
        setFreestyleResult(null);
        setFreestyleInput('');
        setFreestyleWord('');
      }
    }
    if (typeof progress.listenWpm === 'number') {
      setListenWpm(progress.listenWpm);
      if (modeRef.current === 'listen' && listenStatusRef.current === 'idle') {
        playListenSequenceRef.current(
          MORSE_DATA[letterRef.current].code,
          progress.listenWpm,
        );
      }
    }
    if (typeof progress.maxLevel === 'number') {
      maxLevelRef.current = progress.maxLevel as (typeof LEVELS)[number];
      const nextLetters = getLettersForLevel(progress.maxLevel);
      const currentLetter = letterRef.current;
      const nextLetter = nextLetters.includes(currentLetter)
        ? currentLetter
        : getRandomWeightedLetter(nextLetters, nextScores, currentLetter);
      letterRef.current = nextLetter;
      setMaxLevel(progress.maxLevel as (typeof LEVELS)[number]);
      setLetter(nextLetter);
      if (modeRef.current === 'listen' && listenStatusRef.current === 'idle') {
        playListenSequenceRef.current(MORSE_DATA[nextLetter].code);
      }
    }
    if (typeof progress.practiceWordMode === 'boolean') {
      practiceWordModeRef.current = progress.practiceWordMode;
      practiceWordStartRef.current = null;
      setPracticeWordMode(progress.practiceWordMode);
      if (!progress.practiceWordMode) {
        setPracticeWpm(null);
      }
      if (progress.practiceWordMode) {
        const nextLetters = getLettersForLevel(resolvedMaxLevel);
        const nextWord = getRandomWord(getWordsForLetters(nextLetters));
        practiceWordRef.current = nextWord;
        practiceWordIndexRef.current = 0;
        const nextLetter = nextWord[0] as Letter;
        letterRef.current = nextLetter;
        setPracticeWord(nextWord);
        setPracticeWordIndex(0);
        setLetter(nextLetter);
      }
    }
  }, []);

  useFirebaseSync({
    database,
    user,
    onRemoteProgress: applyRemoteProgress,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    progressSnapshot,
  });

  const target = MORSE_DATA[letter].code;
  const targetSymbols = target.split('');
  const hintVisible = !isFreestyle && !isListen && showHint;
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic;
  const showMorseHint = introHintStep === 'morse' && !isListen;
  const showSettingsHint = introHintStep === 'settings' && !isListen;
  const baseStatusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
      ? 'Missed. Start over.'
      : mnemonicVisible
      ? MORSE_DATA[letter].mnemonic
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
  const practiceStatusText = practiceProgressText ?? baseStatusText;
  const practiceWpmText =
    !isFreestyle && !isListen && practiceWordMode && practiceWpm !== null
      ? `${formatWpm(practiceWpm)} WPM`
      : null;
  const isInputOnTrack =
    !isFreestyle && !isListen && Boolean(input) && target.startsWith(input);
  const highlightCount =
    status === 'success'
      ? targetSymbols.length
      : isInputOnTrack
      ? input.length
      : 0;
  const pips: StagePip[] = targetSymbols.map((symbol, index) => ({
    type: symbol === '.' ? 'dot' : 'dah',
    state: index < highlightCount ? 'hit' : 'expected',
  }));
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
    : freestyleInput || '?';
  const listenStatusText =
    listenStatus === 'success'
      ? 'Correct'
      : listenStatus === 'error'
      ? 'Incorrect'
      : 'Listen and type the character';
  const listenDisplay = listenReveal ?? '?';
  const statusText = isFreestyle
    ? freestyleStatus
    : isListen
    ? listenStatusText
    : practiceStatusText;
  const stageLetter = isFreestyle
    ? freestyleDisplay
    : isListen
    ? listenDisplay
    : letter;
  const stagePips = isFreestyle || isListen ? [] : pips;
  const showPracticeWord = !isFreestyle && !isListen && practiceWordMode;
  const letterPlaceholder = isListen && listenReveal === null;

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.topBar}>
            <View style={styles.topBarSide}>
              <Pressable
                onPress={() => {
                  setShowSettings(false);
                  setShowReference(false);
                  setShowAbout((prev) => !prev);
                }}
                accessibilityRole="button"
                accessibilityLabel="About Dit"
                style={styles.logoButton}
              >
                <View style={styles.logo}>
                  <DitLogo />
                </View>
              </Pressable>
            </View>
            <View style={styles.topBarCenter}>
              <ModeSwitcher value={mode} onChange={handleModeChange} />
            </View>
            <View style={styles.topBarSide}>
              <View style={styles.settingsButtonWrap}>
                {showSettingsHint ? (
                  <View style={styles.settingsHint}>
                    <Text style={styles.hintText}>
                      Add hints, change speed, and save progress in settings.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss settings tip"
                      onPress={dismissSettingsHint}
                      style={({ pressed }) => [
                        styles.hintButton,
                        pressed && styles.hintButtonPressed,
                      ]}
                    >
                      <Text style={styles.hintButtonText}>Got it</Text>
                    </Pressable>
                    <View style={styles.settingsHintArrow} />
                  </View>
                ) : null}
                <Button
                  onPress={handleSettingsToggle}
                  accessibilityLabel="Settings"
                  icon="gearshape"
                  radius={SETTINGS_BUTTON_RADIUS}
                  paddingHorizontal={4}
                  iconSize={24}
                />
              </View>
            </View>
          </View>
          {showAbout ? (
            <View style={styles.modalOverlay} pointerEvents="box-none">
              <Pressable
                onPress={() => setShowAbout(false)}
                style={styles.modalBackdrop}
              />
              <View style={styles.modalCenter} pointerEvents="box-none">
                <Pressable style={styles.modalCard} onPress={() => {}}>
                  <AboutPanel onClose={() => setShowAbout(false)} />
                </Pressable>
              </View>
            </View>
          ) : null}
          {showSettings ? (
            <View style={styles.modalOverlay} pointerEvents="box-none">
              <Pressable
                onPress={() => setShowSettings(false)}
                style={styles.modalBackdrop}
              />
              <View style={styles.modalCenter} pointerEvents="box-none">
                <Pressable style={styles.modalCard} onPress={() => {}}>
                  <SettingsPanel
                    isFreestyle={isFreestyle}
                    isListen={isListen}
                    levels={LEVELS}
                    maxLevel={maxLevel}
                    practiceWordMode={practiceWordMode}
                    freestyleWordMode={freestyleWordMode}
                    listenWpm={listenWpm}
                    listenWpmMin={LISTEN_WPM_MIN}
                    listenWpmMax={LISTEN_WPM_MAX}
                    showHint={showHint}
                    showMnemonic={showMnemonic}
                    onClose={() => setShowSettings(false)}
                    onMaxLevelChange={handleMaxLevelChange}
                    onPracticeWordModeChange={handlePracticeWordModeChange}
                    onFreestyleWordModeChange={handleFreestyleWordModeChange}
                    onListenWpmChange={handleListenWpmChange}
                    onShowHintChange={setShowHint}
                    onShowMnemonicChange={setShowMnemonic}
                    onShowReference={handleShowReference}
                    user={user}
                    onSignIn={signInWithGoogle}
                    onSignOut={signOut}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
          {showReference ? (
            <View style={styles.modalOverlay} pointerEvents="box-none">
              <Pressable
                onPress={() => setShowReference(false)}
                style={styles.modalBackdrop}
              />
              <View style={styles.modalCenter} pointerEvents="box-none">
                <View style={styles.modalCard}>
                  <ReferenceModal
                    letters={REFERENCE_LETTERS}
                    numbers={REFERENCE_NUMBERS}
                    morseData={MORSE_DATA}
                    scores={scores}
                    onClose={() => setShowReference(false)}
                    onResetScores={handleResetScores}
                    onPlaySound={async (char) => {
                      const { playMorseTone } = await import(
                        './src/utils/tone'
                      );
                      playMorseTone({ code: MORSE_DATA[char].code });
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}
          <StageDisplay
            letter={stageLetter}
            statusText={statusText}
            pips={stagePips}
            hintVisible={hintVisible}
            letterPlaceholder={letterPlaceholder}
            practiceWpmText={practiceWpmText}
            practiceWordMode={showPracticeWord}
            practiceWord={showPracticeWord ? practiceWord : null}
            practiceWordIndex={practiceWordIndex}
            isFreestyle={isFreestyle}
          />
          <View style={styles.controls}>
            {isListen ? (
              <ListenControls
                listenStatus={listenStatus}
                onReplay={handleListenReplay}
                onSubmitAnswer={submitListenAnswer}
              />
            ) : (
              <>
                {isFreestyle ? (
                  <Pressable
                    onPress={handleFreestyleClear}
                    accessibilityRole="button"
                    accessibilityLabel="Clear freestyle word"
                    style={({ pressed }) => [
                      styles.clearButton,
                      pressed && styles.clearButtonPressed,
                    ]}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </Pressable>
                ) : null}
                <View style={styles.morseButtonWrap}>
                  {showMorseHint ? (
                    <View style={styles.morseHint}>
                      <Text style={styles.hintText}>
                        Tap the big Morse key to make a dit (short press) or dah
                        (long press).
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss Morse tip"
                        onPress={dismissMorseHint}
                        style={({ pressed }) => [
                          styles.hintButton,
                          pressed && styles.hintButtonPressed,
                        ]}
                      >
                        <Text style={styles.hintButtonText}>Got it</Text>
                      </Pressable>
                      <View style={styles.morseHintArrow} />
                    </View>
                  ) : null}
                  <MorseButton
                    isPressing={isPressing}
                    onPressIn={handleIntroPressIn}
                    onPressOut={handlePressOut}
                  />
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191925',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  topBarSide: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoButton: {
    borderRadius: 16,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 14, 0.72)',
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  settingsButtonWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  settingsHint: {
    position: 'absolute',
    top: 54,
    right: -8,
    width: 190,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(12, 18, 24, 0.95)',
    alignItems: 'center',
    gap: 8,
    zIndex: 4,
  },
  settingsHintArrow: {
    position: 'absolute',
    top: -6,
    right: 22,
    width: 12,
    height: 12,
    backgroundColor: 'rgba(12, 18, 24, 0.95)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '45deg' }],
  },
  morseButtonWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  morseHint: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(12, 18, 24, 0.9)',
    alignItems: 'center',
    gap: 8,
  },
  morseHintArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    width: 12,
    height: 12,
    backgroundColor: 'rgba(12, 18, 24, 0.9)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ translateX: -6 }, { rotate: '45deg' }],
  },
  hintText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 247, 249, 0.9)',
  },
  hintButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  hintButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  hintButtonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.85)',
  },
  clearButton: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  clearButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  clearButtonText: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.85)',
  },
  logo: {
    width: 60,
    height: 60,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
});
