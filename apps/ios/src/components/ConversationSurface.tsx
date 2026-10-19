import {
  CONVERSATION_PROSIGNS,
  customListenDiff,
  getReceivedConversationTextAtElapsedMs,
  type ConversationTurn,
  type UseConversationSessionResult,
} from '@dit/core'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Alert, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
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
  const contentRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const followingLatest = useRef(true)
  const copyFocused = useRef(false)
  const workbenchY = useRef(0)
  const copyY = useRef(0)
  const keepCopyVisible = () => {
    if (copyFocused.current) contentRef.current?.scrollTo({ y: workbenchY.current + copyY.current, animated: false })
  }
  const keepLatestVisible = () => {
    if (copyFocused.current) keepCopyVisible()
    else if (!showProsigns && followingLatest.current) contentRef.current?.scrollToEnd({ animated: false })
  }
  const setCopyFocus = (focused: boolean) => {
    copyFocused.current = focused
    onCopyFocusChange?.(focused)
    if (focused) keepCopyVisible()
  }
  const [showProsigns, setShowProsigns] = useState(false)
  const [showLiveLetters, setShowLiveLetters] = useState(false)
  const [revealedTurns, setRevealedTurns] = useState<Set<ConversationTurn>>(() => new Set())
  const [elapsed, setElapsed] = useState(0)
  const receiving = ['their-turn-playing', 'their-turn-paused', 'finishing-copy'].includes(s.phase)
  const replying = s.phase === 'your-turn'
  const lastReceived = [...s.turns].reverse().find((turn) => turn.speaker === 'them')
  const diff = useMemo(() => s.phase === 'finishing-copy' && s.copyWasChecked
    ? customListenDiff(s.incomingText, s.typedCopy.toUpperCase()) : null,
  [s.phase, s.incomingText, s.copyWasChecked, s.typedCopy])

  useEffect(() => {
    followingLatest.current = true
    if (!copyFocused.current) contentRef.current?.scrollToEnd({ animated: false })
  }, [s.phase, s.turns.length])

  useEffect(() => {
    if (!receiving) return
    const update = () => setElapsed(s.phase === 'finishing-copy' ? s.playDurationMs : getMorsePlaybackState().elapsedMs)
    update()
    const timer = setInterval(update, 80)
    return () => clearInterval(timer)
  }, [receiving, s.phase, s.playDurationMs, s.incomingCode])

  const revealTurn = (turn: ConversationTurn) => setRevealedTurns((current) => new Set([...current, turn]))
  const liveText = showLiveLetters && receiving ? getReceivedConversationTextAtElapsedMs(
    s.incomingText, s.incomingCode, s.playUnitMs, elapsed, s.playInterCharacterGapMs,
  ) : ''
  const status = s.phase === 'their-turn-playing' ? 'Listening…'
    : s.phase === 'their-turn-paused' ? 'Paused'
      : s.phase === 'finishing-copy' ? 'Transmission complete'
        : s.phase === 'connecting' ? 'Connecting…'
          : s.phase === 'sending' ? 'Waiting for the other station…' : s.phase === 'ended' ? 'QSO ended' : ''
  const newQso = () => {
    setCopyFocus(false)
    s.reset()
    setRevealedTurns(new Set())
  }
  const endQso = () => { Keyboard.dismiss(); setCopyFocus(false); s.end() }
  const startQso = (direction: 'send' | 'receive') => Alert.alert(
    'Use Google Gemini?',
    'Conversation sends your keyed messages to Google Gemini for replies. Copy stays on your device.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow', onPress: () => void s.start(direction) }],
  )

  if (s.phase === 'idle' || (!s.turns.length && ['connecting', 'error', 'ended'].includes(s.phase))) {
    return <View style={[styles.empty, { paddingBottom: insets.bottom + 44 }]}>
      <View style={styles.emptyContent}>
        <Text style={styles.emptyTitle} accessibilityLiveRegion="polite">
          {s.phase === 'idle' ? 'Do you want to send or receive first?' : s.phase === 'error' ? 'Station unavailable' : status}
        </Text>
        {s.phase === 'error' && <Text style={styles.errorDescription}>{s.errorMessage?.replace(' Try again.', '\nTry again.')}</Text>}
        <View style={styles.emptyActions}>
          {s.phase === 'idle' ? <View style={styles.actions}>
            <Action text="Send first" onPress={() => startQso('send')} />
            <Action text="Receive first" onPress={() => startQso('receive')} />
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
          <Action variant="quiet" text={showProsigns ? 'Close prosigns' : 'Prosigns'} onPress={() => {
            if (!showProsigns) {
              followingLatest.current = false
              contentRef.current?.scrollTo({ y: 0, animated: false })
            }
            setShowProsigns(!showProsigns)
          }} />
        </View>
        <ScrollView ref={contentRef} onLayout={keepLatestVisible} onContentSizeChange={keepLatestVisible}
          onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
            followingLatest.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - spacing.lg
          }} scrollEventThrottle={16}
          style={styles.content} contentContainerStyle={[styles.contentContainer, !replying && { paddingBottom: insets.bottom + spacing.md }]} keyboardShouldPersistTaps="handled" accessibilityLabel="Conversation history and copy">
          {showProsigns && <View style={styles.prosignContent} accessibilityLabel="Prosign reference">
            {CONVERSATION_PROSIGNS.map(([name, meaning]) => <View key={name} style={styles.prosignRow}>
              <Text style={styles.prosignName}>{name}</Text><Text style={styles.detail}>{meaning}</Text>
            </View>)}
            <Text style={styles.detail}>Prosigns are sent as a single continuous character.</Text>
          </View>}
          <View style={styles.historyContent}>
            {s.turns.map((turn, index) => {
              const visible = turn.speaker === 'you' || s.phase === 'ended' || revealedTurns.has(turn)
                || (!receiving && turn === lastReceived && (s.copyWasChecked || s.replyStarted || showLiveLetters))
              return <View key={index} style={[styles.turn, turn.speaker === 'you' && styles.outgoing]}>
                <Text style={styles.detail}>{turn.speaker === 'you' ? 'You' : 'Them'}</Text>
                {visible ? <Text selectable style={styles.message}>{turn.text}</Text>
                  : <Action text="Reveal" accessibilityLabel="Reveal received message" onPress={() => revealTurn(turn)} />}
              </View>
            })}
          </View>
          <View style={styles.workbench} onLayout={({ nativeEvent }) => { workbenchY.current = nativeEvent.layout.y; keepCopyVisible() }}>
            {!replying && <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>}
            {receiving && <>
              <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: s.playDurationMs, now: Math.min(elapsed, s.playDurationMs) }}>
                <View style={[styles.fill, { width: `${s.playDurationMs ? Math.min(100, elapsed / s.playDurationMs * 100) : 0}%` }]} />
              </View>
              <View style={styles.actions}>
                <Action text={s.phase === 'finishing-copy' ? 'Reply' : s.phase === 'their-turn-paused' ? 'Resume' : 'Pause'}
                  onPress={() => {
                    if (s.phase === 'finishing-copy') { Keyboard.dismiss(); setCopyFocus(false); s.beginReply() }
                    else void (s.phase === 'their-turn-paused' ? s.resume() : s.pause())
                }} />
                {s.phase === 'finishing-copy' && <Action text="Check copy" onPress={s.checkCopy} />}
                <Action text="Replay" onPress={() => void s.replay()} />
              </View>
              <TextInput onFocus={() => setCopyFocus(true)} onBlur={() => setCopyFocus(false)} onLayout={({ nativeEvent }) => { copyY.current = nativeEvent.layout.y; keepCopyVisible() }} maxLength={2000} accessibilityLabel="Type what you hear" placeholder="Type what you hear (optional)"
                placeholderTextColor={colors.text.primary40} value={s.typedCopy} onChangeText={(text) => s.setTypedCopy(text.toUpperCase())}
                autoCorrect={false} autoCapitalize="characters" multiline style={styles.input} />
              <View style={styles.actions}>
                <Text style={styles.detail}>Show received letters</Text>
                <Switch accessibilityLabel="Show received letters" value={showLiveLetters} onValueChange={setShowLiveLetters} />
              </View>
              {showLiveLetters && <Text selectable style={styles.message}>{liveText || ' '}</Text>}
              {diff && <>
                <Text selectable style={styles.message} accessibilityLabel="Copy comparison">
                  {diff.tokens.map((token, index) => <Text key={index} style={token.kind === 'ok' ? styles.correct : styles.missed}>{token.text}</Text>)}
                </Text>
                <Text style={styles.detail}>{diff.matched} / {diff.total} matched · {diff.missed} missed · {diff.extra} extra</Text>
              </>}
            </>}
            {replying && lastReceived && <Action text="Replay" onPress={() => void s.replay()} />}
            {s.phase === 'error' && <>
              <Text style={styles.errorDescription} accessibilityLiveRegion="polite">{s.errorMessage}</Text>
              <Action variant="primary" text="Retry" onPress={() => void s.retry()} />
            </>}
            {s.phase === 'ended' ? <Action variant="primary" text="New QSO" onPress={newQso} /> : <Action variant="quiet" text="End QSO" onPress={endQso} />}
          </View>
        </ScrollView>
        {replying && <View style={[styles.replyDock, { paddingBottom: insets.bottom + spacing.md }]} testID="conversation-reply-dock">
          <ScrollView style={styles.draftViewport} contentContainerStyle={styles.draftContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.draft} accessibilityLabel={`Outgoing draft: ${s.draft || 'empty'}`} accessibilityLiveRegion="polite">{s.draft || 'Reply'}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Action text="Backspace" disabled={!s.draft || s.isKeying} onPress={s.handleDraftBackspace} />
            <Action text="Clear" disabled={!s.draft || s.isKeying} onPress={s.handleDraftClear} />
            <Action text="Send" disabled={!s.draft.trim() || s.isKeying} onPress={() => void s.sendReply()} />
          </View>
          <MorseButton isPressing={s.isKeying} onPressIn={() => { Keyboard.dismiss(); setCopyFocus(false); s.handleKeyPressIn() }} onPressOut={s.handleKeyPressOut} />
        </View>}
      </>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  surface: { flex: 1, paddingHorizontal: spacing.lg },
  content: { flex: 1 },
  contentContainer: { flexGrow: 1, gap: spacing.md, paddingBottom: spacing.md },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyContent: { alignSelf: 'center', width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.8, color: colors.text.primary90, textAlign: 'center' },
  errorDescription: { fontSize: 16, lineHeight: 24, color: colors.text.primary70, textAlign: 'center', maxWidth: 300, alignSelf: 'center' },
  emptyActions: { paddingTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  referenceAction: { alignItems: 'flex-end' },
  prosignContent: { gap: spacing.sm, padding: spacing.md },
  prosignRow: { flexDirection: 'row', gap: spacing.lg },
  prosignName: { color: colors.text.primary90, fontSize: 14, minWidth: 32 },
  historyContent: { gap: spacing.md, paddingVertical: spacing.lg },
  turn: { alignSelf: 'flex-start', maxWidth: '90%', gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.input },
  outgoing: { alignSelf: 'flex-end', backgroundColor: colors.surface.panelStrong },
  workbench: { marginTop: 'auto', gap: spacing.md },
  replyDock: { flexShrink: 0, gap: spacing.md, paddingTop: spacing.md },
  draftViewport: { flexGrow: 0, maxHeight: 72 },
  draftContent: { minHeight: 48, justifyContent: 'center' },
  status: { minHeight: 24, fontSize: 16, color: colors.text.primary80, textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 24, fontFamily: 'Menlo', color: colors.text.primary90 },
  draft: { fontSize: 20, fontFamily: 'Menlo', color: colors.text.primary90, textAlign: 'center' },
  input: { minHeight: 84, padding: spacing.md, fontSize: 16, color: colors.text.primary90, backgroundColor: colors.surface.input, borderRadius: radii.md },
  detail: { fontSize: 14, color: colors.text.primary60 },
  correct: { color: colors.feedback.success },
  missed: { color: colors.feedback.error },
  track: { height: 3, backgroundColor: colors.surface.input, borderRadius: radii.pill },
  fill: { height: 3, backgroundColor: colors.text.primary60, borderRadius: radii.pill },
})
