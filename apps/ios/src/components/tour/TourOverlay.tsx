import { BlurView } from 'expo-blur'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Reanimated, {
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { colors, radii, spacing } from '../../design/tokens'
import { BEZIER, TIMING } from '../nux/animationTokens'
import { useReduceMotion } from '../nux/useReduceMotion'
import type { TourTarget } from '../../hooks/useKnownTour'

const TOP_BAR_VISIBLE_HEIGHT = 82
const SIDE_CENTER_OFFSET = 54
const POINTER_SIZE = 22

type TourOverlayProps = {
  target: TourTarget
  title: string
  caption: string
  stopIndex: number
  totalStops: number
  onAdvance: () => void
}

/** Top-bar callout overlay for known-track learners. Taps anywhere advance
 *  the tour while the callout points at each navigation control. */
export function TourOverlay({
  target,
  title,
  caption,
  stopIndex,
  totalStops,
  onAdvance,
}: TourOverlayProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()

  const overlayOpacity = useSharedValue(0)
  const captionOpacity = useSharedValue(0)

  useEffect(() => {
    overlayOpacity.value = withDelay(
      reduceMotion ? 0 : 60,
      withTiming(1, {
        duration: reduceMotion ? 0 : 520,
        easing: REasing.bezier(...BEZIER.out),
      }),
    )
  }, [overlayOpacity, reduceMotion])

  useEffect(() => {
    captionOpacity.value = 0
    captionOpacity.value = withDelay(
      reduceMotion ? 0 : 120,
      withTiming(1, {
        duration: reduceMotion ? 0 : TIMING.medium,
        easing: REasing.bezier(...BEZIER.out),
      }),
    )
  }, [caption, captionOpacity, reduceMotion])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const captionStyle = useAnimatedStyle(() => ({ opacity: captionOpacity.value }))

  const topBarBottom = Math.min(height, insets.top + TOP_BAR_VISIBLE_HEIGHT)
  const targetCenterX = getTargetCenterX(target, width)
  const cardWidth = Math.min(width - 40, 340)
  const cardLeft = clamp(targetCenterX - cardWidth / 2, 20, width - cardWidth - 20)
  const cardTop = topBarBottom + spacing.lg
  const pointerLeft = clamp(
    targetCenterX - cardLeft - POINTER_SIZE / 2,
    spacing.lg,
    cardWidth - POINTER_SIZE - spacing.lg,
  )
  const isFinal = stopIndex === totalStops - 1

  return (
    <Reanimated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.zTop, overlayStyle]}
    >
      <Pressable
        onPress={onAdvance}
        accessibilityRole="button"
        accessibilityLabel={isFinal ? 'Finish tour' : 'Continue tour'}
        style={StyleSheet.absoluteFill}
      />
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.pointer,
          { left: cardLeft + pointerLeft, top: cardTop - POINTER_SIZE / 2 },
          captionStyle,
        ]}
      />

      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.calloutAnchor,
          {
            top: cardTop,
            left: cardLeft,
            width: cardWidth,
          },
          captionStyle,
        ]}
      >
        <BlurView intensity={36} tint="dark" style={styles.callout}>
          <View style={styles.calloutHeader}>
            <Text style={styles.stepText}>
              {stopIndex + 1}/{totalStops}
            </Text>
            <View style={styles.dots} accessibilityElementsHidden>
              {Array.from({ length: totalStops }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === stopIndex ? styles.dotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.captionText}>{caption}</Text>
        </BlurView>
      </Reanimated.View>
    </Reanimated.View>
  )
}

const getTargetCenterX = (target: TourTarget, width: number) => {
  if (target === 'logo') return SIDE_CENTER_OFFSET
  if (target === 'settings') return width - SIDE_CENTER_OFFSET
  return width / 2
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const styles = StyleSheet.create({
  zTop: {
    // Above the NuxModal wrapper (zIndex 20) so taps reach this overlay.
    zIndex: 30,
  },
  pointer: {
    position: 'absolute',
    width: POINTER_SIZE,
    height: POINTER_SIZE,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    transform: [{ rotate: '45deg' }],
  },
  calloutAnchor: {
    position: 'absolute',
  },
  callout: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface.panelStrong,
  },
  calloutHeader: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.primary40,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary20,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.text.primary70,
  },
  titleText: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.primary,
    fontWeight: '600',
  },
  captionText: {
    marginTop: spacing.xs,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary70,
  },
})
