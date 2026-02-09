import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import DitLogo from './DitLogo'
import { ModeSwitcher, type Mode } from './ModeSwitcher'

type TopBarProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onPressAbout: () => void;
  onSettingsPress: () => void;
  showSettingsHint?: boolean;
};

/** Top navigation with logo, mode switcher, and settings access. */
export function TopBar({
  mode,
  onModeChange,
  onPressAbout,
  onSettingsPress,
  showSettingsHint = false,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        <Pressable
          onPress={onPressAbout}
          accessibilityRole="button"
          accessibilityLabel="About Dit"
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
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
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
