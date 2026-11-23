import Foundation
#if os(iOS)
@preconcurrency import AVFoundation
@preconcurrency import UIKit

private final class DitInputView: UIView {
    var key: ((String, Bool) -> Bool)?
    var interrupt: (() -> Void)?
    let waveMeter = DitWaveMeter()
    private(set) var enabled = false
    private var hardwareEligible = false
    private weak var editor: UIView?
    private let pressed = NSHashTable<UIPress>.weakObjects()
    private let suppressed = NSHashTable<UIPress>.weakObjects()
    private var agentHeld = Set<String>()
    private var lastInputWasHardware = false
    var cancelHardware: (() -> Void)?
    private var touchID: ObjectIdentifier?
    override var canBecomeFirstResponder: Bool { enabled && hardwareEligible && editor == nil }

    func setEligibility(_ enabled: Bool, hardware: Bool) {
        guard self.enabled != enabled || hardwareEligible != hardware else { return }
        self.enabled = enabled
        hardwareEligible = hardware
        restoreFocus()
    }

    private func focusedEditor(in view: UIView) -> UIView? {
        if view.isFirstResponder && view is UITextInput { return view }
        for child in view.subviews {
            if let field = focusedEditor(in:child) { return field }
        }
        return nil
    }

    private func cancelHardwareInput() {
        for press in pressed.allObjects { suppressed.add(press) }
        pressed.removeAllObjects()
        agentHeld.removeAll()
        if lastInputWasHardware {
            lastInputWasHardware = false
            cancelHardware?()
        }
    }

    private func updateFocus() {
        if canBecomeFirstResponder {
            if window != nil && !isFirstResponder { _ = becomeFirstResponder() }
        } else {
            cancelHardwareInput()
            if isFirstResponder { _ = resignFirstResponder() }
        }
    }

    private func restoreFocus() {
        editor = window.flatMap { focusedEditor(in:$0) }
        updateFocus()
    }

    @objc private func editingBegan(_ note: Notification) {
        guard let window, let field = note.object as? UIView, field.window === window else { return }
        editor = field
        updateFocus()
    }

    @objc private func editingEnded(_ note: Notification) {
        guard let field = note.object as? UIView, field === editor else { return }
        // Let UIKit finish moving focus, including a direct transfer between fields.
        DispatchQueue.main.async { [weak self] in self?.restoreFocus() }
    }

    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        if resigned { cancelHardwareInput() }
        return resigned
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        waveMeter.attach(to:window)
        let center = NotificationCenter.default
        for name in [UITextField.textDidBeginEditingNotification, UITextView.textDidBeginEditingNotification] {
            center.removeObserver(self, name:name, object:nil)
            if window != nil { center.addObserver(self, selector:#selector(editingBegan(_:)), name:name, object:nil) }
        }
        for name in [UITextField.textDidEndEditingNotification, UITextView.textDidEndEditingNotification] {
            center.removeObserver(self, name:name, object:nil)
            if window != nil { center.addObserver(self, selector:#selector(editingEnded(_:)), name:name, object:nil) }
        }
        guard window != nil else {
            editor = nil
            touchID = nil
            cancelHardwareInput()
            interrupt?()
            return
        }
        restoreFocus()
    }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard enabled, touchID == nil, let touch = touches.first, key?("straight", true) == true else { return }
        lastInputWasHardware = false
        touchID = ObjectIdentifier(touch)
        if canBecomeFirstResponder { _ = becomeFirstResponder() }
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
        guard let key = press.key else { return nil }
        switch key.keyCode {
        case .keyboardSpacebar: return "straight"
        case .keyboardLeftControl: return "."
        case .keyboardRightControl: return "-"
        default:
            switch key.charactersIgnoringModifiers {
            case "[": return "."
            case "]": return "-"
            default: return nil
            }
        }
    }
    private func route(_ presses: Set<UIPress>, down: Bool, cancelStraight: Bool = false) -> Set<UIPress> {
        return Set(presses.filter { p in
            guard let symbol = mapped(p) else { return true }
            if !canBecomeFirstResponder || suppressed.contains(p) {
                if down { suppressed.add(p) } else { suppressed.remove(p) }
                return true
            }
            if down {
                if pressed.contains(p) { return false }
                guard key?(symbol, true) == true else { return true }
                pressed.add(p)
                lastInputWasHardware = true
                return false
            }
            guard pressed.contains(p) else { return true }
            pressed.remove(p)
            if cancelStraight && symbol == "straight" {
                interrupt?()
                return false
            }
            return key?(symbol, false) != true
        })
    }
    func agentKey(_ symbol: String, down: Bool) {
        guard canBecomeFirstResponder else { return }
        if down {
            if key?(symbol,true) == true { agentHeld.insert(symbol); lastInputWasHardware = true }
        } else if agentHeld.remove(symbol) != nil { _ = key?(symbol,false) }
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
        // A cancelled paddle is a key-up. Let its timed element and the other paddle finish.
        let other = route(presses, down: false, cancelStraight: true)
        if !other.isEmpty { super.pressesCancelled(other, with: event) }
    }
    override func accessibilityActivate() -> Bool {
        // VoiceOver activation supplies a dit without synthesizing a held gesture.
        guard enabled, key?(".", true) == true else { return false }
        lastInputWasHardware = false
        _ = key?(".", false)
        return true
    }
}

private final class DitKey: ExactNativeInstance, @unchecked Sendable {
    private let input = DitInputView()
    private let clock: ExactModuleContext
    private let submittedPassword: () -> String?
    private lazy var audio = DitSidetone()
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

    init(clock: ExactModuleContext, events: ExactNativeEvents, submittedPassword: @escaping () -> String?) {
        self.submittedPassword = submittedPassword
        self.clock = clock
        super.init(events: events)
        input.waveMeter.level = { [weak self] in self?.audio.waveLevel() ?? 0 }
        input.backgroundColor = .clear
        input.isAccessibilityElement = true
        input.accessibilityIdentifier = "dit-native-morse-key"
        input.accessibilityLabel = "Tap for dot, hold for dah"
        input.accessibilityUserInputLabels = ["Morse key", "Tap for dot, hold for dah"]
        input.accessibilityTraits = .button
        input.key = { [weak self] symbol, down in self?.signal.key(symbol, down: down) == true }
        input.cancelHardware = { [weak self] in self?.signal.cancel() }
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
                        fixture.resetMessage = { [weak self] message in self?.events.message(message) }
                        fixture.deletionResult = { [weak self] result in
                            self?.events.message("account-deletion:" + result)
                        }
                        fixture.presentation = { [weak self, weak fixture] email in
                            if fixture?.appleSignInAvailable == true {
                                self?.events.message("fixture-apple:available")
                            }
                            if fixture?.googleSignInAvailable == true {
                                self?.events.message("fixture-google:available")
                            }
                            self?.events.message("fixture-learners:" + (fixture?.availableLearners ?? ""))
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
                            self.audio.startPassage(plan, pitch: pitch, gap: gap, volume: self.signal.volume, unitMs: self.signal.unit)
                        }
                    }, passageControl: { [weak self] action in
                        guard let self else { return false }
                        return self.signal.controlPassage(action) { self.audio.passage?.control(action) == true }
                    },
                    passagePosition: { [weak self] in self?.audio.passage?.position() ?? -1 },
                    promptTailMs: { [weak self] in self?.audio.promptTailMs($0) },
                    stop: { [weak self] in self?.signal.stopReplay() }, warm: { [weak self] in _ = self?.audio.warm() },
                    cancelInput: { [weak self] in self?.cancel() },
                    configure: { [weak self] enabled, hardware, unit, pitch, haptics in self?.configure(enabled, hardware: hardware, unit: unit, pitch: pitch, haptics: haptics) },
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
    override var focusTarget: ExactNativeView? { input.canBecomeFirstResponder ? input : nil }

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
            if props["email-sheet-open"] != "true" { fixtureAccounts.cancelEmail() }
            let previous = fixtureCommandToken
            fixtureCommandToken = token
            if let previous, previous != token, let action = props["account-action"] {
                if action == "apple-signin" {
                    let result = fixtureAccounts.submitApple()
                    events.message("apple-result:" + token + ":" + result)
                } else if action == "google-signin" {
                    let result = fixtureAccounts.submitGoogle()
                    events.message("google-result:" + token + ":" + result)
                } else if action == "email-signin" || action == "email-signup" {
                    if props["email-sheet-open"] == "true" {
                        let create = action == "email-signup"
                        let reply: (String) -> Void = { [weak self] message in
                            self?.events.message("email-result:" + token + ":" + message)
                        }
                        if let password = submittedPassword(), !password.isEmpty {
                            fixtureAccounts.submitEmail(create:create,address:props["submitted-address"] ?? "",
                                                        password:password,done:reply)
                        } else {
                            reply(create ? "We could not create your account. Please try again." : "We could not sign you in. Please try again.")
                        }
                    }
                } else { fixtureAccounts.choose(action) }
            }
        }
        #endif
        session?.setProps(props)
    }

