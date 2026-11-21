// Uses the actual key scheduler and presentation state with fixture render timestamps.
private final class RenderedTone: DitToneOutput {
    var presentation = DitPromptPresentation()
    func warm() -> Bool { true }
    func level(_ volume: Float, frequency: Float) { presentation = DitPromptPresentation() }
    func replayLevel(_ volume: Float, frequency: Float, prompt: Int, edge: Int, count: Int) {
        presentation.edge(prompt: prompt, index: edge, count: count)
    }
}

private func checkListenClock() throws {
    let clock = InstrumentClock()
    let tone = RenderedTone()
    let signal = DitKeySignal(now: { clock.now }, after: clock.after, audio: tone, motor: nil,
                              onActive: { _ in }, onSymbol: { _ in }, onSequence: { _ in })
    let fixture = make("listen-presentation")
    fixture.playOutput = { signal.play($0, pitch: $1, prompt: $2) }
    fixture.stopOutput = signal.stopReplay
    fixture.readTail = { id in
        tone.presentation.tailMs(prompt: id, nowMs: clock.now + 1000, rate: 1000,
                                 latencyMs: 25, milliseconds: { Double($0) })
    }
    func render() {
        tone.presentation.observe(host: UInt64(clock.now) + 1000, frame: clock.now, frames: 16)
    }
    func renderUntil(_ end: Int) {
        while clock.now < Double(end) { clock.advance(16); render() }
    }
    func savedE() throws -> [String: Int]? {
        let bytes = try Data(contentsOf: file("listen-presentation", "practice"))
        let save = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
        return (save["listenTtr"] as? [String: [String: Int]])?["E"]
    }
    fixture.set("mode","nux")
    fixture.command("nux","skip")
    fixture.set("mode","practice")
    fixture.command("pref","scope-custom:E")
    fixture.set("listen-content","characters")
    fixture.set("mode","listen")
    let original = fixture.promptID
    render()
    renderUntil(1200)
    fixture.set("warm-token","1")
    precondition(fixture.promptID > original && fixture.readTail?(original) == nil)
    renderUntil(2448)
    fixture.command("answer","E")
    // Replay at 1200. The final release reached the 1312 buffer, followed by
    // 25 ms downstream latency and the shipped 696 ms character gap.
    fixture.expect("listen-recognition","0.4s")
    let expected = ["averageMs":415,"samples":1]
    let measured = try savedE()
    precondition(measured == expected, "expected 415 ms from rendered replay, got " + String(describing: measured))
    let bars = fixture.values["ref-ttr-bars"]!
    precondition(bars.contains("E,415,1,"))

    signal.setSuspended(true)
    fixture.session.interrupt(true)
    fixture.command("answer","E")
    fixture.session.interrupt(false)
    signal.setSuspended(false)
    let before = try savedE()
    precondition(before == expected)
    fixture.set("warm-token","2")
    fixture.command("answer","E") // No rendered buffer for this prompt.
    fixture.expect("listen-recognition","")
    fixture.expect("ref-ttr-bars",bars)
    let after = try savedE()
    precondition(after == expected)
    fixture.close()
    signal.destroy()

    let relaunched = make("listen-presentation")
    relaunched.expect("ref-ttr-bars",bars)
    relaunched.set("listen-content","characters")
    relaunched.set("mode","listen")
    relaunched.command("answer","E")
    relaunched.expect("listen-recognition","")
    relaunched.expect("ref-ttr-bars",bars)
    let restored = try savedE()
    precondition(restored == expected)
    relaunched.close()
    print("PASS actual Apple bundle + Swift bridge + key scheduler: replay released at fixture HAL 1312, 25 ms output latency, 696 ms trailing gap, answer at 2448 = 415 ms. Interruption, unrendered replay and relaunch leave the one-sample Progress bar and file intact.")

    var state = DitPromptPresentation()
    func read(_ at: Double) -> Double? {
        state.tailMs(prompt: 7, nowMs: at, rate: 1000, latencyMs: 2, milliseconds: { Double($0) })
    }
    state.edge(prompt: 7,index: 0,count: 4)
    precondition(read(101) == nil)
    state.observe(host: 100,frame: 0,frames: 16)
    precondition(read(101) == nil && read(104) == 0 && read(119) == nil)
    state.edge(prompt: 7,index: 1,count: 4)
    state.edge(prompt: 7,index: 2,count: 4) // The middle silence was never rendered.
    state.observe(host: 116,frame: 16,frames: 16)
    precondition(read(120) == nil)
    state.edge(prompt: 7,index: 0,count: 2)
    state.observe(host: 200,frame: 0,frames: 16)
    state.observe(host: 240,frame: 40,frames: 16)
    precondition(read(244) == nil)
    state.edge(prompt: 7,index: 0,count: 2)
    state.observe(host: 0,frame: 0,frames: 16)
    precondition(read(300) == nil)
    print("PASS presentation boundaries: pre-onset and stalled stream unknown, presented early answer zero, dropped gain edge, frame discontinuity and invalid HAL timestamp unknown.")
}
try checkListenClock()
