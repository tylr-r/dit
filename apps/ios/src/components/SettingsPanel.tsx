import { Host, Picker } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import type { User } from '@firebase/auth';
import { BlurView } from 'expo-blur';
import { GlassContainer } from 'expo-glass-effect';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DitButton } from './DitButton';

type SettingsPanelProps = {
  isFreestyle: boolean;
  isListen: boolean;
  levels: readonly number[];
  maxLevel: number;
  practiceWordMode: boolean;
  freestyleWordMode: boolean;
  listenWpm: number;
  listenWpmMin: number;
  listenWpmMax: number;
  showHint: boolean;
  showMnemonic: boolean;
  user: User | null;
  onClose: () => void;
  onMaxLevelChange: (value: number) => void;
  onPracticeWordModeChange: (value: boolean) => void;
  onFreestyleWordModeChange: (value: boolean) => void;
  onListenWpmChange: (value: number) => void;
  onShowHintChange: (value: boolean) => void;
  onShowMnemonicChange: (value: boolean) => void;
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
);

/** Settings panel content for practice controls. */
export function SettingsPanel({
  isFreestyle,
  isListen,
  levels,
  maxLevel = 3,
  practiceWordMode,
  freestyleWordMode,
  listenWpm,
  listenWpmMin,
  listenWpmMax,
  showHint,
  showMnemonic,
  user,
  onClose,
  onMaxLevelChange,
  onPracticeWordModeChange,
  onFreestyleWordModeChange,
  onListenWpmChange,
  onShowHintChange,
  onShowMnemonicChange,
  onShowReference,
  onSignIn,
  onSignOut,
}: SettingsPanelProps) {
  const showPracticeControls = !isFreestyle && !isListen;
  const canShowWordsToggle = !isListen;
  const showHintControls = !isFreestyle && !isListen;
  const nextListenWpm =
    listenWpm >= listenWpmMax ? listenWpmMin : listenWpm + 1;

  // Panel entrance/exit animation state
  const panelVisible = useSharedValue(0);
  const [exiting, setExiting] = React.useState(false);

  // Animate panel in on mount
  React.useEffect(() => {
    panelVisible.value = withTiming(1, { duration: 180 });
  }, [panelVisible]);

  // Animate panel out on close
  const handleClose = React.useCallback(() => {
    if (exiting) return;
    setExiting(true);
    panelVisible.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) scheduleOnRN(onClose);
    });
  }, [exiting, onClose, panelVisible]);

  const panelAnimStyle = useAnimatedStyle(() => ({
    opacity: panelVisible.value,
    transform: [
      { scale: 0.98 + 0.02 * panelVisible.value },
      { translateY: 16 * (1 - panelVisible.value) },
    ],
  }));

  return (
    <View style={styles.panel}>
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
      <Animated.View
        style={[
          panelAnimStyle,
          { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
        ]}
      >
        {showHintControls ? (
          <>
            <ToggleRow
              label="Show hints"
              value={showHint}
              onValueChange={onShowHintChange}
            />
            <ToggleRow
              label="Show mnemonics"
              value={showMnemonic}
              onValueChange={onShowMnemonicChange}
            />
          </>
        ) : null}
        {isFreestyle && !isListen ? (
          <View style={styles.section}>
            <ToggleRow
              label="Word mode"
              value={freestyleWordMode}
              onValueChange={onFreestyleWordModeChange}
            />
          </View>
        ) : null}
        {canShowWordsToggle ? (
          <ToggleRow
            label="Practice Words"
            value={practiceWordMode}
            onValueChange={onPracticeWordModeChange}
          />
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
                    const newLevel = levels[nativeEvent.index];
                    if (newLevel !== undefined) onMaxLevelChange(newLevel);
                  }}
                  variant="menu"
                  modifiers={[accessibilityLabel('Max level')]}
                />
              </Host>
            </View>
          </View>
        ) : null}
        {isListen ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => onListenWpmChange(nextListenWpm)}
              accessibilityRole="button"
              accessibilityLabel="Change listen speed"
              style={styles.row}
            >
              <Text style={styles.rowLabel}>Listen speed</Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{listenWpm} WPM</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
      <View style={{ padding: 24, paddingTop: 0 }}>
        <View style={styles.divider} />
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
              <Pressable onPress={onSignOut} style={styles.pill}>
                <Text style={styles.pillText}>Sign Out</Text>
              </Pressable>
            </View>
          ) : (
            <DitButton
              text="Sign in"
              onPress={onSignIn}
              accessibilityLabel="Sign in with Google"
              textStyle={{
                ...styles.panelButtonText,
                color: '#4285F4',
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 520,
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
      'linear-gradient(0deg,transparent,rgba(0,0,0, 0.9),rgba(0,0,0, 0.9),rgba(0,0,0, 0.9))',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.85)',
  },
});
