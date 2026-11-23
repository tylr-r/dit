import Foundation

protocol DitToneOutput: AnyObject {
    @discardableResult func warm() -> Bool
    func level(_ volume: Float, frequency: Float)
    func replayLevel(_ volume: Float, frequency: Float, prompt: Int, edge: Int, count: Int)
}

/// The Apple key instrument shares one interval plan between audio and haptics.
/// Clock values are milliseconds. The UI adapter supplies the Exact host clock.
final class DitKeySignal {
    typealias Schedule = (Double, @escaping () -> Void) -> () -> Void
    private let now: () -> Double
    private let after: Schedule
    private let audio: DitToneOutput
    private let motor: DitHapticDriver?
    private let onActive: (Bool) -> Void
    private let onSymbol: (String) -> Void
    private let onSequence: (String) -> Void
    var blocked = true
    var unit = 100.0
    var frequency: Float = 600
    var volume: Float = 0.75
    private var destroyed = false
    private var suspended = false
    private var hapticsEnabled = false
    private var heldPlayer: DitHapticPlayer?
    private var replayPlayer: DitHapticPlayer?
    private var replay: [() -> Void] = []
    private var replayGeneration: UInt = 0
    private var straightAt: Double?
    private var toneActive = false
    private var paddleHeld: String?
    private var paddleTone: String?
    private var heldKeys: Set<String> = []
    private var sequence = ""
    private var pulseGeneration: UInt = 0
    private var submitGeneration: UInt = 0
    private var pulse: (() -> Void)?
    private var submit: (() -> Void)?

    init(now: @escaping () -> Double, after: @escaping Schedule, audio: DitToneOutput,
         motor: DitHapticDriver?, onActive: @escaping (Bool) -> Void,
         onSymbol: @escaping (String) -> Void, onSequence: @escaping (String) -> Void) {
        self.now = now
        self.after = after
        self.audio = audio
        self.motor = motor
        self.onActive = onActive
        self.onSymbol = onSymbol
        self.onSequence = onSequence
    }

    func setSuspended(_ value: Bool) {
        guard suspended != value else { return }
        suspended = value
        if suspended {
            cancel()
            stopReplay()
        }
    }

    func setHaptics(_ enabled: Bool) {
        guard hapticsEnabled != enabled else { return }
        hapticsEnabled = enabled
        if !enabled {
            heldPlayer?.stop()
            heldPlayer = nil
            replayPlayer?.stop()
            replayPlayer = nil
        }
    }

    func stopReplay() {
        replayGeneration &+= 1
        replayPlayer?.stop()
        replayPlayer = nil
        guard !replay.isEmpty else { return }
        replay.forEach { $0() }
        replay.removeAll()
        audio.level(0, frequency: frequency)
    }

    // Finite passages are rendered by AVAudioPlayerNode. Prepare the motor first
    // so creating a Core Haptics pattern cannot delay it behind the first tone.
    func playPassage(_ plan: [[Double]], startAudio: () -> Bool) -> Bool {
        stopReplay()
        guard !destroyed, !suspended, plan.count <= 12000,
              let intervals = DitToneInterval.decode(plan) else { return false }
        cancel()
        let player = hapticsEnabled ? motor?.prepare(.playback(intervals)) : nil
        guard startAudio() else { return false }
        replayPlayer = player
        player?.start()
        return true
    }

    func controlPassage(_ action: String, controlAudio: () -> Bool) -> Bool {
        let changed = controlAudio()
        guard changed || action == "stop" else { return false }
        if action == "stop" {
            replayPlayer?.stop()
            replayPlayer = nil
        } else if action == "pause" {
            replayPlayer?.pause()
        } else if action == "resume" {
            replayPlayer?.resume()
        }
        return changed
    }

    func play(_ plan: [[Double]], pitch: Float, prompt: Int = 0) -> Bool {
        stopReplay()
        guard !destroyed, !suspended, let intervals = DitToneInterval.decode(plan), audio.warm() else { return false }
        cancel()
        let amplitude = volume
        replayPlayer = hapticsEnabled ? motor?.prepare(.playback(intervals)) : nil
        let start = now()
        let ticket = replayGeneration
        func edge(at offset: Double, _ work: @escaping () -> Void) {
            replay.append(after(max(0, start + offset - now())) { [weak self] in
                guard let self, !self.destroyed, ticket == self.replayGeneration else { return }
                work()
            })
        }
        let count = intervals.count * 2
        let output = audio
        func gain(_ value: Float, edge: Int) {
            output.replayLevel(value, frequency: pitch, prompt: amplitude > 0 ? prompt : 0, edge: edge, count: count)
        }
        if intervals[0].startMs == 0 { gain(amplitude, edge: 0) }
        replayPlayer?.start()
        for (i, interval) in intervals.enumerated() {
            if interval.startMs > 0 {
                edge(at: interval.startMs) { gain(amplitude, edge: i * 2) }
            }
            edge(at: interval.endMs) { gain(0, edge: i * 2 + 1) }
        }
        return true
    }

