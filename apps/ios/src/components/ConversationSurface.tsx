import {
  CONVERSATION_PROSIGNS,
  customListenDiff,
  getReceivedTextAtElapsedMs,
  type ConversationTurn,
  type UseConversationSessionResult,
} from '@dit/core'
import { useEffect, useMemo, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing } from '../design/tokens'
import { getMorsePlaybackState } from '../utils/tone'
import { DitButton, type ButtonProps } from './DitButton'
import { MorseButton } from './MorseButton'

type Props = { session: UseConversationSessionResult; onCopyFocusChange?: (focused: boolean) => void }

function Action({ variant = 'control', ...props }: ButtonProps & { variant?: 'control' | 'primary' | 'quiet' }) {
  return <DitButton {...props} paddingHorizontal={spacing.lg} paddingVertical={spacing.md}
    glassEffectStyle={variant === 'quiet' ? 'none' : 'regular'}
    textStyle={{ fontSize: 15, fontWeight: variant === 'primary' ? '600' : '500', textTransform: 'none', letterSpacing: 0, color: variant === 'quiet' ? colors.text.primary60 : colors.text.primary90, ...props.textStyle }}
    style={{ minHeight: 44, alignSelf: 'center', ...(variant === 'primary' ? { minWidth: 168 } : {}), ...(variant === 'quiet' ? { borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0 } : {}), ...props.style }} />
}

