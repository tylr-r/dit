import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import { useCallback, useMemo, useRef } from 'react';
import { TONE_SOURCE, TONE_VOLUME } from '../constants';

export function useTonePlayer() {
  const tonePlayer = useMemo(
    () =>
      createAudioPlayer(TONE_SOURCE, {
        keepAudioSessionActive: true,
        updateInterval: 250,
        downloadFirst: true,
      }),
    [],
  );
  const toneReadyRef = useRef(false);
  const toneLoadingRef = useRef<Promise<any> | null>(null);
  const toneUnloadTimeoutRef = useRef<any>(null);

  const unloadTonePlayer = useCallback(() => {
    if (!toneReadyRef.current) return;
    tonePlayer.pause();
    tonePlayer.remove();
    toneReadyRef.current = false;
    toneLoadingRef.current = null;
  }, [tonePlayer]);

  const scheduleToneUnload = useCallback(() => {
    if (toneUnloadTimeoutRef.current)
      clearTimeout(toneUnloadTimeoutRef.current);
    toneUnloadTimeoutRef.current = setTimeout(() => {
      unloadTonePlayer();
    }, 4000);
  }, [unloadTonePlayer]);

  // Inline waitForPlayerLoad from App.tsx
  const waitForPlayerLoad = async (player: any) => {
    const start = Date.now();
    while (!player.isLoaded && Date.now() - start < 1500) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  const prepareTonePlayer = useCallback(async () => {
    if (toneReadyRef.current) return tonePlayer;
    if (toneLoadingRef.current) return toneLoadingRef.current;
    toneLoadingRef.current = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });
        await setIsAudioActiveAsync(true);
        await waitForPlayerLoad(tonePlayer);
        tonePlayer.loop = true;
        tonePlayer.volume = Math.min(1, Math.max(0.4, TONE_VOLUME));
        tonePlayer.muted = true;
        tonePlayer.play();
        toneReadyRef.current = true;
        return tonePlayer;
      } finally {
        toneLoadingRef.current = null;
      }
    })();
    return toneLoadingRef.current;
  }, [tonePlayer]);

  const stopTonePlayback = useCallback(() => {
    if (!toneReadyRef.current) return;
    tonePlayer.muted = true;
    scheduleToneUnload();
  }, [scheduleToneUnload, tonePlayer]);

  const startTonePlayback = useCallback(async () => {
    if (toneUnloadTimeoutRef.current)
      clearTimeout(toneUnloadTimeoutRef.current);
    const player = await prepareTonePlayer();
    if (!player) return;
    player.muted = false;
    if (!player.playing) player.play();
  }, [prepareTonePlayer]);

  return {
    startTonePlayback,
    stopTonePlayback,
    unloadTonePlayer,
    tonePlayer,
  };
}
