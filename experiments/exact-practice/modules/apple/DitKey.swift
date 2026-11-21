import Foundation
#if os(iOS)
@preconcurrency import AVFoundation
@preconcurrency import UIKit
import os

private final class Sidetone: DitToneOutput, @unchecked Sendable {
    private(set) var passage: DitPassagePlayer?
    private let engine = AVAudioEngine()
    private var source: AVAudioSourceNode?
    private var lock = os_unfair_lock_s()
    private var presentation = DitPromptPresentation()
    private var renderRate = 0.0
    private var renderedToneOn = false
    func waveToneOn() -> Bool {
        os_unfair_lock_lock(&lock)
        defer { os_unfair_lock_unlock(&lock) }
        return renderedToneOn
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
        let route = AVAudioSession.sharedInstance()
        do {
            try route.setCategory(.playback)
            try route.setPreferredIOBufferDuration(0.0029)
            try route.setActive(true)
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

    func startPassage(_ plan: [[Double]], pitch: Float, gap: Double, volume: Float) -> Bool {
        guard warm() else { return false }
        if passage == nil {
            let player = DitPassagePlayer()
            engine.attach(player.node)
            engine.connect(player.node, to: engine.mainMixerNode, format: player.format)
            passage = player
        }
        return passage?.start(plan, pitch: pitch, gap: gap, volume: volume) == true
    }

    func shutdown() {
        passage?.stop()
        level(0, frequency: 600)
        engine.stop()
        // Do not deactivate the shared session: Exact may be playing replay audio.
    }
}

private final class DitInputView: UIView {
    var key: ((String, Bool) -> Bool)?
    var interrupt: (() -> Void)?
    let waveMeter = DitWaveMeter()
    var enabled = false
    private var touchID: ObjectIdentifier?
    override var canBecomeFirstResponder: Bool { enabled }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        waveMeter.attach(to:window)
        if window == nil { touchID = nil; interrupt?() }
        else if enabled { _ = becomeFirstResponder() }
    }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard enabled, touchID == nil, let touch = touches.first, key?("straight", true) == true else { return }
        touchID = ObjectIdentifier(touch)
        _ = becomeFirstResponder()
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touchID, touches.contains(where: { ObjectIdentifier($0) == touchID }) else { return }
        self.touchID = nil
        _ = key?("straight", false)
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        touchID = nil
        interrupt?()
    }
    func resetTouch() { touchID = nil }
    private func mapped(_ press: UIPress) -> String? {
        switch press.key?.keyCode {
        case .keyboardSpacebar: return "straight"
        case .keyboardLeftControl, .keyboardOpenBracket: return "."
        case .keyboardRightControl, .keyboardCloseBracket: return "-"
        default: return nil
        }
    }
    private func route(_ presses: Set<UIPress>, down: Bool) -> Set<UIPress> {
        guard enabled else { return presses }
        return Set(presses.filter { p in
            guard let symbol = mapped(p) else { return true }
            return key?(symbol, down) != true
        })
    }
    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        let other = route(presses, down: true)
        if !other.isEmpty { super.pressesBegan(other, with: event) }
    }
    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        let other = route(presses, down: false)
        if !other.isEmpty { super.pressesEnded(other, with: event) }
    }
    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { mapped($0) != nil }) { interrupt?() }
        let other = Set(presses.filter { mapped($0) == nil })
        if !other.isEmpty { super.pressesCancelled(other, with: event) }
    }
    override func accessibilityActivate() -> Bool {
        // VoiceOver activation supplies a dit without synthesizing a held gesture.
        guard enabled, key?(".", true) == true else { return false }
        _ = key?(".", false)
        return true
    }
}

private final class DitKey: ExactNativeInstance, @unchecked Sendable {
    private let input = DitInputView()
    private let clock: ExactModuleContext
    private lazy var audio = Sidetone()
    private var volumeObserver: NSKeyValueObservation?
    private var observers: [NSObjectProtocol] = []
    private var destroyed = false
    private var session: DitAppleSession?
    #if targetEnvironment(simulator)
    private var fixtureAccounts: DitFixtureAccounts?
    private var fixtureCommandToken: String?
    #endif
    private var boot: ExactTicket?
    private var interruptions: Set<String> = []
    private lazy var signal = DitKeySignal(now: clock.now, after: { [clock] delay, run in
        let ticket = clock.after(delay, run)
        return { ticket.stop() }
    }, audio: audio, motor: clock.agent ? nil : DitCoreHaptics(),
       onActive: { [weak self] active in
           if active { self?.session?.input("down", "") }
           self?.events.message(active ? "active:on" : "active:off")
       }, onSymbol: { [weak self] in self?.session?.input("symbol", $0) },
       onSequence: { [weak self] output in self?.session?.input("sequence", output) })

