/** Detects iOS Safari, including iPadOS which reports as MacIntel with touch. */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return true
  }
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}
