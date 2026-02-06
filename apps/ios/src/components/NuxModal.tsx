import { StyleSheet, Text, View } from 'react-native';
import { DitButton } from './DitButton';
import { ModalShell } from './ModalShell';

type NuxModalProps = {
  step: 'welcome' | 'exercise' | 'result';
  index: number;
  total: number;
  result: 'fast' | 'slow' | null;
  onStart: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onChoosePreset: (preset: 'beginner' | 'advanced') => void;
};

/** First-run modal that guides users through the personalization exercise. */
export function NuxModal({
  step,
  index,
  total,
  result,
  onStart,
  onSkip,
  onFinish,
  onChoosePreset,
}: NuxModalProps) {
  const isWelcome = step === 'welcome';
  const isResult = step === 'result';
  const progressItems = Array.from({ length: total });

  if (isWelcome) {
    return (
      <ModalShell onClose={onSkip} cardPressable allowBackdropDismiss={false}>
        <View style={styles.panel}>
          <Text style={styles.title}>Welcome to Dit</Text>
          <Text style={styles.body}>
            We'll run a quick exercise to personalize your defaults.
          </Text>
          <Text style={styles.bodySecondary}>
            It only takes a few easy letters. Go as fast as you can.
          </Text>
          <View style={styles.actions}>
            <DitButton
              text="Start quick exercise"
              onPress={onStart}
              accessibilityLabel="Start personalization exercise"
              radius={16}
              paddingHorizontal={14}
              paddingVertical={10}
            />
            <DitButton
              text="Skip for now"
              onPress={onSkip}
              accessibilityLabel="Skip personalization"
              radius={16}
              paddingHorizontal={14}
              paddingVertical={10}
            />
          </View>
        </View>
      </ModalShell>
    );
  }

  if (isResult) {
    const resultTitle = result === 'fast' ? 'All set' : 'All set';
    const resultBody =
      result === 'fast'
        ? 'We set a faster start with hints off and a higher starting level.'
        : 'We set a gentler start with hints on and level 1.';
    return (
      <ModalShell onClose={onFinish} cardPressable allowBackdropDismiss={false}>
        <View style={styles.panel}>
          <Text style={styles.title}>{resultTitle}</Text>
          <Text style={styles.body}>{resultBody}</Text>
          <Text style={styles.bodySecondary}>
            You can always change this later in settings.
          </Text>
          <View style={styles.actionsColumn}>
            <DitButton
              text="Beginner preset"
              onPress={() => onChoosePreset('beginner')}
              accessibilityLabel="Apply beginner preset"
              radius={16}
              paddingHorizontal={14}
              paddingVertical={10}
            />
            <DitButton
              text="Advanced preset"
              onPress={() => onChoosePreset('advanced')}
              accessibilityLabel="Apply advanced preset"
              radius={16}
              paddingHorizontal={14}
              paddingVertical={10}
            />
            <DitButton
              text="Start practicing"
              onPress={onFinish}
              accessibilityLabel="Finish personalization"
              radius={16}
              paddingHorizontal={14}
              paddingVertical={10}
            />
          </View>
        </View>
      </ModalShell>
    );
  }

  return (
    <View style={styles.exerciseOverlay} pointerEvents="box-none">
      <View style={styles.topBlocker} pointerEvents="auto" />
      <View style={styles.exerciseCard} pointerEvents="none">
        <View style={styles.panel}>
          <Text style={styles.title}>Quick personalization</Text>
          <Text style={styles.body}>
            Match each letter on screen as fast as you can.
          </Text>
          <Text style={styles.progressLabel}>
            Letter {index + 1} of {total}
          </Text>
          <View style={styles.progressRow}>
            {progressItems.map((_, itemIndex) => {
              const isDone = itemIndex < index;
              const isActive = itemIndex === index;
              return (
                <View
                  key={`nux-dot-${itemIndex}`}
                  style={[
                    styles.progressDot,
                    isDone && styles.progressDotDone,
                    isActive && styles.progressDotActive,
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.caption}>Use the big Morse key below.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  topBlocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(6, 10, 14, 0.35)',
  },
  exerciseCard: {
    width: '100%',
    maxWidth: 360,
  },
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
    width: '100%',
  },
  title: {
    fontSize: 18,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f7f9',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(244, 247, 249, 0.9)',
    marginBottom: 10,
  },
  bodySecondary: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 247, 249, 0.7)',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  actionsColumn: {
    gap: 10,
  },
  progressLabel: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.7)',
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(244, 247, 249, 0.2)',
  },
  progressDotActive: {
    backgroundColor: 'rgba(76, 201, 255, 0.9)',
  },
  progressDotDone: {
    backgroundColor: 'rgba(56, 242, 162, 0.9)',
  },
  caption: {
    fontSize: 12,
    color: 'rgba(244, 247, 249, 0.6)',
  },
});
