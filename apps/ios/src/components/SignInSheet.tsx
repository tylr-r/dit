import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { SymbolView } from 'expo-symbols'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { normalizeColorForNative } from '../design/color'

type EmailResult = { ok: true } | { ok: false; error: string }

type SheetView = 'picker' | 'email'

type SignInSheetProps = {
  visible: boolean
  onDismiss: () => void
  onSignInWithApple: () => void
  onSignInWithGoogle: () => void
  onSignInWithEmail: (email: string, password: string) => Promise<EmailResult>
  onCreateAccountWithEmail: (email: string, password: string) => Promise<EmailResult>
}

/**
 * Shared bottom sheet for picking a sign-in provider. Used from both the NUX
 * welcome screen and Settings. Hosts three provider rows (Apple, Google,
 * Email) and swaps to an inline email form when the user picks email.
 */
export function SignInSheet({
  visible,
  onDismiss,
  onSignInWithApple,
  onSignInWithGoogle,
  onSignInWithEmail,
  onCreateAccountWithEmail,
}: SignInSheetProps) {
  const insets = useSafeAreaInsets()
  const [view, setView] = useState<SheetView>('picker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'signin' | 'signup' | null>(null)

  // Reset form state whenever the sheet dismisses so the next open is clean.
  useEffect(() => {
    if (visible) return
    setView('picker')
    setEmail('')
    setPassword('')
    setError(null)
    setSubmitting(null)
  }, [visible])

  const handleOpenEmailForm = useCallback(() => {
    setError(null)
    setView('email')
  }, [])

  const handleReturnToPicker = useCallback(() => {
    setView('picker')
    setError(null)
  }, [])

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && submitting === null

  const runEmailAction = useCallback(
    async (mode: 'signin' | 'signup', action: () => Promise<EmailResult>) => {
      if (!canSubmit) return
      setSubmitting(mode)
      setError(null)
      const result = await action()
      if (result.ok) {
        onDismiss()
        return
      }
      setError(result.error)
      setSubmitting(null)
    },
    [canSubmit, onDismiss],
  )

  const handleSubmitSignIn = useCallback(() => {
    void runEmailAction('signin', () => onSignInWithEmail(email.trim(), password))
  }, [email, onSignInWithEmail, password, runEmailAction])

  const handleSubmitSignUp = useCallback(() => {
    void runEmailAction('signup', () =>
      onCreateAccountWithEmail(email.trim(), password),
    )
  }, [email, onCreateAccountWithEmail, password, runEmailAction])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityLabel="Dismiss sign-in"
      />
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardWrap}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
        >
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.sheetTint} />
          <View style={styles.grabber} />

          {view === 'picker' ? (
            <>
              <Text style={styles.title}>Sign in to Dit</Text>
              <View style={styles.group}>
                <Pressable
                  onPress={onSignInWithApple}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
                >
                  <SymbolView
                    name={'applelogo' as any}
                    size={18}
                    tintColor={normalizeColorForNative('rgba(244, 247, 249, 0.95)')}
                    style={styles.rowIcon}
                    fallback={
                      <MaterialCommunityIcons
                        name="apple"
                        size={18}
                        color="rgba(244, 247, 249, 0.95)"
                      />
                    }
                  />
                  <Text style={styles.rowText}>Continue with Apple</Text>
                </Pressable>
                <View style={styles.separator} />
                <Pressable
                  onPress={onSignInWithGoogle}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                >
                  <MaterialCommunityIcons
                    name="google"
                    size={18}
                    color="rgba(244, 247, 249, 0.95)"
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowText}>Continue with Google</Text>
                </Pressable>
                <View style={styles.separator} />
                <Pressable
                  onPress={handleOpenEmailForm}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Email"
                >
                  <MaterialIcons
                    name="mail-outline"
                    size={18}
                    color="rgba(244, 247, 249, 0.95)"
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowText}>Continue with Email</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.cancel,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancel sign-in"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.formHeader}>
                <Pressable
                  onPress={handleReturnToPicker}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Back to sign-in options"
                  hitSlop={12}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={22}
                    color="rgba(244, 247, 249, 0.85)"
                  />
                </Pressable>
                <Text style={styles.title}>Email sign-in</Text>
                <View style={styles.backButton} />
              </View>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="rgba(200, 210, 220, 0.45)"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                style={styles.input}
                editable={submitting === null}
                returnKeyType="next"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="rgba(200, 210, 220, 0.45)"
                secureTextEntry
                autoComplete="password"
                autoCorrect={false}
                textContentType="password"
                style={styles.input}
                editable={submitting === null}
                returnKeyType="go"
                onSubmitEditing={handleSubmitSignIn}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={handleSubmitSignIn}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!canSubmit || submitting !== null) && styles.primaryButtonDisabled,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with email"
              >
                {submitting === 'signin' ? (
                  <ActivityIndicator color="rgba(244, 247, 249, 0.95)" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleSubmitSignUp}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Create account with email"
              >
                {submitting === 'signup' ? (
                  <ActivityIndicator color="rgba(200, 210, 220, 0.85)" size="small" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Create account</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 12, 18, 0.6)',
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 18, 0.35)',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 14,
  },
  title: {
    color: 'rgba(244, 247, 249, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowText: {
    color: 'rgba(244, 247, 249, 0.95)',
    fontSize: 15,
    fontWeight: '500',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancel: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  cancelText: {
    color: 'rgba(200, 210, 220, 0.65)',
    fontSize: 14,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: 'rgba(244, 247, 249, 0.95)',
    fontSize: 15,
    marginBottom: 10,
  },
  error: {
    color: 'rgba(255, 150, 150, 0.9)',
    fontSize: 13,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: 'rgba(244, 247, 249, 0.95)',
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: 'rgba(200, 210, 220, 0.7)',
    fontSize: 14,
  },
})
