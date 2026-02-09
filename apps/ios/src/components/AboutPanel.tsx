import { Linking, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'

type AboutPanelProps = {
  onClose: () => void;
};

/** About panel with usage guidance. */
export function AboutPanel({ onClose }: AboutPanelProps) {
  const currentYear = new Date().getFullYear()

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Dit</Text>
      <Text style={styles.body}>
        Tap that big button. Quick taps make dots, longer presses make dashes.
      </Text>
      <Text style={styles.bodySecondary}>
        Use <Text style={styles.emphasis}>settings</Text> to adjust difficulty,
        check the reference chart, enable hints, and sign in to save your
        progress.
      </Text>
      <Text style={styles.bodySecondary}>
        <Text style={styles.emphasis}>Modes:</Text> Practice for guided
        learning, Freestyle to translate on your own, or Listen to test your
        copy skills.
      </Text>
      <View style={styles.footer}>
        <Text style={styles.footerText}>© {currentYear} Tylr</Text>
        <Text style={styles.footerSeparator}>|</Text>
        <Text
          style={styles.footerLink}
          onPress={() => Linking.openURL('https://practicedit.com/privacy')}
        >
          Privacy
        </Text>
        <Text style={styles.footerSeparator}>|</Text>
        <Text
          style={styles.footerLink}
          onPress={() => Linking.openURL('https://practicedit.com/terms')}
        >
          Terms
        </Text>
      </View>
      <DitButton
        text="Close"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close about"
        style={styles.closeButton}
        paddingHorizontal={12}
        paddingVertical={12}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.lg,
    padding: 20,
    backgroundColor: colors.surface.panelStrong,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    fontSize: 22,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary90,
    marginBottom: spacing.md,
  },
  bodySecondary: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.primary70,
    marginBottom: spacing.md,
  },
  emphasis: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.primary60,
  },
  footerSeparator: {
    fontSize: 12,
    color: colors.text.primary40,
  },
  footerLink: {
    fontSize: 12,
    color: colors.text.primary70,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})
