/** Minimum system output volume before NUX sound check can complete. */
export const SOUND_CHECK_MIN_OUTPUT_VOLUME = 0.05

export function isOutputVolumeSufficient(volume: number): boolean {
  return volume >= SOUND_CHECK_MIN_OUTPUT_VOLUME
}
