import { MaterialIcons } from '@expo/vector-icons'
import {
  MORSE_BUTTON_A11Y_LABEL,
  MORSE_BUTTON_HEIGHT,
  MORSE_BUTTON_MAX_WIDTH,
  MORSE_BUTTON_RADIUS,
  TAP_HINT_ICON_COLOR,
  TAP_HINT_ICON_SIZE,
  TAP_HINT_PULSE_MS,
} from '@dit/core'
import { GlassView } from 'expo-glass-effect'
import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'

type MorseButtonProps = {
  disabled?: boolean
  isPressing: boolean
  onPressIn: () => void
  onPressOut: () => void
  showTapHint?: boolean
}

/** Tap/press input button for dot/dah entry. */
export function MorseButton({
  disabled = false,
  isPressing,
  onPressIn,
  onPressOut,
  showTapHint = false,
}: MorseButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!showTapHint) {
      pulseAnim.setValue(1)
      return
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: TAP_HINT_PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: TAP_HINT_PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [showTapHint, pulseAnim])

  return (
    <Pressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel={MORSE_BUTTON_A11Y_LABEL}
      style={styles.morsePressable}
    >
      {({ pressed }) => {
        const isActive = !disabled && (pressed || isPressing)
        return (
          <GlassView
            glassEffectStyle="clear"
            style={[
              styles.morseWrap,
              isActive && styles.morseWrapPressed,
              disabled && styles.morseWrapDisabled,
              { borderRadius: MORSE_BUTTON_RADIUS },
            ]}
          >
            {showTapHint && !isActive ? (
              <Animated.View style={[styles.tapHint, { opacity: pulseAnim }]}>
                <MaterialIcons
                  name="fingerprint"
                  size={TAP_HINT_ICON_SIZE}
                  color={TAP_HINT_ICON_COLOR}
                />
              </Animated.View>
            ) : null}
          </GlassView>
        )
      }}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  morsePressable: {
    width: '100%',
    maxWidth: MORSE_BUTTON_MAX_WIDTH,
    alignSelf: 'center',
  },
  morseWrap: {
    width: '100%',
    height: MORSE_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1 }],
  },
  morseWrapPressed: {
    transform: [{ scale: 0.98 }],
  },
  morseWrapDisabled: {
    opacity: 0.6,
  },
  tapHint: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
