import AVFoundation
import Foundation

@main
struct PassageWaveCheck {
    static func main() throws {
        let engine = AVAudioEngine()
        let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
        try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 160)
        let audio = DitSidetone(engine: engine)
        guard audio.warm() else { fatalError("offline audio graph failed to start") }
        defer { audio.shutdown() }
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 160)!
        var failures = 0
        func sample(_ label: String, blocks: Int, audible: Bool, expectedLevel: Double) throws {
            var peak: Float = 0
            for _ in 0..<blocks {
                guard try engine.renderOffline(160, to: buffer) == .success else { fatalError("render failed") }
                peak = UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength)).map(abs).max()!
                RunLoop.main.run(until: Date().addingTimeInterval(0.001))
            }
            let level = audio.waveLevel()
            let ok = (audible ? peak > 0.25 : peak < 0.001) && abs(level - expectedLevel) < 0.00001
            print("\(ok ? "PASS" : "FAIL") \(label): peak=\(peak), meter=\(level), expected=\(expectedLevel)")
            if !ok { failures += 1 }
        }
        // E, then T. At 16 kHz each ten-millisecond block is 160 PCM frames.
        guard audio.startPassage([[0,100],[220,520]], pitch: 600, gap: 240, volume: 0.75, unitMs: 100) else { fatalError("passage failed") }
        try sample("dit", blocks: 4, audible: true, expectedLevel: 0.72)
        try sample("between characters", blocks: 12, audible: false, expectedLevel: 0)
        try sample("dah", blocks: 14, audible: true, expectedLevel: 1)
        guard audio.passage?.control("pause") == true else { fatalError("pause failed") }
        let frozen = audio.passage!.position()
        try sample("paused mid-dah", blocks: 15, audible: false, expectedLevel: 0)
        precondition(frozen == audio.passage!.position())
        guard audio.passage?.control("resume") == true else { fatalError("resume failed") }
        try sample("resumed dah", blocks: 5, audible: true, expectedLevel: 1)
        try sample("trailing gap", blocks: 24, audible: false, expectedLevel: 0)
        try sample("completed", blocks: 25, audible: false, expectedLevel: 0)
        precondition(audio.passage!.position() == -2)
        audio.level(0.75, frequency: 640)
        try sample("manual down", blocks: 4, audible: true, expectedLevel: 1)
        audio.level(0, frequency: 640)
        try sample("manual up", blocks: 4, audible: false, expectedLevel: 0)
        // At 30 WPM a dah is 120 ms. This run crosses the first queued PCM buffer.
        guard audio.startPassage([[60,180],[1100,1140]], pitch: 640, gap: 120, volume: 0.75, unitMs: 40)
        else { fatalError("second passage failed") }
        try sample("new passage leading silence", blocks: 2, audible: false, expectedLevel: 0)
        try sample("fast dah", blocks: 9, audible: true, expectedLevel: 1)
        try sample("silent second buffer", blocks: 95, audible: false, expectedLevel: 0)
        try sample("fast dit after buffer boundary", blocks: 6, audible: true, expectedLevel: 0.72)
        precondition(audio.passage!.control("stop"))
        try sample("stopped mid-dit", blocks: 3, audible: false, expectedLevel: 0)
        // The display callback samples the meter, then this envelope drives the path amplitude.
        guard audio.startPassage([[0,100],[300,600]], pitch: 600, gap: 300, volume: 0.75, unitMs: 100)
        else { fatalError("envelope passage failed") }
        var envelope = DitWaveEnvelope()
        try sample("renderer dit input", blocks: 5, audible: true, expectedLevel: 0.72)
        envelope.advance(level: audio.waveLevel(), seconds: 0.062)
        let attack = envelope.energy
        try sample("renderer silence input", blocks: 10, audible: false, expectedLevel: 0)
        envelope.advance(level: audio.waveLevel(), seconds: 0.190)
        let decay = envelope.energy
        let expectedAttack = 0.12 + 0.72 * 0.88 * (1 - exp(-1.0))
        let expectedDecay = 0.12 + (expectedAttack - 0.12) * exp(-1.0)
        precondition(abs(attack - expectedAttack) < 0.000001 && abs(decay - expectedDecay) < 0.000001)
        print("PASS display energy sampled from passage: idle=0.12, dit=\(attack), gap=\(decay)")
        if failures > 0 { exit(1) }
    }
}
