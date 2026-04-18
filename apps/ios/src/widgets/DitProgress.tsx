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
declare const ZStack: typeof import('@expo/ui/swift-ui').ZStack
declare const Text: typeof import('@expo/ui/swift-ui').Text
declare const Spacer: typeof import('@expo/ui/swift-ui').Spacer
declare const Image: typeof import('@expo/ui/swift-ui').Image
declare const ProgressView: typeof import('@expo/ui/swift-ui').ProgressView
declare const background: typeof import('@expo/ui/swift-ui/modifiers').background
declare const font: typeof import('@expo/ui/swift-ui/modifiers').font
declare const resizable: typeof import('@expo/ui/swift-ui/modifiers').resizable
declare const foregroundStyle: typeof import(
  '@expo/ui/swift-ui/modifiers'
).foregroundStyle
declare const frame: typeof import('@expo/ui/swift-ui/modifiers').frame
declare const padding: typeof import('@expo/ui/swift-ui/modifiers').padding
declare const clipShape: typeof import('@expo/ui/swift-ui/modifiers').clipShape

export type DitProgressWidgetProps = {
  streak: number
  todayCorrect: number
  goal: number
  heroKind: 'mastered' | 'wpm'
  heroValue: number
  heroTotal: number
  iconUri: string
  bgSmallUri: string
  bgMediumUri: string
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
  const OVERLAY = '#0A0F14'

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

  const iconUri = props.iconUri ?? ''
  const hasIcon = iconUri.length > 0
  const bgSmallUri = props.bgSmallUri ?? ''
  const hasBgSmall = bgSmallUri.length > 0
  const bgMediumUri = props.bgMediumUri ?? ''
  const hasBgMedium = bgMediumUri.length > 0

  if (env.widgetFamily === 'accessoryRectangular') {
    const progress = goal > 0 ? Math.min(Math.max(todayCorrect / goal, 0), 1) : 0
    return (
      <VStack alignment="leading" spacing={2}>
        <HStack spacing={4}>
          <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
            {streakLine}
          </Text>
          <Spacer />
          {hasIcon ? (
            <Image
              uiImage={iconUri}
              modifiers={[
                resizable(),
                frame({ width: 14, height: 14 }),
                clipShape('circle'),
              ]}
            />
          ) : null}
          <Text modifiers={[font({ size: 11, weight: 'semibold' })]}>Dit</Text>
        </HStack>
        <ProgressView value={progress}>
          <Text modifiers={[font({ size: 11 })]}>{todayLine}</Text>
        </ProgressView>
      </VStack>
    )
  }

  if (env.widgetFamily === 'systemMedium') {
    return (
      <ZStack
        alignment="topLeading"
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000 }),
          background(OVERLAY),
        ]}
      >
        {hasBgMedium ? (
          <Image
            uiImage={bgMediumUri}
            modifiers={[
              resizable(),
              frame({ maxWidth: 10000, maxHeight: 10000 }),
            ]}
          />
        ) : null}
        <VStack
          alignment="leading"
          spacing={10}
          modifiers={[
            padding({ all: 18 }),
            frame({
              maxWidth: 10000,
              maxHeight: 10000,
              alignment: 'topLeading',
            }),
          ]}
        >
        <HStack spacing={6}>
          {hasIcon ? (
            <Image
              uiImage={iconUri}
              modifiers={[
                resizable(),
                frame({ width: 18, height: 18 }),
                clipShape('circle'),
              ]}
            />
          ) : (
            <Spacer />
          )}
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold' }),
              foregroundStyle(TEXT_PRIMARY),
            ]}
          >
            Dit
          </Text>
        </HStack>
        <HStack spacing={16}>
          <VStack alignment="leading" spacing={4}>
            <Text
              modifiers={[
                font({ size: 34, weight: 'semibold' }),
                foregroundStyle(TEXT_PRIMARY),
              ]}
            >
              {heroValueText}
            </Text>
            <Text
              modifiers={[font({ size: 13 }), foregroundStyle(TEXT_MUTED)]}
            >
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
            <Text
              modifiers={[font({ size: 13 }), foregroundStyle(TEXT_MUTED)]}
            >
              {todayLine}
            </Text>
          </VStack>
        </HStack>
        </VStack>
      </ZStack>
    )
  }

  return (
    <ZStack
      alignment="topLeading"
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        background(OVERLAY),
      ]}
    >
      {hasBgSmall ? (
        <Image
          uiImage={bgSmallUri}
          modifiers={[
            resizable(),
            frame({ maxWidth: 10000, maxHeight: 10000 }),
          ]}
        />
      ) : (
        <Spacer />
      )}
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[
          padding({ all: 14 }),
          frame({
            maxWidth: 10000,
            maxHeight: 10000,
            alignment: 'topLeading',
          }),
        ]}
      >
        <HStack spacing={6}>
          {hasIcon ? (
            <Image
              uiImage={iconUri}
              modifiers={[
                resizable(),
                frame({ width: 16, height: 16 }),
                clipShape('circle'),
              ]}
            />
          ) : (
            <Spacer />
          )}
          <Text
            modifiers={[
              font({ size: 12, weight: 'semibold' }),
              foregroundStyle(TEXT_PRIMARY),
            ]}
          >
            Dit
          </Text>
        </HStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 30, weight: 'semibold' }),
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
    </ZStack>
  )
}

export const DitProgressWidget = createWidget<DitProgressWidgetProps>(
  'DitProgress',
  DitProgressLayout,
)
