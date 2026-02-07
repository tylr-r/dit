import { Host, Picker } from '@expo/ui/swift-ui'
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers'
import type { User } from '@firebase/auth'
import { BlurView } from 'expo-blur'
import { GlassContainer } from 'expo-glass-effect'
import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DitButton } from './DitButton'

type SettingsPanelProps = {
  isFreestyle: boolean;
  isListen: boolean;
  levels: readonly number[];
  maxLevel: number;
  practiceWordMode: boolean;
  practiceAutoPlay: boolean;
  practiceLearnMode: boolean;
  listenWpm: number;
  listenWpmMin: number;
  listenWpmMax: number;
  showHint: boolean;
  showMnemonic: boolean;
  user: User | null;
  onClose: () => void;
  onMaxLevelChange: (value: number) => void;
  onPracticeWordModeChange: (value: boolean) => void;
  onPracticeAutoPlayChange: (value: boolean) => void;
  onPracticeLearnModeChange: (value: boolean) => void;
  onListenWpmChange: (value: number) => void;
  onShowHintChange: (value: boolean) => void;
  onShowMnemonicChange: (value: boolean) => void;
  onUseRecommended: () => void;
  onShowReference: () => void;
  onSignIn: () => Promise<unknown>;
  onSignOut: () => Promise<unknown>;
};

const ToggleRow = ({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
      {label}
    </Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: 'rgba(255, 255, 255, 0.15)', true: '#38f2a2' }}
      thumbColor={value ? '#0c1116' : '#f4f7f9'}
    />
  </View>
)