/** Sound-first QSO practice with concealed reception and an explicit reply handoff. */
export function ConversationSurface({ session: s, onCopyFocusChange }: Props) {
  const insets = useSafeAreaInsets()
  const [showProsigns, setShowProsigns] = useState(false)
  const [showLiveLetters, setShowLiveLetters] = useState(false)
  const [revealedTurns, setRevealedTurns] = useState<Set<ConversationTurn>>(() => new Set())
  const [expandedCopyCount, setExpandedCopyCount] = useState<number | null>(null)
  const [hiddenCopyCount, setHiddenCopyCount] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const receiving = ['their-turn-playing', 'their-turn-paused', 'finishing-copy'].includes(s.phase)
  const replying = s.phase === 'your-turn'
  const lastReceived = [...s.turns].reverse().find((turn) => turn.speaker === 'them')
  const copyExpanded = hiddenCopyCount !== s.turns.length && (expandedCopyCount === s.turns.length || Boolean(s.typedCopy.trim()))
  const diff = useMemo(() => s.copyWasChecked && lastReceived
    ? customListenDiff(lastReceived.text, s.typedCopy.toUpperCase()) : null,
  [lastReceived, s.copyWasChecked, s.typedCopy])

  useEffect(() => {
    if (!receiving) return
    const update = () => setElapsed(s.phase === 'finishing-copy' ? s.playDurationMs : getMorsePlaybackState().elapsedMs)
    update()
    const timer = setInterval(update, 80)
    return () => clearInterval(timer)
  }, [receiving, s.phase, s.playDurationMs, s.incomingCode])

  const revealTurn = (turn: ConversationTurn) => setRevealedTurns((current) => new Set([...current, turn]))
  const liveText = showLiveLetters && receiving ? getReceivedTextAtElapsedMs(
    s.incomingText, s.incomingCode, s.playUnitMs, elapsed, s.playInterCharacterGapMs,
  ) : ''
  const status = s.phase === 'their-turn-playing' ? 'Listening…'
    : s.phase === 'their-turn-paused' ? 'Paused'
      : s.phase === 'finishing-copy' ? 'Transmission complete'
        : replying ? 'Your turn' : s.phase === 'connecting' ? 'Connecting…'
          : s.phase === 'sending' ? 'Waiting for the other station…' : s.phase === 'ended' ? 'QSO ended' : ''
  const newQso = () => {
    onCopyFocusChange?.(false)
    s.reset()
    setRevealedTurns(new Set())
    setExpandedCopyCount(null)
    setHiddenCopyCount(null)
  }
  const endQso = () => { Keyboard.dismiss(); onCopyFocusChange?.(false); s.end() }

  if (s.phase === 'idle' || (!s.turns.length && ['connecting', 'error', 'ended'].includes(s.phase))) {
    return <View style={[styles.empty, { paddingBottom: insets.bottom + 44 }]}>
      <View style={styles.emptyContent}>
        <Text style={styles.emptyTitle} accessibilityLiveRegion="polite">
          {s.phase === 'idle' ? 'Do you want to send or receive first?' : s.phase === 'error' ? 'Station unavailable' : status}
        </Text>
        {s.phase === 'error' && <Text style={styles.errorDescription}>{s.errorMessage?.replace(' Try again.', '\nTry again.')}</Text>}
        <View style={styles.emptyActions}>
          {s.phase === 'idle' ? <View style={styles.actions}>
            <Action text="Send first" onPress={() => void s.start('send')} />
            <Action text="Receive first" onPress={() => void s.start('receive')} />
          </View> : s.phase === 'error' ? <>
            <Action variant="primary" text="Retry" onPress={() => void s.retry()} />
            <Action variant="quiet" text="End QSO" onPress={endQso} />
          </> : s.phase === 'ended' ? <Action variant="primary" text="New QSO" onPress={newQso} />
            : <Action variant="quiet" text="End QSO" onPress={endQso} />}
        </View>
      </View>
    </View>
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.surface}>
      <>
        <View style={styles.referenceAction}>
          <Action variant="quiet" text={showProsigns ? 'Close prosigns' : 'Prosigns'} onPress={() => setShowProsigns(!showProsigns)} />
        </View>
        {showProsigns && <ScrollView style={styles.prosigns} contentContainerStyle={styles.prosignContent} keyboardShouldPersistTaps="handled" accessibilityLabel="Prosign reference">
          {CONVERSATION_PROSIGNS.map(([name, meaning]) => <View key={name} style={styles.prosignRow}>
            <Text style={styles.prosignName}>{name}</Text><Text style={styles.detail}>{meaning}</Text>
          </View>)}
          <Text style={styles.detail}>Prosigns are sent as a single continuous character.</Text>
        </ScrollView>}
        <ScrollView style={styles.history} contentContainerStyle={styles.historyContent} keyboardShouldPersistTaps="handled" accessibilityLabel="Conversation history">
          {s.turns.map((turn, index) => {
            const visible = turn.speaker === 'you' || s.phase === 'ended' || revealedTurns.has(turn)
              || (turn === lastReceived && (s.copyWasChecked || s.replyStarted || showLiveLetters))
            return <View key={index} style={[styles.turn, turn.speaker === 'you' && styles.outgoing]}>
              <Text style={styles.detail}>{turn.speaker === 'you' ? 'You' : 'Them'}</Text>
              {visible ? <Text selectable style={styles.message}>{turn.text}</Text>
                : <Action text="Reveal received turn" onPress={() => revealTurn(turn)} />}
            </View>
          })}
        </ScrollView>
        <ScrollView style={styles.workbench} contentContainerStyle={[styles.workbenchContent, { paddingBottom: insets.bottom + spacing.md }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>
          {receiving && <>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: s.playDurationMs, now: Math.min(elapsed, s.playDurationMs) }}>
              <View style={[styles.fill, { width: `${s.playDurationMs ? Math.min(100, elapsed / s.playDurationMs * 100) : 0}%` }]} />
            </View>
            <View style={styles.actions}>
              <Action text={s.phase === 'finishing-copy' ? 'Start my turn' : s.phase === 'their-turn-paused' ? 'Resume' : 'Pause'}
                onPress={() => {
                  if (s.phase === 'finishing-copy') { Keyboard.dismiss(); onCopyFocusChange?.(false); s.beginReply() }
                  else void (s.phase === 'their-turn-paused' ? s.resume() : s.pause())
                }} />
              <Action text="Replay" onPress={() => void s.replay()} />
            </View>
            <TextInput onFocus={() => onCopyFocusChange?.(true)} onBlur={() => onCopyFocusChange?.(false)} maxLength={2000} accessibilityLabel="Type what you hear" placeholder="Type what you hear (optional)"
              placeholderTextColor={colors.text.primary40} value={s.typedCopy} onChangeText={(text) => s.setTypedCopy(text.toUpperCase())}
              autoCorrect={false} autoCapitalize="characters" multiline style={styles.input} />
            <View style={styles.actions}>
              <Text style={styles.detail}>Show received letters</Text>
              <Switch accessibilityLabel="Show received letters" value={showLiveLetters} onValueChange={setShowLiveLetters} />
            </View>
            {showLiveLetters && <Text selectable style={styles.message}>{liveText || ' '}</Text>}
          </>}
          {replying && <>
            <Text style={styles.draft} accessibilityLabel={`Outgoing draft: ${s.draft || 'empty'}`}>{s.draft || 'Key your reply'}</Text>
            <MorseButton isPressing={s.isKeying} onPressIn={() => { Keyboard.dismiss(); onCopyFocusChange?.(false); s.handleKeyPressIn() }} onPressOut={s.handleKeyPressOut} />
            <View style={styles.actions}>
              <Action text="Backspace" disabled={!s.draft || s.isKeying} onPress={s.handleDraftBackspace} />
              <Action text="Clear" disabled={!s.draft || s.isKeying} onPress={s.handleDraftClear} />
              <Action text="Send" disabled={!s.draft.trim() || s.isKeying} onPress={() => void s.sendReply()} />
            </View>
            {lastReceived && <>
              {!copyExpanded ? <Action text="Copy (optional)" onPress={() => { setHiddenCopyCount(null); setExpandedCopyCount(s.turns.length) }} /> : <>
                <TextInput onFocus={() => onCopyFocusChange?.(true)} onBlur={() => onCopyFocusChange?.(false)} maxLength={2000} accessibilityLabel="Your copy" value={s.typedCopy} onChangeText={(text) => s.setTypedCopy(text.toUpperCase())}
                  placeholder="Type what you heard" placeholderTextColor={colors.text.primary40} autoCorrect={false} autoCapitalize="characters" multiline style={styles.input} />
                <View style={styles.actions}>
                  <Action text="Check copy" onPress={s.checkCopy} />
                  <Action text="Hide copy" onPress={() => { Keyboard.dismiss(); onCopyFocusChange?.(false); setHiddenCopyCount(s.turns.length); s.skipCopy() }} />
                  <Action text="Replay" onPress={() => void s.replay()} />
                </View>
                {diff && <>
                  <Text selectable style={styles.message} accessibilityLabel="Copy comparison">
                    {diff.tokens.map((token, index) => <Text key={index} style={token.kind === 'ok' ? styles.correct : styles.missed}>{token.text}</Text>)}
                  </Text>
                  <Text style={styles.detail}>{diff.matched} / {diff.total} matched · {diff.missed} missed · {diff.extra} extra</Text>
                </>}
              </>}
            </>}
          </>}
          {s.phase === 'error' && <>
            <Text style={styles.errorDescription} accessibilityLiveRegion="polite">{s.errorMessage}</Text>
            <Action variant="primary" text="Retry" onPress={() => void s.retry()} />
          </>}
          {s.phase === 'ended' ? <Action variant="primary" text="New QSO" onPress={newQso} /> : <Action variant="quiet" text="End QSO" onPress={endQso} />}
        </ScrollView>
      </>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  surface: { flex: 1, paddingHorizontal: spacing.lg },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyContent: { alignSelf: 'center', width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.8, color: colors.text.primary90, textAlign: 'center' },
  errorDescription: { fontSize: 16, lineHeight: 24, color: colors.text.primary70, textAlign: 'center', maxWidth: 300, alignSelf: 'center' },
  emptyActions: { paddingTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  referenceAction: { alignItems: 'flex-end' },
  prosigns: { maxHeight: 140, flexGrow: 0 },
  prosignContent: { gap: spacing.sm, padding: spacing.md },
  prosignRow: { flexDirection: 'row', gap: spacing.lg },
  prosignName: { color: colors.text.primary90, fontSize: 14, minWidth: 32 },
  history: { flex: 1 },
  historyContent: { gap: spacing.md, paddingVertical: spacing.lg },
  turn: { alignSelf: 'flex-start', maxWidth: '90%', gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.input },
  outgoing: { alignSelf: 'flex-end', backgroundColor: colors.surface.panelStrong },
  workbench: { flexGrow: 0, maxHeight: '80%' },
  workbenchContent: { gap: spacing.md },
  status: { minHeight: 24, fontSize: 16, color: colors.text.primary80, textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 24, fontFamily: 'Menlo', color: colors.text.primary90 },
  draft: { minHeight: 48, fontSize: 20, fontFamily: 'Menlo', color: colors.text.primary90, textAlign: 'center' },
  input: { minHeight: 84, padding: spacing.md, fontSize: 16, color: colors.text.primary90, backgroundColor: colors.surface.input, borderRadius: radii.md },
  detail: { fontSize: 14, color: colors.text.primary60 },
  correct: { color: colors.feedback.success },
  missed: { color: colors.feedback.error },
  track: { height: 3, backgroundColor: colors.surface.input, borderRadius: radii.pill },
  fill: { height: 3, backgroundColor: colors.text.primary60, borderRadius: radii.pill },
})
