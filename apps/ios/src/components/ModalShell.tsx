import type { ReactNode } from 'react';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type ModalShellProps = {
  children: ReactNode;
  onClose: () => void;
  cardPressable?: boolean;
};

/** Shared modal wrapper with backdrop and centered card layout. */
export function ModalShell({
  children,
  onClose,
  cardPressable = false,
}: ModalShellProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable onPress={onClose} style={styles.backdrop} />
      <View style={styles.center} pointerEvents="box-none">
        {cardPressable ? (
          <Pressable style={styles.card} onPress={() => {}}>
            {children}
          </Pressable>
        ) : (
          <View style={styles.card}>{children}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 14, 0.72)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
});
