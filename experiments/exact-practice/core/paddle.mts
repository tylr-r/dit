export type PaddleSymbol = '.' | '-'

export type PaddleEvent =
  | { type: 'press' | 'release'; symbol: PaddleSymbol; atMs: number }
  | { type: 'timer'; id: number; atMs: number }
  | { type: 'cancel'; atMs: number }

export type PaddleEffect =
  | { type: 'toneStart' | 'toneStop' }
  | { type: 'symbol'; symbol: PaddleSymbol }
  | { type: 'schedule'; id: number; atMs: number }
  | { type: 'cancelTimer'; id: number }

type Deadline = Readonly<{ id: number; atMs: number }>
type Phase =
  | { kind: 'idle' }
  | { kind: 'tone'; symbol: PaddleSymbol; unitMs: number; deadline: Deadline }
  | { kind: 'gap'; next: PaddleSymbol; deadline: Deadline }

export type PaddleState = Readonly<{
  held: PaddleSymbol | null
  phase: Readonly<Phase>
  lastId: number
}>

export type PaddleSettings = Readonly<{ canStart: boolean; unitMs: number }>
export type PaddleResult = { state: PaddleState; effects: readonly PaddleEffect[]; accepted: boolean }

const idle = { kind: 'idle' } as const

export const createPaddleState = (): PaddleState => ({ held: null, phase: idle, lastId: 0 })

/**
 * Advance one input event. Use a monotonic clock for atMs. Schedule effects are
 * one-shot and their IDs must be passed back on delivery; preserve state across
 * cancellation so late callbacks from the same session remain harmless.
 * Only press/release can be accepted; this legacy hint-consumption signal
 * does not imply that effects were emitted. Commit the new state before
 * applying effects in order. A tone's indicator follows toneStart/toneStop.
 * Adapters should serialize dispatch and avoid running stale effects after a
 * reentrant callback (e.g. a symbol handler cancels): guard schedules by the
 * current deadline ID and skip superseded batches with a dispatch generation.
 */
export function stepPaddle(
  state: PaddleState,
  event: PaddleEvent,
  settings: PaddleSettings,
): PaddleResult {
  const { phase } = state
  const unchanged = { state, effects: [], accepted: false }
  const canStart = settings.canStart && Number.isFinite(settings.unitMs) && settings.unitMs > 0

  const beginTone = (symbol: PaddleSymbol, accepted: boolean, effects: PaddleEffect[] = []): PaddleResult => {
    const unitMs = settings.unitMs
    const deadline = {
      id: state.lastId + 1,
      atMs: event.atMs + unitMs * (symbol === '.' ? 1 : 3),
    }
    return {
      state: { held: symbol, phase: { kind: 'tone', symbol, unitMs, deadline }, lastId: deadline.id },
      effects: [...effects, { type: 'toneStart' }, { type: 'schedule', ...deadline }],
      accepted,
    }
  }

  switch (event.type) {
    case 'press':
      if (!canStart) return unchanged
      if (phase.kind === 'tone') return { state: { ...state, held: event.symbol }, effects: [], accepted: true }
      return beginTone(
        event.symbol, true,
        phase.kind === 'gap' ? [{ type: 'cancelTimer', id: phase.deadline.id }] : [],
      )

    case 'release':
      if (state.held !== event.symbol) {
        return phase.kind === 'tone' && phase.symbol === event.symbol
          ? { ...unchanged, accepted: true }
          : unchanged
      }
      if (phase.kind === 'gap') {
        return {
          state: { ...state, held: null, phase: idle },
          effects: [{ type: 'cancelTimer', id: phase.deadline.id }],
          accepted: true,
        }
      }
      return { state: { ...state, held: null }, effects: [], accepted: true }

    case 'cancel': {
      const effects: PaddleEffect[] = []
      if (phase.kind !== 'idle') effects.push({ type: 'cancelTimer', id: phase.deadline.id })
      if (phase.kind === 'tone') effects.push({ type: 'toneStop' })
      return { state: { ...state, held: null, phase: idle }, effects, accepted: false }
    }

    case 'timer': {
      if (phase.kind === 'idle' || event.id !== phase.deadline.id) return unchanged
      if (event.atMs < phase.deadline.atMs) {
        return { state, effects: [{ type: 'schedule', ...phase.deadline }], accepted: false }
      }
      if (phase.kind === 'gap') {
        if (state.held === phase.next && canStart) return beginTone(phase.next, false)
        return { state: { ...state, phase: idle }, effects: [], accepted: false }
      }

      const effects: PaddleEffect[] = [{ type: 'toneStop' }, { type: 'symbol', symbol: phase.symbol }]
      if (state.held === null) return { state: { ...state, phase: idle }, effects, accepted: false }
      // The silence after a tone uses the same unit that shaped that tone.
      // Apply any new unit length at the start of the next pulse.
      const deadline = { id: state.lastId + 1, atMs: event.atMs + phase.unitMs }
      return {
        state: { ...state, lastId: deadline.id, phase: { kind: 'gap', next: state.held, deadline } },
        effects: [...effects, { type: 'schedule', ...deadline }],
        accepted: false,
      }
    }
  }
}
