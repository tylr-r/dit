import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  DASH_THRESHOLD,
  MORSE_CODE,
  WPM_RANGE,
  applyScoreDelta,
  formatWpm,
  getRandomWeightedLetter,
  initializeScores,
  parseProgress,
  type Letter,
  type ProgressSnapshot,
  type ScoreRecord,
} from '@dit/core';
import { GlassButton } from './components/GlassButton';
import { GlassSurface } from './components/GlassSurface';
import { useFirebaseService } from './firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { startTone, stopTone, unloadTone } from './native/audio';
import {
  triggerDashHaptic,
  triggerDotHaptic,
  triggerSuccessHaptic,
} from './native/haptics';

const LETTERS = Object.keys(MORSE_CODE) as Letter[];
const INITIAL_WPM = Math.round((WPM_RANGE[0] + WPM_RANGE[1]) / 2);
const LOGO = require('../assets/icon.png');
const COLORS = {
  bg: '#0a0c12',
  text: '#f4f7f9',
  muted: '#8d98a5',
  accent: '#38f2a2',
  accentCool: '#4cc9ff',
  error: '#ff6b6b',
};

const pickNextLetter = (scores: ScoreRecord, previous?: Letter) =>
  getRandomWeightedLetter(LETTERS, scores, previous);

