import { MaterialIcons } from '@expo/vector-icons'
import { BEGINNER_COURSE_PACKS, MORSE_DATA, colors } from '@dit/core'
import type { Letter } from '@dit/core'
import { BlurView } from 'expo-blur'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type LearningSheetProps = {
  visible: boolean
  guidedCourseActive: boolean
  guidedPackIndex: number
  guidedMaxPackReached: number
  maxLevel: number
  customLetters: Letter[]
  onDismiss: () => void
  onSelectPack: (packIndex: number) => void
  onSelectTier: (level: number) => void
  onSelectCustomLetters: (letters: Letter[]) => void
  onSetGuidedCourseActive: (next: boolean) => void
}

type TierDef = {
  level: number
  name: string
  description: string
}

// Frequency-tier presets exposed in Open practice. Levels match the
// existing letter-level metadata in MORSE_DATA so picking a tier just
// sets `maxLevel`.
const TIERS: readonly TierDef[] = [
  { level: 1, name: 'Beginner letters', description: 'A E I M N T' },
  { level: 2, name: 'Common letters', description: 'adds D G K O R S U W' },
  { level: 3, name: 'Full alphabet', description: 'adds B C F H J L P Q V X Y Z' },
  { level: 4, name: 'Full alphabet + digits', description: 'adds 0 1 2 3 4 5 6 7 8 9' },
]

const ALL_CHARACTERS = Object.keys(MORSE_DATA) as Letter[]
const LETTER_CHARACTERS = ALL_CHARACTERS.filter((c) => /^[A-Z]$/.test(c))
const DIGIT_CHARACTERS = ALL_CHARACTERS.filter((c) => /^[0-9]$/.test(c))

type LearningView = 'modes' | 'pickYourOwn'

