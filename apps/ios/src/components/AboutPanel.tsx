import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

type AboutPanelProps = {
  onClose: () => void
}

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
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close about"
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(12, 18, 24, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    fontSize: 22,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f7f9',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(244, 247, 249, 0.9)',
    marginBottom: 12,
  },
  bodySecondary: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(244, 247, 249, 0.75)',
    marginBottom: 12,
  },
  emphasis: {
    color: '#f4f7f9',
    fontWeight: '600',
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.85)',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(244, 247, 249, 0.6)',
  },
  footerSeparator: {
    fontSize: 12,
    color: 'rgba(244, 247, 249, 0.4)',
  },
  footerLink: {
    fontSize: 12,
    color: 'rgba(244, 247, 249, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})
