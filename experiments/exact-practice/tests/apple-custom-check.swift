// Offline manual rendering: the engine writes only into test-owned PCM buffers.
private func checkCustomPassage(verifyRelaunch: Bool = true) throws {
    let player = DitPassagePlayer()
    let engine = AVAudioEngine()
    engine.attach(player.node)
    engine.connect(player.node, to: engine.mainMixerNode, format: player.format)
    try engine.enableManualRenderingMode(.offline, format: player.format, maximumFrameCount: 160)
    try engine.start()
    defer { player.stop(); engine.stop() }
    let fixture = make("custom-passage")
    fixture.startPassage = { player.start($0, pitch: $1, gap: $2, volume: 0.75, unitMs: 100) }
    var rejectControl: String?
    fixture.controlPassage = { action in
        action != rejectControl && player.control(action)
    }
    fixture.passagePosition = player.position
    fixture.set("mode","nux")
    fixture.command("nux","skip")
    fixture.set("mode","listen")
    fixture.set("listen-content","custom")
    fixture.set("listen-choice-token","1")
    fixture.set("custom-source-value","  et E  ")
    fixture.set("custom-type-value","true")
    fixture.command("custom","save")
    fixture.expect("custom-phase","setup")
    fixture.command("custom","play")
    fixture.expect("custom-phase","playing")
    let buffer = AVAudioPCMBuffer(pcmFormat: player.format, frameCapacity: 160)!
    func render(_ blocks: Int) throws -> [Float] {
        var peaks: [Float] = []
        for _ in 0..<blocks {
            let status = try engine.renderOffline(160, to: buffer)
            precondition(status == .success, "offline engine failed to render")
            let frames = UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength))
            peaks.append(frames.map(abs).max() ?? 0)
            RunLoop.main.run(until: Date().addingTimeInterval(0.001))
        }
        return peaks
    }
    let initial = try render(50)
    precondition(initial.prefix(8).max()! > 0.6 && initial.suffix(25).max()! < 0.001)
    fixture.set("custom-copy-value","ET T")
    rejectControl = "pause"
    fixture.command("custom","pause")
    fixture.expect("custom-control-error", "Could not pause playback. Try End and Play again.")
    fixture.expect("custom-phase", "playing")
    precondition(player.node.isPlaying)
    rejectControl = nil
    fixture.command("custom","pause")
    let paused = player.position()
    let silence = try render(40)
    precondition(paused > 0 && player.position() == paused && silence.suffix(20).max()! < 0.001)
    precondition(!fixture.timers.values.contains { $0.0 == 60 })
    fixture.expect("custom-phase","paused")
    rejectControl = "resume"
    fixture.command("custom","resume")
    fixture.expect("custom-control-error", "Could not resume playback. Try Restart.")
    fixture.expect("custom-phase", "paused")
    precondition(!player.node.isPlaying && player.position() == paused)
    rejectControl = nil
    fixture.command("custom","resume")
    let middle = try render(295)
    precondition(middle.max()! > 0.6 && middle.suffix(45).max()! < 0.001)
    fixture.advance(60)
    fixture.expect("custom-phase","playing")
    _ = try render(25)
    fixture.advance(60)
    fixture.expect("custom-phase","reveal")
    fixture.expect("custom-reveal","ET E")
    fixture.expect("custom-summary","3/4 matched · 1 missed · 1 extra")
    fixture.command("custom","play")
    fixture.expect("custom-control-error", "")
    fixture.session.interrupt(true)
    fixture.expect("custom-phase","setup")
    precondition(player.position() == -1)
    fixture.close()
    print("PASS Custom Listen controls: packaged JSCore session and AVAudioEngine offline PCM, rejected Pause and Resume, retry, frozen playhead, natural Reveal and transient copy.")
    guard verifyRelaunch else { return }
    let restarted = make("custom-passage")
    restarted.set("mode","listen")
    restarted.expect("custom-phase","setup")
    restarted.expect("custom-chars","4")
    restarted.expect("custom-copy","")
    let bytes = try String(contentsOf: file("custom-passage","custom"), encoding: .utf8)
    precondition(!bytes.contains("ET T"))
    restarted.close()
    print("PASS Custom Listen: bundled JavaScriptCore and AVAudioEngine offline PCM. Measured tone samples in memory, silent gaps, rejected Pause and Resume with retry, frozen paused position, natural completion after the trailing gap, transient copy diff, interruption and cold restore.")
}
try checkCustomPassage()
