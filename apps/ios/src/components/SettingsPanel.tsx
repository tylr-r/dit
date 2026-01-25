import { Host, Picker } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import type { User } from '@firebase/auth';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

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

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
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
      {showPracticeControls ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Max level</Text>
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
          {canShowWordsToggle ? (
            <ToggleRow
              label="Words"
              value={practiceWordMode}
              onValueChange={onPracticeWordModeChange}
            />
          ) : null}
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
      <View style={styles.section}>
        <Pressable
          onPress={onShowReference}
          accessibilityRole="button"
          accessibilityLabel="Open reference"
          style={({ pressed }) => [
            styles.panelButton,
            pressed && styles.panelButtonPressed,
          ]}
        >
          <Text style={styles.panelButtonText}>Reference</Text>
        </Pressable>
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
          <Pressable
            onPress={onSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            style={({ pressed }) => [
              styles.panelButton,
              pressed && styles.panelButtonPressed,
              {
                backgroundColor: 'rgba(66, 133, 244, 0.2)',
                borderColor: '#4285F4',
              },
            ]}
          >
            <Text style={[styles.panelButtonText, { color: '#4285F4' }]}>
              Sign in with Google
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 280,
    alignSelf: 'center',
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(12, 18, 24, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
