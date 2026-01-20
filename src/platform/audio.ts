type AudioContextConstructor = typeof AudioContext;

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  if ('AudioContext' in window && window.AudioContext) {
    return window.AudioContext;
  }
  if ('webkitAudioContext' in window) {
    return (
      (
        window as Window & {
          webkitAudioContext?: AudioContextConstructor;
        }
      ).webkitAudioContext ?? null
    );
  }
  return null;
};

export const createAudioContext = (): AudioContext | null => {
  const constructor = getAudioContextConstructor();
  if (!constructor) {
    return null;
  }
  return new constructor();
};
