import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

type SettingsPanelProps = {
  isFreestyle: boolean
  isListen: boolean
  levels: readonly number[]
  maxLevel: number
  practiceWordMode: boolean
  showHint: boolean
  showMnemonic: boolean
  onClose: () => void
  onMaxLevelChange: (value: number) => void
  onPracticeWordModeChange: (value: boolean) => void
  onShowHintChange: (value: boolean) => void
  onShowMnemonicChange: (value: boolean) => void
}

const ToggleRow = ({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string
  value: boolean
  disabled?: boolean
  onValueChange: (value: boolean) => void
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
  maxLevel,
  practiceWordMode,
  showHint,
  showMnemonic,
  onClose,
  onMaxLevelChange,
  onPracticeWordModeChange,
  onShowHintChange,
  onShowMnemonicChange,
}: SettingsPanelProps) {
  const canShowPracticeOptions = !isFreestyle
  const canShowWordsToggle = !isListen
  const isHintDisabled = isFreestyle || isListen
  const nextLevel =
    levels[(levels.indexOf(maxLevel) + 1) % levels.length] ?? maxLevel

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole='button'
          accessibilityLabel='Close settings'
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
      <ToggleRow
        label='Show hints'
        value={showHint}
        disabled={isHintDisabled}
        onValueChange={onShowHintChange}
      />
      <ToggleRow
        label='Show mnemonics'
        value={showMnemonic}
        disabled={isHintDisabled}
        onValueChange={onShowMnemonicChange}
      />
      {canShowPracticeOptions ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => onMaxLevelChange(nextLevel)}
            accessibilityRole='button'
            accessibilityLabel='Change max level'
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Max level</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Level {maxLevel}</Text>
            </View>
          </Pressable>
          {canShowWordsToggle ? (
            <ToggleRow
              label='Words'
              value={practiceWordMode}
              onValueChange={onPracticeWordModeChange}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    width: 280,
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
})
