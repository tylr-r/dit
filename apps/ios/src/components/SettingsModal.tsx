import type { User } from '@firebase/auth'
import { BlurView } from 'expo-blur'
import React from 'react'
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing } from '../design/tokens'

type SettingsModalProps = {
  isFreestyle: boolean
  isListen: boolean
  levels: readonly number[]
  maxLevel: number
  practiceWordMode: boolean
  practiceAutoPlay: boolean
  practiceLearnMode: boolean
  practiceIfrMode: boolean
  practiceReviewMisses: boolean
  listenCharacterWpm: number
  listenCharacterWpmMin: number
  listenCharacterWpmMax: number
  showHint: boolean
  showMnemonic: boolean
  user: User | null
  isDeletingAccount: boolean
  onClose: () => void
  onMaxLevelChange: (value: number) => void
  onPracticeWordModeChange: (value: boolean) => void
  onPracticeAutoPlayChange: (value: boolean) => void
  onPracticeLearnModeChange: (value: boolean) => void
  onPracticeIfrModeChange: (value: boolean) => void
  onPracticeReviewMissesChange: (value: boolean) => void
  onListenCharacterWpmChange: (value: number) => void
  onShowHintChange: (value: boolean) => void
  onShowMnemonicChange: (value: boolean) => void
  onUseRecommended: () => void
  onShowReference: () => void
  onSignInWithApple: () => Promise<unknown>
  onSignInWithGoogle: () => Promise<unknown>
  onSignOut: () => Promise<unknown>
  onDeleteAccount: () => void
}

type ToggleRowProps = {
  label: string
  value: boolean
  disabled?: boolean
  onValueChange: (value: boolean) => void
}

type ActionRowProps = {
  text: string
  accessibilityLabel: string
  accessibilityHint?: string
  onPress: () => void
  destructive?: boolean
  disabled?: boolean
}

const SHEET_MIN_HEIGHT = 360
const SHEET_TOP_GAP = 16
const SHEET_DISMISS_DRAG_THRESHOLD = 124
const SHEET_DISMISS_VELOCITY_THRESHOLD = 1.1

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const groupBackgroundColor = 'hsla(217, 26%, 5%, 0.94)'
const actionTintColor = 'rgba(125, 195, 255, 0.96)'

const ToggleRow = ({
  label,
  value,
  disabled,
  onValueChange,
}: ToggleRowProps) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
      {label}
    </Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      trackColor={{
        false: colors.controls.switchTrackOff,
        true: colors.feedback.success,
      }}
      thumbColor={value ? colors.controls.switchThumbOn : colors.text.primary}
    />
  </View>
)

const ActionRow = ({
  text,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  destructive = false,
  disabled = false,
}: ActionRowProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    style={({ pressed }) => [
      styles.row,
      disabled && styles.rowDisabled,
      pressed && !disabled && styles.actionRowPressed,
    ]}
  >
    <Text
      style={[
        styles.actionText,
        destructive && styles.destructiveText,
        disabled && styles.actionTextDisabled,
      ]}
    >
      {text}
    </Text>
  </Pressable>
)

const SettingsGroup = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.group}>{children}</View>
)

