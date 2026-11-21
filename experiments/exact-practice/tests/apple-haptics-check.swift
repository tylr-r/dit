// Concatenated by check-apple-session.sh. No haptic engine or audio device is opened.
import CoreHaptics

private final class InstrumentClock {
    struct Tick { let at: Double; let run: () -> Void }
    var now = 0.0
    var serial = 0
    var pending: [Int: Tick] = [:]
    var discarded: [() -> Void] = []
    func after(_ delay: Double, _ run: @escaping () -> Void) -> () -> Void {
        serial += 1
        let id = serial
        pending[id] = Tick(at: now + delay, run: run)
        return { [weak self] in
            if let tick = self?.pending.removeValue(forKey: id) { self?.discarded.append(tick.run) }
        }
    }
    func advance(_ ms: Double) {
        let end = now + ms
        while let (id,tick) = pending.filter({ $0.value.at <= end }).min(by: {
            ($0.value.at, $0.key) < ($1.value.at, $1.key)
        }) {
            now = max(now,tick.at)
            pending.removeValue(forKey: id)
            tick.run()
        }
        now = max(now,end)
    }
}

private struct FeedbackEdge: Equatable {
    let at: Double
    let action: String
    init(_ at: Double,_ action: String) { self.at = at; self.action = action }
}

private final class RecordedPlayer: DitHapticPlayer {
    let name: String
    let record: (String) -> Void
    init(_ name: String,_ record: @escaping (String) -> Void) { self.name = name; self.record = record }
    func start() { record(name + "+") }
    func pause() { record(name + " pause") }
    func resume() { record(name + " resume") }
    func stop() { record(name + "-") }
}

private final class SignalFixture: DitHapticDriver, DitToneOutput {
    let clock = InstrumentClock()
    var audioAvailable = true
    var motorAvailable = true
    var preparationMs = 0.0
    var edges: [FeedbackEdge] = []
    var patterns: [DitHapticPattern] = []
    var symbols = ""
    var sequences: [String] = []
    lazy var key: DitKeySignal! = DitKeySignal(now: { [unowned self] in clock.now }, after: clock.after,
        audio: self, motor: self, onActive: { _ in }, onSymbol: { [unowned self] in symbols += $0 },
        onSequence: { [unowned self] in sequences.append($0) })
    init() { key.blocked = false; key.setHaptics(true) }
    func warm() -> Bool { audioAvailable }
    func level(_ volume: Float, frequency: Float) { record(volume > 0 ? "tone+" : "tone-") }
    func replayLevel(_ volume: Float, frequency: Float, prompt: Int, edge: Int, count: Int) {
        level(volume, frequency: frequency)
    }
    func record(_ value: String) { edges.append(FeedbackEdge(clock.now,value)) }
    func prepare(_ pattern: DitHapticPattern) -> DitHapticPlayer? {
        guard motorAvailable else { return nil }
        patterns.append(pattern)
        clock.now += preparationMs
        return RecordedPlayer(pattern == .held ? "hold" : "sequence", { [weak self] in self?.record($0) })
    }
    func times(_ action: String) -> [Double] { edges.filter { $0.action == action }.map(\.at) }
    func release() { key.destroy(); key = nil }
}

