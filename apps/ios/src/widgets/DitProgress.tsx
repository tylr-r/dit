import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { frame, padding } from '@expo/ui/swift-ui/modifiers'
import { createWidget, type WidgetEnvironment } from 'expo-widgets'

export type DitProgressWidgetProps = {
  streak: number
  todayCorrect: number
  goal: number
  heroKind: 'mastered' | 'wpm'
  heroValue: number
  heroTotal: number
}

const TEXT_PRIMARY = '#FBF7F5'
const TEXT_MUTED = '#FBF7F5B3'
const ACCENT = '#FF9A4D'

const heroLabel = (props: DitProgressWidgetProps): string => {
  if (props.heroKind === 'wpm') {
    return 'Best WPM'
  }
  return 'Letters'
}

const heroValueText = (props: DitProgressWidgetProps): string => {
  if (props.heroKind === 'wpm') {
    return props.heroValue > 0 ? String(props.heroValue) : '—'
  }
  return `${props.heroValue}/${props.heroTotal}`
}

const streakLine = (props: DitProgressWidgetProps): string =>
  props.streak > 0 ? `${props.streak}-day streak` : 'Start a streak'

const todayLine = (props: DitProgressWidgetProps): string =>
  `${Math.min(props.todayCorrect, props.goal)}/${props.goal} today`

const DitProgressLayout = (
  props: DitProgressWidgetProps,
  env: WidgetEnvironment,
) => {
  'widget'

  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2}>
        <Text weight="semibold" size={14}>
          {streakLine(props)}
        </Text>
        <Text size={12}>{todayLine(props)}</Text>
      </VStack>
    )
  }

  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack
        spacing={16}
        modifiers={[
          padding({ all: 14 }),
          frame({ maxWidth: 10000, maxHeight: 10000 }),
        ]}
      >
        <VStack alignment="leading" spacing={4}>
          <Text size={36} weight="semibold" color={TEXT_PRIMARY}>
            {heroValueText(props)}
          </Text>
          <Text size={13} color={TEXT_MUTED}>
            {heroLabel(props)}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={6}>
          <Text size={15} weight="semibold" color={ACCENT}>
            {streakLine(props)}
          </Text>
          <Text size={13} color={TEXT_MUTED}>
            {todayLine(props)}
          </Text>
        </VStack>
      </HStack>
    )
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        padding({ all: 14 }),
        frame({ maxWidth: 10000, maxHeight: 10000 }),
      ]}
    >
      <Text size={32} weight="semibold" color={TEXT_PRIMARY}>
        {heroValueText(props)}
      </Text>
      <Text size={12} color={TEXT_MUTED}>
        {heroLabel(props)}
      </Text>
      <Spacer />
      <Text size={13} weight="semibold" color={ACCENT}>
        {streakLine(props)}
      </Text>
      <Text size={11} color={TEXT_MUTED}>
        {todayLine(props)}
      </Text>
    </VStack>
  )
}

export const DitProgressWidget = createWidget<DitProgressWidgetProps>(
  'DitProgress',
  DitProgressLayout,
)
