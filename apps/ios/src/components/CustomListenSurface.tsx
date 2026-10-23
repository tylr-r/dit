import { customListenDiff, getListenPlaybackDurationMs, normalizeCustomText, textToMorseCode } from '@dit/core'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { useCustomListenSession } from '../hooks/useCustomListenSession'
import { colors, radii, spacing } from '../design/tokens'
import { ListenActionButton as DitButton } from './ListenActionButton'
import { ListenSineWave } from './ListenSineWave'

type Props = { session: ReturnType<typeof useCustomListenSession>; onDone: () => void }

/** Plays private passages by ear, with optional copy and post-playback comparison. */
export function CustomListenSurface({ session, onDone }: Props) {
  const [editing, setEditing] = useState(!session.text)
  const [draft, setDraft] = useState(session.text)
  const [typeAlong, setTypeAlong] = useState(session.typeAlong)
  const normalized = normalizeCustomText(draft)
  const draftCode = textToMorseCode(draft).code
  const estimateMs = getListenPlaybackDurationMs(draftCode, session.timing.unitMs, session.timing.interCharacterGapMs)
  const insets = useSafeAreaInsets()
  const diff = useMemo(() => session.phase === 'reveal' ? customListenDiff(session.text, session.typedCopy) : null, [session.phase, session.text, session.typedCopy])
  const playing = session.phase === 'playing'
  const paused = session.phase === 'paused'
  const revealed = session.phase === 'reveal'
  const edit = () => {
    void session.stop()
    setDraft(session.text)
    setTypeAlong(session.typeAlong)
    setEditing(true)
  }
  const save = async () => {
    await session.save(draft, typeAlong)
    setEditing(false)
    if (!normalized.normalized) onDone()
  }
  const progress = session.durationMs > 0 ? Math.min(1, session.elapsedMs / session.durationMs) : 0

  return (
    <>
      <View style={styles.wave}>
        <ListenSineWave
          playback={playing || paused ? { sequence: 1, code: session.encoded.code, ...session.timing } : null}
          playbackElapsedMs={session.elapsedMs}
          paused={paused}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityLiveRegion="polite">
          {revealed ? 'Compare your copy' : playing ? 'Listening…' : paused ? 'Paused' : `${session.text.length} chars · ${session.text.split(' ').filter(Boolean).length} words ready`}
        </Text>
        {(playing || paused) && <>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
          <Text style={styles.detail}>{Math.floor(session.elapsedMs / 1000)} / {Math.ceil(session.durationMs / 1000)} seconds</Text>
        </>}
        {revealed ? <>
          <Text selectable style={styles.source}>{session.text}</Text>
          {session.typeAlong && diff && <>
            <Text selectable style={styles.source} accessibilityLabel="Copy comparison">
              {diff.tokens.map((token, index) => (
                <Text key={index} style={token.kind === 'ok' ? styles.correct : styles.missed}>{token.text}</Text>
              ))}
            </Text>
            <Text style={styles.detail}>{diff.matched} / {diff.total} matched · {diff.missed} missed · {diff.extra} extra</Text>
          </>}
        </> : session.typeAlong ? <TextInput
          accessibilityLabel="Type what you hear"
          placeholder="Type what you hear"
          placeholderTextColor={colors.text.primary40}
          value={session.typedCopy}
          onChangeText={(value) => session.setTypedCopy(value.toUpperCase())}
          editable={playing}
          autoCapitalize="characters"
          autoCorrect={false}
          multiline
          style={styles.input}
        /> : null}
        {session.error && <Text style={styles.missed}>{session.error}</Text>}
        <View style={styles.actions}>
          <DitButton text={playing ? 'Pause' : paused ? 'Resume' : revealed ? 'Replay' : 'Play'}
            disabled={!session.text} onPress={() => void (playing ? session.pause() : paused ? session.resume() : session.play())} />
          {(playing || paused) ? <>
            <DitButton text="Restart" onPress={() => void session.play()} />
            <DitButton text="End" onPress={() => void session.reveal()} />
          </> : <>
            <DitButton text={revealed ? 'New text' : 'Edit text'} onPress={edit} />
            <DitButton text="Done" onPress={onDone} />
            {!revealed && <DitButton text="Clear" onPress={() => { void session.save('', session.typeAlong); onDone() }} />}
          </>}
        </View>
        <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setEditing(false); if (!session.text) onDone() }}>
          <KeyboardAvoidingView behavior="padding" style={styles.editor}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
              <Text style={styles.title}>Custom text</Text>
              <TextInput accessibilityLabel="Text to play as Morse" value={draft} onChangeText={setDraft}
                multiline autoCorrect={false} autoCapitalize="characters" placeholder="Paste a passage"
                placeholderTextColor={colors.text.primary40} style={[styles.input, styles.editorInput]} />
              <Text style={styles.detail}>{normalized.normalized.length} / 2000 chars · {normalized.ignored} ignored · about {Math.ceil(estimateMs / 1000)} seconds</Text>
              <View style={styles.actions}>
                <Text style={styles.source}>Type along</Text>
                <Switch accessibilityLabel="Type along" value={typeAlong} onValueChange={setTypeAlong} />
              </View>
              <View style={styles.actions}>
                <DitButton text="Discard" onPress={() => { setEditing(false); if (!session.text) onDone() }} />
                <DitButton text="Save" onPress={() => void save()} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  wave: { width: '100%', height: 120 },
  content: { width: '100%', paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.lg },
  title: { color: colors.text.primary, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  detail: { color: colors.text.primary60, fontSize: 13, textAlign: 'center' },
  source: { color: colors.text.primary, fontSize: 18, lineHeight: 26 },
  correct: { color: colors.feedback.success },
  missed: { color: colors.feedback.error },
  input: { color: colors.text.primary, backgroundColor: colors.surface.input, borderWidth: 1, borderColor: colors.border.subtle,
    borderRadius: radii.md, padding: spacing.md, fontSize: 18, minHeight: 80, maxHeight: 160, width: '100%', textAlignVertical: 'top' },
  editorInput: { minHeight: 200, maxHeight: 320 },
  editor: { flex: 1, backgroundColor: colors.surface.panelStrong },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  track: { height: 4, width: '100%', backgroundColor: colors.surface.input, borderRadius: radii.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent.wave },
})