private func checkHaptics() {
    // Inspect the real framework event values, without constructing CHHapticEngine.
    let manual = DitHapticPattern.held.events()
    precondition(manual.count == 1 && manual[0].relativeTime == 0 && manual[0].duration == 30)
    func validate(_ events: [CHHapticEvent]) {
        for event in events {
            precondition(event.type == .hapticContinuous)
            precondition(event.eventParameters.first { $0.parameterID == .hapticIntensity }?.value == 1)
            precondition(event.eventParameters.first { $0.parameterID == .hapticSharpness }?.value == 0.5)
        }
    }
    validate(manual)
    let source = make("tactile-audio-plan")
    source.set("mode","nux"); source.command("nux","skip"); source.set("mode","practice")
    source.command("pref","scope-custom:A")
    source.expect("target","A")
    for unit in [100.0,50.0] {
        if unit == 50 {
            for _ in 0..<12 { source.command("pref","speed-up") }
        }
        source.set("warm-token",unit == 100 ? "1" : "2")
        let plan = source.tones.last!.0
        precondition(plan == [[0,unit],[2*unit,5*unit]])
        let f = SignalFixture()
        f.preparationMs = 12
        precondition(f.key.play(plan,pitch:600))
        let epoch = f.clock.now
        f.clock.advance(5*unit)
        let events = f.patterns[0].events()
        validate(events)
        precondition(events.map(\.relativeTime) == [0,2*unit/1000])
        precondition(events.map(\.duration) == [unit/1000,3*unit/1000])
        precondition(f.times("sequence+") == [epoch] && f.times("hold+").isEmpty)
        precondition(f.times("tone+") == [epoch,epoch+2*unit])
        precondition(f.times("tone-") == [epoch+unit,epoch+5*unit])
        f.release()
    }
    source.close()
    print("PASS actual session A at 12/24 WPM: audio [0,100]/[200,500] and [0,50]/[100,250] ms; continuous framework events match offsets/durations, intensity 1 and sharpness 0.5")

    let manualKey = SignalFixture()
    precondition(manualKey.key.key("straight",down:true))
    manualKey.clock.advance(90)
    precondition(manualKey.key.key("straight",down:true)) // autorepeat
    precondition(manualKey.key.key("straight",down:false))
    manualKey.clock.advance(25)
    precondition(manualKey.key.key("straight",down:true))
    manualKey.clock.advance(245)
    precondition(manualKey.key.key("straight",down:false))
    manualKey.clock.advance(200)
    precondition(manualKey.sequences == [".-"])
    precondition(manualKey.times("hold+") == [0,115] && manualKey.times("hold-") == [90,360])
    precondition(manualKey.times("hold+") == manualKey.times("tone+") && manualKey.times("hold-") == manualKey.times("tone-"))
    manualKey.release()

    for unit in [100.0,50.0] {
        let f = SignalFixture()
        f.key.unit = unit
        precondition(f.key.key(".",down:true))
        f.clock.advance(unit*2.25)
        precondition(f.key.key("-",down:true)); precondition(f.key.key(".",down:false))
        f.clock.advance(2*unit)
        precondition(f.key.key("-",down:false)) // early release finishes this dah
        f.clock.advance(unit*4 + 200)
        precondition(f.sequences == ["..-"])
        precondition(f.times("hold+") == [0,2*unit,4*unit])
        precondition(f.times("hold-") == [unit,3*unit,7*unit])
        precondition(f.times("tone+") == f.times("hold+") && f.times("tone-") == f.times("hold-"))
        f.release()
    }
    // Shipped modes.spec.ts expects “I” from repeat at both speeds, and “A”
    // when Right takes over 30 ms after Left goes down.
    for (unit, hold) in [(100.0,260.0),(40.0,130.0)] {
        let f = SignalFixture()
        f.key.unit = unit
        precondition(f.key.key(".",down:true))
        f.clock.advance(hold)
        precondition(f.key.key(".",down:false))
        f.clock.advance(500)
        precondition(f.sequences == [".."] && f.times("hold+") == [0,2*unit])
        precondition(f.times("hold-") == [unit,3*unit])
        f.release()
    }
    let overlap = SignalFixture()
    precondition(overlap.key.key(".",down:true))
    overlap.clock.advance(30)
    precondition(overlap.key.key("-",down:true))
    overlap.clock.advance(30)
    precondition(overlap.key.key(".",down:false))
    overlap.clock.advance(330)
    precondition(overlap.key.key("-",down:false))
    overlap.clock.advance(400)
    precondition(overlap.sequences == [".-"] && overlap.times("hold+") == [0,200])
    precondition(overlap.times("hold-") == [100,500])
    overlap.release()
    print("PASS shipped VBand examples at 12/30 WPM: held Left produces I; Left/Right overlap produces A")
    let cold = SignalFixture()
    cold.preparationMs = 13
    precondition(cold.key.key(".",down:true))
    precondition(cold.key.key(".",down:false))
    cold.clock.advance(100)
    precondition(cold.times("tone+") == [0] && cold.times("tone-") == [100])
    cold.release()
    print("PASS sustained straight key releases at 90/245 ms; held/overlapping paddles finish 1/3-unit tones with one-unit gaps at both speeds; preparation cost does not extend the scheduled paddle deadline")

    let f = SignalFixture(), mixed = [[0.0,100],[200,500]]
    precondition(f.key.key("straight",down:true))
    f.clock.advance(40)
    f.key.setHaptics(false); f.key.setHaptics(true)
    precondition(f.times("hold-") == [40] && f.times("tone-").isEmpty && f.times("hold+") == [0])
    f.clock.advance(20); precondition(f.key.key("straight",down:false))
    precondition(f.key.play(mixed,pitch:600))
    f.clock.advance(50); f.key.setHaptics(false)
    precondition(f.times("sequence-") == [110])
    f.clock.advance(450)
    precondition(f.times("tone+").contains(260) && f.times("tone-").contains(560))
    f.key.setHaptics(true)
    precondition(f.times("sequence+").count == 1)
    precondition(f.key.play(mixed,pitch:600))
    f.clock.advance(20)
    precondition(f.key.play([[0,300]],pitch:680))
    precondition(f.times("sequence-").last == f.clock.now)
    f.clock.advance(10); precondition(f.key.key("straight",down:true))
    precondition(f.times("sequence-").last == f.clock.now && f.times("hold+").last == f.clock.now)
    f.clock.advance(10); f.key.setSuspended(true)
    precondition(f.times("hold-").last == f.clock.now)
    precondition(!f.key.key(".",down:true) && !f.key.play(mixed,pitch:600))
    f.key.setSuspended(false)
    let snapshot = f.edges
    f.clock.discarded.forEach { $0() }; f.clock.advance(2000)
    precondition(f.edges == snapshot)
    precondition(f.key.play(mixed,pitch:600))
    f.clock.advance(20); f.release()
    precondition(f.times("sequence-").last == f.clock.now)
    let final = f.edges
    f.clock.discarded.forEach { $0() }; f.clock.advance(2000)
    precondition(f.edges == final)
    let interrupted = SignalFixture()
    precondition(interrupted.key.play(mixed,pitch:600))
    interrupted.clock.advance(250)
    interrupted.key.setSuspended(true)
    precondition(interrupted.times("tone-").last == 250 && interrupted.times("sequence-") == [250])
    interrupted.key.setSuspended(false)
    let stopped = interrupted.edges
    interrupted.clock.discarded.forEach { $0() }
    interrupted.clock.advance(1000)
    precondition(interrupted.edges == stopped)
    precondition(interrupted.key.play([[50,150]],pitch:600))
    precondition(interrupted.patterns.last?.events().first?.relativeTime == 0.05)
    interrupted.clock.advance(151)
    precondition(interrupted.times("tone+").last == 1300 && interrupted.times("tone-").last == 1400)
    interrupted.release()
    let badAudio = SignalFixture()
    badAudio.audioAvailable = false
    precondition(!badAudio.key.play(mixed,pitch:600))
    precondition(badAudio.key.key("straight",down:true) && badAudio.patterns.isEmpty && badAudio.times("tone+").isEmpty)
    badAudio.release()
    let noMotor = SignalFixture()
    noMotor.motorAvailable = false
    precondition(noMotor.key.play(mixed,pitch:600)); noMotor.clock.advance(500)
    precondition(noMotor.times("tone+") == [0,200] && noMotor.times("tone-") == [100,500])
    noMotor.release()
    print("PASS mid-hold/mid-replay disable, silent re-enable, replay replacement, manual takeover, interruption, stale callbacks and teardown; unavailable motor preserves audio and unavailable audio starts no motor")
}
checkHaptics()