/** Unified "what letters and how" picker. Replaces Max Difficulty stepper + pack picker. */
export function LearningSheet({
  visible,
  guidedCourseActive,
  guidedPackIndex,
  guidedMaxPackReached,
  maxLevel,
  customLetters,
  onDismiss,
  onSelectPack,
  onSelectTier,
  onSelectCustomLetters,
  onSetGuidedCourseActive,
}: LearningSheetProps) {
  const insets = useSafeAreaInsets()
  const [view, setView] = useState<LearningView>('modes')
  const [draftCustom, setDraftCustom] = useState<Set<Letter>>(
    () => new Set(customLetters),
  )

  // Sync the draft with persisted state whenever the sheet opens or the
  // persisted value changes from outside (e.g., remote progress load).
  useEffect(() => {
    if (visible) {
      setDraftCustom(new Set(customLetters))
    }
  }, [visible, customLetters])

  // Reset to the modes view whenever the sheet closes so the next open is clean.
  useEffect(() => {
    if (!visible) setView('modes')
  }, [visible])

  const customActive = !guidedCourseActive && customLetters.length > 0

  const handleSelectCourseSegment = useCallback(() => {
    if (!guidedCourseActive) onSetGuidedCourseActive(true)
  }, [guidedCourseActive, onSetGuidedCourseActive])

  const handleSelectOpenSegment = useCallback(() => {
    if (guidedCourseActive) onSetGuidedCourseActive(false)
  }, [guidedCourseActive, onSetGuidedCourseActive])

  const handleOpenPickYourOwn = useCallback(() => {
    setDraftCustom(new Set(customLetters))
    setView('pickYourOwn')
  }, [customLetters])

  const handleReturnToModes = useCallback(() => {
    setView('modes')
  }, [])

  const handleToggleCharacter = useCallback((letter: Letter) => {
    setDraftCustom((prev) => {
      const next = new Set(prev)
      if (next.has(letter)) {
        next.delete(letter)
      } else {
        next.add(letter)
      }
      return next
    })
  }, [])

  const handleApplyCustomSelection = useCallback(() => {
    // Keep the canonical character order (MORSE_DATA insertion order) so the
    // saved list reads predictably in storage and tests.
    const ordered = ALL_CHARACTERS.filter((letter) => draftCustom.has(letter))
    onSelectCustomLetters(ordered)
    onDismiss()
  }, [draftCustom, onDismiss, onSelectCustomLetters])

  const draftCount = draftCustom.size

  const slideProgress = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(slideProgress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [slideProgress, visible])

  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const id = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(id)
  }, [visible])

  if (!mounted) return null

  const sheetTranslateY = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [800, 0],
  })
  const backdropOpacity = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <View
      style={styles.overlay}
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityViewIsModal
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      />
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss learning sheet"
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 12,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <BlurView intensity={18} tint="dark" style={styles.blurBase} />
        <View style={styles.tint} />
        <View style={styles.grabber} />

        {view === 'modes' ? (
          <>
            <Text style={styles.title}>Learning method</Text>
            <Text style={styles.subtitle}>How you want to practice.</Text>

            <View style={styles.segmented}>
              <Pressable
                onPress={handleSelectCourseSegment}
                style={({ pressed }) => [
                  styles.segment,
                  guidedCourseActive && styles.segmentActive,
                  pressed && styles.segmentPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: guidedCourseActive }}
                accessibilityLabel="Course mode"
              >
                <Text
                  style={[
                    styles.segmentText,
                    guidedCourseActive && styles.segmentTextActive,
                  ]}
                >
                  Course
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSelectOpenSegment}
                style={({ pressed }) => [
                  styles.segment,
                  !guidedCourseActive && styles.segmentActive,
                  pressed && styles.segmentPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: !guidedCourseActive }}
                accessibilityLabel="Open practice mode"
              >
                <Text
                  style={[
                    styles.segmentText,
                    !guidedCourseActive && styles.segmentTextActive,
                  ]}
                >
                  Open practice
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {guidedCourseActive ? (
                BEGINNER_COURSE_PACKS.map((letters, index) => {
                  const isCurrent = index === guidedPackIndex
                  const isCompleted = index < guidedMaxPackReached
                  const accessibilitySuffix = isCompleted
                    ? ', completed'
                    : isCurrent
                      ? ', current'
                      : ''
                  return (
                    <Pressable
                      key={`pack-${index}`}
                      onPress={() => onSelectPack(index)}
                      style={({ pressed }) => [
                        styles.row,
                        isCurrent && styles.rowCurrent,
                        pressed && styles.rowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Pack ${index + 1}, letters ${letters.join(' ')}${accessibilitySuffix}`}
                    >
                      <View style={styles.rowLabelWrap}>
                        {isCompleted ? (
                          <MaterialIcons
                            name="check"
                            size={16}
                            color="rgba(180, 220, 180, 0.85)"
                            style={styles.rowCheck}
                          />
                        ) : (
                          <View style={styles.rowCheckSlot} />
                        )}
                        <Text
                          style={[
                            styles.rowLabel,
                            isCurrent && styles.rowLabelCurrent,
                          ]}
                        >
                          {`Pack ${index + 1}`}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowLetters,
                          isCurrent && styles.rowLettersCurrent,
                        ]}
                      >
                        {letters.join(' ')}
                      </Text>
                    </Pressable>
                  )
                })
              ) : (
                <>
                  {TIERS.map((tier) => {
                    const isCurrent = !customActive && maxLevel === tier.level
                    return (
                      <Pressable
                        key={`tier-${tier.level}`}
                        onPress={() => onSelectTier(tier.level)}
                        style={({ pressed }) => [
                          styles.tierRow,
                          isCurrent && styles.rowCurrent,
                          pressed && styles.rowPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCurrent }}
                        accessibilityLabel={`${tier.name}, ${tier.description}`}
                      >
                        <View style={styles.tierTextWrap}>
                          <Text
                            style={[
                              styles.rowLabel,
                              isCurrent && styles.rowLabelCurrent,
                            ]}
                          >
                            {tier.name}
                          </Text>
                          <Text
                            style={[
                              styles.tierDescription,
                              isCurrent && styles.tierDescriptionCurrent,
                            ]}
                          >
                            {tier.description}
                          </Text>
                        </View>
                        {isCurrent ? (
                          <MaterialIcons
                            name="check"
                            size={18}
                            color="rgba(180, 220, 180, 0.85)"
                          />
                        ) : null}
                      </Pressable>
                    )
                  })}
                  <Pressable
                    onPress={handleOpenPickYourOwn}
                    style={({ pressed }) => [
                      styles.tierRow,
                      customActive && styles.rowCurrent,
                      pressed && styles.rowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: customActive }}
                    accessibilityLabel="Pick your own letters"
                  >
                    <View style={styles.tierTextWrap}>
                      <Text
                        style={[
                          styles.rowLabel,
                          customActive && styles.rowLabelCurrent,
                        ]}
                      >
                        Pick your own
                      </Text>
                      <Text
                        style={[
                          styles.tierDescription,
                          customActive && styles.tierDescriptionCurrent,
                        ]}
                      >
                        {customActive
                          ? `${customLetters.length} selected`
                          : 'Choose any combination of letters and digits'}
                      </Text>
                    </View>
                    <Text style={styles.rowChevron}>›</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>

            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.cancel,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.cancelText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.formHeader}>
              <Pressable
                onPress={handleReturnToModes}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to modes"
                hitSlop={12}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={22}
                  color="rgba(244, 247, 249, 0.85)"
                />
              </Pressable>
              <Text style={styles.title}>Pick your own</Text>
              <View style={styles.backButton} />
            </View>
            <Text style={styles.subtitle}>
              {`${draftCount} ${draftCount === 1 ? 'character' : 'characters'} selected`}
            </Text>

            <ScrollView contentContainerStyle={styles.gridContent}>
              <Text style={styles.sectionHeader}>Letters</Text>
              <View style={styles.grid}>
                {LETTER_CHARACTERS.map((letter) => {
                  const selected = draftCustom.has(letter)
                  return (
                    <Pressable
                      key={`chip-${letter}`}
                      onPress={() => handleToggleCharacter(letter)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={letter}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {letter}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                Numbers
              </Text>
              <View style={styles.grid}>
                {DIGIT_CHARACTERS.map((digit) => {
                  const selected = draftCustom.has(digit)
                  return (
                    <Pressable
                      key={`chip-${digit}`}
                      onPress={() => handleToggleCharacter(digit)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={digit}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {digit}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={handleApplyCustomSelection}
              disabled={draftCount === 0}
              style={({ pressed }) => [
                styles.primaryButton,
                draftCount === 0 && styles.primaryButtonDisabled,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Apply selection"
            >
              <Text style={styles.primaryButtonText}>Apply</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface.backdrop,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  blurBase: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    maxHeight: '85%',
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.42,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -10 },
  },
  tint: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'hsla(215, 25%, 6%, 0.62)',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 12,
  },
  title: {
    color: 'rgba(244, 247, 249, 0.95)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(200, 210, 220, 0.55)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'hsla(217, 26%, 5%, 0.94)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  segmentText: {
    color: 'rgba(200, 210, 220, 0.6)',
    fontSize: 13,
  },
  segmentTextActive: {
    color: 'rgba(244, 247, 249, 0.95)',
    fontWeight: '500',
  },
  list: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'hsla(217, 26%, 5%, 0.94)',
  },
  listContent: {
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowCurrent: {
    backgroundColor: 'rgba(130, 170, 230, 0.12)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCheck: {
    marginRight: 8,
  },
  rowCheckSlot: {
    width: 16,
    marginRight: 8,
  },
  rowLabel: {
    color: 'rgba(200, 210, 220, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  rowLabelCurrent: {
    color: 'rgba(230, 240, 255, 0.95)',
  },
  rowLetters: {
    color: 'rgba(200, 210, 220, 0.55)',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowLettersCurrent: {
    color: 'rgba(230, 240, 255, 0.95)',
  },
  rowChevron: {
    color: 'rgba(200, 210, 220, 0.5)',
    fontSize: 18,
    fontWeight: '500',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tierTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  tierDescription: {
    color: 'rgba(200, 210, 220, 0.5)',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 1,
  },
  tierDescriptionCurrent: {
    color: 'rgba(200, 220, 250, 0.75)',
  },
  cancel: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelText: {
    color: 'rgba(244, 247, 249, 0.9)',
    fontSize: 15,
    fontWeight: '500',
  },
  gridContent: {
    paddingVertical: 4,
  },
  sectionHeader: {
    color: 'rgba(200, 210, 220, 0.5)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeaderSpaced: {
    marginTop: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: 'rgba(130, 170, 230, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(130, 170, 230, 0.55)',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: 'rgba(200, 210, 220, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: 'rgba(230, 240, 255, 0.95)',
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(130, 170, 230, 0.5)',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: 'rgba(244, 247, 249, 0.98)',
    fontSize: 15,
    fontWeight: '600',
  },
})
