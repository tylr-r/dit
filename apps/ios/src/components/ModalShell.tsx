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
    <View style={styles.overlay} pointerEvents="box-none">
      {allowBackdropDismiss ? (
        <Pressable onPress={onClose} style={styles.backdrop} />
      ) : (
        <View style={styles.backdrop} />
      )}
      <View style={styles.center} pointerEvents="box-none">
        {cardPressable ? (
          <Pressable style={styles.card} onPress={noop}>
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.backdrop,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
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
