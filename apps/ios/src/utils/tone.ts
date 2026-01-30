import { requireNativeModule } from 'expo-modules-core';
import { AUDIO_FREQUENCY, AUDIO_VOLUME } from '@dit/core';

const DitNative = requireNativeModule('DitNative');

type ToneDefaults = {
  frequency?: number;
  volume?: number;
};

const clampVolume = (value: number) => Math.min(1, Math.max(0.4, value));

export async function prepareToneEngine() {
  return DitNative.prepareToneEngine();
}

export async function startTone({ frequency, volume }: ToneDefaults = {}) {
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME);
  return DitNative.startTone(
    frequency ?? AUDIO_FREQUENCY,
    resolvedVolume,
  );
}

export async function stopTone() {
  return DitNative.stopTone();
}

export async function playMorseTone({
  code,
  wpm = 20,
  minUnitMs = 40,
  frequency,
  volume,
}: {
  code: string;
  wpm?: number;
  minUnitMs?: number;
  frequency?: number;
  volume?: number;
}) {
  const unitMs = Math.max(Math.round(1200 / wpm), minUnitMs);
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME);
  return DitNative.playMorseSequence(
    code,
    unitMs,
    frequency ?? AUDIO_FREQUENCY,
    resolvedVolume,
  );
}

export async function stopMorseTone() {
  return DitNative.stopMorseSequence();
}
