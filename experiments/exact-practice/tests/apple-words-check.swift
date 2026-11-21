// The real JavaScriptCore program and key scheduler observe synthetic HAL buffers.
private func checkAppleWords() throws {
    let name = "words-round"
    let f = make(name)
    let clock = InstrumentClock()
    let tone = RenderedTone()
    let signal = DitKeySignal(now: { clock.now }, after: clock.after, audio: tone, motor: nil,
                              onActive: { _ in }, onSymbol: { _ in }, onSequence: { _ in })
    f.playOutput = { signal.play($0, pitch: $1, prompt: $2) }
    f.stopOutput = signal.stopReplay
    f.readTail = { id in
        tone.presentation.tailMs(prompt: id, nowMs: clock.now + 1000, rate: 1000,
                                 latencyMs: 25, milliseconds: { Double($0) })
    }
    func render() { tone.presentation.observe(host: UInt64(clock.now) + 1000, frame: clock.now, frames: 10) }
    func renderThrough(_ end: Double) {
        while clock.now < end { clock.advance(10); render() }
    }
    f.set("mode","nux")
    f.command("nux","skip")
    f.set("mode","practice")
    f.command("pref","scope-tier:4")
    f.set("mode","listen")
    f.set("listen-content","words")
    f.set("listen-choice-token","1")
    f.expect("word-phase","ready")
    f.command("word","q-codes")
    let original = try Data(contentsOf: file(name,"practice"))
    let before = f.tones.count
    f.command("word","start")
    precondition(f.tones.count == before + 1)
    let (plan, pitch) = f.tones.last!
    precondition(pitch == 600 && plan.count >= 3 && plan.contains { $0[1] - $0[0] == 300 })
    precondition(zip(plan.dropFirst(),plan).contains { $0[0] - $1[1] == 696 })
    let firstID = f.promptID
    let end = ceil(plan.last![1] / 10) * 10
    render()
    renderThrough(end + 720) // 695 ms presented after final release, accounting for 25 ms route latency.
    f.advance(40)
    f.expect("word-options","")
    f.expect("word-phase","playing")
    f.command("word","option-1")
    f.command("word","replay")
    precondition(f.promptID == firstID)
    renderThrough(end + 730)
    f.advance(40)
    f.expect("word-phase","choosing")
    let choices = f.values["word-options"]!
    precondition(Set(choices.split(separator: ",")).count == 4)
    f.command("word","option-1")
    let count = f.values["word-count"]!
    let target = f.values["word-target"]!
    let meaning = f.values["word-meaning"]!
    precondition(!meaning.isEmpty && !target.isEmpty && count.hasSuffix("/1"))
    f.command("word","replay")
    f.expect("word-options","")
    f.expect("word-target","")
    f.expect("word-meaning","")
    precondition(f.promptID > firstID && f.tones.last!.0 == plan)
    // Prime the new stream directly on the next consecutive render buffer.
    renderThrough(clock.now + end + 750)
    f.advance(40)
    f.expect("word-phase","answered")
    f.expect("word-count",count)
    f.expect("word-options",choices)
    f.expect("word-meaning",meaning)
    f.expect("word-target",target)
    f.command("word","next")
    precondition(f.tones.last!.0 != plan)
    let stale = f.timers.values.first { $0.0 == 40 }!.1
    f.session.interrupt(true)
    stale()
    f.session.interrupt(false)
    f.expect("word-phase","ready")
    f.expect("word-count",count)
    f.command("word","option-1")
    f.expect("word-count",count)
    let after = try Data(contentsOf: file(name,"practice"))
    precondition(after == original)
    f.close()
    signal.destroy()

    let restart = make(name)
    restart.expect("apple-listen-content","words")
    let quiet = restart.tones.count
    restart.set("mode","listen")
    restart.expect("word-vocab","q-codes")
    restart.expect("word-count","0/0")
    restart.expect("word-phase","ready")
    precondition(restart.tones.count == quiet)
    restart.close()
    print("PASS Apple Words: JavaScriptCore + Swift scheduler + continuous fixture render buffers. Default 12/8 WPM and 600 Hz; 695 ms after presented release concealed, next 10 ms buffer reveals. Replay retains four choices, target, Q meaning and count; Next changes target. Interruption drops stale callbacks. Exact preference file restores quiet Words/Q codes on restart, resets session count and preserves practice file bytes.")
}
try checkAppleWords()