// Custom Listen and Conversation run on the finite PCM player, including its
// actual pause/resume result. A disabled motor must never stop the passage.
private func checkPassageMotor() {
    let f = SignalFixture()
    f.preparationMs = 13
    let plan = [[0.0,100],[300,600],[1300,1400]]
    precondition(f.key.playPassage(plan) { f.record("pcm+"); return true })
    precondition(f.patterns.last == .playback(DitToneInterval.decode(plan)!))
    precondition(f.times("pcm+") == f.times("sequence+"))
    precondition(f.key.controlPassage("pause") { true })
    precondition(f.times("sequence pause").count == 1)
    precondition(f.key.controlPassage("resume") { true })
    precondition(f.times("sequence resume").count == 1)
    f.key.setHaptics(false)
    precondition(f.times("sequence-").count == 1)
    precondition(f.key.controlPassage("pause") { true })
    precondition(f.key.controlPassage("resume") { true })
    precondition(f.times("sequence resume").count == 1)
    f.key.setHaptics(true)
    precondition(!f.key.playPassage(plan) { false })
    precondition(f.times("sequence+").count == 1)
    precondition(f.key.playPassage(plan) { true })
    f.key.setSuspended(true)
    precondition(!f.key.playPassage(plan) { preconditionFailure("started interrupted audio") })
    precondition(f.times("sequence+").count == 2)
    f.release()
    print("PASS passage haptic plan: equal requested PCM and motor onset, shared dit/dah/gap intervals, transport pause and resume, settings disable, failed audio start and interruption. Recording driver only.")
}
checkPassageMotor()
