import { BlurView } from 'expo-blur'
import {
  GlassContainer as NativeGlassContainer,
  GlassView as NativeGlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassContainerProps,
  type GlassStyle,
  type GlassViewProps,
} from 'expo-glass-effect'
import React from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { colors } from '../design/tokens'

export type { GlassStyle } from 'expo-glass-effect'

type GlassSurfaceProps = Omit<GlassViewProps, 'ref'>
type GlassGroupProps = Omit<GlassContainerProps, 'ref'>

let cachedLiquidGlassAvailable: boolean | null = null

const canUseNativeGlass = () => {
  if (cachedLiquidGlassAvailable == null) {
    try {
      cachedLiquidGlassAvailable =
        isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
    } catch {
      cachedLiquidGlassAvailable = false
    }
  }

  return cachedLiquidGlassAvailable
}

const resolveGlassStyle = (
  glassEffectStyle: GlassSurfaceProps['glassEffectStyle'],
): GlassStyle => {
  if (typeof glassEffectStyle === 'object') {
    return glassEffectStyle.style
  }

  return glassEffectStyle ?? 'regular'
}

const getFallbackTone = (glassEffectStyle: GlassSurfaceProps['glassEffectStyle']) => {
  switch (resolveGlassStyle(glassEffectStyle)) {
    case 'clear':
      return {
        blurIntensity: 30,
        backgroundColor: colors.surface.input,
      }
    case 'none':
      return {
        blurIntensity: 0,
        backgroundColor: 'transparent',
      }
    case 'regular':
    default:
      return {
        blurIntensity: 22,
        backgroundColor: colors.surface.panel,
      }
  }
}

const getRadiusStyle = (style: GlassSurfaceProps['style']): ViewStyle | undefined => {
  const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined
  if (!flattenedStyle) {
    return undefined
  }

  return {
    borderRadius: flattenedStyle.borderRadius,
    borderTopLeftRadius: flattenedStyle.borderTopLeftRadius,
    borderTopRightRadius: flattenedStyle.borderTopRightRadius,
    borderBottomLeftRadius: flattenedStyle.borderBottomLeftRadius,
    borderBottomRightRadius: flattenedStyle.borderBottomRightRadius,
  }
}

/** Uses native Liquid Glass when available, with a blur material fallback. */
export function GlassView({
  children,
  glassEffectStyle = 'regular',
  tintColor,
  style,
  ...props
}: GlassSurfaceProps) {
  if (canUseNativeGlass()) {
    return (
      <NativeGlassView
        {...props}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        style={style}
      >
        {children}
      </NativeGlassView>
    )
  }

  const tone = getFallbackTone(glassEffectStyle)
  const radiusStyle = getRadiusStyle(style)

  return (
    <View {...props} style={style}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.fallbackClip,
          radiusStyle,
        ]}
      >
        {tone.blurIntensity > 0 ? (
          <BlurView
            pointerEvents="none"
            intensity={tone.blurIntensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.fallbackTint,
            radiusStyle,
            { backgroundColor: tintColor ?? tone.backgroundColor },
          ]}
        />
      </View>
      {children}
    </View>
  )
}

/** Preserves native glass grouping on iOS 26+ and plain layout grouping below it. */
export function GlassContainer({ children, ...props }: GlassGroupProps) {
  if (canUseNativeGlass()) {
    return <NativeGlassContainer {...props}>{children}</NativeGlassContainer>
  }

  return <View {...props}>{children}</View>
}

const styles = StyleSheet.create({
  fallbackClip: {
    overflow: 'hidden',
  },
  fallbackTint: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
})
