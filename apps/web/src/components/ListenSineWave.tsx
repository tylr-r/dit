import type { ListenWavePlayback } from '@dit/core'
import { getListenToneLevelAtElapsedMs } from '@dit/core'
import { useEffect, useRef, useState } from 'react'

type TintStatus = 'idle' | 'success' | 'error'

type ListenSineWaveProps = {
  playback: ListenWavePlayback | null
  tintStatus?: TintStatus
}

const SAMPLE_POINTS = 80
const TWO_PI = Math.PI * 2
const WAVE_CYCLES = 1.2
const IDLE_ENERGY = 0.12
const BASE_PHASE_SPEED = 0.005
const ACTIVE_PHASE_SPEED_BONUS = 0.015
const MIN_CARRIER_PERIOD_MS = 1400
const CARRIER_PERIOD_UNIT_MULTIPLIER = 18

const SAMPLE_T = Array.from(
  { length: SAMPLE_POINTS + 1 },
  (_, i) => i / SAMPLE_POINTS,
)
const EDGE_WEIGHTS = SAMPLE_T.map((t) => 0.52 + Math.sin(Math.PI * t) * 0.48)
const SPATIAL_PHASES = SAMPLE_T.map((t) => t * WAVE_CYCLES * TWO_PI)

const LINE_SPECS = [
  { strokeWidth: 1.9, phaseOffset: -0.9, amplitudeScale: 0.74, opacity: 0.55 },
  { strokeWidth: 2.8, phaseOffset: 0, amplitudeScale: 1, opacity: 1 },
  { strokeWidth: 1.9, phaseOffset: 0.9, amplitudeScale: 0.74, opacity: 0.55 },
] as const

const LOWER_DIR = [1, -1, 1] as const
const UPPER_DIR = [-1, 1, 1] as const

const buildPath = (
  width: number,
  height: number,
  phase: number,
  energy: number,
  unitMs: number,
  elapsedMs: number,
  amplitudeScale: number,
  phaseOffset: number,
  direction: number,
  invert: boolean,
) => {
  if (width <= 0 || height <= 0) {
    return 'M 0 0'
  }
  const midY = height * 0.5
  const maxAmplitude = height * 0.18
  const idleAmplitude = height * 0.028
  const globalEnergy = 0.24 + energy * 0.76
  const amplitude = (idleAmplitude + maxAmplitude * globalEnergy) * amplitudeScale
  const carrierPeriodMs = Math.max(
    MIN_CARRIER_PERIOD_MS,
    unitMs * CARRIER_PERIOD_UNIT_MULTIPLIER,
  )
  const carrierPhase = (elapsedMs / carrierPeriodMs) * TWO_PI * direction
  const driftPhase = phase * direction * 0.005
  const sign = invert ? -1 : 1

  let path = ''
  for (let i = 0; i < SAMPLE_T.length; i += 1) {
    const x = width * SAMPLE_T[i]
    const travelPhase =
      carrierPhase + SPATIAL_PHASES[i] + phaseOffset + driftPhase
    const y =
      midY + sign * Math.sin(travelPhase) * amplitude * EDGE_WEIGHTS[i]
    path += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return path
}

/** Listen-mode multi-line sine wave that reacts to Morse playback. */
export function ListenSineWave({ playback, tintStatus = 'idle' }: ListenSineWaveProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgLowerRefs = useRef<(SVGPathElement | null)[]>([])
  const svgUpperRefs = useRef<(SVGPathElement | null)[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stateRef = useRef({
    phase: 0,
    energy: IDLE_ENERGY,
    elapsedMs: 0,
    lastFrameMs: 0,
  })
  const playbackRef = useRef<ListenWavePlayback | null>(null)

  useEffect(() => {
    playbackRef.current = playback
    stateRef.current.elapsedMs = 0
  }, [playback])

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(el)
    const rect = el.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let rafId = 0
    const tick = (now: number) => {
      const state = stateRef.current
      const deltaMs = state.lastFrameMs === 0 ? 16 : now - state.lastFrameMs
      state.lastFrameMs = now
      state.elapsedMs += deltaMs

      const pb = playbackRef.current
      const toneLevel = pb
        ? getListenToneLevelAtElapsedMs(
            pb.code,
            pb.unitMs,
            state.elapsedMs,
            pb.interCharacterGapMs,
          )
        : 0
      const targetEnergy = IDLE_ENERGY + toneLevel * (1 - IDLE_ENERGY)
      const attack = 1 - Math.exp(-deltaMs / 62)
      const decay = 1 - Math.exp(-deltaMs / 190)
      const blend = targetEnergy > state.energy ? attack : decay
      state.energy += (targetEnergy - state.energy) * blend

      const phaseSpeed = BASE_PHASE_SPEED + state.energy * ACTIVE_PHASE_SPEED_BONUS
      state.phase = (state.phase + (deltaMs / 1000) * phaseSpeed) % TWO_PI

      const unitMs = pb?.unitMs ?? 40
      const { width, height } = size
      if (width > 0 && height > 0) {
        for (let i = 0; i < LINE_SPECS.length; i += 1) {
          const spec = LINE_SPECS[i]
          const lower = svgLowerRefs.current[i]
          const upper = svgUpperRefs.current[i]
          if (lower) {
            lower.setAttribute(
              'd',
              buildPath(
                width,
                height,
                state.phase + spec.phaseOffset,
                state.energy,
                unitMs,
                state.elapsedMs,
                spec.amplitudeScale,
                spec.phaseOffset,
                LOWER_DIR[i],
                false,
              ),
            )
          }
          if (upper) {
            upper.setAttribute(
              'd',
              buildPath(
                width,
                height,
                state.phase + spec.phaseOffset,
                state.energy,
                unitMs,
                state.elapsedMs,
                spec.amplitudeScale,
                spec.phaseOffset,
                UPPER_DIR[i],
                true,
              ),
            )
          }
        }
      }
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    const capturedState = stateRef.current
    return () => {
      window.cancelAnimationFrame(rafId)
      capturedState.lastFrameMs = 0
    }
  }, [size])

  const stroke =
    tintStatus === 'success'
      ? 'rgb(110, 231, 183)'
      : tintStatus === 'error'
        ? 'rgb(248, 113, 113)'
        : 'rgba(148, 163, 184, 0.85)'

  return (
    <div className={`listen-wave tint-${tintStatus}`} ref={containerRef} aria-hidden="true">
      <svg width="100%" height="100%" preserveAspectRatio="none">
        {LINE_SPECS.map((spec, i) => (
          <path
            key={`upper-${i}`}
            ref={(node) => {
              svgUpperRefs.current[i] = node
            }}
            fill="none"
            stroke={stroke}
            strokeOpacity={spec.opacity}
            strokeWidth={spec.strokeWidth}
            strokeLinecap="round"
          />
        ))}
        {LINE_SPECS.map((spec, i) => (
          <path
            key={`lower-${i}`}
            ref={(node) => {
              svgLowerRefs.current[i] = node
            }}
            fill="none"
            stroke={stroke}
            strokeOpacity={spec.opacity}
            strokeWidth={spec.strokeWidth}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  )
}
