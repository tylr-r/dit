import {
  getEligibleListenPhrases,
  LISTEN_WORD_BANKS,
  useListenPhraseSession,
  usePlatform,
  type Letter,
  type ListenVocabulary,
} from '@dit/core'
import { Host, Picker, Text as NativeText } from '@expo/ui/swift-ui'
import { accessibilityLabel, disabled, frame, labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { normalizeColorForNative } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'
import { useCustomListenSession } from '../hooks/useCustomListenSession'
import { playMorseTone, stopMorseTone } from '../utils/tone'
import { CustomListenSurface } from './CustomListenSurface'
import { ListenActionButton as DitButton } from './ListenActionButton'
import { ListenSineWave } from './ListenSineWave'

type Content = 'characters' | 'words' | 'custom'
const WORD_WAVE_HEIGHT = 120
type Props = {
  availableLetters: Letter[]
  guidedCourseActive: boolean
  characterWpm: number
  effectiveWpm: number
  toneFrequency: number
  blocked: boolean
  wordCounts: { correct: number; attempted: number }
  onWordAnswer: (correct: boolean) => void
  suspendCharacters: (suspended: boolean) => void
  replayCharacter: () => void
  characterStage: ReactNode
  characterControls: ReactNode
}

/** Listen content selection with quiet entry, concealed word choices, and private head-copy practice. */
export function ListenLearningSurface({
  availableLetters, guidedCourseActive, characterWpm, effectiveWpm, toneFrequency,
  blocked, wordCounts, onWordAnswer, suspendCharacters, replayCharacter, characterStage, characterControls,
}: Props) {
  const { storage } = usePlatform()
  const insets = useSafeAreaInsets()
  const [content, setContent] = useState<Content>('characters')
  const [vocabulary, setVocabulary] = useState<ListenVocabulary>('common')
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const edited = useRef(false)
  const started = useRef(false)
  const lastActiveContent = useRef<Content>('characters')
  const custom = useCustomListenSession({ characterWpm, effectiveWpm, toneFrequency })
  const wordsAvailable = Object.values(LISTEN_WORD_BANKS).some((bank) => getEligibleListenPhrases(bank, availableLetters).length >= 4)
  const effectiveContent = guidedCourseActive || (!wordsAvailable && content === 'words') ? 'characters' : content
  const phrase = useListenPhraseSession({
    isActive: effectiveContent === 'words' && !blocked,
    availableLetters, characterWpm, effectiveWpm, toneFrequency,
    playMorseTone, stopMorseTone, phrases: LISTEN_WORD_BANKS[vocabulary], onAnswer: onWordAnswer,
  })
  const release = phrase.release
  const customStop = custom.stop

  useEffect(() => {
    let cancelled = false
    void Promise.all([storage.getItem('dit-listen-content-v1'), storage.getItem('dit-listen-vocabulary-v1')]).then(([savedContent, savedVocabulary]) => {
      if (cancelled || edited.current) return
      if (savedContent === 'words' || savedContent === 'custom') setContent(savedContent)
      if (savedVocabulary === 'q-codes') setVocabulary('q-codes')
    }).catch(() => {}).finally(() => { if (!cancelled) setHydrated(true) })
    return () => { cancelled = true }
  }, [storage])

  useEffect(() => {
    suspendCharacters(effectiveContent !== 'characters' || !hydrated || blocked)
    if (hydrated && !blocked) {
      const shouldReplay = effectiveContent === 'characters' && (!started.current || lastActiveContent.current !== 'characters')
      started.current = true
      lastActiveContent.current = effectiveContent
      if (shouldReplay) replayCharacter()
    }
  }, [effectiveContent, hydrated, blocked, suspendCharacters, replayCharacter])

  useEffect(() => {
    if (!blocked) return
    release()
    void customStop()
  }, [blocked, release, customStop])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') return
      release()
      void customStop()
    })
    return () => {
      subscription.remove()
      release()
      void stopMorseTone()
      suspendCharacters(false)
    }
  }, [release, customStop, suspendCharacters])

  // Changes in the active learning scope never start a word without an explicit action.
  const scope = availableLetters.join('')
  useEffect(() => {
    release()
    if (effectiveContent === 'words') void stopMorseTone()
  }, [scope, guidedCourseActive, release, effectiveContent])

  const changeContent = useCallback(async (next: Content) => {
    if (next === effectiveContent) return
    edited.current = true
    suspendCharacters(true)
    release()
    await customStop()
    setContent(next)
    setError(null)
    await storage.setItem('dit-listen-content-v1', next).catch(() => {})
  }, [customStop, release, storage, suspendCharacters, effectiveContent])

  const changeVocabulary = async (next: ListenVocabulary) => {
    edited.current = true
    release()
    await stopMorseTone()
    setVocabulary(next)
    setError(null)
    await storage.setItem('dit-listen-vocabulary-v1', next).catch(() => {})
  }

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try { await action() } catch {
      release()
      setError('Could not play the word. Try Start listening again.')
    }
  }

  if (!hydrated || !custom.ready) return <View style={styles.loading}><Text style={styles.detail}>Loading Listen…</Text></View>
  const selector = !guidedCourseActive ? <View style={styles.contentSelector}>
    <Host matchContents={{ vertical: true }} colorScheme="dark" ignoreSafeArea="all" alignment="center" style={styles.contentPicker}>
      <Picker label="Listen content" selection={effectiveContent === 'custom' ? null : effectiveContent}
        modifiers={[pickerStyle('segmented'), accessibilityLabel('Listen content')]}
        onSelectionChange={(next) => {
          if (next === 'characters' || (next === 'words' && wordsAvailable)) void changeContent(next)
        }}>
        <NativeText modifiers={[tag('characters')]}>Characters</NativeText>
        <NativeText modifiers={[tag('words'), disabled(!wordsAvailable)]}>Words</NativeText>
      </Picker>
    </Host>
  </View> : null

  if (effectiveContent === 'characters') return <>
    {selector}
    {characterStage}
    <View style={styles.characterControls}>
      {characterControls}
      {!guidedCourseActive && <DitButton text="Use custom" onPress={() => void changeContent('custom')} />}
    </View>
  </>

  return <>
    {selector}
    {effectiveContent === 'custom' ? <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={styles.scroll}
      contentContainerStyle={styles.body}>
      <CustomListenSurface session={custom} onDone={() => void changeContent('characters')} />
    </ScrollView> : <View style={styles.words}>
      <View style={styles.vocabulary}>
        <Host matchContents colorScheme="dark" ignoreSafeArea="all" alignment="center"
          seedColor={normalizeColorForNative(colors.text.primary90)}>
          <Picker label="Word vocabulary" selection={vocabulary}
            modifiers={[pickerStyle('menu'), labelsHidden(), accessibilityLabel('Word vocabulary'), frame({ minHeight: 44 })]}
            onSelectionChange={(next) => { if (next !== vocabulary) void changeVocabulary(next) }}>
            <NativeText modifiers={[tag('common')]}>Common words</NativeText>
            <NativeText modifiers={[tag('q-codes')]}>Q codes</NativeText>
          </Picker>
        </Host>
      </View>
      {/* The lower viewport begins at the visible wave's midline, not its canvas edge. */}
      <View style={styles.waveAnchor} pointerEvents="none">
        <View style={styles.wave}><ListenSineWave playback={phrase.playback} tintStatus={phrase.isPlaying ? 'idle' : phrase.status} /></View>
      </View>
      <ScrollView style={[styles.scroll, { marginBottom: insets.bottom }]} contentContainerStyle={styles.exercise}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}>
        <Text style={styles.prompt} accessibilityLiveRegion="polite">
          {!phrase.round ? phrase.isAvailable ? 'Ready when you are' : 'More characters needed' : phrase.isPlaying ? 'Listening…' : phrase.status === 'idle' ? 'Choose what you heard' : phrase.status === 'success' ? 'Correct' : 'The word was'}
        </Text>
        {!phrase.round ? <>
          <Text style={styles.detail}>{phrase.isAvailable
            ? `Listen to one ${vocabulary === 'common' ? 'English word' : 'Q code'}, then choose what you heard.`
            : 'This set needs at least four choices from your active characters. Try the other set or add more characters.'}</Text>
          <DitButton text="Start listening" disabled={!phrase.isAvailable || blocked} onPress={() => void run(phrase.start)} />
        </> : <>
          <Text style={styles.detail}>{wordCounts.correct} / {wordCounts.attempted} correct</Text>
          <View style={styles.answers} accessibilityElementsHidden={phrase.isPlaying} importantForAccessibility={phrase.isPlaying ? 'no-hide-descendants' : 'auto'}>
            {phrase.round.options.map((answer, index) => {
              const correct = !phrase.isPlaying && phrase.status !== 'idle' && answer.id === phrase.round?.target.id
              const missed = !phrase.isPlaying && phrase.status === 'error' && answer.id === phrase.selectedPhraseId
              return <DitButton key={index} text={phrase.isPlaying ? '…' : answer.text}
                accessibilityLabel={phrase.isPlaying ? 'Answer concealed during playback' : `Answer ${answer.text}${correct ? ', correct' : missed ? ', incorrect' : ''}`}
                disabled={blocked || phrase.isPlaying || phrase.status !== 'idle'}
                color={correct ? colors.feedback.success : missed ? colors.feedback.error : colors.text.primary}
                style={styles.answer} textStyle={styles.answerText}
                onPress={() => void run(() => phrase.submitAnswer(answer.id))} />
            })}
          </View>
          <View style={styles.feedback}>
            {!phrase.isPlaying && phrase.status !== 'idle' && <>
              <Text style={styles.prompt}>{phrase.round.target.text}</Text>
              {phrase.round.target.meaning && <Text style={styles.detail}>{phrase.round.target.meaning}</Text>}
            </>}
          </View>
          <View style={styles.actions}>
            <View style={styles.actionSlot} />
            <View style={styles.actionSlot}>
              <DitButton text="Replay" disabled={blocked || phrase.isPlaying} onPress={() => void run(phrase.replay)} />
            </View>
            <View accessibilityElementsHidden={phrase.status === 'idle'}
              importantForAccessibility={phrase.status === 'idle' ? 'no-hide-descendants' : 'auto'}
              style={[styles.actionSlot, styles.nextAction, { opacity: phrase.status === 'idle' ? 0 : 1 }]}>
              <DitButton text="Next" disabled={blocked || phrase.isPlaying || phrase.status === 'idle'} onPress={() => void run(phrase.next)} />
            </View>
          </View>
        </>}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </View>}
  </>
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center' },
  scroll: { flex: 1 },
  body: { flexGrow: 1, paddingVertical: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.lg },
  contentSelector: { width: '100%', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  contentPicker: { width: '100%', maxWidth: 360, minHeight: 44 },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  actionSlot: { flex: 1, alignItems: 'center' },
  nextAction: { alignItems: 'flex-end' },
  characterControls: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  words: { flex: 1, paddingTop: spacing.lg },
  vocabulary: { alignItems: 'center', marginBottom: spacing.lg },
  waveAnchor: { width: '100%', height: WORD_WAVE_HEIGHT / 2, flexShrink: 0 },
  wave: { position: 'absolute', top: 0, width: '100%', height: WORD_WAVE_HEIGHT },
  exercise: { flexGrow: 1, width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.lg },
  prompt: { fontSize: 20, fontWeight: '600', color: colors.text.primary, textAlign: 'center', paddingHorizontal: spacing.xl },
  detail: { fontSize: 14, color: colors.text.primary60, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.xl },
  answers: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', paddingHorizontal: spacing.xl, justifyContent: 'space-between', gap: spacing.md },
  answer: { width: '47%', minHeight: 56, borderRadius: radii.md },
  answerText: { fontSize: 20 },
  feedback: { minHeight: 96, gap: spacing.sm, justifyContent: 'center' },
  error: { color: colors.feedback.error, textAlign: 'center', paddingHorizontal: spacing.xl },
})