/** Settings controls presented in a custom detent bottom sheet. */
export function SettingsModal({
  isFreestyle,
  isListen,
  levels,
  maxLevel = 3,
  practiceWordMode,
  practiceAutoPlay,
  practiceLearnMode,
  practiceIfrMode,
  practiceReviewMisses,
  listenCharacterWpm,
  listenCharacterWpmMin,
  listenCharacterWpmMax,
  showHint,
  showMnemonic,
  user,
  isDeletingAccount,
  onClose,
  onMaxLevelChange,
  onPracticeWordModeChange,
  onPracticeAutoPlayChange,
  onPracticeLearnModeChange,
  onPracticeIfrModeChange,
  onPracticeReviewMissesChange,
  onListenCharacterWpmChange,
  onShowHintChange,
  onShowMnemonicChange,
  onUseRecommended,
  onShowReference,
  onSignInWithApple,
  onSignInWithGoogle,
  onSignOut,
  onDeleteAccount,
}: SettingsModalProps) {
  const { height: viewportHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const isPractice = !isFreestyle && !isListen

  const maxSheetHeight = Math.max(
    SHEET_MIN_HEIGHT,
    viewportHeight - Math.max(insets.top + SHEET_TOP_GAP, SHEET_TOP_GAP),
  )
  const hiddenOffset = maxSheetHeight + insets.bottom + spacing.xl
  const hiddenOffsetMidpoint = hiddenOffset / 2

  const sheetTranslateY = React.useRef(new Animated.Value(hiddenOffset)).current
  const dragStartTranslateYRef = React.useRef(0)
  const hasOpenedRef = React.useRef(false)
  const isClosingRef = React.useRef(false)

  const showFreestyleWordToggle = isFreestyle
  const showMaxLevelControl = !isFreestyle
  const hasControlsBeforePlaybackSpeed =
    showFreestyleWordToggle || showMaxLevelControl
  const maxLevelIndex = levels.indexOf(maxLevel)
  const canDecreaseMaxLevel = maxLevelIndex > 0
  const canIncreaseMaxLevel = maxLevelIndex < levels.length - 1
  const [practiceSettingsExpanded, setPracticeSettingsExpanded] =
    React.useState(false)
  const [helperExpanded, setHelperExpanded] = React.useState(false)
  const bottomInsetPadding = Math.max(
    spacing.xl * 2,
    insets.bottom + spacing.xl,
  )

  const animateTo = React.useCallback(
    (toValue: number) => {
      Animated.spring(sheetTranslateY, {
        toValue,
        tension: 82,
        friction: 12,
        useNativeDriver: true,
      }).start()
    },
    [sheetTranslateY],
  )

  const requestClose = React.useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    Animated.timing(sheetTranslateY, {
      toValue: hiddenOffset,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose()
      } else {
        isClosingRef.current = false
      }
    })
  }, [hiddenOffset, onClose, sheetTranslateY])

  const settleSheet = React.useCallback(
    (value: number, velocityY: number) => {
      const draggedDown = Math.max(0, value)
      const shouldDismiss =
        draggedDown > SHEET_DISMISS_DRAG_THRESHOLD ||
        velocityY > SHEET_DISMISS_VELOCITY_THRESHOLD
      if (shouldDismiss) {
        requestClose()
        return
      }
      animateTo(0)
    },
    [animateTo, requestClose],
  )

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((currentValue: number) => {
            const start = clamp(currentValue, 0, hiddenOffset)
            dragStartTranslateYRef.current = start
            sheetTranslateY.setValue(start)
          })
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartTranslateYRef.current
          const dy = gestureState.dy
          const nextTranslateY = clamp(start + dy, 0, hiddenOffset)
          sheetTranslateY.setValue(nextTranslateY)
        },
        onPanResponderRelease: (_, gestureState) => {
          const start = dragStartTranslateYRef.current
          const releasedValue = clamp(start + gestureState.dy, 0, hiddenOffset)
          sheetTranslateY.stopAnimation()
          sheetTranslateY.setValue(releasedValue)
          settleSheet(releasedValue, gestureState.vy)
        },
        onPanResponderTerminate: (_, gestureState) => {
          const start = dragStartTranslateYRef.current
          const releasedValue = clamp(start + gestureState.dy, 0, hiddenOffset)
          sheetTranslateY.stopAnimation()
          sheetTranslateY.setValue(releasedValue)
          settleSheet(releasedValue, gestureState.vy)
        },
      }),
    [hiddenOffset, settleSheet, sheetTranslateY],
  )

  React.useEffect(() => {
    isClosingRef.current = false
    const targetOffset = 0
    if (!hasOpenedRef.current) {
      sheetTranslateY.setValue(hiddenOffset)
      const openTimer = setTimeout(() => {
        animateTo(targetOffset)
      }, 0)
      hasOpenedRef.current = true
      return () => {
        clearTimeout(openTimer)
      }
    }
    sheetTranslateY.setValue(clamp(targetOffset, 0, hiddenOffset))
  }, [animateTo, hiddenOffset, sheetTranslateY])

  const backdropOpacity = sheetTranslateY.interpolate({
    inputRange: [0, hiddenOffsetMidpoint, hiddenOffset],
    outputRange: [1, 0.88, 0],
    extrapolate: 'clamp',
  })

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      />
      <Pressable
        onPress={requestClose}
        style={styles.backdropTouchTarget}
        accessibilityRole="button"
        accessibilityLabel="Close settings"
        accessibilityHint="Dismisses the settings panel"
      />
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheetCard,
            {
              height: maxSheetHeight,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <BlurView intensity={18} tint="dark" style={styles.sheetBlurBase} />
          <View style={styles.sheetTintOverlay} />
          <View
            style={styles.sheetHandleTouchArea}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetBody}>
            <View
              style={[
                styles.panel,
                { paddingBottom: insets.bottom + spacing.md },
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
              </View>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: bottomInsetPadding },
                ]}
                contentInsetAdjustmentBehavior="automatic"
                scrollIndicatorInsets={{ bottom: bottomInsetPadding }}
                showsVerticalScrollIndicator
                alwaysBounceVertical
                bounces
              >
                <SettingsGroup>
                  {showFreestyleWordToggle ? (
                    <>
                      <ToggleRow
                        label="Word mode"
                        value={practiceWordMode}
                        onValueChange={onPracticeWordModeChange}
                      />
                      <Text style={styles.helperText}>
                        Build a running word from decoded letters in Freestyle.
                      </Text>
                    </>
                  ) : null}
                  {showMaxLevelControl ? (
                    <>
                      {showFreestyleWordToggle ? (
                        <View style={styles.separator} />
                      ) : null}
                      <View style={styles.row}>
                        <View style={styles.stepperInfo}>
                          <Text style={styles.rowLabel}>Max Difficulty</Text>
                          <Text style={styles.stepperValue}>
                            Level {maxLevel}
                          </Text>
                        </View>
                        <View style={styles.stepperGroup} accessible={false}>
                          <Pressable
                            onPress={() => {
                              const newLevel = levels[maxLevelIndex - 1]
                              if (newLevel !== undefined) {
                                onMaxLevelChange(newLevel)
                              }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease max level"
                            accessibilityHint={`Changes max difficulty to level ${levels[maxLevelIndex - 1] ?? maxLevel}`}
                            disabled={!canDecreaseMaxLevel}
                            style={({ pressed }) => [
                              styles.stepperButton,
                              pressed && styles.stepperButtonPressed,
                              !canDecreaseMaxLevel &&
                                styles.stepperButtonDisabled,
                            ]}
                          >
                            <Text style={styles.stepperButtonText}>-</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              const newLevel = levels[maxLevelIndex + 1]
                              if (newLevel !== undefined) {
                                onMaxLevelChange(newLevel)
                              }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Increase max level"
                            accessibilityHint={`Changes max difficulty to level ${levels[maxLevelIndex + 1] ?? maxLevel}`}
                            disabled={!canIncreaseMaxLevel}
                            style={({ pressed }) => [
                              styles.stepperButton,
                              pressed && styles.stepperButtonPressed,
                              !canIncreaseMaxLevel &&
                                styles.stepperButtonDisabled,
                            ]}
                          >
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.helperText}>
                        Limits Practice and Listen to the characters in this
                        level.
                      </Text>
                    </>
                  ) : null}
                  <>
                    {hasControlsBeforePlaybackSpeed ? (
                      <View style={styles.separator} />
                    ) : null}
                    <View style={styles.row}>
                      <View style={styles.stepperInfo}>
                        <Text style={styles.rowLabel}>Playback letter speed</Text>
                        <Text style={styles.stepperValue}>
                          {listenCharacterWpm} WPM
                        </Text>
                      </View>
                      <View style={styles.stepperGroup} accessible={false}>
                        <Pressable
                          onPress={() =>
                            onListenCharacterWpmChange(listenCharacterWpm - 1)
                          }
                          accessibilityRole="button"
                          accessibilityLabel="Decrease playback character speed"
                          accessibilityHint={`Changes playback letter speed to ${listenCharacterWpm - 1} words per minute`}
                          disabled={listenCharacterWpm <= listenCharacterWpmMin}
                          style={({ pressed }) => [
                            styles.stepperButton,
                            pressed && styles.stepperButtonPressed,
                            listenCharacterWpm <= listenCharacterWpmMin &&
                              styles.stepperButtonDisabled,
                          ]}
                        >
                          <Text style={styles.stepperButtonText}>-</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            onListenCharacterWpmChange(listenCharacterWpm + 1)
                          }
                          accessibilityRole="button"
                          accessibilityLabel="Increase playback character speed"
                          accessibilityHint={`Changes playback letter speed to ${listenCharacterWpm + 1} words per minute`}
                          disabled={listenCharacterWpm >= listenCharacterWpmMax}
                          style={({ pressed }) => [
                            styles.stepperButton,
                            pressed && styles.stepperButtonPressed,
                            listenCharacterWpm >= listenCharacterWpmMax &&
                              styles.stepperButtonDisabled,
                          ]}
                        >
                          <Text style={styles.stepperButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.helperText}>
                      Used whenever Dit plays Morse for you. Higher = faster
                      dits and dahs.
                    </Text>
                    {/* TODO: Restore a playback spacing control when word playback ships. */}
                  </>
                </SettingsGroup>

                <SettingsGroup>
                  {!isPractice ? (
                    <Pressable
                      onPress={() =>
                        setPracticeSettingsExpanded((prev) => !prev)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Toggle practice settings"
                      accessibilityHint={
                        practiceSettingsExpanded
                          ? 'Collapses practice-only settings'
                          : 'Expands practice-only settings'
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.actionRowPressed,
                      ]}
                    >
                      <Text style={styles.rowLabel}>Practice settings</Text>
                      <Text style={styles.helperTriggerChevron}>
                        {practiceSettingsExpanded ? '▾' : '▸'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {isPractice || practiceSettingsExpanded ? (
                    <>
                      {!isPractice ? (
                        <>
                          <View style={styles.separator} />
                          <Text style={styles.helperText}>
                            Applies when you switch back to Practice mode.
                          </Text>
                          <View style={styles.separator} />
                        </>
                      ) : null}
                      <ToggleRow
                        label="Practice Words"
                        value={practiceWordMode}
                        onValueChange={onPracticeWordModeChange}
                      />
                      <Text style={styles.helperText}>
                        Practice full words instead of single characters.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Auto-play sound"
                        value={practiceAutoPlay}
                        onValueChange={onPracticeAutoPlayChange}
                      />
                      <Text style={styles.helperText}>
                        Automatically plays the current Practice target.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Learn mode"
                        value={practiceLearnMode}
                        disabled={practiceWordMode}
                        onValueChange={onPracticeLearnModeChange}
                      />
                      <Text style={styles.helperText}>
                        {practiceWordMode
                          ? 'Unavailable while Practice Words is on.'
                          : 'Shows characters in a fixed learning order instead of random selection.'}
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Immediate flow recovery"
                        value={practiceIfrMode}
                        onValueChange={onPracticeIfrModeChange}
                      />
                      <Text style={styles.helperText}>
                        On a miss, move on to the next target instead of
                        repeating the same one.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Review misses later"
                        value={practiceReviewMisses}
                        disabled={!practiceIfrMode}
                        onValueChange={onPracticeReviewMissesChange}
                      />
                      <Text style={styles.helperText}>
                        {!practiceIfrMode
                          ? 'Requires Immediate flow recovery.'
                          : 'Brings missed targets back after a short delay.'}
                      </Text>
                    </>
                  ) : null}
                </SettingsGroup>

                <SettingsGroup>
                  <Pressable
                    onPress={() => setHelperExpanded((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle helper options"
                    accessibilityHint={
                      helperExpanded
                        ? 'Collapses helper settings'
                        : 'Expands helper settings'
                    }
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.actionRowPressed,
                    ]}
                  >
                    <Text style={styles.rowLabel}>Helpers</Text>
                    <Text style={styles.helperTriggerChevron}>
                      {helperExpanded ? '▾' : '▸'}
                    </Text>
                  </Pressable>
                  {helperExpanded ? (
                    <>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Show hints"
                        value={showHint}
                        onValueChange={onShowHintChange}
                      />
                      <Text style={styles.helperText}>
                        Not recommended. This can be tempting at first, but learning by ear improves recall.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Show mnemonics"
                        value={showMnemonic}
                        onValueChange={onShowMnemonicChange}
                      />
                      <Text style={styles.helperText}>
                        Memory aids for Morse patterns. Best used temporarily.
                      </Text>
                    </>
                  ) : null}
                </SettingsGroup>

                <SettingsGroup>
                  <ActionRow
                    text="Use recommended settings"
                    onPress={onUseRecommended}
                    accessibilityLabel="Use recommended settings"
                    accessibilityHint="Applies the default learning setup"
                  />
                  <View style={styles.separator} />
                  <ActionRow
                    text="Letter Reference"
                    onPress={onShowReference}
                    accessibilityLabel="Open reference"
                    accessibilityHint="Opens the Morse code reference chart"
                  />
                  <View style={styles.separator} />
                  {user ? (
                    <>
                      <View style={[styles.row, isDeletingAccount && styles.rowDisabled]}>
                        <Text style={styles.accountEmail} numberOfLines={1}>
                          {user.email}
                        </Text>
                        <Pressable
                          onPress={() => {
                            void onSignOut()
                          }}
                          disabled={isDeletingAccount}
                          accessibilityRole="button"
                          accessibilityLabel="Sign out"
                          accessibilityHint="Stops sync and returns to local-only progress"
                          style={({ pressed }) => [
                            pressed &&
                              !isDeletingAccount &&
                              styles.pressedOpacity,
                          ]}
                        >
                          <Text
                            style={[
                              styles.actionText,
                              styles.destructiveText,
                              isDeletingAccount && styles.actionTextDisabled,
                            ]}
                          >
                            Sign Out
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.separator} />
                      <ActionRow
                        text={
                          isDeletingAccount
                            ? 'Deleting account...'
                            : 'Delete Account'
                        }
                        onPress={onDeleteAccount}
                        accessibilityLabel="Delete account"
                        accessibilityHint="Deletes your account, synced progress, and local progress on this device"
                        destructive
                        disabled={isDeletingAccount}
                      />
                    </>
                  ) : (
                    <>
                      <ActionRow
                        text="Sign in with Apple"
                        onPress={() => {
                          void onSignInWithApple()
                        }}
                        accessibilityLabel="Sign in with Apple"
                        accessibilityHint="Connects your Dit account using Apple"
                      />
                      <View style={styles.separator} />
                      <ActionRow
                        text="Sign in with Google"
                        onPress={() => {
                          void onSignInWithGoogle()
                        }}
                        accessibilityLabel="Sign in with Google"
                        accessibilityHint="Connects your Dit account using Google"
                      />
                    </>
                  )}
                </SettingsGroup>
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.backdrop,
  },
  backdropTouchTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    width: '100%',
    maxWidth: 860,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.42,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -10 },
  },
  sheetBlurBase: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  sheetTintOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    backgroundColor: 'hsla(215, 25%, 6%, 0.62)',
  },
  sheetHandleTouchArea: {
    minHeight: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetHandle: {
    width: 76,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  sheetBody: {
    flex: 1,
  },
  panel: {
    width: '100%',
    paddingHorizontal: 30,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl + 4,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    gap: spacing.xl + 4,
  },
  group: {
    backgroundColor: groupBackgroundColor,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 66,
  },
  rowLabel: {
    fontSize: 16,
    color: colors.text.primary90,
  },
  rowLabelDisabled: {
    color: colors.text.primary40,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: spacing.xl,
    marginRight: spacing.xl,
  },
  helperText: {
    marginTop: -8,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary60,
  },
  helperTriggerChevron: {
    fontSize: 24,
    color: colors.text.primary60,
  },
  stepperInfo: {
    flex: 1,
    gap: 2,
  },
  stepperValue: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.primary60,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  stepperButtonText: {
    fontSize: 18,
    color: colors.text.primary90,
  },
  actionText: {
    fontSize: 16,
    color: actionTintColor,
  },
  actionTextDisabled: {
    color: colors.text.primary40,
  },
  destructiveText: {
    color: colors.feedback.error,
  },
  actionRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pressedOpacity: {
    opacity: 0.6,
  },
  accountEmail: {
    flex: 1,
    marginRight: spacing.xl,
    fontSize: 13,
    color: colors.text.primary60,
  },
})