    init(clock: ExactModuleContext, events: ExactNativeEvents) {
        self.clock = clock
        super.init(events: events)
        input.waveMeter.sounding = { [weak self] in self?.audio.waveToneOn() == true }
        input.backgroundColor = .clear
        input.isAccessibilityElement = true
        input.accessibilityIdentifier = "dit-native-morse-key"
        input.accessibilityLabel = "Tap for dot, hold for dah"
        input.accessibilityUserInputLabels = ["Morse key", "Tap for dot, hold for dah"]
        input.accessibilityTraits = .button
        input.key = { [weak self] symbol, down in self?.signal.key(symbol, down: down) == true }
        input.interrupt = { [weak self] in self?.cancel(); self?.signal.stopReplay() }
        let support = clock.agent ? nil : FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let bundleID = Bundle.main.bundleIdentifier
        let legacyDirectory = support.flatMap { directory in
            bundleID.map { DitLegacyStore.directory(in: directory, bundleID: $0) }
        }
        let data = DitLegacyStore.sessionDirectory(hostData: clock.data, privateSupport: support, bundleID: bundleID, agent: clock.agent)
        var bootFailure = "apple-session:failed"
        if let data {
            var sessionData = data
            var sessionLegacy = legacyDirectory
            var accounts: DitAccountTransport?
            var storageReady = true
            #if targetEnvironment(simulator)
            if !clock.agent {
                do {
                    fixtureAccounts = try DitFixtureAccounts(environment: ProcessInfo.processInfo.environment,
                        bundle: bundleID, directory: data)
                    if let fixture = fixtureAccounts {
                        sessionData = fixture.directory
                        sessionLegacy = nil
                        accounts = fixture
                        fixture.presentation = { [weak self] email in
                            self?.events.message("fixture-account:" + email)
                        }
                    }
                } catch { storageReady = false }
            }
            #endif
            if storageReady {
                session = DitAppleSession(directory: sessionData, legacyDirectory: sessionLegacy,
                    onLegacyHold: { bootFailure = "apple-session:legacy-held" },
                    program: Bundle.main.url(forResource: "dit-apple-session", withExtension: "js", subdirectory: "assets"),
                    accountService: accounts, notifications: clock.agent || accounts != nil ? nil : DitSystemReminderCenter.service,
                    outputVolume: { Double(AVAudioSession.sharedInstance().outputVolume) },
                    schedule: { milliseconds, run in
                        let ticket = clock.after(milliseconds, run)
                        return { ticket.stop() }
                    }, play: { [weak self] plan, pitch, id in self?.play(plan, pitch: pitch, prompt: id) == true },
                    passageStart: { [weak self] plan, pitch, gap in
                        guard let self, self.interruptions.isEmpty else { return false }
                        return self.signal.playPassage(plan) {
                            self.audio.startPassage(plan, pitch: pitch, gap: gap, volume: self.signal.volume)
                        }
                    }, passageControl: { [weak self] action in
                        guard let self else { return false }
                        return self.signal.controlPassage(action) { self.audio.passage?.control(action) == true }
                    },
                    passagePosition: { [weak self] in self?.audio.passage?.position() ?? -1 },
                    promptTailMs: { [weak self] in self?.audio.promptTailMs($0) },
                    stop: { [weak self] in self?.signal.stopReplay() }, warm: { [weak self] in _ = self?.audio.warm() },
                    cancelInput: { [weak self] in self?.cancel() },
                    configure: { [weak self] enabled, unit, pitch, haptics in self?.configure(enabled, unit: unit, pitch: pitch, haptics: haptics) },
                    publish: { [weak self] message in self?.events.message(message) })
            }
        }
        // Host installs the event receiver after the factory returns.
        boot = clock.after(0) { [weak self] in
            guard let self, !self.destroyed else { return }
            if self.session == nil { self.events.message(bootFailure) }
            self.session?.bootstrap()
            self.publishPowerMode()
        }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: .NSProcessInfoPowerStateDidChange, object: nil, queue: .main) { [weak self] _ in
            self?.publishPowerMode()
        })
        for (name, stopped) in [(UIApplication.willResignActiveNotification, true),
                                (UIApplication.didBecomeActiveNotification, false)] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.interrupt("application", stopped)
                if !stopped { self?.session?.foreground() }
            })
        }
        for name in [AVAudioSession.routeChangeNotification, .AVAudioEngineConfigurationChange] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.audio.invalidatePresentation()
            })
        }
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] n in
            guard let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            self?.interrupt("audio", type == .began)
        })
    }

    override var view: ExactNativeView { input }
    override var focusTarget: ExactNativeView? { signal.blocked ? nil : input }

    override func setProps(_ props: [String: String]) throws {
        if let text = props["tone-volume"], let value = Float(text), value.isFinite {
            signal.volume = min(0.9, max(0, value))
        }
        let watchesVolume = props["watch-volume"] == "true"
        if watchesVolume && volumeObserver == nil {
            volumeObserver = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.initial, .new]) { [weak self] session, _ in
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.volumeObserver != nil, !self.destroyed else { return }
                    self.events.message(session.outputVolume < 0.05 ? "output-volume:low" : "output-volume:ready")
                }
            }
        } else if !watchesVolume {
            volumeObserver = nil
        }
        #if targetEnvironment(simulator)
        if let fixtureAccounts, let token = props["account-token"] {
            let previous = fixtureCommandToken
            fixtureCommandToken = token
            if let previous, previous != token, let action = props["account-action"] {
                fixtureAccounts.choose(action)
            }
        }
        #endif
        session?.setProps(props)
    }

    private func publishPowerMode() {
        events.message(ProcessInfo.processInfo.isLowPowerModeEnabled ? "low-power:on" : "low-power:off")
    }

    private func configure(_ enabled: Bool, unit: Double, pitch: Float, haptics: Bool) {
        signal.unit = unit
        signal.frequency = pitch
        signal.setHaptics(haptics)
        let changed = enabled == signal.blocked
        signal.blocked = !enabled
        input.enabled = enabled
        input.isAccessibilityElement = enabled
        input.accessibilityTraits = enabled ? .button : [.button, .notEnabled]
        if changed && !enabled {
            cancel()
            _ = input.resignFirstResponder()
        } else if changed && input.window != nil {
            _ = input.becomeFirstResponder()
        }
    }

    private func interrupt(_ source: String, _ began: Bool) {
        if began { interruptions.insert(source) } else { interruptions.remove(source) }
        if began { input.resetTouch() }
        signal.setSuspended(!interruptions.isEmpty)
        session?.interrupt(!interruptions.isEmpty)
    }

    private func play(_ plan: [[Double]], pitch: Float, prompt: Int) -> Bool {
        guard !destroyed, interruptions.isEmpty else { return false }
        guard signal.play(plan, pitch: pitch, prompt: prompt) else { return false }
        input.resetTouch()
        return true
    }

    override func agentInput(_ request: ExactNativeInput) throws {
        guard case let .key(name, phase) = request else { throw ExactNativeRefusal("dit-key accepts keyboard chords only") }
        let symbol: String
        switch name {
        case "Space", " ": symbol = "straight"
        case "ControlLeft", "BracketLeft", "[": symbol = "."
        case "ControlRight", "BracketRight", "]": symbol = "-"
        default: throw ExactNativeRefusal("unsupported dit-key chord")
        }
        if phase != "up" { _ = signal.key(symbol, down: true) }
        if phase != "down" { _ = signal.key(symbol, down: false) }
    }

    private func cancel() {
        signal.cancel()
        input.resetTouch()
    }

    override func destroy() {
        destroyed = true
        volumeObserver = nil
        boot?.stop()
        session?.close()
        session = nil
        signal.destroy()
        input.resetTouch()
        audio.shutdown()
        input.enabled = false
        _ = input.resignFirstResponder()
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers.removeAll()
    }
}
#endif

private final class DitPracticeModule: ExactModule {
    #if os(iOS)
    override class var views: [String: ExactNativeFactory] {
        ["dit-key": ExactNativeFactory(for: DitPracticeModule.self) { module, props, events in
            let key = DitKey(clock: module.context, events: events)
            try? key.setProps(props)
            return key
        }, "dit-reminder-wheel": ExactNativeFactory(for: DitPracticeModule.self) { _, props, events in
            let wheel = DitReminderWheel(events: events)
            try? wheel.setProps(props)
            return wheel
        }, "dit-listen-wave": ExactNativeFactory(for: DitPracticeModule.self) { _, props, events in
            let wave = DitListenWave(events: events)
            try? wave.setProps(props)
            return wave
        }, "dit-intro-artwork": ExactNativeFactory(for: DitPracticeModule.self) { _, props, events in
            let illustration = DitIntroArtwork(events: events)
            try? illustration.setProps(props)
            return illustration
        }, "dit-mode-selector": ExactNativeFactory(for: DitPracticeModule.self) { _, props, events in
            let selector = DitModeSelector(events: events)
            try? selector.setProps(props)
            return selector
        }]
    }
    #endif
}

let exactModule: ExactModule.Type = DitPracticeModule.self
