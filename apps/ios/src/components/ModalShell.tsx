import type { ReactNode } from 'react'
import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { colors, spacing } from '../design/tokens'

const noop = () => {}

type ModalShellProps = {
  children: ReactNode
  onClose: () => void
  cardPressable?: boolean
  allowBackdropDismiss?: boolean
}

/** Shared modal wrapper with backdrop and centered card layout. */
export function ModalShell({
  children,
  onClose,
  cardPressable = false,
  allowBackdropDismiss = true,
}: ModalShellProps) {
  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      {allowBackdropDismiss ? (
        <Pressable
          onPress={onClose}
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          accessibilityHint="Dismisses this dialog"
        />
      ) : (
        <View style={styles.backdrop} accessible={false} />
      )}
      <View style={styles.center} pointerEvents="box-none">
        {cardPressable ? (
          <Pressable style={styles.card} onPress={noop} accessible={false}>
            {children}
          </Pressable>
        ) : (
          <View style={styles.card}>{children}</View>
        )}
      </View>
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
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
})
