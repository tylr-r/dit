import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { AUDIO_VOLUME } from '@dit/core';
import toneSource from '../../assets/audio/dit-tone.wav';
import { DitNative } from 'dit-native';

const TONE_SOURCE = toneSource;

let tonePlayer: AudioPlayer | null = null;
let loadingPromise: Promise<AudioPlayer> | null = null;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let useNativeTone = Boolean(DitNative?.startTone);

const waitForPlayerLoad = async (player: AudioPlayer) => {
  const start = Date.now();
  while (!player.isLoaded && Date.now() - start < 1500) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const ensureTone = async () => {
  if (tonePlayer) {
    return tonePlayer;
  }
  if (loadingPromise) {
    return loadingPromise;
  }
  loadingPromise = (async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
      await setIsAudioActiveAsync(true);
      const player = createAudioPlayer(TONE_SOURCE, {
        updateInterval: 250,
        downloadFirst: true,
        keepAudioSessionActive: true,
      });
      await waitForPlayerLoad(player);
      player.loop = true;
      player.volume = AUDIO_VOLUME;
      player.muted = true;
      player.play();
      tonePlayer = player;
      return player;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
};

export const startTone = async () => {
  if (useNativeTone && DitNative?.startTone) {
    try {
      await DitNative.startTone();
      return;
    } catch (error) {
      console.warn('DitNative startTone failed, using fallback.', error);
      useNativeTone = false;
    }
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  if (tonePlayer) {
    tonePlayer.muted = false;
    if (!tonePlayer.playing) {
      tonePlayer.play();
    }
    return;
  }
  const player = await ensureTone();
  await waitForPlayerLoad(player);
  player.muted = false;
};

export const playTone = async (durationMs: number) => {
  if (useNativeTone && DitNative?.playTone) {
    try {
      await DitNative.playTone(durationMs);
      return;
    } catch (error) {
      console.warn('DitNative playTone failed, using fallback.', error);
      useNativeTone = false;
    }
  }
  await startTone();
  if (stopTimeout) {
    clearTimeout(stopTimeout);
  }
  stopTimeout = setTimeout(() => {
    void stopTone();
  }, durationMs);
};

export const stopTone = async () => {
  if (useNativeTone && DitNative?.stopTone) {
    try {
      await DitNative.stopTone();
      return;
    } catch (error) {
      console.warn('DitNative stopTone failed, using fallback.', error);
      useNativeTone = false;
    }
  }
  if (!tonePlayer) {
    return;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  tonePlayer.muted = true;
};

export const unloadTone = async () => {
  if (!tonePlayer) {
    return;
  }
  tonePlayer.pause();
  tonePlayer.remove();
  tonePlayer = null;
  loadingPromise = null;
};
