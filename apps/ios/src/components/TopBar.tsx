import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import DitLogo from './DitLogo'
import { ModeSwitcher, type Mode } from './ModeSwitcher'

type TopBarProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onPressReference: () => void;
  onSettingsPress: () => void;
  showSettingsHint?: boolean;
  courseChipText?: string | null;
};

/** Top navigation with logo, mode switcher, and settings access. */
export function TopBar({
  mode,
  onModeChange,
  onPressReference,
  onSettingsPress,
  showSettingsHint = false,
  courseChipText,
}: TopBarProps) {
  return (
    <View style={styles.topBarWrap}>
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          <Pressable
            onPress={onPressReference}
            accessibilityRole="button"
            accessibilityLabel="Open progress"
            accessibilityHint="Shows your progress and the Morse code reference chart"
            style={styles.logoButton}
          >
            <DitLogo />
          </Pressable>
        </View>
        <View style={styles.topBarCenter}>
          <ModeSwitcher value={mode} onChange={onModeChange} />
        </View>
        <View style={styles.topBarSide}>
          <View style={styles.settingsButtonWrap}>
            {showSettingsHint ? (
              <View style={styles.settingsHint}>
                <Text style={styles.hintText}>
                  Add hints, change speed, and save progress in settings.
                </Text>
                <View style={styles.settingsHintArrow} />
              </View>
            ) : null}
            <DitButton
              onPress={onSettingsPress}
              accessibilityLabel="Settings"
              icon="switch.2"
              radius={36}
              padding={12}
              iconSize={24}
            />
          </View>
        </View>
      </View>
      {courseChipText ? (
        <View style={styles.courseChipRow}>
          <View style={styles.courseChip}>
            <Text style={styles.courseChipText}>{courseChipText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  topBarWrap: {
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  courseChipRow: {
    alignItems: 'center',
  },
  courseChip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.input,
  },
  courseChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary40,
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
    borderRadius: radii.iconCircle,
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
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 4,
  },
  settingsHintArrow: {
    position: 'absolute',
    top: -6,
    right: 22,
    width: 12,
    height: 12,
    backgroundColor: colors.surface.panelStrong,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
    transform: [{ rotate: '45deg' }],
  },
  hintText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary90,
  },
})
