import { useCallback, useEffect, useRef, useState } from 'react';

type UseAudioOptions = {
  toneFrequency: number;
  toneGain: number;
  listenWpm: number;
  useCustomKeyboard: boolean;
  onHaptics: (pattern: number | number[]) => void;
  onTrackEvent?: (name: string, params?: Record<string, unknown>) => void;
};

const createToneNodes = (
  context: AudioContext,
  frequency: number,
  initialGain: number,
) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = initialGain;
  oscillator.connect(gain);
  gain.connect(context.destination);
  return { oscillator, gain };
};

const scheduleToneEnvelope = (
  gain: GainNode,
  toneGain: number,
  startTime: number,
  duration: number,
  rampSeconds: number,
  sustain = true,
) => {
  const endTime = startTime + duration;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(toneGain, startTime + rampSeconds);
  if (sustain) {
    gain.gain.setValueAtTime(toneGain, endTime - rampSeconds);
  }
  gain.gain.linearRampToValueAtTime(0, endTime);
};

export const useAudio = ({
  toneFrequency,
  toneGain,
  listenWpm,
  useCustomKeyboard,
  onHaptics,
  onTrackEvent,
}: UseAudioOptions) => {
  const [soundCheckStatus, setSoundCheckStatus] = useState<'idle' | 'playing'>(
    'idle',
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const listenPlaybackRef = useRef<{
    oscillator: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      await context.resume();
    }
    return context;
  }, []);

  const startTone = useCallback(async () => {
    const context = await ensureAudioContext();
    if (oscillatorRef.current) {
      return;
    }
    const { oscillator, gain } = createToneNodes(
      context,
      toneFrequency,
      toneGain,
    );
    oscillator.start();
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
  }, [ensureAudioContext, toneFrequency, toneGain]);

  const stopTone = useCallback(() => {
    if (!oscillatorRef.current) {
      return;
    }
    oscillatorRef.current.stop();
    oscillatorRef.current.disconnect();
    oscillatorRef.current = null;
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  }, []);

  const stopListenPlayback = useCallback(() => {
    const current = listenPlaybackRef.current;
    if (!current) {
      return;
    }
    try {
      current.oscillator.stop();
    } catch {
      // No-op: oscillator might already be stopped.
    }
    current.oscillator.disconnect();
    current.gain.disconnect();
    listenPlaybackRef.current = null;
  }, []);

  const playListenSequence = useCallback(
    async (code: string) => {
      stopListenPlayback();
      const context = await ensureAudioContext();
      const { oscillator, gain } = createToneNodes(context, toneFrequency, 0);
      listenPlaybackRef.current = { oscillator, gain };

      const unitSeconds = 1.2 / listenWpm;
      const rampSeconds = 0.005;
      let currentTime = context.currentTime + 0.05;
      if (useCustomKeyboard) {
        const unitMs = Math.max(Math.round(unitSeconds * 1000), 40);
        const pattern: number[] = [];
        for (let index = 0; index < code.length; index += 1) {
          const symbol = code[index];
          pattern.push(symbol === '.' ? unitMs : unitMs * 3);
          if (index < code.length - 1) {
            pattern.push(unitMs);
          }
        }
        onHaptics(pattern);
      }

      for (const symbol of code) {
        const duration = symbol === '.' ? unitSeconds : unitSeconds * 3;
        scheduleToneEnvelope(
          gain,
          toneGain,
          currentTime,
          duration,
          rampSeconds,
        );
        currentTime += duration + unitSeconds;
      }

      oscillator.start(context.currentTime);
      oscillator.stop(currentTime + 0.05);
      oscillator.onended = () => {
        if (listenPlaybackRef.current?.oscillator === oscillator) {
          listenPlaybackRef.current = null;
        }
        oscillator.disconnect();
        gain.disconnect();
      };
    },
    [
      ensureAudioContext,
      listenWpm,
      onHaptics,
      stopListenPlayback,
      toneFrequency,
      toneGain,
      useCustomKeyboard,
    ],
  );

  const handleSoundCheck = useCallback(async () => {
    if (soundCheckStatus !== 'idle') {
      return;
    }
    onTrackEvent?.('sound_check');
    setSoundCheckStatus('playing');
    const context = await ensureAudioContext();
    const { oscillator, gain } = createToneNodes(context, toneFrequency, 0);
    const startTime = context.currentTime + 0.02;
    const duration = 0.25;
    scheduleToneEnvelope(gain, toneGain, startTime, duration, 0.02, false);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      setSoundCheckStatus('idle');
    };
    if (useCustomKeyboard) {
      onHaptics([40, 40, 40]);
    }
  }, [
    ensureAudioContext,
    onHaptics,
    onTrackEvent,
    soundCheckStatus,
    toneFrequency,
    toneGain,
    useCustomKeyboard,
  ]);

  useEffect(() => {
    return () => {
      stopListenPlayback();
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopListenPlayback]);

  return {
    handleSoundCheck,
    playListenSequence,
    soundCheckStatus,
    startTone,
    stopListenPlayback,
    stopTone,
  };
};
