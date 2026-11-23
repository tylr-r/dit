#if os(iOS) || DIT_OFFLINE_AUDIO_TEST
@preconcurrency import AVFoundation
import CoreAudio
import os

final class DitSidetone: DitToneOutput, @unchecked Sendable {
    private(set) var passage: DitPassagePlayer?
    private let engine: AVAudioEngine

    init(engine: AVAudioEngine = AVAudioEngine()) {
        self.engine = engine
    }
    private var source: AVAudioSourceNode?
    private var lock = os_unfair_lock_s()
    private var presentation = DitPromptPresentation()
    private var renderRate = 0.0
    private var renderedToneOn = false
    func waveLevel() -> Double {
        os_unfair_lock_lock(&lock)
        let keyed = renderedToneOn
        os_unfair_lock_unlock(&lock)
        return keyed ? 1 : passage?.waveLevel() ?? 0
    }
    private var target: Float = 0
    private var hz: Float = 600
    // Render-thread owned.
    private var phase: Float = 0
    private var amplitude: Float = 0
    private var rampTarget: Float = 0
    private var rampStep: Float = 0
    private var framesLeft = 0

    @discardableResult func warm() -> Bool {
        if engine.isRunning { return true }
        do {
            #if os(iOS)
            let route = AVAudioSession.sharedInstance()
            try route.setCategory(.playback)
            try route.setPreferredIOBufferDuration(0.0029)
            try route.setActive(true)
            #else
            guard engine.isInManualRenderingMode else { return false }
            #endif
            if source == nil {
                let rate = engine.outputNode.outputFormat(forBus: 0).sampleRate
                guard rate.isFinite, rate > 0,
                      let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1) else { return false }
                renderRate = rate
                let node = AVAudioSourceNode { [weak self] _, time, frames, io in
                    let buffers = UnsafeMutableAudioBufferListPointer(io)
                    guard let self else {
                        for buffer in buffers { if let data = buffer.mData { memset(data, 0, Int(buffer.mDataByteSize)) } }
                        return noErr
                    }
                    os_unfair_lock_lock(&self.lock)
                    let (target, hz) = (self.target, self.hz)
                    self.renderedToneOn = target > 0
                    let stamp = time.pointee
                    let valid = stamp.mFlags.contains([.hostTimeValid, .sampleTimeValid])
                    self.presentation.observe(host: valid ? stamp.mHostTime : 0, frame: stamp.mSampleTime, frames: Int(frames))
                    os_unfair_lock_unlock(&self.lock)
                    if target != self.rampTarget {
                        self.rampTarget = target
                        self.framesLeft = max(1, Int(rate * (target > self.amplitude ? 0.004 : 0.002)))
                        self.rampStep = (target - self.amplitude) / Float(self.framesLeft)
                    }
                    let step = 2 * Float.pi * hz / Float(rate)
                    for frame in 0..<Int(frames) {
                        if self.framesLeft > 0 {
                            self.amplitude += self.rampStep
                            self.framesLeft -= 1
                            if self.framesLeft == 0 { self.amplitude = target }
                        }
                        let sample = sin(self.phase) * self.amplitude
                        self.phase += step
                        if self.phase >= 2 * Float.pi { self.phase -= 2 * Float.pi }
                        for buffer in buffers { buffer.mData?.assumingMemoryBound(to: Float.self)[frame] = sample }
                    }
                    return noErr
                }
                engine.attach(node)
                engine.connect(node, to: engine.mainMixerNode, format: format)
                engine.prepare()
                source = node
            }
            try engine.start()
            return true
        } catch { return false }
    }

    func level(_ volume: Float, frequency: Float) {
        os_unfair_lock_lock(&lock)
        presentation = DitPromptPresentation()
        target = volume
        if volume == 0 { renderedToneOn = false }
        hz = frequency
        os_unfair_lock_unlock(&lock)
    }

    func replayLevel(_ volume: Float, frequency: Float, prompt: Int, edge: Int, count: Int) {
        os_unfair_lock_lock(&lock)
        presentation.edge(prompt: prompt, index: edge, count: count)
        target = volume
        hz = frequency
        os_unfair_lock_unlock(&lock)
    }

    func invalidatePresentation() {
        os_unfair_lock_lock(&lock)
        presentation = DitPromptPresentation()
        os_unfair_lock_unlock(&lock)
    }

    func promptTailMs(_ id: Int) -> Double? {
        guard engine.isRunning, let source else { return nil }
        let latencyMs = source.outputPresentationLatency * 1000
        os_unfair_lock_lock(&lock)
        let snapshot = presentation
        let now = mach_absolute_time()
        os_unfair_lock_unlock(&lock)
        func ms(_ ticks: UInt64) -> Double { AVAudioTime.seconds(forHostTime: ticks) * 1000 }
        return snapshot.tailMs(prompt: id, nowMs: ms(now), rate: renderRate,
                               latencyMs: latencyMs, milliseconds: ms)
    }

    func startPassage(_ plan: [[Double]], pitch: Float, gap: Double, volume: Float, unitMs: Double) -> Bool {
        guard warm() else { return false }
        if passage == nil {
            let player = DitPassagePlayer()
            engine.attach(player.node)
            engine.connect(player.node, to: engine.mainMixerNode, format: player.format)
            passage = player
        }
        return passage?.start(plan, pitch: pitch, gap: gap, volume: volume, unitMs: unitMs) == true
    }

    func shutdown() {
        passage?.stop()
        level(0, frequency: 600)
        engine.stop()
        // Do not deactivate the shared session: Exact may be playing replay audio.
    }
}
#endif