/** Settings panel content for practice controls. */
export function SettingsPanel({
  isFreestyle,
  isListen,
  levels,
  maxLevel = 3,
  practiceWordMode,
  practiceAutoPlay,
  practiceLearnMode,
  listenWpm,
  listenWpmMin,
  listenWpmMax,
  showHint,
  showMnemonic,
  user,
  onClose,
  onMaxLevelChange,
  onPracticeWordModeChange,
  onPracticeAutoPlayChange,
  onPracticeLearnModeChange,
  onListenWpmChange,
  onShowHintChange,
  onShowMnemonicChange,
  onUseRecommended,
  onShowReference,
  onSignIn,
  onSignOut,
}: SettingsPanelProps) {
  const { height: windowHeight } = useWindowDimensions()
  const panelMaxHeight = Math.round(windowHeight * 0.9)
  const scrollMaxHeight = Math.max(140, panelMaxHeight - 260)
  const showPracticeControls = !isFreestyle && !isListen
  const canShowWordsToggle = !isListen
  const showHintControls = !isFreestyle && !isListen
  const [helperExpanded, setHelperExpanded] = React.useState(false)
  // Panel entrance/exit animation state
  const panelVisible = useSharedValue(0)
  const [exiting, setExiting] = React.useState(false)

  // Animate panel in on mount
  React.useEffect(() => {
    panelVisible.value = withTiming(1, { duration: 180 })
  }, [panelVisible])

  // Animate panel out on close
  const handleClose = React.useCallback(() => {
    if (exiting) return
    setExiting(true)
    panelVisible.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) scheduleOnRN(onClose)
    })
  }, [exiting, onClose, panelVisible])

  const panelAnimStyle = useAnimatedStyle(() => ({
    opacity: panelVisible.value,
    transform: [
      { scale: 0.98 + 0.02 * panelVisible.value },
      { translateY: 16 * (1 - panelVisible.value) },
    ],
  }))

  return (
    <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
      <BlurView
        intensity={24}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <GlassContainer spacing={6} style={styles.actions}>
          <DitButton
            text="Close"
            onPress={handleClose}
            accessibilityLabel="Close settings"
            textStyle={{ fontSize: 11 }}
          />
        </GlassContainer>
      </View>
      <Animated.View style={panelAnimStyle}>
        <ScrollView
          style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {canShowWordsToggle ? (
            <ToggleRow
              label={isFreestyle ? 'Word mode' : 'Practice Words'}
              value={practiceWordMode}
              onValueChange={onPracticeWordModeChange}
            />
          ) : null}
          {showPracticeControls ? (
            <ToggleRow
              label="Auto-play sound"
              value={practiceAutoPlay}
              onValueChange={onPracticeAutoPlayChange}
            />
          ) : null}
          {showPracticeControls ? (
            <>
              <ToggleRow
                label="Learn mode"
                value={practiceLearnMode}
                disabled={practiceWordMode}
                onValueChange={onPracticeLearnModeChange}
              />
              <Text style={styles.helperText}>
                Cycles through characters in order of most common instead of
                random selection.
              </Text>
            </>
          ) : null}
          {showPracticeControls ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Max Difficulty</Text>
              <View
                style={{
                  alignItems: 'flex-end',
                  alignSelf: 'flex-end',
                  marginRight: -10,
                }}
              >
                <Host matchContents>
                  <Picker
                    options={levels.map((level) => `Level ${level}`)}
                    selectedIndex={levels.indexOf(maxLevel)}
                    label={`Level ${maxLevel}`}
                    onOptionSelected={({ nativeEvent }) => {
                      const newLevel = levels[nativeEvent.index]
                      if (newLevel !== undefined) onMaxLevelChange(newLevel)
                    }}
                    variant="menu"
                    modifiers={[accessibilityLabel('Max level')]}
                    color="white"
                  />
                </Host>
              </View>
            </View>
          ) : null}
          {isListen ? (
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.stepperInfo}>
                  <Text style={styles.rowLabel}>Listen speed</Text>
                  <Text style={styles.stepperValue}>{listenWpm} WPM</Text>
                </View>
                <View
                  style={styles.stepperGroup}
                  accessible
                  accessibilityLabel="Listen speed"
                >
                  <Pressable
                    onPress={() => onListenWpmChange(listenWpm - 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease listen speed"
                    disabled={listenWpm <= listenWpmMin}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      pressed && styles.stepperButtonPressed,
                      listenWpm <= listenWpmMin && styles.stepperButtonDisabled,
                    ]}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onListenWpmChange(listenWpm + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase listen speed"
                    disabled={listenWpm >= listenWpmMax}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      pressed && styles.stepperButtonPressed,
                      listenWpm >= listenWpmMax && styles.stepperButtonDisabled,
                    ]}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
          {showHintControls ? (
            <>
              <View style={styles.divider} />
              <Pressable
                onPress={() => setHelperExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle helper options"
                style={({ pressed }) => [
                  styles.helperTrigger,
                  pressed && styles.helperTriggerPressed,
                ]}
              >
                <Text style={styles.helperTriggerTitle}>Helpers</Text>
                <Text style={styles.helperTriggerChevron}>
                  {helperExpanded ? '▾' : '▸'}
                </Text>
              </Pressable>
              {helperExpanded ? (
                <>
                  <ToggleRow
                    label="Show hints"
                    value={showHint}
                    onValueChange={onShowHintChange}
                  />
                  <Text style={styles.helperText}>Not recommended</Text>
                  <ToggleRow
                    label="Show mnemonics"
                    value={showMnemonic}
                    onValueChange={onShowMnemonicChange}
                  />
                  <Text style={styles.helperText}>Not recommended</Text>
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
      <View style={styles.footer}>
        <View style={styles.divider} />
        <View style={styles.section}>
          <DitButton
            text="Use recommended settings"
            onPress={onUseRecommended}
            accessibilityLabel="Use recommended settings"
            textStyle={{
              ...styles.panelButtonText,
              ...styles.resetButtonText,
            }}
          />
        </View>
        <View style={styles.section}>
          <DitButton
            text="Letter Reference"
            onPress={onShowReference}
            accessibilityLabel="Open reference"
            textStyle={styles.panelButtonText}
          />
        </View>
        <View style={styles.section}>
          {user ? (
            <View style={styles.row}>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: 12, flex: 1, marginRight: 8 },
                ]}
                numberOfLines={1}
              >
                {user.email}
              </Text>
              <DitButton
                text="Sign Out"
                onPress={onSignOut}
                accessibilityLabel="Sign out"
                padding={0}
              />
            </View>
          ) : (
            <DitButton
              text="Sign in"
              onPress={onSignIn}
              accessibilityLabel="Sign in with Google"
              textStyle={styles.panelButtonText}
            />
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    paddingBottom: 4,
    paddingTop: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 10 },
    alignSelf: 'center',
  },
  header: {
    position: 'absolute',
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    experimental_backgroundImage:
      'linear-gradient(0deg,transparent,rgba(0, 0, 0, 0.26),rgba(0,0,0, 0.9),rgba(0,0,0, 0.9))',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  footer: {
    padding: 24,
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f7f9',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.8)',
  },
  section: {
    marginTop: 12,
    gap: 10,
  },
  panelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  panelButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  panelButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.9)',
  },
  resetButtonText: {
    color: '#38f2a2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: 'rgba(244, 247, 249, 0.9)',
  },
  rowLabelDisabled: {
    color: 'rgba(244, 247, 249, 0.4)',
  },
  helperText: {
    marginTop: -2,
    marginBottom: 4,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(244, 247, 249, 0.62)',
  },
  helperTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  helperTriggerPressed: {
    opacity: 0.8,
  },
  helperTriggerTitle: {
    fontSize: 14,
    color: 'rgba(244, 247, 249, 0.9)',
  },
  helperTriggerChevron: {
    fontSize: 36,
    marginRight: 4,
    color: 'rgba(244, 247, 249, 0.7)',
  },
  stepperInfo: {
    flex: 1,
    gap: 2,
  },
  stepperValue: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.7)',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  stepperButtonText: {
    fontSize: 16,
    color: 'rgba(244, 247, 249, 0.9)',
  },
})
