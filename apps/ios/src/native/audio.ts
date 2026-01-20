import { AudioModule, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AUDIO_VOLUME } from '@dit/core';
import { DitNative } from './ditNative';

const TONE_SOURCE = require('../../assets/audio/dit-tone.wav');

let tonePlayer: AudioPlayer | null = null;
let loadingPromise: Promise<AudioPlayer> | null = null;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;

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
      const player = new AudioModule.AudioPlayer(TONE_SOURCE, 500, false);
      player.loop = true;
      player.volume = AUDIO_VOLUME;
      tonePlayer = player;
      return player;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
};

export const startTone = async () => {
  if (DitNative?.startTone) {
    await DitNative.startTone();
    return;
  }
  const player = await ensureTone();
  await player.seekTo(0);
  player.play();
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
  if (!tonePlayer) {
    return;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  tonePlayer.pause();
  await tonePlayer.seekTo(0);
};

export const unloadTone = async () => {
  if (!tonePlayer) {
    return;
  }
  tonePlayer.pause();
  tonePlayer.release();
  tonePlayer = null;
  loadingPromise = null;
};
