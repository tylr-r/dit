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
  listenEffectiveWpm: number
  listenEffectiveWpmMin: number
  listenEffectiveWpmMax: number
  showHint: boolean
  showMnemonic: boolean
  user: User | null
  onClose: () => void
  onMaxLevelChange: (value: number) => void
  onPracticeWordModeChange: (value: boolean) => void
  onPracticeAutoPlayChange: (value: boolean) => void
  onPracticeLearnModeChange: (value: boolean) => void
  onPracticeIfrModeChange: (value: boolean) => void
  onPracticeReviewMissesChange: (value: boolean) => void
  onListenCharacterWpmChange: (value: number) => void
  onListenEffectiveWpmChange: (value: number) => void
  onShowHintChange: (value: boolean) => void
  onShowMnemonicChange: (value: boolean) => void
  onUseRecommended: () => void
  onShowReference: () => void
  onSignIn: () => Promise<unknown>
  onSignOut: () => Promise<unknown>
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
  onPress: () => void
  destructive?: boolean
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
  onPress,
  destructive = false,
}: ActionRowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [styles.row, pressed && styles.actionRowPressed]}
  >
    <Text style={[styles.actionText, destructive && styles.destructiveText]}>
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
  listenEffectiveWpm,
  listenEffectiveWpmMin,
  listenEffectiveWpmMax,
  showHint,
  showMnemonic,
  user,
  onClose,
  onMaxLevelChange,
  onPracticeWordModeChange,
  onPracticeAutoPlayChange,
  onPracticeLearnModeChange,
  onPracticeIfrModeChange,
  onPracticeReviewMissesChange,
  onListenCharacterWpmChange,
  onListenEffectiveWpmChange,
  onShowHintChange,
  onShowMnemonicChange,
  onUseRecommended,
  onShowReference,
  onSignIn,
  onSignOut,
}: SettingsModalProps) {
  const { height: viewportHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()

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

  const showPracticeControls = !isFreestyle && !isListen
  const canShowWordsToggle = !isListen
  const showHintControls = !isFreestyle && !isListen
  const maxLevelIndex = levels.indexOf(maxLevel)
  const canDecreaseMaxLevel = maxLevelIndex > 0
  const canIncreaseMaxLevel = maxLevelIndex < levels.length - 1
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
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      />
      <Pressable onPress={requestClose} style={styles.backdropTouchTarget} />
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
                  {canShowWordsToggle ? (
                    <ToggleRow
                      label={isFreestyle ? 'Word mode' : 'Practice Words'}
                      value={practiceWordMode}
                      onValueChange={onPracticeWordModeChange}
                    />
                  ) : null}
                  {showPracticeControls ? (
                    <>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Auto-play sound"
                        value={practiceAutoPlay}
                        onValueChange={onPracticeAutoPlayChange}
                      />
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Learn mode"
                        value={practiceLearnMode}
                        disabled={practiceWordMode}
                        onValueChange={onPracticeLearnModeChange}
                      />
                      <Text style={styles.helperText}>
                        Cycles through characters in order of most common
                        instead of random selection.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="IFR mode"
                        value={practiceIfrMode}
                        onValueChange={onPracticeIfrModeChange}
                      />
                      <Text style={styles.helperText}>
                        On misses, immediately continue to the next symbol.
                      </Text>
                      <View style={styles.separator} />
                      <ToggleRow
                        label="Review misses later"
                        value={practiceReviewMisses}
                        disabled={!practiceIfrMode}
                        onValueChange={onPracticeReviewMissesChange}
                      />
                      <Text style={styles.helperText}>
                        Replays missed symbols after a short delay.
                      </Text>
                      <View style={styles.separator} />
                      <View style={styles.row}>
                        <View style={styles.stepperInfo}>
                          <Text style={styles.rowLabel}>Max Difficulty</Text>
                          <Text style={styles.stepperValue}>
                            Level {maxLevel}
                          </Text>
                        </View>
                        <View
                          style={styles.stepperGroup}
                          accessible
                          accessibilityLabel="Max level"
                        >
                          <Pressable
                            onPress={() => {
                              const newLevel = levels[maxLevelIndex - 1]
                              if (newLevel !== undefined) {
                                onMaxLevelChange(newLevel)
                              }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease max level"
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
                    </>
                  ) : null}
                  {isListen ? (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.row}>
                        <View style={styles.stepperInfo}>
                          <Text style={styles.rowLabel}>Letter speed</Text>
                          <Text style={styles.stepperValue}>
                            {listenCharacterWpm} WPM
                          </Text>
                        </View>
                        <View
                          style={styles.stepperGroup}
                          accessible
                          accessibilityLabel="Listen character speed"
                        >
                          <Pressable
                            onPress={() =>
                              onListenCharacterWpmChange(listenCharacterWpm - 1)
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Decrease character speed"
                            disabled={
                              listenCharacterWpm <= listenCharacterWpmMin
                            }
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
                            accessibilityLabel="Increase character speed"
                            disabled={
                              listenCharacterWpm >= listenCharacterWpmMax
                            }
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
                        How fast each letter sounds. Higher = faster dits and
                        dahs.
                      </Text>
                      <View style={styles.separator} />
                      <View style={styles.row}>
                        <View style={styles.stepperInfo}>
                          <Text style={styles.rowLabel}>Spacing</Text>
                          <Text style={styles.stepperValue}>
                            {listenEffectiveWpm} WPM
                          </Text>
                        </View>
                        <View
                          style={styles.stepperGroup}
                          accessible
                          accessibilityLabel="Listen effective speed"
                        >
                          <Pressable
                            onPress={() =>
                              onListenEffectiveWpmChange(listenEffectiveWpm - 1)
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Decrease effective speed"
                            disabled={
                              listenEffectiveWpm <= listenEffectiveWpmMin
                            }
                            style={({ pressed }) => [
                              styles.stepperButton,
                              pressed && styles.stepperButtonPressed,
                              listenEffectiveWpm <= listenEffectiveWpmMin &&
                                styles.stepperButtonDisabled,
                            ]}
                          >
                            <Text style={styles.stepperButtonText}>-</Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              onListenEffectiveWpmChange(listenEffectiveWpm + 1)
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Increase effective speed"
                            disabled={
                              listenEffectiveWpm >= listenEffectiveWpmMax
                            }
                            style={({ pressed }) => [
                              styles.stepperButton,
                              pressed && styles.stepperButtonPressed,
                              listenEffectiveWpm >= listenEffectiveWpmMax &&
                                styles.stepperButtonDisabled,
                            ]}
                          >
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.helperText}>
                        Pause between letters. Lower = longer pause to think.
                      </Text>
                    </>
                  ) : null}
                </SettingsGroup>

                {showHintControls ? (
                  <SettingsGroup>
                    <Pressable
                      onPress={() => setHelperExpanded((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle helper options"
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
                        <Text style={styles.helperText}>Not recommended</Text>
                        <View style={styles.separator} />
                        <ToggleRow
                          label="Show mnemonics"
                          value={showMnemonic}
                          onValueChange={onShowMnemonicChange}
                        />
                        <Text style={styles.helperText}>Not recommended</Text>
                      </>
                    ) : null}
                  </SettingsGroup>
                ) : null}

                <SettingsGroup>
                  <ActionRow
                    text="Use recommended settings"
                    onPress={onUseRecommended}
                    accessibilityLabel="Use recommended settings"
                  />
                  <View style={styles.separator} />
                  <ActionRow
                    text="Letter Reference"
                    onPress={onShowReference}
                    accessibilityLabel="Open reference"
                  />
                  <View style={styles.separator} />
                  {user ? (
                    <View style={styles.row}>
                      <Text style={styles.accountEmail} numberOfLines={1}>
                        {user.email}
                      </Text>
                      <Pressable
                        onPress={() => {
                          void onSignOut()
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Sign out"
                        style={({ pressed }) => [
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Text
                          style={[styles.actionText, styles.destructiveText]}
                        >
                          Sign Out
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <ActionRow
                      text="Sign in"
                      onPress={() => {
                        void onSignIn()
                      }}
                      accessibilityLabel="Sign in with Google"
                    />
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
