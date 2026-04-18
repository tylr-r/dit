import { createWidget, type WidgetEnvironment } from 'expo-widgets'

// `@expo/ui/swift-ui` is NOT imported here: it registers native views at module
// load, and those views only exist inside the widget extension — importing them
// from main-app JS crashes the app. The babel widgets-plugin stringifies the
// layout function at build time, so `VStack` / `Text` / `font` become literal
// text inside the stored layout string and are resolved against widget
// JSContext globals (set up by `expo-widgets/bundle/index.ts`). Ambient
// `declare const` gives TypeScript the types without emitting requires.
declare const VStack: typeof import('@expo/ui/swift-ui').VStack
declare const HStack: typeof import('@expo/ui/swift-ui').HStack
declare const Text: typeof import('@expo/ui/swift-ui').Text
declare const Spacer: typeof import('@expo/ui/swift-ui').Spacer
declare const background: typeof import('@expo/ui/swift-ui/modifiers').background
declare const font: typeof import('@expo/ui/swift-ui/modifiers').font
declare const foregroundStyle: typeof import(
  '@expo/ui/swift-ui/modifiers'
).foregroundStyle
declare const frame: typeof import('@expo/ui/swift-ui/modifiers').frame
declare const padding: typeof import('@expo/ui/swift-ui/modifiers').padding

export type DitProgressWidgetProps = {
  streak: number
  todayCorrect: number
  goal: number
  heroKind: 'mastered' | 'wpm'
  heroValue: number
  heroTotal: number
}

// Everything this layout uses must be referenced directly — the function
// is serialized via `.toString()` and evaluated in an isolated JSContext
// inside the widget extension, so module-scope helpers and constants are
// not available there.
const DitProgressLayout = (
  props: DitProgressWidgetProps,
  env: WidgetEnvironment,
) => {
  'widget'

  const TEXT_PRIMARY = '#FBF7F5'
  const TEXT_MUTED = '#FBF7F5B3'
  const ACCENT = '#FF9A4D'
  const SURFACE = '#0A0F14'

  const streak = props.streak ?? 0
  const streakLine =
    streak > 0 ? `${streak}-day streak` : 'Start a streak'

  const goal = props.goal ?? 15
  const todayCorrect = Math.min(props.todayCorrect ?? 0, goal)
  const todayLine = `${todayCorrect}/${goal} today`

  const heroLabel = props.heroKind === 'wpm' ? 'Best WPM' : 'Letters'
  let heroValueText: string
  if (props.heroKind === 'wpm') {
    const v = props.heroValue ?? 0
    heroValueText = v > 0 ? String(v) : '—'
  } else {
    const value = props.heroValue ?? 0
    const total = props.heroTotal ?? 36
    heroValueText = `${value}/${total}`
  }

  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
          {streakLine}
        </Text>
        <Text modifiers={[font({ size: 12 })]}>{todayLine}</Text>
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
          background(SURFACE),
        ]}
      >
        <VStack alignment="leading" spacing={4}>
          <Text
            modifiers={[
              font({ size: 36, weight: 'semibold' }),
              foregroundStyle(TEXT_PRIMARY),
            ]}
          >
            {heroValueText}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(TEXT_MUTED)]}>
            {heroLabel}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={6}>
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold' }),
              foregroundStyle(ACCENT),
            ]}
          >
            {streakLine}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(TEXT_MUTED)]}>
            {todayLine}
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
        background(SURFACE),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 32, weight: 'semibold' }),
          foregroundStyle(TEXT_PRIMARY),
        ]}
      >
        {heroValueText}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(TEXT_MUTED)]}>
        {heroLabel}
      </Text>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 13, weight: 'semibold' }),
          foregroundStyle(ACCENT),
        ]}
      >
        {streakLine}
      </Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(TEXT_MUTED)]}>
        {todayLine}
      </Text>
    </VStack>
  )
}

export const DitProgressWidget = createWidget<DitProgressWidgetProps>(
  'DitProgress',
  DitProgressLayout,
)
