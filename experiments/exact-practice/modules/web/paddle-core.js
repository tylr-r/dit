// core/paddle.mts
var idle = { kind: "idle" };
var createPaddleState = () => ({ held: null, phase: idle, lastId: 0 });
function stepPaddle(state, event, settings) {
  const { phase } = state;
  const unchanged = { state, effects: [], accepted: false };
  const canStart = settings.canStart && Number.isFinite(settings.unitMs) && settings.unitMs > 0;
  const beginTone = (symbol, accepted, effects = []) => {
    const unitMs = settings.unitMs;
    const deadline = {
      id: state.lastId + 1,
      atMs: event.atMs + unitMs * (symbol === "." ? 1 : 3)
    };
    return {
      state: { held: symbol, phase: { kind: "tone", symbol, unitMs, deadline }, lastId: deadline.id },
      effects: [...effects, { type: "toneStart" }, { type: "schedule", ...deadline }],
      accepted
    };
  };
  switch (event.type) {
    case "press":
      if (!canStart)
        return unchanged;
      if (phase.kind === "tone")
        return { state: { ...state, held: event.symbol }, effects: [], accepted: true };
      return beginTone(event.symbol, true, phase.kind === "gap" ? [{ type: "cancelTimer", id: phase.deadline.id }] : []);
    case "release":
      if (state.held !== event.symbol) {
        return phase.kind === "tone" && phase.symbol === event.symbol ? { ...unchanged, accepted: true } : unchanged;
      }
      if (phase.kind === "gap") {
        return {
          state: { ...state, held: null, phase: idle },
          effects: [{ type: "cancelTimer", id: phase.deadline.id }],
          accepted: true
        };
      }
      return { state: { ...state, held: null }, effects: [], accepted: true };
    case "cancel": {
      const effects = [];
      if (phase.kind !== "idle")
        effects.push({ type: "cancelTimer", id: phase.deadline.id });
      if (phase.kind === "tone")
        effects.push({ type: "toneStop" });
      return { state: { ...state, held: null, phase: idle }, effects, accepted: false };
    }
    case "timer": {
      if (phase.kind === "idle" || event.id !== phase.deadline.id)
        return unchanged;
      if (event.atMs < phase.deadline.atMs) {
        return { state, effects: [{ type: "schedule", ...phase.deadline }], accepted: false };
      }
      if (phase.kind === "gap") {
        if (state.held === phase.next && canStart)
          return beginTone(phase.next, false);
        return { state: { ...state, phase: idle }, effects: [], accepted: false };
      }
      const effects = [{ type: "toneStop" }, { type: "symbol", symbol: phase.symbol }];
      if (state.held === null)
        return { state: { ...state, phase: idle }, effects, accepted: false };
      const deadline = { id: state.lastId + 1, atMs: event.atMs + phase.unitMs };
      return {
        state: { ...state, lastId: deadline.id, phase: { kind: "gap", next: state.held, deadline } },
        effects: [...effects, { type: "schedule", ...deadline }],
        accepted: false
      };
    }
  }
}
export {
  createPaddleState,
  stepPaddle
};
