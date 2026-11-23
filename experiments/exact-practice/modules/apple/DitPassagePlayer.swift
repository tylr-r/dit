import AVFoundation

/// Renders a bounded pair of mono PCM buffers. The player's final buffer
/// includes the trailing Farnsworth gap and reports actual playback completion.
final class DitPassagePlayer: @unchecked Sendable {
    let node = AVAudioPlayerNode()
    let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
    private var intervals: [DitToneInterval] = []
    private var index = 0
    private var frame = 0
    private var frames = 0
    private var pitch = 600.0
    private var amplitude: Float = 0
    private var unitMs = 0.0
    private var generation = 0
    private var finished = false
    private var pausedAt: Double?

    func start(_ plan: [[Double]], pitch: Float, gap: Double, volume: Float, unitMs: Double) -> Bool {
        stop()
        guard let decoded = DitToneInterval.decode(plan), let last = decoded.last,
              decoded.count <= 12000, gap.isFinite, gap > 0, unitMs.isFinite, unitMs > 0,
              last.endMs + gap < 24 * 60 * 60 * 1000, pitch.isFinite, pitch > 0 else { return false }
        intervals = decoded
        self.pitch = Double(pitch)
        amplitude = volume
        self.unitMs = unitMs
        frames = Int(((last.endMs + gap) * format.sampleRate / 1000).rounded())
        guard enqueue() else { stop(); return false }
        if frame < frames && !enqueue() { stop(); return false }
        node.play()
        return true
    }

    private func enqueue() -> Bool {
        let count = min(16000, frames - frame)
        guard count > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: UInt32(count)),
              let samples = buffer.floatChannelData?[0] else { return false }
        let rate = format.sampleRate
        for offset in 0..<count {
            let ms = Double(frame + offset) * 1000 / rate
            while index < intervals.count && ms >= intervals[index].endMs { index += 1 }
            if index < intervals.count && ms >= intervals[index].startMs {
                let span = intervals[index]
                let envelope = min(1, (ms - span.startMs) / 3, (span.endMs - ms) / 3)
                samples[offset] = amplitude * Float(envelope * sin(2 * .pi * pitch * ms / 1000))
            } else { samples[offset] = 0 }
        }
        frame += count
        buffer.frameLength = UInt32(count)
        let last = frame == frames
        let ticket = generation
        // In manual rendering the caller is the output. Only hardware has a
        // downstream playback boundary beyond the final rendered buffer.
        let completion: AVAudioPlayerNodeCompletionCallbackType =
            node.engine?.isInManualRenderingMode == true ? .dataRendered : .dataPlayedBack
        node.scheduleBuffer(buffer, completionCallbackType: last ? completion : .dataConsumed) { [weak self] _ in
            DispatchQueue.main.async { [weak self] in
                guard let self, self.generation == ticket else { return }
                if last { self.finished = true }
                else if self.frame < self.frames && !self.enqueue() { self.stop() }
            }
        }
        return true
    }

    func position() -> Double {
        guard frames > 0 else { return -1 }
        if finished { return -2 }
        if let pausedAt { return pausedAt }
        guard node.isPlaying, node.engine?.isRunning == true else { return -1 }
        return renderedMilliseconds() ?? 0
    }

    private func renderedMilliseconds() -> Double? {
        guard let rendered = node.lastRenderTime, let time = node.playerTime(forNodeTime: rendered),
              time.sampleTime >= 0, time.sampleRate.isFinite, time.sampleRate > 0 else { return nil }
        return Double(time.sampleTime) * 1000 / time.sampleRate
    }

    /// Sample the playback clock. The PCM fill cursor can be two buffers ahead of it.
    func waveLevel() -> Double {
        guard frames > 0, !finished, pausedAt == nil, amplitude > 0, node.isPlaying,
              node.engine?.isRunning == true, let ms = renderedMilliseconds(), ms > 0 else { return 0 }
        var low = 0
        var high = intervals.count
        while low < high {
            let mid = (low + high) / 2
            if intervals[mid].endMs <= ms { low = mid + 1 } else { high = mid }
        }
        guard low < intervals.count, intervals[low].startMs <= ms else { return 0 }
        let duration = intervals[low].endMs - intervals[low].startMs
        // Dit uses one unit for a dit and three for a dah. The waveform receives only energy.
        return duration < 2 * unitMs ? 0.72 : 1
    }

    func control(_ action: String) -> Bool {
        if action == "stop" { stop(); return true }
        guard frames > 0, !finished else { return false }
        if action == "pause", pausedAt == nil {
            let at = position()
            guard at >= 0 else { return false }
            node.pause()
            pausedAt = at
            return true
        }
        if action == "resume", pausedAt != nil, node.engine?.isRunning == true {
            node.play()
            pausedAt = nil
            return true
        }
        return false
    }

    func stop() {
        generation += 1
        if frames > 0 { node.stop() }
        intervals = []
        frame = 0
        frames = 0
        index = 0
        finished = false
        pausedAt = nil
    }
}