    @discardableResult private func setTone(_ active: Bool) -> Double {
        guard toneActive != active else { return now() }
        toneActive = active
        if active { stopReplay() }
        let audible = active && audio.warm()
        let onset = now()
        audio.level(audible ? volume : 0, frequency: frequency)
        if audible && hapticsEnabled {
            heldPlayer = motor?.prepare(.held)
            heldPlayer?.start()
        } else if !active {
            heldPlayer?.stop()
            heldPlayer = nil
        }
        if !destroyed { onActive(active) }
        return onset
    }

    func key(_ symbol: String, down: Bool) -> Bool {
        guard !blocked, !destroyed, !suspended else { return false }
        if down {
            if heldKeys.contains(symbol) { return true }
            if symbol == "straight" {
                guard paddleTone == nil, paddleHeld == nil else { return false }
                heldKeys.insert(symbol)
                disarmSubmit()
                straightAt = now()
                setTone(true)
            } else {
                guard straightAt == nil else { return false }
                heldKeys.insert(symbol)
                disarmSubmit()
                paddleHeld = symbol
                if paddleTone == nil { beginPulse(symbol) }
            }
        } else {
            guard heldKeys.remove(symbol) != nil else { return false }
            if symbol == "straight", let started = straightAt {
                straightAt = nil
                setTone(false)
                collect(now() - started < 200 ? "." : "-")
                armSubmit()
            } else if paddleHeld == symbol {
                paddleHeld = nil
                if paddleTone == nil { clearPulse(); armSubmit() }
            }
        }
        return true
    }

    private func beginPulse(_ symbol: String) {
        guard !blocked, !destroyed, paddleHeld == symbol else { return }
        clearPulse()
        paddleTone = symbol
        let pulseUnit = unit
        let generation = pulseGeneration
        let onset = setTone(true)
        guard !blocked, !destroyed, pulseGeneration == generation, paddleTone == symbol else { return }
        armPulse(delay: max(0, onset + pulseUnit * (symbol == "." ? 1 : 3) - now())) { [weak self] in
            guard let self, self.paddleTone == symbol else { return }
            self.paddleTone = nil
            self.setTone(false)
            guard !self.blocked, !self.destroyed else { return }
            self.collect(symbol)
            guard !self.blocked, !self.destroyed else { return }
            if let next = self.paddleHeld {
                self.armPulse(delay: pulseUnit) { [weak self] in self?.beginPulse(next) }
            } else { self.armSubmit() }
        }
    }

    private func collect(_ symbol: String) {
        guard !blocked, !destroyed else { return }
        sequence.append(symbol)
        onSymbol(symbol)
    }

    private func clearPulse() {
        pulseGeneration &+= 1
        pulse?()
        pulse = nil
    }

    private func armPulse(delay: Double, _ work: @escaping () -> Void) {
        clearPulse()
        let tick = pulseGeneration
        pulse = after(delay) { [weak self] in
            guard let self, !self.destroyed, !self.blocked, self.pulseGeneration == tick else { return }
            self.pulse = nil
            work()
        }
    }

    private func disarmSubmit() {
        submitGeneration &+= 1
        submit?()
        submit = nil
    }

    private func armSubmit() {
        disarmSubmit()
        guard !sequence.isEmpty else { return }
        let tick = submitGeneration
        submit = after(200) { [weak self] in
            guard let self, !self.destroyed, !self.blocked, self.submitGeneration == tick,
                  self.straightAt == nil, self.paddleTone == nil, self.paddleHeld == nil else { return }
            self.submit = nil
            let output = self.sequence
            self.sequence = ""
            self.onSequence(output)
        }
    }

    func cancel() {
        clearPulse()
        disarmSubmit()
        sequence = ""
        heldKeys.removeAll()
        straightAt = nil
        paddleHeld = nil
        paddleTone = nil
        if toneActive { setTone(false) }
    }

    func destroy() {
        destroyed = true
        stopReplay()
        cancel()
    }
}
