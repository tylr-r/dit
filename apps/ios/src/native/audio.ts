import { Audio } from 'expo-av';
import { AUDIO_VOLUME } from '@dit/core';
import { DitNative } from './ditNative';

const TONE_SOURCE = require('../../assets/audio/dit-tone.wav');

let toneSound: Audio.Sound | null = null;
let loadingPromise: Promise<Audio.Sound> | null = null;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;

const ensureTone = async () => {
  if (toneSound) {
    return toneSound;
  }
  if (loadingPromise) {
    return loadingPromise;
  }
  loadingPromise = (async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
    });
    const { sound } = await Audio.Sound.createAsync(TONE_SOURCE, {
      shouldPlay: false,
      isLooping: true,
      volume: AUDIO_VOLUME,
    });
    toneSound = sound;
    loadingPromise = null;
    return sound;
  })();
  return loadingPromise;
};

export const startTone = async () => {
  if (DitNative?.startTone) {
    await DitNative.startTone();
    return;
  }
  const sound = await ensureTone();
  await sound.setPositionAsync(0);
  await sound.playAsync();
};

export const playTone = async (durationMs: number) => {
  if (DitNative?.playTone) {
    await DitNative.playTone(durationMs);
    return;
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
  if (DitNative?.stopTone) {
    await DitNative.stopTone();
    return;
  }
  if (!toneSound) {
    return;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  await toneSound.stopAsync();
  await toneSound.setPositionAsync(0);
};

export const unloadTone = async () => {
  if (!toneSound) {
    return;
  }
  await toneSound.unloadAsync();
  toneSound = null;
  loadingPromise = null;
};
