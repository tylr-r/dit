import {
  getEligibleListenPhrases,
  LISTEN_WORD_BANKS,
  useListenPhraseSession,
  usePlatform,
  type Letter,
  type ListenVocabulary,
} from '@dit/core'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../design/tokens'
import { useCustomListenSession } from '../hooks/useCustomListenSession'
import { playMorseTone, stopMorseTone } from '../utils/tone'
import { CustomListenSurface } from './CustomListenSurface'
import { ListenActionButton as DitButton } from './ListenActionButton'
import { ListenSineWave } from './ListenSineWave'

type Content = 'characters' | 'words' | 'custom'
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
  const selector = !guidedCourseActive ? <View style={styles.selector}>
    {(['characters', 'words'] as const).map((value) => <DitButton key={value}
      text={value === 'characters' ? 'Characters' : 'Words'}
      disabled={value === 'words' && !wordsAvailable}
      color={effectiveContent === value ? colors.text.primary : colors.text.primary60}
      backgroundColor={effectiveContent === value ? colors.surface.inputPressed : undefined}
      onPress={() => void changeContent(value)} />)}
  </View> : null

  if (effectiveContent === 'characters') return <>
    {selector}
    {characterStage}
    <View style={styles.characterControls}>
      {characterControls}
      {!guidedCourseActive && <DitButton text="Use custom" onPress={() => void changeContent('custom')} />}
    </View>
  </>

  return <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={styles.scroll}
    contentContainerStyle={styles.body}>
    {selector}
    {effectiveContent === 'custom' ? <CustomListenSurface session={custom} onDone={() => void changeContent('characters')} /> : <>
      <View style={styles.selector}>
        {(['common', 'q-codes'] as const).map((value) => <DitButton key={value}
          text={value === 'common' ? 'Common words' : 'Q codes'}
          color={vocabulary === value ? colors.text.primary : colors.text.primary60}
          onPress={() => void changeVocabulary(value)} />)}
      </View>
      <View style={styles.wave}><ListenSineWave playback={phrase.playback} tintStatus={phrase.isPlaying ? 'idle' : phrase.status} /></View>
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
        <View style={styles.selector}>
          <DitButton text="Replay" disabled={blocked || phrase.isPlaying} onPress={() => void run(phrase.replay)} />
          <View accessibilityElementsHidden={phrase.status === 'idle'} style={{ opacity: phrase.status === 'idle' ? 0 : 1 }}>
            <DitButton text="Next" disabled={blocked || phrase.isPlaying || phrase.status === 'idle'} onPress={() => void run(phrase.next)} />
          </View>
        </View>
      </>}
      {error && <Text style={styles.error}>{error}</Text>}
    </>}
  </ScrollView>
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center' },
  scroll: { flex: 1 },
  body: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.lg },
  selector: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  characterControls: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  wave: { width: '100%', height: 120 },
  prompt: { fontSize: 20, fontWeight: '600', color: colors.text.primary, textAlign: 'center' },
  detail: { fontSize: 14, color: colors.text.primary60, textAlign: 'center', lineHeight: 20 },
  answers: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', gap: spacing.md },
  answer: { width: '47%', minHeight: 56, borderRadius: radii.md },
  answerText: { fontSize: 20 },
  feedback: { minHeight: 96, gap: spacing.sm, justifyContent: 'center' },
  error: { color: colors.feedback.error, textAlign: 'center' },
})
