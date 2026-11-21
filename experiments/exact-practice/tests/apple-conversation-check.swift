// AVAudioEngine writes into test-owned buffers. The station reply is synthetic.
private func checkAppleContact() throws {
    let f = make("local-contact")
    let player = DitPassagePlayer()
    let engine = AVAudioEngine()
    engine.attach(player.node)
    engine.connect(player.node, to: engine.mainMixerNode, format: player.format)
    try engine.enableManualRenderingMode(.offline, format: player.format, maximumFrameCount: 1600)
    try engine.start()
    defer { f.close(); player.stop(); engine.stop() }
    var starts = 0
    f.startPassage = { plan, pitch, gap in
        starts += 1
        precondition(pitch == 600 && gap == 300)
        return player.start(plan, pitch: pitch, gap: gap, volume: 0.75)
    }
    f.controlPassage = player.control
    f.passagePosition = player.position
    f.set("mode","nux")
    f.command("nux","skip")
    f.set("mode","conversation")
    f.command("qso","receive-first")
    f.expect("qso-phase","consent")
    f.command("qso","consent-cancel")
    precondition(starts == 0)
    f.command("qso","receive-first")
    f.command("qso","consent-allow")
    f.expect("qso-phase","receiving")
    precondition(!f.enabled)
    let buffer = AVAudioPCMBuffer(pcmFormat: player.format, frameCapacity: 1600)!
    func render() throws -> Float {
        precondition(tryRender() == .success)
        RunLoop.main.run(until: Date().addingTimeInterval(0.002))
        return UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength)).map(abs).max() ?? 0
    }
    func tryRender() -> AVAudioEngineManualRenderingStatus {
        (try? engine.renderOffline(1600, to: buffer)) ?? .error
    }
    let peak = try render()
    precondition(peak > 0.5)
    f.command("qso","pause")
    let paused = player.position()
    _ = try render()
    precondition(player.position() == paused)
    f.command("qso","resume")
    f.set("qso-copy-value","CQ K")
    for _ in 0..<150 where f.values["qso-phase"] == "receiving" {
        _ = try render()
        f.advance(50)
    }
    f.expect("qso-phase","rx-ready")
    f.command("qso","check")
    f.expect("qso-rx-text","CQ K")
    f.command("qso","start-turn")
    f.expect("qso-transcript","Station: CQ K")
    precondition(f.enabled)
    f.session.input("sequence",".")
    f.expect("qso-draft","E")
    f.command("qso","send")
    f.expect("qso-phase","receiving")
    f.expect("qso-transcript","Hidden:1\nYou: E")
    f.session.interrupt(true)
    f.expect("qso-phase","error")
    precondition(!f.enabled && player.position() == -1)
    f.session.interrupt(false)
    f.command("qso","retry")
    f.expect("qso-phase","receiving")
    precondition(starts == 3)
    f.set("mode","practice")
    precondition(player.position() == -1)
    print("PASS Apple local Conversation: JavaScriptCore, Swift key input and AVAudioEngine offline PCM; canceled consent is silent, receive/pause/resume, presented end, copy, deliberate reply, sent E, interruption and retry.")
}
try checkAppleContact()
