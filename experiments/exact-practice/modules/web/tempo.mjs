import { getAutoEffectiveWpm, getFarnsworthUnitMs, getListenUnitMs, normalizeListenSpeeds } from './listen-speed.generated.mjs'

const MIN_UNIT_MS = 40
const int = (value, fallback) => Number.isSafeInteger(value) ? value : fallback
export function normalizeTempo(value) {
  const initialSpeed = int(value.speed,12)
  const autoTighten = typeof value.autoTighten === 'boolean' ? value.autoTighten : true
  const autoCorrect = Math.max(0,Math.min(1_000_000_000,int(value.autoCorrect,0)))
  const {characterWpm:speed,effectiveWpm:effectiveSpeed} = normalizeListenSpeeds(
    initialSpeed, int(value.effectiveSpeed,initialSpeed-4),
  )
  return {
    speed,
    effectiveSpeed: autoTighten ? getAutoEffectiveWpm(speed,autoCorrect) : effectiveSpeed,
    autoTighten,
    autoCorrect,
  }
}

/** Transition only the tempo fields; preserve other durable preferences. */
export function tempoStep(settings, command) {
  if (command === 'toggle-auto-tighten') {
    const autoTighten = !settings.autoTighten
    return { ...settings, autoTighten,
      effectiveSpeed:autoTighten ? getAutoEffectiveWpm(settings.speed,settings.autoCorrect) : settings.effectiveSpeed }
  }
  if (command === 'auto-correct') {
    if (!settings.autoTighten) return settings
    const autoCorrect = Math.min(1_000_000_000,settings.autoCorrect+1)
    if (autoCorrect===settings.autoCorrect) return settings
    return { ...settings, autoCorrect, effectiveSpeed:getAutoEffectiveWpm(settings.speed,autoCorrect) }
  }
  const changes = {
    'speed-up':[1,0], 'speed-down':[-1,0], 'effective-up':[0,1], 'effective-down':[0,-1],
  }
  if (!Object.hasOwn(changes,command)) return settings
  const [character,effective] = changes[command]
  const {characterWpm:speed,effectiveWpm:effectiveSpeed} = normalizeListenSpeeds(
    settings.speed+character, settings.effectiveSpeed+effective,
  )
  if (speed===settings.speed && effectiveSpeed===settings.effectiveSpeed) return settings
  return { ...settings, speed, effectiveSpeed, autoTighten:false }
}

export const characterUnitMs = speed => getListenUnitMs(speed,MIN_UNIT_MS)
export function tempoTiming(speed,effective) {
  const {characterWpm,effectiveWpm} = normalizeListenSpeeds(speed,effective)
  const unitMs = characterUnitMs(characterWpm)
  const spacing = getFarnsworthUnitMs(characterWpm,effectiveWpm,MIN_UNIT_MS)
  return {unitMs,characterGapMs:3*spacing,wordGapMs:7*spacing}
}