export default function App() {
  const initialScores = useMemo(() => initializeScores(), []);
  const [progress, setProgress] = useState<ProgressSnapshot>(() => ({
    listenWpm: INITIAL_WPM,
    maxLevel: 2,
    practiceWordMode: false,
    scores: initialScores,
    showHint: true,
    showMnemonic: true,
    wordMode: false,
  }));
  const [targetLetter, setTargetLetter] = useState<Letter>(() =>
    pickNextLetter(initialScores),
  );
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [showHintOnce, setShowHintOnce] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const pressStartRef = useRef<number | null>(null);
  const scoresRef = useRef(progress.scores);
  const targetCode = MORSE_CODE[targetLetter].code;

  const { firebaseService, isAuthRequestReady } = useFirebaseService();

  const handleRemoteProgress = useCallback((raw: unknown) => {
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
  }, []);

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

  useEffect(() => () => void unloadTone(), []);

  useEffect(() => {
    if (input.length === 0) {
      return;
    }
    if (input.length < targetCode.length) {
      return;
    }
    const isMatch = input === targetCode;
    const delta = isMatch ? 1 : -1;
    const nextScores = applyScoreDelta(
      scoresRef.current,
      targetLetter,
      delta,
    );
    setProgress((prev) => ({
      ...prev,
      scores: nextScores,
    }));
    setResult(isMatch ? 'correct' : 'wrong');
    if (isMatch) {
      void triggerSuccessHaptic();
    }
    const timeout = setTimeout(() => {
      setInput('');
      setResult(null);
      setShowHintOnce(false);
      setTargetLetter(pickNextLetter(nextScores, targetLetter));
    }, isMatch ? 700 : 900);
    return () => clearTimeout(timeout);
  }, [input, targetCode, targetLetter]);

  const handlePressIn = async () => {
    pressStartRef.current = Date.now();
    await startTone();
  };

  const handlePressOut = async () => {
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
    setInput((previous) => previous + signal);
  };

  const handleSkip = useCallback(() => {
    setInput('');
    setResult(null);
    setShowHintOnce(false);
    setTargetLetter((previous) =>
      pickNextLetter(scoresRef.current, previous),
    );
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
  const userLabel = user ? user.displayName ?? user.email ?? 'Signed in' : '';
  const userInitial = user
    ? userLabel
      ? userLabel[0].toUpperCase()
      : '?'
    : '';

  const hintVisible = progress.showHint || showHintOnce;
  const mnemonicVisible = progress.showMnemonic;
  const status =
    result === 'correct' ? 'success' : result === 'wrong' ? 'error' : 'idle';
  const baseStatusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
        ? 'Missed. Start over.'
        : mnemonicVisible
          ? MORSE_CODE[targetLetter].mnemonic
          : ' ';
  const statusText = baseStatusText;
  const practiceWpmText = progress.practiceWordMode
    ? `${formatWpm(progress.listenWpm)} WPM`
    : null;
  const targetSymbols = targetCode.split('');
  const isInputOnTrack = Boolean(input) && targetCode.startsWith(input);
  const highlightCount =
    status === 'success'
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
          status === 'success' && styles.pipSuccess,
          status === 'error' && styles.pipError,
        ]}
      />
    );
  });

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
              <Image source={LOGO} style={styles.logoImage} />
            </Pressable>
            <GlassSurface
              style={styles.modeSelect}
              contentStyle={styles.modeSelectContent}
              intensity={25}
            >
              <Text style={styles.modeSelectText}>Practice</Text>
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
                <Text style={styles.settingsButtonLabel}>...</Text>
              </Pressable>
              {showSettings ? (
                <GlassSurface
                  style={styles.settingsPanel}
                  contentStyle={styles.settingsPanelContent}
                  intensity={45}
                >
                  <Pressable
                    onPress={() =>
                      setProgress((prev) => ({
                        ...prev,
                        showHint: !prev.showHint,
                      }))
                    }
                    style={styles.toggleRow}
                  >
                    <Text style={styles.toggleLabel}>Show hints</Text>
                    <View
                      style={[
                        styles.toggleTrack,
                        progress.showHint && styles.toggleTrackActive,
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
                    onPress={() =>
                      setProgress((prev) => ({
                        ...prev,
                        showMnemonic: !prev.showMnemonic,
                      }))
                    }
                    style={styles.toggleRow}
                  >
                    <Text style={styles.toggleLabel}>Show mnemonics</Text>
                    <View
                      style={[
                        styles.toggleTrack,
                        progress.showMnemonic && styles.toggleTrackActive,
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

          <View
            style={[
              styles.stage,
              status === 'success' && styles.stageSuccess,
              status === 'error' && styles.stageError,
            ]}
          >
            <Text
              style={[
                styles.letter,
                status === 'success' && styles.letterSuccess,
                status === 'error' && styles.letterError,
              ]}
            >
              {targetLetter}
            </Text>
            {hintVisible ? (
              <View style={styles.progress} accessibilityLabel={`Target ${targetCode}`}>
                {pips}
              </View>
            ) : (
              <View style={[styles.progress, styles.progressHidden]} />
            )}
            <Text
              style={[
                styles.statusText,
                status === 'success' && styles.statusTextSuccess,
                status === 'error' && styles.statusTextError,
              ]}
            >
              {statusText}
            </Text>
            {practiceWpmText ? (
              <Text style={styles.wpmText}>{practiceWpmText}</Text>
            ) : null}
          </View>

          <View style={styles.controls}>
            {!progress.showHint && !showHintOnce ? (
              <GlassButton
                label="Show this hint"
                onPress={() => setShowHintOnce(true)}
                style={styles.hintButton}
              />
            ) : null}
            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
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
            <View style={styles.actions}>
              <GlassButton label="Clear" onPress={() => setInput('')} />
              <GlassButton label="Skip" onPress={handleSkip} />
            </View>
          </View>
        </SafeAreaView>
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
    width: 44,
    height: 44,
    opacity: 0.6,
    resizeMode: 'contain',
  },
  modeSelect: {
    borderRadius: 999,
  },
  modeSelectContent: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelectText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
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
  settingsButtonLabel: {
    color: COLORS.text,
    fontSize: 16,
    letterSpacing: 2,
  },
  settingsPanel: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 240,
    borderRadius: 16,
    zIndex: 4,
  },
  settingsPanelContent: {
    gap: 16,
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
  toggleLabel: {
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
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
    fontSize: 11,
    letterSpacing: 2,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stageSuccess: {
    zIndex: 1,
  },
  stageError: {
    zIndex: 1,
  },
  letter: {
    fontSize: 96,
    lineHeight: 90,
    letterSpacing: 6,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: COLORS.text,
    textAlign: 'center',
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
  morseWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
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
