import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent } from 'react';

type UseMorseInputOptions = {
  dotThresholdMs: number;
  canStartPress: () => boolean;
  enableGlobalKeyboard: boolean;
  isGlobalShortcutBlocked: () => boolean;
  onCancel?: () => void;
  onPressEnd?: () => void;
  onPressStart?: () => void;
  onSymbol: (symbol: '.' | '-') => void;
};

export const useMorseInput = ({
  dotThresholdMs,
  canStartPress,
  enableGlobalKeyboard,
  isGlobalShortcutBlocked,
  onCancel,
  onPressEnd,
  onPressStart,
  onSymbol,
}: UseMorseInputOptions) => {
  const [isPressing, setIsPressing] = useState(false);
  const pressStartRef = useRef<number | null>(null);

  const beginPress = useCallback(() => {
    if (pressStartRef.current !== null) {
      return false;
    }
    if (!canStartPress()) {
      return false;
    }
    pressStartRef.current = performance.now();
    setIsPressing(true);
    onPressStart?.();
    return true;
  }, [canStartPress, onPressStart]);

  const releasePress = useCallback(
    (register: boolean) => {
      setIsPressing(false);
      const start = pressStartRef.current;
      pressStartRef.current = null;
      onPressEnd?.();
      if (!register || start === null) {
        return;
      }
      const duration = performance.now() - start;
      onSymbol(duration < dotThresholdMs ? '.' : '-');
    },
    [dotThresholdMs, onPressEnd, onSymbol],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      if (!beginPress()) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginPress],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (pressStartRef.current === null) {
        return;
      }
      releasePress(true);
    },
    [releasePress],
  );

  const handlePointerCancel = useCallback(() => {
    if (pressStartRef.current === null) {
      return;
    }
    releasePress(false);
    onCancel?.();
  }, [onCancel, releasePress]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) {
        return;
      }
      if (event.key !== ' ' && event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      beginPress();
    },
    [beginPress],
  );

  const handleKeyUp = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== ' ' && event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      if (pressStartRef.current === null) {
        return;
      }
      releasePress(true);
    },
    [releasePress],
  );

  useEffect(() => {
    if (!enableGlobalKeyboard) {
      return;
    }
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isGlobalShortcutBlocked()) {
        return;
      }
      if (event.repeat) {
        return;
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      beginPress();
    };

    const handleGlobalKeyUp = (event: globalThis.KeyboardEvent) => {
      if (isGlobalShortcutBlocked()) {
        return;
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      if (pressStartRef.current === null) {
        return;
      }
      releasePress(true);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [beginPress, enableGlobalKeyboard, isGlobalShortcutBlocked, releasePress]);

  return {
    handleKeyDown,
    handleKeyUp,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp,
    isPressing,
  };
};
