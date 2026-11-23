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
        return player.start(plan, pitch: pitch, gap: gap, volume: 0.75, unitMs: 100)
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
    f.session.interrupt(true)
    f.session.interrupt(true, applicationInactive: true)
    f.expect("qso-phase","ended")
    f.session.interrupt(false)
    f.command("qso","retry")
    f.expect("qso-phase","ended")
    precondition(starts == 3 && !f.enabled)
    f.set("mode","practice")
    precondition(player.position() == -1)
    print("PASS Apple local Conversation: JavaScriptCore, Swift key input and AVAudioEngine offline PCM; canceled consent is silent, receive/pause/resume, presented end, copy, deliberate reply, sent E, audio retry and background termination.")
}
try checkAppleContact()

private func checkDelayedStation() throws {
    var texts: [String] = []
    var histories: [String] = []
    var prompts: [String] = []
    var replies: [(String?, String?) -> Void] = []
    var cancelled: [Int] = []
    let record: DitStationExchange = { request, reply in
        let id = texts.count
        precondition(request.model == "gemini-3.5-flash-lite" && Thread.isMainThread)
        texts.append(request.text)
        histories.append(request.historyJSON)
        prompts.append(request.systemInstruction)
        replies.append { text, history in
            if let text, let history { reply(DitStationReply(text:text, historyJSON:history)) }
            else { reply(nil) }
        }
        return { cancelled.append(id) }
    }
    var openings: [(Bool) -> Void] = []
    var cancelledOpens = [Int]()
    let transport = DitStationTransport(open: { model, _, ready in
        precondition(model == "gemini-3.5-flash-lite" && Thread.isMainThread)
        let id = openings.count
        openings.append(ready)
        return { cancelledOpens.append(id) }
    },send:record)
    let f = Fixture(root.appendingPathComponent("swift-station"), asset, station:transport)
    var audio = 0
    f.startPassage = { plan, _, _ in precondition(!plan.isEmpty); audio += 1; return true }
    f.controlPassage = { _ in true }
    f.passagePosition = { -2 }
    f.set("mode","nux"); f.command("nux","skip"); f.set("mode","conversation")
    func command(_ action: String) { f.command("qso",action) }
    func drainMainQueue() {
        var drained = false
        DispatchQueue.main.async { drained = true }
        until { drained }
    }
    command("receive-first"); command("consent-cancel")
    precondition(openings.isEmpty && texts.isEmpty && audio == 0)
    command("send-first"); command("consent-allow")
    f.expect("qso-phase","sending")
    openings[0](false); drainMainQueue()
    f.expect("qso-phase","error"); f.expect("qso-error","Could not start the QSO. Try again.")
    precondition(!f.enabled && texts.isEmpty && audio == 0)
    command("retry"); command("end"); command("new")
    command("receive-first"); command("consent-allow")
    openings[1](true); drainMainQueue()
    f.expect("qso-phase","sending")
    precondition(cancelledOpens == [1] && texts.isEmpty)
    openings[2](true); drainMainQueue()
    precondition(texts.count == 1 && audio == 0, "consented opener must wait for Swift")
    let opener = "Begin the QSO now. Call CQ or send your opening call as you see fit."
    precondition(texts == [opener] && histories == ["[]"])
    command("end"); command("new"); command("send-first"); command("consent-allow")
    openings[3](true); drainMainQueue()
    f.expect("qso-phase","tx")
    replies[0]("STALE","[]"); drainMainQueue()
    precondition(audio == 0 && cancelled == [0] && f.enabled)

    f.session.input("sequence","."); command("send")
    precondition(texts == [opener,"E"])
    replies[1](nil,nil); drainMainQueue()
    f.expect("qso-phase","error")
    f.expect("qso-error","Could not reach the other station. Try again.")
    command("retry")
    let accepted = #"[{"role":"user","parts":[{"text":"E"}]},{"role":"model","parts":[{"text":"RST 599 K"}]}]"#
    let reply = replies[2]
    let delivered = DispatchSemaphore(value: 0)
    DispatchQueue.global().async { reply("RST 599 K",accepted); delivered.signal() }
    precondition(delivered.wait(timeout:.now()+1) == .success)
    drainMainQueue()
    f.expect("qso-phase","receiving")
    precondition(audio == 1 && texts == [opener,"E","E"] && histories == ["[]","[]","[]"])
    reply("DUPLICATE","[]"); drainMainQueue()
    precondition(audio == 1)
    f.set("qso-copy-value","PRIVATE COPY"); f.advance(50); command("reveal"); f.expect("qso-rx-text","RST 5NN K")
    command("start-turn"); f.session.input("sequence","-"); command("send")
    precondition(texts.last == "T" && histories.last == accepted && prompts[0] != prompts[1])
    f.session.interrupt(true); f.session.interrupt(false); command("retry")
    precondition(texts.suffix(2) == ["T","T"] && cancelled == [0,3])
    replies[3]("STALE BEFORE RETRY","[]"); drainMainQueue()
    f.expect("qso-phase","sending")
    precondition(audio == 1)
    f.session.interrupt(true, applicationInactive:true)
    f.expect("qso-phase","ended")
    replies[4]("STALE BACKGROUND","[]"); drainMainQueue()
    f.session.interrupt(false); command("retry"); f.expect("qso-phase","ended")
    precondition(audio == 1 && cancelled == [0,3,4])
    command("new"); command("receive-first"); command("consent-allow")
    openings[4](true); drainMainQueue()
    precondition(histories.last == "[]")
    f.close(); replies[5]("AFTER DISPOSE","[]"); drainMainQueue()
    precondition(audio == 1 && cancelled == [0,3,4,5])
    print("PASS Swift station bridge: Send first startup error before keying, stale open cancelled, delayed opener after End/New, failed keyed E and retry, background-thread completion, single passage and 5NN reveal, accepted history, background and dispose.")
}
try checkDelayedStation()
