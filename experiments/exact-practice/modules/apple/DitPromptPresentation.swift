import Foundation

/// Render-thread observations for one Listen replay. Sidetone holds its existing
/// gain lock while updating this value, so the edge and its samples agree.
struct DitPromptPresentation {
    private var prompt = 0
    private var edgeCount = 0
    private var requested = -1
    private var rendered = -1
    private var onset: UInt64 = 0
    private var release: UInt64 = 0
    private var latest: UInt64 = 0
    private var nextFrame = 0.0
    private var framesInBuffer = 0

    mutating func edge(prompt id: Int, index: Int, count: Int) {
        if index == 0 {
            self = Self()
            prompt = id
            edgeCount = count
        }
        guard id > 0, prompt == id, count == edgeCount, count >= 2,
              index == requested + 1, index < count, requested == rendered else {
            self = Self() // The renderer missed an edge; later edges cannot recover this prompt.
            return
        }
        requested = index
    }

    mutating func observe(host: UInt64, frame: Double, frames: Int) {
        guard prompt > 0 else { return }
        guard host > 0, frame.isFinite, frames > 0,
              latest == 0 || (host > latest && frame == nextFrame) else {
            self = Self()
            return
        }
        latest = host
        nextFrame = frame + Double(frames)
        framesInBuffer = frames
        guard requested != rendered else { return }
        rendered = requested
        if rendered == 0 { onset = host }
        if rendered == edgeCount - 1 { release = host }
    }

    /// Milliseconds since the final release edge, or zero while the character
    /// is being presented. Never extrapolate beyond the observed render stream.
    func tailMs(prompt id: Int, nowMs: Double, rate: Double, latencyMs: Double,
                milliseconds: (UInt64) -> Double) -> Double? {
        guard id > 0, id == prompt, onset > 0, rate.isFinite, rate > 0,
              latencyMs.isFinite, latencyMs >= 0, nowMs.isFinite else { return nil }
        let renderedAt = nowMs - latencyMs
        guard renderedAt >= milliseconds(onset),
              renderedAt <= milliseconds(latest) + Double(framesInBuffer) * 1000 / rate else { return nil }
        return release == 0 ? 0 : max(0, renderedAt - milliseconds(release))
    }
}
