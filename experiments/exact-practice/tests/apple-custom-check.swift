// Offline manual rendering: the engine writes only into test-owned PCM buffers.
private func checkCustomPassage() throws {
    let player = DitPassagePlayer()
    let engine = AVAudioEngine()
    engine.attach(player.node)
    engine.connect(player.node, to: engine.mainMixerNode, format: player.format)
    try engine.enableManualRenderingMode(.offline, format: player.format, maximumFrameCount: 160)
    try engine.start()
    defer { player.stop(); engine.stop() }
    let fixture = make("custom-passage")
    fixture.startPassage = { player.start($0, pitch: $1, gap: $2, volume: 0.75) }
    fixture.controlPassage = player.control
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
    fixture.command("custom","pause")
    let paused = player.position()
    let silence = try render(40)
    precondition(paused > 0 && player.position() == paused && silence.suffix(20).max()! < 0.001)
    precondition(!fixture.timers.values.contains { $0.0 == 60 })
    fixture.expect("custom-phase","paused")
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
    fixture.session.interrupt(true)
    fixture.expect("custom-phase","setup")
    precondition(player.position() == -1)
    fixture.close()
    let restarted = make("custom-passage")
    restarted.set("mode","listen")
    restarted.expect("custom-phase","setup")
    restarted.expect("custom-chars","4")
    restarted.expect("custom-copy","")
    let bytes = try String(contentsOf: file("custom-passage","custom"), encoding: .utf8)
    precondition(!bytes.contains("ET T"))
    restarted.close()
    print("PASS Custom Listen: bundled JavaScriptCore and AVAudioEngine offline PCM. Measured tone samples in memory, silent gaps, frozen paused position, natural completion after the trailing gap, transient copy diff, interruption and cold restore.")
}
try checkCustomPassage()
