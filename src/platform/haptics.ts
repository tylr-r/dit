export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  if (typeof navigator.vibrate !== 'function') {
    return false;
  }
  return navigator.vibrate(pattern);
};