    private func publishPowerMode() {
        events.message(ProcessInfo.processInfo.isLowPowerModeEnabled ? "low-power:on" : "low-power:off")
    }

    private func configure(_ enabled: Bool, hardware: Bool, unit: Double, pitch: Float, haptics: Bool) {
        signal.unit = unit
        signal.frequency = pitch
        signal.setHaptics(haptics)
        let changed = enabled == signal.blocked
        signal.blocked = !enabled
        input.setEligibility(enabled, hardware:hardware)
        input.isAccessibilityElement = enabled
        input.accessibilityTraits = enabled ? .button : [.button, .notEnabled]
        if changed && !enabled { cancel() }
    }

    private func interrupt(_ source: String, _ began: Bool) {
        if began { interruptions.insert(source) } else { interruptions.remove(source) }
        if began { input.resetTouch() }
        signal.setSuspended(!interruptions.isEmpty)
        session?.interrupt(!interruptions.isEmpty, applicationInactive: interruptions.contains("application"))
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
        if phase != "up" { input.agentKey(symbol, down:true) }
        if phase != "down" { input.agentKey(symbol, down:false) }
    }

    private func cancel() {
        signal.cancel()
        input.resetTouch()
    }

    override func destroy() {
        destroyed = true
        #if targetEnvironment(simulator)
        fixtureAccounts?.cancelEmail()
        #endif
        volumeObserver = nil
        boot?.stop()
        session?.close()
        session = nil
        signal.destroy()
        input.resetTouch()
        audio.shutdown()
        input.setEligibility(false, hardware:false)
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers.removeAll()
    }
}
#endif

private final class DitPracticeModule: ExactModule {
    #if os(iOS)
    private weak var passwordElement: ExactElement?
    override func element(_ element: ExactElement) {
        if element.hatch == .ditEmailPassword { passwordElement = element }
    }
    override func elementEnded(_ element: ExactElement) {
        if element === passwordElement { passwordElement = nil }
    }

    override class var views: [String: ExactNativeFactory] {
        ["dit-key": ExactNativeFactory(for: DitPracticeModule.self) { module, props, events in
            let key = DitKey(clock: module.context, events: events) { [weak module] in
                (module?.passwordElement?.platform as? UITextField)?.text
            }
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
