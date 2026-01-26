import {
    createAudioPlayer,
    setAudioModeAsync,
    setIsAudioActiveAsync,
} from 'expo-audio';
import { TONE_SOURCE, TONE_VOLUME } from '../constants';

export async function playMorseTone({
  code,
  wpm = 20,
  volume = TONE_VOLUME,
}: {
  code: string;
  wpm?: number;
  volume?: number;
}) {
  // Calculate unit time based on WPM
  const unitMs = Math.max(Math.round(1200 / wpm), 40);
  const player = createAudioPlayer(TONE_SOURCE, {
    keepAudioSessionActive: true,
    updateInterval: 250,
    downloadFirst: true,
  });
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  });
  await setIsAudioActiveAsync(true);
  // No player.load() in expo-audio API
  player.loop = true;
  player.volume = Math.min(1, Math.max(0.4, volume));
  player.muted = false;
  player.play();

  let currentMs = 0;
  for (const symbol of code) {
    const duration = symbol === '.' ? unitMs : unitMs * 3;
    setTimeout(() => {
      player.muted = false;
      if (!player.playing) player.play();
    }, currentMs);
    setTimeout(() => {
      player.muted = true;
    }, currentMs + duration);
    currentMs += duration + unitMs;
  }
  setTimeout(() => {
    player.pause();
    player.remove();
  }, currentMs + 20);
}
